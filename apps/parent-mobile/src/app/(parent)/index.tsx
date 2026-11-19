import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Image,
    ActivityIndicator,
    RefreshControl,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';
import { supabase } from '@/lib/supabase';

/* -------------------------------------------------------------------------- */
/*  Design tokens                                                             */
/*  (Move COLORS / FONTS into a shared theme file when you share the next      */
/*  screens, so every screen imports the same values.)                         */
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
};

// These names come from @expo-google-fonts/* (see setup notes).
const FONTS = {
    headingMedium: 'Fredoka_500Medium',
    heading: 'Fredoka_600SemiBold',
    serif: 'PlayfairDisplay_500Medium',
    body: 'Nunito_400Regular',
    bodyMedium: 'Nunito_600SemiBold',
    bodyBold: 'Nunito_700Bold',
};

const SCREEN_PADDING = 20;
const CARD_GAP = 12;

/* -------------------------------------------------------------------------- */
/*  Types (unchanged)                                                         */
/* -------------------------------------------------------------------------- */

type StudentRecord = {
    id: string;
    full_name: string;
    admission_number: string;
    avatar_url: string | null;
    class_id: string | null;
};

type ParentChildRow = {
    id: string;
    status: string;
    school_id: string;
    student_id: string;
    students: StudentRecord | StudentRecord[];
};

type Child = {
    relationshipId: string;
    id: string;
    name: string;
    admissionNumber: string;
    avatarUrl: string | null;
    schoolName: string;
    className: string;
    status: string;
};

type Announcement = {
    id: string;
    title: string;
    body: string;
    category: string;
    priority: string;
    published_at: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

type IconName =
    | 'bell'
    | 'video'
    | 'announce'
    | 'userPlus'
    | 'user'
    | 'chevron'
    | 'school'
    | 'class';

function Icon({
    name,
    size = 24,
    color = COLORS.blue,
    strokeWidth = 1.8,
}: {
    name: IconName;
    size?: number;
    color?: string;
    strokeWidth?: number;
}) {
    const common = {
        fill: 'none',
        stroke: color,
        strokeWidth,
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
            {name === 'video' && (
                <>
                    <Polygon points="23 7 16 12 23 17 23 7" {...common} />
                    <Rect
                        x={1}
                        y={5}
                        width={15}
                        height={14}
                        rx={2}
                        ry={2}
                        {...common}
                    />
                </>
            )}
            {name === 'announce' && (
                <>
                    <Polygon
                        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                        {...common}
                    />
                    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" {...common} />
                    <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" {...common} />
                </>
            )}
            {name === 'userPlus' && (
                <>
                    <Path
                        d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                        {...common}
                    />
                    <Circle cx={8.5} cy={7} r={4} {...common} />
                    <Line x1={20} y1={8} x2={20} y2={14} {...common} />
                    <Line x1={23} y1={11} x2={17} y2={11} {...common} />
                </>
            )}
            {name === 'user' && (
                <>
                    <Path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                        {...common}
                    />
                    <Circle cx={12} cy={7} r={4} {...common} />
                </>
            )}
            {name === 'chevron' && <Path d="M9 18l6-6-6-6" {...common} />}
            {name === 'school' && (
                <>
                    <Path d="M3 21h18" {...common} />
                    <Path d="M5 21V7l7-4 7 4v14" {...common} />
                    <Path d="M9 21v-6h6v6" {...common} />
                </>
            )}
            {name === 'class' && (
                <>
                    <Rect x={3} y={4} width={18} height={12} rx={2} {...common} />
                    <Path d="M8 20h8M12 16v4" {...common} />
                </>
            )}
        </Svg>
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
                    style={styles.sectionAction}
                    hitSlop={10}
                >
                    <Text style={styles.sectionActionText}>{actionLabel}</Text>
                    <Icon name="chevron" size={18} />
                </Pressable>
            ) : null}
        </View>
    );
}

function QuickAccessItem({
    icon,
    label,
    onPress,
}: {
    icon: IconName;
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            style={styles.quickItem}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <View style={styles.quickIconCircle}>
                <Icon name={icon} size={26} />
            </View>
            <Text style={styles.quickLabel}>{label}</Text>
        </Pressable>
    );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function ParentHome() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [children, setChildren] = useState<Child[]>([]);
    const [parentName, setParentName] = useState('Parent');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [announcementLoading, setAnnouncementLoading] = useState(false);
    const [announcementError, setAnnouncementError] = useState('');

    /* ---------------------------- Data (unchanged) ---------------------------- */

    const loadChildren = useCallback(async () => {
        try {
            setError('');

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                setChildren([]);
                setError('Please sign in again to view your children.');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();

            const metadataName =
                user.user_metadata?.full_name ||
                user.user_metadata?.name;

            setParentName(
                profile?.full_name ||
                metadataName ||
                user.email?.split('@')[0] ||
                'Parent'
            );

            const { data, error: childrenError } = await supabase
                .from('parent_students')
                .select(`
                    id,
                    status,
                    school_id,
                    student_id,
                    students!inner (
                        id,
                        full_name,
                        admission_number,
                        avatar_url,
                        class_id
                    )
                `)
                .eq('parent_id', user.id)
                .order('created_at', { ascending: false });

            if (childrenError) throw childrenError;

            const rows = (data ?? []) as unknown as ParentChildRow[];

            if (rows.length === 0) {
                setChildren([]);
                setAnnouncements([]);
                setAnnouncementError('');
                setAnnouncementLoading(false);
                return;
            }

            const schoolIds = [
                ...new Set(rows.map((row) => row.school_id)),
            ];

            const studentRecords = rows.map((row) =>
                Array.isArray(row.students)
                    ? row.students[0]
                    : row.students
            );

            const classIds = [
                ...new Set(
                    studentRecords
                        .map((student) => student?.class_id)
                        .filter((id): id is string => Boolean(id))
                ),
            ];

            const [schoolsResult, classesResult] = await Promise.all([
                supabase
                    .from('schools')
                    .select('id, name')
                    .in('id', schoolIds),

                classIds.length > 0
                    ? supabase
                        .from('classes')
                        .select('id, name, grade_level')
                        .in('id', classIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (schoolsResult.error) throw schoolsResult.error;
            if (classesResult.error) throw classesResult.error;

            const schoolNames = new Map(
                (schoolsResult.data ?? []).map((school) => [
                    school.id,
                    school.name,
                ])
            );

            const classNames = new Map(
                (classesResult.data ?? []).map((schoolClass) => [
                    schoolClass.id,
                    schoolClass.name,
                ])
            );

            const mappedChildren: Child[] = rows
                .map((row) => {
                    const student = Array.isArray(row.students)
                        ? row.students[0]
                        : row.students;

                    if (!student) return null;

                    return {
                        relationshipId: row.id,
                        id: student.id,
                        name: student.full_name,
                        admissionNumber: student.admission_number,
                        avatarUrl: student.avatar_url,
                        schoolName:
                            schoolNames.get(row.school_id) ?? 'School',
                        className: student.class_id
                            ? classNames.get(student.class_id) ??
                            'Class not assigned'
                            : 'Class not assigned',
                        status: row.status,
                    };
                })
                .filter((child): child is Child => child !== null);

            setChildren(mappedChildren);
            setFailedImages([]);

            // Fetch announcements for schools with approved parent-child links.
            const approvedRows = rows.filter(
                (row) => row.status === 'approved'
            );

            const approvedSchoolIds = [
                ...new Set(approvedRows.map((row) => row.school_id)),
            ];

            if (approvedSchoolIds.length === 0) {
                setAnnouncements([]);
                setAnnouncementError('');
                setAnnouncementLoading(false);
            } else {
                setAnnouncementLoading(true);
                setAnnouncementError('');

                try {
                    const { data: announcementData, error: announcementsError } =
                        await supabase
                            .from('announcements')
                            .select(`
                                id,
                                title,
                                body,
                                category,
                                priority,
                                published_at
                            `)
                            .in('school_id', approvedSchoolIds)
                            .not('published_at', 'is', null)
                            .order('published_at', { ascending: false })
                            .limit(3);

                    if (announcementsError) {
                        throw announcementsError;
                    }

                    setAnnouncements(
                        (announcementData ?? []) as Announcement[]
                    );
                } catch (announcementErr) {
                    console.error(
                        'Announcements loading error:',
                        announcementErr
                    );

                    setAnnouncements([]);
                    setAnnouncementError(
                        'We could not load announcements. Pull down to refresh.'
                    );
                } finally {
                    setAnnouncementLoading(false);
                }
            }
        } catch (err) {
            console.error('Parent dashboard error:', err);
            setError('We could not load your children. Please try again.');
            setAnnouncementLoading(false);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadChildren();
    }, [loadChildren]);

    const onRefresh = () => {
        setRefreshing(true);
        loadChildren();
    };

    const addAnotherChild = () => {
        router.push('/(auth)/select-school');
    };

    const approvedChildren = children.filter(
        (child) => child.status === 'approved'
    );

    /* ------------------------------ Derived UI ------------------------------ */

    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? 'Good morning,'
            : hour < 17
                ? 'Good afternoon,'
                : 'Good evening,';

    // Show a peek of the next card when there is more than one child.
    const cardWidth =
        children.length > 1
            ? width - SCREEN_PADDING * 2 - 28
            : width - SCREEN_PADDING * 2;

    const hasUnreadIndicator = announcements.length > 0;

    const isUrgent = (priority: string) =>
        ['urgent', 'high', 'important'].includes(
            (priority ?? '').toLowerCase()
        );

    const capitalise = (value: string) =>
        value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

    /* -------------------------------- Render -------------------------------- */

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* A. Welcome header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.headerProfile}
                    onPress={() => router.push('/(parent)/profile')}
                    accessibilityRole="button"
                    accessibilityLabel="Open profile"
                >
                    <View style={styles.headerAvatar}>
                        <Text style={styles.headerAvatarText}>
                            {parentName.charAt(0).toUpperCase()}
                        </Text>
                    </View>

                    <View style={styles.headerTextWrap}>
                        <Text style={styles.greeting}>{greeting}</Text>
                        <Text style={styles.parentName} numberOfLines={1}>
                            {parentName}!
                        </Text>
                    </View>
                </Pressable>

                <Pressable
                    style={styles.notificationButton}
                    onPress={() => router.push('/(parent)/announcements')}
                    accessibilityRole="button"
                    accessibilityLabel="Open announcements"
                >
                    <Icon name="bell" size={24} />
                    {hasUnreadIndicator && <View style={styles.unreadDot} />}
                </Pressable>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.blue}
                    />
                }
            >
                {/* B. Linked children */}
                <SectionHeader title="My Children" />

                {loading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator
                            color={COLORS.blue}
                            size="large"
                        />
                        <Text style={styles.stateText}>
                            Loading your children...
                        </Text>
                    </View>
                ) : error ? (
                    <View style={styles.stateCard}>
                        <Text style={styles.stateTitle}>
                            Unable to load your children
                        </Text>
                        <Text style={styles.stateText}>{error}</Text>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={loadChildren}
                        >
                            <Text style={styles.primaryButtonText}>
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : children.length === 0 ? (
                    <View style={styles.stateCard}>
                        <Text style={styles.stateTitle}>
                            No children linked yet
                        </Text>
                        <Text style={styles.stateText}>
                            Add your child using their school and admission
                            details. Their school will review your request.
                        </Text>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={addAnotherChild}
                        >
                            <Text style={styles.primaryButtonText}>
                                Add your child
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        snapToInterval={cardWidth + CARD_GAP}
                        snapToAlignment="start"
                        style={styles.childrenScroll}
                        contentContainerStyle={styles.childrenScrollContent}
                    >
                        {children.map((child) => {
                            const hasImage =
                                Boolean(child.avatarUrl) &&
                                !failedImages.includes(child.id);
                            const approved = child.status === 'approved';
                            const pending = child.status === 'pending';

                            return (
                                <Pressable
                                    key={child.relationshipId}
                                    style={[styles.childCard, { width: cardWidth }]}
                                    onPress={() =>
                                        approved
                                            ? router.push('/(parent)/live')
                                            : undefined
                                    }
                                >
                                    {/* Subtle decorative circles */}
                                    <View style={styles.decorCircleLarge} />
                                    <View style={styles.decorCircleSmall} />

                                    <View style={styles.childTopRow}>
                                        {hasImage ? (
                                            <Image
                                                source={{ uri: child.avatarUrl! }}
                                                style={styles.childAvatar}
                                                onError={() =>
                                                    setFailedImages((current) =>
                                                        current.includes(child.id)
                                                            ? current
                                                            : [...current, child.id]
                                                    )
                                                }
                                            />
                                        ) : (
                                            <View style={styles.childAvatarFallback}>
                                                <Text style={styles.avatarInitial}>
                                                    {child.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </Text>
                                            </View>
                                        )}

                                        <View style={styles.childInfo}>
                                            <Text
                                                style={styles.childName}
                                                numberOfLines={1}
                                            >
                                                {child.name}
                                            </Text>
                                            <Text
                                                style={styles.childAdmission}
                                                numberOfLines={1}
                                            >
                                                Adm. No. {child.admissionNumber}
                                            </Text>
                                        </View>

                                        <View
                                            style={[
                                                styles.statusPill,
                                                pending && styles.statusPillPending,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusText,
                                                    approved
                                                        ? { color: COLORS.green }
                                                        : pending
                                                            ? { color: COLORS.white }
                                                            : { color: COLORS.red },
                                                ]}
                                            >
                                                {approved
                                                    ? '✓ Approved'
                                                    : pending
                                                        ? 'Pending'
                                                        : capitalise(child.status)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.childDetailRow}>
                                        <Icon
                                            name="school"
                                            size={18}
                                            color={COLORS.white}
                                        />
                                        <Text
                                            style={styles.childDetailText}
                                            numberOfLines={1}
                                        >
                                            {child.schoolName}
                                        </Text>
                                    </View>

                                    <View style={styles.childDetailRow}>
                                        <Icon
                                            name="class"
                                            size={18}
                                            color={COLORS.white}
                                        />
                                        <Text
                                            style={styles.childDetailText}
                                            numberOfLines={1}
                                        >
                                            {child.className}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                )}

                {/* C. Quick access */}
                <SectionHeader title="Quick Access" />

                <View style={styles.quickRow}>
                    <QuickAccessItem
                        icon="video"
                        label={'Live\nMonitoring'}
                        onPress={() => router.push('/(parent)/live')}
                    />
                    <QuickAccessItem
                        icon="announce"
                        label="Announcements"
                        onPress={() => router.push('/(parent)/announcements')}
                    />
                    <QuickAccessItem
                        icon="userPlus"
                        label={'Add\nChild'}
                        onPress={addAnotherChild}
                    />
                    <QuickAccessItem
                        icon="user"
                        label="Profile"
                        onPress={() => router.push('/(parent)/profile')}
                    />
                </View>

                {/* Live monitoring entry */}
                <Pressable
                    style={styles.liveCard}
                    onPress={() => router.push('/(parent)/live')}
                    accessibilityRole="button"
                    accessibilityLabel="View live classrooms"
                >
                    <View style={styles.liveIconCircle}>
                        <Icon name="video" size={26} />
                    </View>

                    <View style={styles.liveTextWrap}>
                        <Text style={styles.liveTitle}>View Live Classrooms</Text>
                        <Text style={styles.liveSubtitle} numberOfLines={2}>
                            {approvedChildren.length > 0
                                ? `${approvedChildren[0].className} · ${approvedChildren[0].schoolName}`
                                : 'Open your school\'s authorized camera feeds'}
                        </Text>
                    </View>

                    <Icon name="chevron" size={22} color={COLORS.charcoal} />
                </Pressable>

                <Text style={styles.cameraNote}>
                    Live viewing requires camera access granted by your school.
                    Availability is checked when you open a feed.
                </Text>

                {/* D. Announcements */}
                <SectionHeader
                    title="Announcements"
                    actionLabel="View All"
                    onActionPress={() => router.push('/(parent)/announcements')}
                />

                {announcementLoading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator color={COLORS.blue} size="small" />
                        <Text style={styles.stateText}>
                            Loading announcements...
                        </Text>
                    </View>
                ) : announcementError ? (
                    <View style={styles.stateCard}>
                        <Text style={styles.stateTitle}>
                            Announcements unavailable
                        </Text>
                        <Text style={styles.stateText}>{announcementError}</Text>
                    </View>
                ) : announcements.length > 0 ? (
                    <View style={styles.announcementList}>
                        {announcements.map((announcement) => (
                            <Pressable
                                key={announcement.id}
                                style={styles.announcementCard}
                                onPress={() =>
                                    router.push('/(parent)/announcements')
                                }
                            >
                                <View style={styles.announcementIconCircle}>
                                    <Icon name="announce" size={22} />
                                </View>

                                <View style={styles.announcementTextWrap}>
                                    <View style={styles.announcementTags}>
                                        {announcement.category ? (
                                            <View style={styles.categoryPill}>
                                                <Text style={styles.categoryText}>
                                                    {capitalise(announcement.category)}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {isUrgent(announcement.priority) && (
                                            <View style={styles.urgentPill}>
                                                <Text style={styles.urgentText}>
                                                    {capitalise(announcement.priority)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text
                                        style={styles.announcementTitle}
                                        numberOfLines={2}
                                    >
                                        {announcement.title}
                                    </Text>

                                    <Text
                                        style={styles.announcementDescription}
                                        numberOfLines={2}
                                    >
                                        {announcement.body}
                                    </Text>

                                    {announcement.published_at && (
                                        <Text style={styles.announcementDate}>
                                            {new Date(
                                                announcement.published_at
                                            ).toLocaleString('en-KE', {
                                                weekday: 'short',
                                                day: 'numeric',
                                                month: 'short',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        </Text>
                                    )}
                                </View>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View style={styles.stateCard}>
                        <Text style={styles.stateTitle}>
                            No announcements available yet
                        </Text>
                        <Text style={styles.stateText}>
                            School updates and notices will appear here.
                        </Text>
                    </View>
                )}

                <Text style={styles.footer}>
                    SchoolView · Keeping parents connected
                </Text>
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
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    headerProfile: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },

    headerAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    headerAvatarText: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 22,
    },

    headerTextWrap: {
        flex: 1,
        marginLeft: 14,
    },

    greeting: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
    },

    parentName: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 20,
        marginTop: 1,
    },

    notificationButton: {
        width: 48,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
    },

    unreadDot: {
        position: 'absolute',
        top: 10,
        right: 11,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.red,
        borderWidth: 1.5,
        borderColor: COLORS.white,
    },

    /* Scroll area */
    scrollView: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    container: {
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 24,
        paddingBottom: 40,
    },

    /* Section header */
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },

    sectionTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 22,
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

    /* Children cards */
    childrenScroll: {
        marginHorizontal: -SCREEN_PADDING,
        marginBottom: 28,
    },

    childrenScrollContent: {
        paddingHorizontal: SCREEN_PADDING,
        gap: CARD_GAP,
    },

    childCard: {
        backgroundColor: COLORS.blue,
        borderRadius: 20,
        padding: 18,
        overflow: 'hidden',
    },

    decorCircleLarge: {
        position: 'absolute',
        right: -40,
        top: -40,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },

    decorCircleSmall: {
        position: 'absolute',
        right: 40,
        bottom: -50,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },

    childTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },

    childAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.paleBlue,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
    },

    childAvatarFallback: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    avatarInitial: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 24,
    },

    childInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },

    childName: {
        color: COLORS.white,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },

    childAdmission: {
        color: 'rgba(255,255,255,0.85)',
        fontFamily: FONTS.body,
        fontSize: 13,
        marginTop: 2,
    },

    statusPill: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
    },

    statusPillPending: {
        backgroundColor: 'rgba(255,255,255,0.22)',
    },

    statusText: {
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
    },

    childDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },

    childDetailText: {
        flex: 1,
        color: COLORS.white,
        fontFamily: FONTS.bodyMedium,
        fontSize: 15,
    },

    /* Quick access */
    quickRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },

    quickItem: {
        flex: 1,
        alignItems: 'center',
    },

    quickIconCircle: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },

    quickLabel: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 12.5,
        lineHeight: 17,
        textAlign: 'center',
    },

    /* Live monitoring entry */
    liveCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },

    liveIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    liveTextWrap: {
        flex: 1,
        marginHorizontal: 14,
    },

    liveTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 17,
    },

    liveSubtitle: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
        marginTop: 2,
    },

    cameraNote: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 11.5,
        lineHeight: 17,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 28,
        paddingHorizontal: 8,
    },

    /* Announcements */
    announcementList: {
        gap: 12,
    },

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

    announcementTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 6,
    },

    categoryPill: {
        backgroundColor: COLORS.paleBlue,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
    },

    categoryText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
    },

    urgentPill: {
        backgroundColor: '#FDECEA',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
    },

    urgentText: {
        color: COLORS.red,
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
    },

    announcementTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 16,
        lineHeight: 21,
    },

    announcementDescription: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13.5,
        lineHeight: 20,
        marginTop: 4,
    },

    announcementDate: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12,
        marginTop: 8,
    },

    /* Loading / error / empty states */
    stateCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 24,
        alignItems: 'center',
        marginBottom: 28,
    },

    stateTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 17,
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

    footer: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        textAlign: 'center',
        fontSize: 12,
        marginTop: 28,
    },
});