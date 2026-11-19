import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { WebView } from 'react-native-webview';

/* -------------------------------------------------------------------------- */
/*  Design tokens (same as the other screens)                                 */
/* -------------------------------------------------------------------------- */

const COLORS = {
    blue: '#1683C5',
    charcoal: '#292D32',
    paleBlue: '#E8F5FC',
    white: '#FFFFFF',
    muted: '#6B7280',
    border: '#E4E8EC',
    green: '#16A34A',
    red: '#D92D20',
    grey: '#9CA3AF',
    playerDark: '#1B1F24',
};

const FONTS = {
    heading: 'Fredoka_600SemiBold',
    serif: 'PlayfairDisplay_500Medium',
    body: 'Nunito_400Regular',
    bodyMedium: 'Nunito_600SemiBold',
    bodyBold: 'Nunito_700Bold',
};

/* -------------------------------------------------------------------------- */
/*  Types (unchanged)                                                         */
/* -------------------------------------------------------------------------- */

type Child = {
    id: string;
    relationshipId: string;
    schoolId: string;
    name: string;
    admissionNumber: string;
    classId: string | null;
    className: string;
    schoolName: string;
    avatarUrl: string | null;
};

type Camera = {
    id: string;
    name: string;
    location: string | null;
    status: string;
    enabled: boolean;
    classId: string | null;
};

type Announcement = {
    id: string;
    title: string;
    body: string;
    publishedAt: string | null;
};

type AccessState = {
    cameras: Camera[];
    liveViewingEnabled: boolean;
    settingsAvailable: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Helpers (unchanged)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Normalize UUIDs returned by Supabase before using them in filters.
 * This prevents whitespace in stored or returned values from reaching
 * PostgreSQL UUID comparisons.
 */
function cleanUuid(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
        throw new Error(`Invalid ${fieldName}: expected a UUID.`);
    }

    const normalized = value.trim();

    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(normalized)) {
        throw new Error(`Invalid ${fieldName}: ${normalized || '(empty value)'}.`);
    }

    return normalized;
}

function cleanNullableUuid(
    value: unknown,
    fieldName: string,
): string | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    return cleanUuid(value, fieldName);
}

function formatTime(value: string | null) {
    if (!value) return 'Not available';

    return new Date(value).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatAnnouncementDate(value: string | null) {
    if (!value) return '';

    return new Date(value).toLocaleString([], {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/*
 * Streaming page loaded inside the WebView.
 * Only the colours changed (neutral charcoal instead of navy).
 * All WebRTC / WHEP logic is identical to the original.
 */
function buildWhepHtml(endpoint: string, token: string) {
    const safeEndpoint = JSON.stringify(endpoint);
    const safeToken = JSON.stringify(token);

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #1B1F24;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #1B1F24;
    }
    #message {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #E5E7EB;
      font: 14px Arial, sans-serif;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="message">Preparing secure classroom connection…</div>
  <video id="video" autoplay playsinline muted controls></video>

  <script>
    (function () {
      const endpoint = ${safeEndpoint};
      const token = ${safeToken};
      const video = document.getElementById('video');
      const message = document.getElementById('message');

      let peer = null;
      let resourceUrl = null;
      let closed = false;

      const headers = {
        Authorization: 'Bearer ' + token
      };

      function notify(type, detail) {
        try {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type, detail: detail || '' })
          );
        } catch (_) {}
      }

      function showError(text) {
        if (closed) return;

        message.style.display = 'flex';
        message.textContent = text;
        notify('error', text);
      }

      function waitForIceGathering(pc) {
        return new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
            return;
          }

          let finished = false;

          const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          };

          const check = () => {
            if (pc.iceGatheringState === 'complete') {
              finish();
            }
          };

          const timeout = setTimeout(() => {
            notify('status', 'Using available network candidates…');
            finish();
          }, 8000);

          pc.addEventListener('icegatheringstatechange', check);
          check();
        });
      }

      async function start() {
        try {
          notify('status', 'Preparing video connection…');

          peer = new RTCPeerConnection({
            iceServers: [
              {
                urls: 'stun:stun.l.google.com:19302'
              }
            ]
          });

          peer.addTransceiver('video', {
            direction: 'recvonly'
          });

          peer.ontrack = function (event) {
            if (event.streams && event.streams[0]) {
              video.srcObject = event.streams[0];
            }
          };

          video.onplaying = function () {
            message.style.display = 'none';
            notify('connected');
          };

          video.onerror = function () {
            showError('The classroom video could not be played.');
          };

          peer.oniceconnectionstatechange = function () {
            if (!peer || closed) return;

            const state = peer.iceConnectionState;

            notify('status', 'Video network: ' + state);

            if (state === 'failed') {
              showError(
                'The video network connection failed. Check the hotspot connection and WebRTC firewall access.'
              );
            } else if (state === 'disconnected') {
              notify('disconnected');
            }
          };

          peer.onconnectionstatechange = function () {
            if (!peer || closed) return;

            if (peer.connectionState === 'failed') {
              showError('The classroom video connection failed.');
            }
          };

          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);

          notify('status', 'Gathering network connection details…');

          await waitForIceGathering(peer);

          if (closed) return;

          notify('status', 'Contacting classroom video server…');

          const controller = new AbortController();

          const requestTimeout = setTimeout(
            () => controller.abort(),
            15000
          );

          let response;

          try {
            response = await fetch(endpoint, {
              method: 'POST',
              headers: Object.assign({}, headers, {
                'Content-Type': 'application/sdp',
                'Accept': 'application/sdp'
              }),
              body: peer.localDescription.sdp,
              signal: controller.signal
            });
          } finally {
            clearTimeout(requestTimeout);
          }

          if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(
              'Video server rejected playback (' +
              response.status +
              '). ' +
              body.slice(0, 180)
            );
          }

          const location = response.headers.get('Location');

          if (location) {
            resourceUrl = /^https?:\\/\\//i.test(location)
              ? location
              : new URL(location, endpoint).toString();
          }

          const answer = await response.text();

          await peer.setRemoteDescription({
            type: 'answer',
            sdp: answer
          });

          notify('status', 'Waiting for classroom video…');

        } catch (error) {
          if (!closed) {
            const messageText =
              error && error.name === 'AbortError'
                ? 'The video server did not respond in time. Check the phone hotspot connection.'
                : error && error.message
                  ? error.message
                  : 'Unable to start classroom video.';

            showError(messageText + ' (' + endpoint + ')');
          }
        }
      }

      async function stop() {
        closed = true;

        if (peer) {
          peer.ontrack = null;
          peer.close();
          peer = null;
        }

        video.srcObject = null;

        if (resourceUrl) {
          try {
            await fetch(resourceUrl, {
              method: 'DELETE',
              headers
            });
          } catch (_) {}

          resourceUrl = null;
        }
      }

      window.addEventListener('pagehide', stop);

      start();
    })();
  </script>
</body>
</html>`;
}


function buildWhepEndpoint(streamPath: string) {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

    if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_API_URL is missing.');
    }

    const { hostname } = new URL(apiUrl);

    return `http://${hostname}:8889/${encodeURIComponent(streamPath)}/whep`;
}


/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

type IconName =
    | 'bell'
    | 'chevronDown'
    | 'chevronUp'
    | 'check'
    | 'refresh'
    | 'video'
    | 'announce'
    | 'class'
    | 'camera'
    | 'school'
    | 'clock'
    | 'shield';

function Icon({
    name,
    size = 22,
    color = COLORS.blue,
}: {
    name: IconName;
    size?: number;
    color?: string;
}) {
    const common = {
        fill: 'none',
        stroke: color,
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    };

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            {name === 'bell' && (
                <>
                    <Path
                        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                        {...common}
                    />
                    <Path d="M10 21h4" {...common} />
                </>
            )}
            {name === 'chevronDown' && <Path d="M6 9l6 6 6-6" {...common} />}
            {name === 'chevronUp' && <Path d="M18 15l-6-6-6 6" {...common} />}
            {name === 'check' && <Path d="M20 6L9 17l-5-5" {...common} />}
            {name === 'refresh' && (
                <>
                    <Path d="M23 4v6h-6" {...common} />
                    <Path d="M1 20v-6h6" {...common} />
                    <Path
                        d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                        {...common}
                    />
                </>
            )}
            {name === 'video' && (
                <>
                    <Polygon points="23 7 16 12 23 17 23 7" {...common} />
                    <Rect x={1} y={5} width={15} height={14} rx={2} ry={2} {...common} />
                </>
            )}
            {name === 'announce' && (
                <>
                    <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" {...common} />
                    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" {...common} />
                    <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" {...common} />
                </>
            )}
            {name === 'class' && (
                <>
                    <Rect x={3} y={4} width={18} height={12} rx={2} {...common} />
                    <Path d="M8 20h8M12 16v4" {...common} />
                </>
            )}
            {name === 'camera' && (
                <>
                    <Path
                        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                        {...common}
                    />
                    <Circle cx={12} cy={13} r={4} {...common} />
                </>
            )}
            {name === 'school' && (
                <>
                    <Path d="M3 21h18" {...common} />
                    <Path d="M5 21V7l7-4 7 4v14" {...common} />
                    <Path d="M9 21v-6h6v6" {...common} />
                </>
            )}
            {name === 'clock' && (
                <>
                    <Circle cx={12} cy={12} r={10} {...common} />
                    <Path d="M12 6v6l4 2" {...common} />
                </>
            )}
            {name === 'shield' && (
                <>
                    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...common} />
                    <Path d="M9 12l2 2 4-4" {...common} />
                </>
            )}
        </Svg>
    );
}

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: IconName;
    label: string;
    value: string;
}) {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoIconCircle}>
                <Icon name={icon} size={18} />
            </View>
            <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                    {value}
                </Text>
            </View>
        </View>
    );
}

function SectionHeader({
    title,
    actionLabel,
    onActionPress,
}: {
    title: string;
    actionLabel?: string;
    onActionPress?: () => void;
}) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>

            {actionLabel && onActionPress ? (
                <Pressable
                    onPress={onActionPress}
                    hitSlop={10}
                    style={styles.sectionAction}
                >
                    <Text style={styles.sectionActionText}>{actionLabel}</Text>
                    <Svg width={18} height={18} viewBox="0 0 24 24">
                        <Path
                            d="M9 18l6-6-6-6"
                            fill="none"
                            stroke={COLORS.blue}
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </Pressable>
            ) : null}
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function LiveMonitoringScreen() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [parentName, setParentName] = useState('');
    const [parentAvatar, setParentAvatar] = useState<string | null>(null);

    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [showChildren, setShowChildren] = useState(false);

    const [access, setAccess] = useState<AccessState>({
        cameras: [],
        liveViewingEnabled: false,
        settingsAvailable: false,
    });

    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const selectedChild = useMemo(
        () => children.find((child) => child.id === selectedChildId) ?? null,
        [children, selectedChildId],
    );

    const selectedCamera = useMemo(() => {
        if (!selectedChild) return null;

        return access.cameras.find(
            (camera) =>
                camera.classId === selectedChild.classId ||
                camera.classId === null,
        ) ?? null;
    }, [access.cameras, selectedChild]);

    const [playbackSession, setPlaybackSession] = useState<{
        sessionId: string;
        streamPath: string;
        playbackToken: string;
        expiresAt: string;
    } | null>(null);

    const [playbackLoading, setPlaybackLoading] = useState(false);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [playbackStatus, setPlaybackStatus] = useState('');
    const [playbackRetry, setPlaybackRetry] = useState(0);

    /* ---------------------------- Data (unchanged) ---------------------------- */

    const refreshData = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                setChildren([]);
                setSelectedChildId(null);
                setAccess({
                    cameras: [],
                    liveViewingEnabled: false,
                    settingsAvailable: false,
                });
                setAnnouncement(null);
                setError('Please sign in to view your classrooms.');
                return;
            }

            const userId = cleanUuid(user.id, 'signed-in parent ID');

            // Parent profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', userId)
                .maybeSingle();

            setParentName(profile?.full_name ?? '');
            setParentAvatar(profile?.avatar_url ?? null);

            // Only approved parent-child relationships are eligible.
            const { data: relationships, error: relationshipError } =
                await supabase
                    .from('parent_students')
                    .select('id, student_id, school_id, status')
                    .eq('parent_id', userId)
                    .eq('status', 'approved');

            if (relationshipError) throw relationshipError;

            // Normalize every relationship UUID before using it in queries.
            const relationshipRows = (relationships ?? []).map((item) => ({
                ...item,
                id: cleanUuid(item.id, 'parent-child relationship ID'),
                student_id: cleanUuid(item.student_id, 'relationship student ID'),
                school_id: cleanUuid(item.school_id, 'relationship school ID'),
            }));

            if (relationshipRows.length === 0) {
                setChildren([]);
                setSelectedChildId(null);
                setAccess({
                    cameras: [],
                    liveViewingEnabled: false,
                    settingsAvailable: false,
                });
                setAnnouncement(null);
                setLastUpdated(new Date().toISOString());
                return;
            }

            const studentIds = [
                ...new Set(relationshipRows.map((item) => item.student_id)),
            ];

            const schoolIds = [
                ...new Set(relationshipRows.map((item) => item.school_id)),
            ];

            // Fetch student records. Retry without avatar_url if that optional
            // column has not yet been added to the database.
            let studentRows: any[] = [];

            const studentQuery = await supabase
                .from('students')
                .select(
                    'id, school_id, full_name, admission_number, class_id, avatar_url',
                )
                .in('id', studentIds);

            if (studentQuery.error) {
                const fallbackQuery = await supabase
                    .from('students')
                    .select(
                        'id, school_id, full_name, admission_number, class_id',
                    )
                    .in('id', studentIds);

                if (fallbackQuery.error) throw fallbackQuery.error;
                studentRows = fallbackQuery.data ?? [];
            } else {
                studentRows = studentQuery.data ?? [];
            }

            // Normalize student IDs and class IDs before using them in filters.
            studentRows = studentRows.map((student) => ({
                ...student,
                id: cleanUuid(student.id, 'student ID'),
                school_id: cleanUuid(student.school_id, 'student school ID'),
                class_id: cleanNullableUuid(student.class_id, 'student class ID'),
            }));

            const classIds = [
                ...new Set(
                    studentRows
                        .map((student) => student.class_id)
                        .filter((id): id is string => Boolean(id)),
                ),
            ];

            const { data: rawClassRows, error: classError } = classIds.length
                ? await supabase
                    .from('classes')
                    .select('id, name')
                    .in('id', classIds)
                : { data: [], error: null };

            if (classError) throw classError;

            const classRows = (rawClassRows ?? []).map((item) => ({
                ...item,
                id: cleanUuid(item.id, 'class ID'),
            }));

            const { data: rawSchoolRows, error: schoolError } = await supabase
                .from('schools')
                .select('id, name')
                .in('id', schoolIds);

            if (schoolError) throw schoolError;

            const schoolRows = (rawSchoolRows ?? []).map((item) => ({
                ...item,
                id: cleanUuid(item.id, 'school ID'),
            }));

            const mappedChildren: Child[] = relationshipRows
                .map((relationship) => {
                    const student = studentRows.find(
                        (item) => item.id === relationship.student_id,
                    );

                    if (!student) return null;

                    const classRecord = classRows.find(
                        (item) => item.id === student.class_id,
                    );

                    const school = schoolRows.find(
                        (item) => item.id === relationship.school_id,
                    );

                    return {
                        id: student.id,
                        relationshipId: relationship.id,
                        schoolId: relationship.school_id,
                        name: student.full_name,
                        admissionNumber: student.admission_number,
                        classId: student.class_id,
                        className: classRecord?.name ?? 'Class not assigned',
                        schoolName: school?.name ?? 'School',
                        avatarUrl: student.avatar_url ?? null,
                    };
                })
                .filter((item): item is Child => item !== null);

            setChildren(mappedChildren);

            const activeChildId = mappedChildren.some(
                (child) => child.id === selectedChildId,
            )
                ? selectedChildId
                : mappedChildren[0]?.id ?? null;

            setSelectedChildId(activeChildId);

            if (!activeChildId) {
                setLastUpdated(new Date().toISOString());
                return;
            }

            const activeChild = mappedChildren.find(
                (child) => child.id === activeChildId,
            );

            if (!activeChild) return;

            // Camera grants belong to a specific approved parent-child link.
            const relationshipId = cleanUuid(
                activeChild.relationshipId,
                'camera grant relationship ID',
            );

            const { data: grants, error: grantError } = await supabase
                .from('camera_access')
                .select(
                    'id, camera_id, parent_student_id, expires_at, revoked_at',
                )
                .in('parent_student_id', [relationshipId])
                .is('revoked_at', null);

            if (grantError) throw grantError;

            // Normalize grant UUIDs before matching or querying cameras.
            const normalizedGrants = (grants ?? []).map((grant) => ({
                ...grant,
                id: cleanUuid(grant.id, 'camera grant ID'),
                camera_id: cleanUuid(grant.camera_id, 'granted camera ID'),
                parent_student_id: cleanUuid(
                    grant.parent_student_id,
                    'camera grant relationship ID',
                ),
            }));

            const now = Date.now();

            const validGrants = normalizedGrants.filter(
                (grant) =>
                    !grant.expires_at ||
                    new Date(grant.expires_at).getTime() > now,
            );

            const cameraIds = [
                ...new Set(validGrants.map((grant) => grant.camera_id)),
            ];

            const { data: rawCameraRows, error: cameraError } = cameraIds.length
                ? await supabase
                    .from('cameras')
                    .select('id, name, location, status, is_enabled, class_id')
                    .in('id', cameraIds)
                : { data: [], error: null };

            if (cameraError) throw cameraError;

            const cameraRows = (rawCameraRows ?? []).map((camera) => ({
                ...camera,
                id: cleanUuid(camera.id, 'camera ID'),
                class_id: cleanNullableUuid(camera.class_id, 'camera class ID'),
            }));

            const mappedCameras: Camera[] = cameraRows
                .filter((camera) =>
                    validGrants.some(
                        (grant) =>
                            grant.camera_id === camera.id &&
                            grant.parent_student_id === relationshipId,
                    ),
                )
                .map((camera) => ({
                    id: camera.id,
                    name: camera.name,
                    location: camera.location,
                    status: camera.status,
                    enabled: camera.is_enabled,
                    classId: camera.class_id,
                }));

            // The school setting is checked independently of camera grants.
            const { data: settings, error: settingsError } = await supabase
                .from('school_settings')
                .select('live_viewing_enabled')
                .eq('school_id', activeChild.schoolId)
                .maybeSingle();

            if (settingsError) throw settingsError;

            setAccess({
                cameras: mappedCameras,
                liveViewingEnabled: settings?.live_viewing_enabled === true,
                settingsAvailable: settings !== null,
            });

            // Announcements are scoped to the selected child's school.
            let announcementQuery = supabase
                .from('announcements')
                .select('id, title, body, published_at')
                .eq('school_id', activeChild.schoolId)
                .not('published_at', 'is', null)
                .order('published_at', { ascending: false })
                .limit(10);

            if (activeChild.classId) {
                const classId = cleanUuid(
                    activeChild.classId,
                    'announcement class ID',
                );

                // Important: no trailing space after the UUID.
                announcementQuery = announcementQuery.or(
                    `class_id.is.null,class_id.eq.${classId}`,
                );
            } else {
                announcementQuery = announcementQuery.is('class_id', null);
            }

            const { data: announcementRows, error: announcementError } =
                await announcementQuery;

            if (announcementError) throw announcementError;

            const latest = (announcementRows ?? [])[0];

            setAnnouncement(
                latest
                    ? {
                        id: latest.id,
                        title: latest.title,
                        body: latest.body,
                        publishedAt: latest.published_at,
                    }
                    : null,
            );

            setLastUpdated(new Date().toISOString());
        } catch (err) {
            console.error('Live screen loading error:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load your classroom information.',
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedChildId]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const chooseChild = (childId: string) => {
        setSelectedChildId(cleanUuid(childId, 'selected student ID'));
        setShowChildren(false);
    };

    const cameraIsOnline =
        selectedCamera?.status?.toLowerCase() === 'online';

    const cameraCanBeViewed =
        !!selectedCamera &&
        selectedCamera.enabled &&
        cameraIsOnline &&
        access.liveViewingEnabled &&
        access.settingsAvailable;

    /* --------------------- Playback authorisation (unchanged) --------------------- */

    useEffect(() => {
        let cancelled = false;
        const camera = selectedCamera;
        const child = selectedChild;

        const connectPlayback = async () => {
            setPlaybackSession(null);
            setPlaybackError(null);

            if (!cameraCanBeViewed || !camera || !child) {
                setPlaybackLoading(false);
                setPlaybackStatus('');
                return;
            }

            setPlaybackLoading(true);
            setPlaybackStatus('Requesting secure playback access…');

            try {
                const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');

                if (!apiUrl) {
                    throw new Error(
                        'The SchoolView API address is missing. Check EXPO_PUBLIC_API_URL in your app .env file.',
                    );
                }

                const apiOrigin = new URL(apiUrl);

                const cameraId = cleanUuid(camera.id, 'playback camera ID');
                const parentStudentId = cleanUuid(
                    child.relationshipId,
                    'playback parent-child relationship ID',
                );

                const {
                    data: { session },
                    error: sessionError,
                } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (!session?.access_token) {
                    throw new Error(
                        'Your login session has expired. Please sign in again.',
                    );
                }

                // Fixed URL: the previous version contained spaces around
                // /api/cameras and the camera ID.
                const playbackUrl =
                    `${apiOrigin.origin}/api/cameras/${cameraId}/playback`;

                const response = await fetch(playbackUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        parentStudentId,
                    }),
                });

                const result = await response.json().catch(() => null);

                if (!response.ok || !result?.success) {
                    throw new Error(
                        result?.message ||
                        `Unable to authorize playback (${response.status}).`,
                    );
                }

                if (cancelled) return;

                if (
                    typeof result.sessionId !== 'string' ||
                    typeof result.streamPath !== 'string' ||
                    typeof result.playbackToken !== 'string' ||
                    typeof result.expiresAt !== 'string'
                ) {
                    throw new Error(
                        'The playback service returned an incomplete session.',
                    );
                }

                setPlaybackSession({
                    sessionId: result.sessionId,
                    streamPath: result.streamPath,
                    playbackToken: result.playbackToken,
                    expiresAt: result.expiresAt,
                });

                setPlaybackStatus('Opening secure classroom video…');
            } catch (err) {
                if (!cancelled) {
                    setPlaybackError(
                        err instanceof Error
                            ? err.message
                            : 'Unable to connect to the classroom stream.',
                    );
                    setPlaybackStatus('');
                }
            } finally {
                if (!cancelled) setPlaybackLoading(false);
            }
        };

        connectPlayback();

        return () => {
            cancelled = true;
        };
    }, [
        cameraCanBeViewed,
        selectedCamera?.id,
        selectedChild?.relationshipId,
        access.cameras,
        playbackRetry,
    ]);

    let cameraMessage = 'No classroom camera access has been granted yet.';

    if (!access.settingsAvailable) {
        cameraMessage = 'School live-viewing settings are unavailable.';
    } else if (!access.liveViewingEnabled) {
        cameraMessage = 'Live viewing is currently disabled by your school.';
    } else if (!selectedCamera) {
        cameraMessage = 'Your school has not granted camera access for this child yet.';
    } else if (!selectedCamera.enabled) {
        cameraMessage = 'This classroom camera has been disabled by the school.';
    } else if (!cameraIsOnline) {
        cameraMessage = `Camera status: ${selectedCamera.status}.`;
    } else if (cameraCanBeViewed) {
        cameraMessage =
            'Your camera access is verified. Connecting to the secure classroom stream.';
    }

    /* ------------------------------ Status indicator ------------------------------ */

    // Green  = camera online and available to watch
    // Red    = camera offline, disabled, or the connection failed
    // Grey   = no camera / viewing not available / not yet known
    let statusColor = COLORS.grey;
    let statusLabel = 'Camera unavailable';
    let statusWord = 'Unavailable';

    if (selectedCamera) {
        if (cameraCanBeViewed && !playbackError) {
            statusColor = COLORS.green;
            statusLabel = 'Camera online';
            statusWord = 'Online';
        } else if (
            !selectedCamera.enabled ||
            !cameraIsOnline ||
            playbackError
        ) {
            statusColor = COLORS.red;
            statusLabel = playbackError
                ? 'Camera disconnected'
                : 'Camera offline';
            statusWord = playbackError ? 'Disconnected' : 'Offline';
        }
    }

    const cameraTitle = selectedCamera
        ? selectedCamera.name
        : 'Classroom camera';

    const cameraLocation = selectedCamera?.location ?? '';

    /* -------------------------------- Render -------------------------------- */

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Page header */}
            <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.pageTitle}>Live Monitoring</Text>
                    <Text style={styles.pageSubtitle} numberOfLines={1}>
                        Watch your child's classroom live
                    </Text>
                </View>

                <View style={styles.headerActions}>
                    <Pressable
                        style={styles.iconButton}
                        onPress={() =>
                            router.push('/(parent)/profile/notifications')
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Open notifications"
                    >
                        <Icon name="bell" size={24} />
                    </Pressable>

                    <Pressable
                        style={styles.avatarButton}
                        onPress={() => router.push('/(parent)/profile')}
                        accessibilityRole="button"
                        accessibilityLabel="Open profile"
                    >
                        {parentAvatar ? (
                            <Image
                                source={{ uri: parentAvatar }}
                                style={styles.avatarImage}
                                contentFit="cover"
                            />
                        ) : (
                            <Text style={styles.avatarInitial}>
                                {parentName.charAt(0).toUpperCase() || 'P'}
                            </Text>
                        )}
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => refreshData(true)}
                        tintColor={COLORS.blue}
                    />
                }
            >
                {loading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator size="large" color={COLORS.blue} />
                        <Text style={styles.stateText}>
                            Loading your classroom information...
                        </Text>
                    </View>
                ) : error ? (
                    <View style={styles.stateCard}>
                        <Text style={styles.stateTitle}>
                            Unable to load live classrooms
                        </Text>
                        <Text style={styles.stateText}>{error}</Text>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={() => refreshData(true)}
                        >
                            <Text style={styles.primaryButtonText}>
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : children.length === 0 ? (
                    <View style={styles.stateCard}>
                        <View style={styles.stateIconCircle}>
                            <Icon name="video" size={26} />
                        </View>
                        <Text style={styles.stateTitle}>
                            No approved children yet
                        </Text>
                        <Text style={styles.stateText}>
                            Your linked children will appear here after the
                            school approves your parent-child registration.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Child selector */}
                        <Pressable
                            style={styles.childSelector}
                            onPress={() =>
                                setShowChildren((previous) => !previous)
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Choose child"
                        >
                            <View style={styles.childAvatar}>
                                {selectedChild?.avatarUrl ? (
                                    <Image
                                        source={{ uri: selectedChild.avatarUrl }}
                                        style={styles.childImage}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <Text style={styles.childInitial}>
                                        {selectedChild?.name
                                            .charAt(0)
                                            .toUpperCase()}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.childDetails}>
                                <Text style={styles.childName} numberOfLines={1}>
                                    {selectedChild?.name}
                                </Text>
                                <Text style={styles.childMeta} numberOfLines={1}>
                                    {selectedChild?.schoolName} •{' '}
                                    {selectedChild?.className}
                                </Text>
                            </View>

                            <Icon
                                name={showChildren ? 'chevronUp' : 'chevronDown'}
                                size={22}
                                color={COLORS.charcoal}
                            />
                        </Pressable>

                        {showChildren && (
                            <View style={styles.childOptions}>
                                {children.map((child) => (
                                    <Pressable
                                        key={child.id}
                                        style={styles.childOption}
                                        onPress={() => chooseChild(child.id)}
                                    >
                                        <View style={styles.optionAvatar}>
                                            {child.avatarUrl ? (
                                                <Image
                                                    source={{ uri: child.avatarUrl }}
                                                    style={styles.childImage}
                                                    contentFit="cover"
                                                />
                                            ) : (
                                                <Text style={styles.optionInitial}>
                                                    {child.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.childDetails}>
                                            <Text
                                                style={styles.optionName}
                                                numberOfLines={1}
                                            >
                                                {child.name}
                                            </Text>
                                            <Text
                                                style={styles.childMeta}
                                                numberOfLines={1}
                                            >
                                                {child.className}
                                            </Text>
                                        </View>
                                        {child.id === selectedChildId && (
                                            <Icon name="check" size={20} />
                                        )}
                                    </Pressable>
                                ))}
                            </View>
                        )}

                        {/* Camera heading */}
                        <View style={styles.cameraHeading}>
                            <View style={styles.cameraHeadingText}>
                                <Text style={styles.cameraTitle} numberOfLines={1}>
                                    {cameraTitle}
                                </Text>
                                {cameraLocation ? (
                                    <Text
                                        style={styles.cameraLocation}
                                        numberOfLines={1}
                                    >
                                        {cameraLocation}
                                    </Text>
                                ) : null}
                            </View>
                        </View>

                        {/* Video player */}
                        <View style={styles.playerFrame}>
                            {cameraCanBeViewed && playbackSession ? (
                                <WebView
                                    key={`${playbackSession.sessionId}-${playbackRetry}`}
                                    source={{
                                        html: buildWhepHtml(
                                            buildWhepEndpoint(playbackSession.streamPath),
                                            playbackSession.playbackToken,
                                        ),
                                    }}
                                    style={styles.videoPlayer}
                                    originWhitelist={['*']}
                                    javaScriptEnabled
                                    domStorageEnabled
                                    allowsInlineMediaPlayback
                                    mediaPlaybackRequiresUserAction={false}
                                    mixedContentMode="always"
                                    allowsFullscreenVideo
                                    onMessage={(event) => {
                                        try {
                                            const message = JSON.parse(
                                                event.nativeEvent.data,
                                            );

                                            if (message.type === 'connected') {
                                                setPlaybackStatus(
                                                    'Live classroom video connected.',
                                                );
                                                setPlaybackError(null);
                                            } else if (message.type === 'status') {
                                                setPlaybackStatus(
                                                    message.detail ||
                                                    'Connecting to classroom video…',
                                                );
                                            } else if (message.type === 'error') {
                                                setPlaybackError(
                                                    message.detail ||
                                                    'The video connection failed.',
                                                );
                                                setPlaybackStatus('');
                                                setPlaybackSession(null);
                                            } else if (message.type === 'disconnected') {
                                                setPlaybackStatus(
                                                    'Video connection interrupted.',
                                                );
                                            }
                                        } catch {
                                            // Ignore non-JSON WebView messages.
                                        }
                                    }}
                                    onError={() => {
                                        setPlaybackError(
                                            'Unable to load the secure video player. Check your Wi-Fi connection.',
                                        );
                                        setPlaybackSession(null);
                                    }}
                                    onHttpError={(event) => {
                                        setPlaybackError(
                                            `Video player request failed (${event.nativeEvent.statusCode}).`,
                                        );
                                        setPlaybackSession(null);
                                    }}
                                />
                            ) : (
                                <View style={styles.videoPlaceholder}>
                                    <View style={styles.videoIconCircle}>
                                        {playbackLoading ? (
                                            <ActivityIndicator
                                                color={COLORS.blue}
                                                size="large"
                                            />
                                        ) : (
                                            <Icon name="video" size={28} />
                                        )}
                                    </View>

                                    <Text style={styles.videoTitle}>
                                        {playbackLoading
                                            ? 'Connecting to classroom…'
                                            : cameraCanBeViewed
                                                ? 'Unable to start video'
                                                : 'Classroom stream unavailable'}
                                    </Text>

                                    <Text style={styles.videoDescription}>
                                        {playbackError || cameraMessage}
                                    </Text>

                                    <Text style={styles.videoFootnote}>
                                        {playbackStatus ||
                                            'Your classroom video is protected by a temporary, private playback session.'}
                                    </Text>

                                    {cameraCanBeViewed && !playbackLoading && (
                                        <Pressable
                                            style={styles.retryButton}
                                            onPress={() =>
                                                setPlaybackRetry((value) => value + 1)
                                            }
                                        >
                                            <Text style={styles.retryButtonText}>
                                                Retry connection
                                            </Text>
                                        </Pressable>
                                    )}
                                </View>
                            )}

                            {/* Small status dot, top-right of the player */}
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: statusColor },
                                ]}
                                accessible
                                accessibilityLabel={statusLabel}
                                pointerEvents="none"
                            />
                        </View>

                        {/* Controls */}
                        <Pressable
                            style={[
                                styles.refreshButton,
                                refreshing && styles.refreshButtonDisabled,
                            ]}
                            onPress={() => refreshData(true)}
                            disabled={refreshing}
                            accessibilityRole="button"
                            accessibilityLabel="Refresh stream"
                        >
                            {refreshing ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Icon name="refresh" size={20} color={COLORS.white} />
                            )}
                            <Text style={styles.refreshButtonText}>
                                {refreshing ? 'Refreshing...' : 'Refresh Stream'}
                            </Text>
                        </Pressable>

                        {/* Classroom details */}
                        <SectionHeader title="Classroom Details" />

                        <View style={styles.detailsCard}>
                            <InfoRow
                                icon="class"
                                label="Classroom"
                                value={selectedChild?.className ?? ''}
                            />
                            <View style={styles.rowDivider} />
                            <InfoRow
                                icon="camera"
                                label="Camera"
                                value={
                                    selectedCamera
                                        ? `${selectedCamera.name} · ${statusWord}`
                                        : 'No camera assigned'
                                }
                            />
                            <View style={styles.rowDivider} />
                            <InfoRow
                                icon="school"
                                label="School"
                                value={selectedChild?.schoolName ?? ''}
                            />
                            <View style={styles.rowDivider} />
                            <InfoRow
                                icon="clock"
                                label="Last updated"
                                value={formatTime(lastUpdated)}
                            />
                        </View>

                        {/* Latest announcement */}
                        <SectionHeader
                            title="Latest Announcement"
                            actionLabel="View All"
                            onActionPress={() =>
                                router.push('/(parent)/announcements')
                            }
                        />

                        <View style={styles.announcementCard}>
                            <View style={styles.announcementIconCircle}>
                                <Icon name="announce" size={22} />
                            </View>

                            {announcement ? (
                                <View style={styles.announcementTextWrap}>
                                    <Text
                                        style={styles.announcementTitle}
                                        numberOfLines={2}
                                    >
                                        {announcement.title}
                                    </Text>
                                    <Text
                                        style={styles.announcementBody}
                                        numberOfLines={3}
                                    >
                                        {announcement.body}
                                    </Text>
                                    <Text style={styles.announcementDate}>
                                        {formatAnnouncementDate(
                                            announcement.publishedAt,
                                        )}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.announcementTextWrap}>
                                    <Text style={styles.announcementEmpty}>
                                        No announcements have been published
                                        for this classroom yet.
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Privacy information */}
                        <View style={styles.privacyCard}>
                            <Icon name="shield" size={22} />
                            <View style={styles.privacyTextWrap}>
                                <Text style={styles.privacyTitle}>
                                    Secure classroom access
                                </Text>
                                <Text style={styles.privacyText}>
                                    Your school controls camera permissions.
                                    Access remains available only while your
                                    authorization is valid.
                                </Text>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    headerTextWrap: {
        flex: 1,
        marginRight: 12,
    },

    pageTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 24,
    },

    pageSubtitle: {
        color: COLORS.muted,
        fontFamily: FONTS.serif,
        fontSize: 14,
        marginTop: 2,
    },

    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    iconButton: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
    },

    avatarButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },

    avatarImage: {
        width: '100%',
        height: '100%',
    },

    avatarInitial: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },

    /* Scroll area */
    scrollView: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },

    /* Section header */
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 28,
        marginBottom: 14,
    },

    sectionTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },

    sectionAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },

    sectionActionText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
        fontSize: 14,
    },

    /* Child selector */
    childSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 14,
    },

    childAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },

    childImage: {
        width: '100%',
        height: '100%',
    },

    childInitial: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 22,
    },

    childDetails: {
        flex: 1,
    },

    childName: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 18,
    },

    childMeta: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13.5,
        marginTop: 2,
    },

    childOptions: {
        marginTop: 8,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 6,
    },

    childOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        padding: 8,
    },

    optionAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },

    optionInitial: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 17,
    },

    optionName: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 15.5,
    },

    /* Camera heading */
    cameraHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 12,
    },

    cameraHeadingText: {
        flex: 1,
    },

    cameraTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },

    cameraLocation: {
        color: COLORS.muted,
        fontFamily: FONTS.serif,
        fontSize: 14,
        marginTop: 1,
    },

    /* Player */
    playerFrame: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: COLORS.paleBlue,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    videoPlayer: {
        flex: 1,
        backgroundColor: COLORS.playerDark,
    },

    statusDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: COLORS.white,
        zIndex: 5,
        elevation: 5,
    },

    videoPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: COLORS.paleBlue,
    },

    videoIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },

    videoTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 16,
        textAlign: 'center',
    },

    videoDescription: {
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        marginTop: 4,
    },

    videoFootnote: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 11.5,
        lineHeight: 16,
        textAlign: 'center',
        marginTop: 6,
    },

    retryButton: {
        minHeight: 38,
        marginTop: 10,
        paddingHorizontal: 18,
        borderRadius: 12,
        backgroundColor: COLORS.blue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    retryButtonText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 13,
    },

    /* Controls */
    refreshButton: {
        minHeight: 52,
        marginTop: 14,
        borderRadius: 14,
        backgroundColor: COLORS.blue,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },

    refreshButtonDisabled: {
        opacity: 0.7,
    },

    refreshButtonText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 15.5,
    },

    /* Details card */
    detailsCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 6,
    },

    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
    },

    infoIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    infoTextWrap: {
        flex: 1,
    },

    infoLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12.5,
    },

    infoValue: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        marginTop: 1,
    },

    rowDivider: {
        height: 1,
        backgroundColor: COLORS.border,
    },

    /* Announcement */
    announcementCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },

    announcementIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    announcementTextWrap: {
        flex: 1,
        marginLeft: 14,
    },

    announcementTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 16,
        lineHeight: 21,
    },

    announcementBody: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
    },

    announcementDate: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12,
        marginTop: 8,
    },

    announcementEmpty: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 2,
    },

    /* Privacy */
    privacyCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginTop: 20,
        padding: 16,
        backgroundColor: COLORS.paleBlue,
        borderRadius: 18,
    },

    privacyTextWrap: {
        flex: 1,
    },

    privacyTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 14.5,
    },

    privacyText: {
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 3,
    },

    /* States */
    stateCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 28,
        alignItems: 'center',
    },

    stateIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },

    stateTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 18,
        textAlign: 'center',
    },

    stateText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 8,
    },

    primaryButton: {
        minHeight: 48,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        paddingHorizontal: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
    },

    primaryButtonText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
    },
});