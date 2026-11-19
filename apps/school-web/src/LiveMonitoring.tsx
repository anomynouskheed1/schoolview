
import { useEffect, useRef, useState } from 'react';
import {
    MonitorPlay,
    RefreshCw,
    Camera,
    Wifi,
    WifiOff,
    AlertTriangle,
    Power,
    X,
    Play,
    Loader2,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type CameraRecord = {
    id: string;
    camera_code: string;
    name: string;
    location: string | null;
    status: 'online' | 'offline' | 'maintenance' | 'disabled';
    is_enabled: boolean;
    class_id: string | null;
    classes: { name: string } | null;
};

type PlaybackStatus = 'connecting' | 'live' | 'offline';

type PlaybackSession = {
    sessionId: string;
    streamPath: string;
    playbackToken: string;
};

const API_URL = (
    import.meta.env as Record<string, string | undefined>
).VITE_API_URL?.trim().replace(/\/$/, '');

export default function LiveMonitoring({ schoolId }: { schoolId: string }) {
    const [cameras, setCameras] = useState<CameraRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const [selectedCamera, setSelectedCamera] =
        useState<CameraRecord | null>(null);

    const [playbackStatus, setPlaybackStatus] =
        useState<PlaybackStatus>('connecting');

    const [playbackError, setPlaybackError] = useState('');

    const videoRef = useRef<HTMLVideoElement | null>(null);

    const loadCameras = async () => {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
            .from('cameras')
            .select(`
                id,
                camera_code,
                name,
                location,
                status,
                is_enabled,
                class_id,
                classes(name)
            `)
            .eq('school_id', schoolId)
            .order('name');

        if (fetchError) {
            setError(fetchError.message);
            setCameras([]);
        } else {
            setCameras((data || []) as unknown as CameraRecord[]);
            setLastUpdated(new Date());
        }

        setLoading(false);
    };

    useEffect(() => {
        void loadCameras();
    }, [schoolId]);

    // Establish an authenticated administrator WebRTC session.
    useEffect(() => {
        if (!selectedCamera) {
            return;
        }

        let cancelled = false;
        let peer: RTCPeerConnection | null = null;
        let whepResourceUrl: string | null = null;
        let playbackSession: PlaybackSession | null = null;
        let playbackToken: string | null = null;
        let connectionTimeout: ReturnType<typeof setTimeout> | null = null;

        const video = videoRef.current;

        const setOffline = (message: string) => {
            if (cancelled) return;

            setPlaybackStatus('offline');
            setPlaybackError(message);

            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
                connectionTimeout = null;
            }
        };

        const cleanup = async () => {
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
            }

            if (peer) {
                peer.ontrack = null;
                peer.onconnectionstatechange = null;
                peer.close();
                peer = null;
            }

            if (video) {
                video.pause();
                video.srcObject = null;
            }

            // Remove the MediaMTX WHEP resource.
            if (whepResourceUrl && playbackToken) {
                try {
                    await fetch(whepResourceUrl, {
                        method: 'DELETE',
                        headers: {
                            Authorization: `Bearer ${playbackToken}`,
                        },
                    });
                } catch {
                    // The playback session is still ended through our API.
                }
            }

            // End the administrator's secure playback session.
            if (playbackSession && API_URL) {
                try {
                    await fetch(
                        `${API_URL}/api/cameras/${encodeURIComponent(
                            selectedCamera.id,
                        )}/admin-playback/${encodeURIComponent(
                            playbackSession.sessionId,
                        )}`,
                        {
                            method: 'DELETE',
                            headers: {
                                Authorization: `Bearer ${await getAccessToken()
                                    }`,
                            },
                        },
                    );
                } catch {
                    // Expired sessions are also rejected by MediaMTX.
                }
            }
        };

        const getAccessToken = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            return session?.access_token || '';
        };

        const startPlayback = async () => {
            try {
                setPlaybackStatus('connecting');
                setPlaybackError('');

                if (!API_URL) {
                    throw new Error(
                        'VITE_API_URL is missing from the School Admin environment.',
                    );
                }

                if (
                    !selectedCamera.is_enabled ||
                    selectedCamera.status !== 'online'
                ) {
                    throw new Error(
                        'This camera is disabled or marked offline in the school database.',
                    );
                }

                const accessToken = await getAccessToken();

                if (!accessToken) {
                    throw new Error(
                        'Your login session has expired. Please sign in again.',
                    );
                }

                const sessionResponse = await fetch(
                    `${API_URL}/api/cameras/${encodeURIComponent(
                        selectedCamera.id,
                    )}/admin-playback`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    },
                );

                const sessionResult = await sessionResponse.json();

                if (!sessionResponse.ok || !sessionResult.success) {
                    throw new Error(
                        sessionResult.message ||
                        'Unable to authorize classroom playback.',
                    );
                }

                playbackSession = {
                    sessionId: sessionResult.sessionId,
                    streamPath: sessionResult.streamPath,
                    playbackToken: sessionResult.playbackToken,
                };

                playbackToken = playbackSession.playbackToken;

                if (cancelled) {
                    return;
                }

                // Derive the MediaMTX WebRTC address from the API host.
                const apiOrigin = new URL(API_URL);

                const whepUrl =
                    `${apiOrigin.protocol}//${apiOrigin.hostname}:8889/` +
                    `${encodeURIComponent(playbackSession.streamPath)}/whep`;

                peer = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: 'stun:stun.l.google.com:19302',
                        },
                    ],
                });

                const connection = peer;

                connection.addTransceiver('video', {
                    direction: 'recvonly',
                });

                connection.addTransceiver('audio', {
                    direction: 'recvonly',
                });

                connection.ontrack = (event) => {
                    if (cancelled || !video) return;

                    if (event.streams.length > 0) {
                        video.srcObject = event.streams[0];
                    } else {
                        const stream = new MediaStream([event.track]);
                        video.srcObject = stream;
                    }

                    void video.play().catch(() => {
                        setOffline(
                            'The browser could not start video playback. Check browser autoplay permissions.',
                        );
                    });
                };

                connection.onconnectionstatechange = () => {
                    if (cancelled) return;

                    if (connection.connectionState === 'failed') {
                        setOffline(
                            'WebRTC connection failed. Check the MediaMTX server, network and firewall.',
                        );
                    }

                    if (connection.connectionState === 'closed') {
                        setOffline('The classroom video connection has closed.');
                    }
                };

                connection.oniceconnectionstatechange = () => {
                    if (cancelled) return;

                    if (connection.iceConnectionState === 'failed') {
                        setOffline(
                            'Unable to establish a WebRTC network connection. Check ICE/UDP connectivity.',
                        );
                    }
                };

                const offer = await connection.createOffer();

                await connection.setLocalDescription(offer);

                // Gather ICE candidates before submitting the WHEP offer.
                await new Promise<void>((resolve, reject) => {
                    if (!peer) {
                        reject(new Error('WebRTC connection was closed.'));
                        return;
                    }

                    if (peer.iceGatheringState === 'complete') {
                        resolve();
                        return;
                    }

                    const timeout = setTimeout(() => {
                        reject(
                            new Error('Timed out gathering WebRTC connection candidates.'),
                        );
                    }, 12000);

                    const handleGathering = () => {
                        if (peer?.iceGatheringState === 'complete') {
                            clearTimeout(timeout);
                            peer.removeEventListener(
                                'icegatheringstatechange',
                                handleGathering,
                            );
                            resolve();
                        }
                    };

                    peer.addEventListener(
                        'icegatheringstatechange',
                        handleGathering,
                    );
                });

                if (cancelled || !connection.localDescription?.sdp) {
                    return;
                }

                const whepResponse = await fetch(whepUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${playbackToken}`,
                        'Content-Type': 'application/sdp',
                        Accept: 'application/sdp',
                    },
                    body: connection.localDescription.sdp,
                });

                if (!whepResponse.ok) {
                    const responseText = await whepResponse.text();

                    throw new Error(
                        `MediaMTX rejected the WebRTC request (${whepResponse.status}). ${responseText || whepResponse.statusText
                        }`,
                    );
                }

                const location = whepResponse.headers.get('Location');

                if (location) {
                    whepResourceUrl = new URL(location, whepUrl).toString();
                }

                const answer = await whepResponse.text();

                if (!answer) {
                    throw new Error(
                        'MediaMTX returned an empty WebRTC answer.',
                    );
                }

                await connection.setRemoteDescription({
                    type: 'answer',
                    sdp: answer,
                });

                if (cancelled) return;

                // Only the actual video playing event sets LIVE.
                if (video) {
                    video.onplaying = () => {
                        if (cancelled) return;

                        setPlaybackStatus('live');
                        setPlaybackError('');

                        if (connectionTimeout) {
                            clearTimeout(connectionTimeout);
                            connectionTimeout = null;
                        }
                    };

                    video.onerror = () => {
                        setOffline('The classroom video could not be decoded.');
                    };
                }

                connectionTimeout = setTimeout(() => {
                    if (
                        !cancelled &&
                        video &&
                        video.paused
                    ) {
                        setOffline(
                            'The connection was established but no classroom video started playing. Check whether the camera is publishing.',
                        );
                    }
                }, 25000);
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Unable to connect to the classroom stream.';

                setOffline(message);
            }
        };

        void startPlayback();

        return () => {
            cancelled = true;
            void cleanup();
        };
    }, [selectedCamera]);

    const openCamera = (camera: CameraRecord) => {
        setPlaybackError('');
        setPlaybackStatus('connecting');
        setSelectedCamera(camera);
    };

    const closePlayer = () => {
        setSelectedCamera(null);
        setPlaybackError('');
        setPlaybackStatus('connecting');
    };

    const onlineCount = cameras.filter(
        (camera) => camera.is_enabled && camera.status === 'online'
    ).length;

    const offlineCount = cameras.filter(
        (camera) => camera.is_enabled && camera.status === 'offline'
    ).length;

    const maintenanceCount = cameras.filter(
        (camera) => camera.is_enabled && camera.status === 'maintenance'
    ).length;

    const disabledCount = cameras.filter(
        (camera) => !camera.is_enabled || camera.status === 'disabled'
    ).length;

    const getStatusIcon = (camera: CameraRecord) => {
        if (!camera.is_enabled || camera.status === 'disabled') {
            return <Power size={17} />;
        }

        if (camera.status === 'online') {
            return <Wifi size={17} />;
        }

        if (camera.status === 'maintenance') {
            return <AlertTriangle size={17} />;
        }

        return <WifiOff size={17} />;
    };

    const getStatusLabel = (camera: CameraRecord) => {
        if (!camera.is_enabled || camera.status === 'disabled') {
            return 'Disabled';
        }

        return camera.status.charAt(0).toUpperCase() + camera.status.slice(1);
    };

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>Live Monitoring</h2>
                    <p>Monitor the registered classroom cameras in your school.</p>
                </div>

                <button
                    type="button"
                    className="refresh-button"
                    onClick={() => void loadCameras()}
                    disabled={loading}
                >
                    <RefreshCw size={15} />
                    Refresh Status
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <Camera size={20} />
                    </div>
                    <p>Total cameras</p>
                    <strong>{cameras.length}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <Wifi size={20} />
                    </div>
                    <p>Online</p>
                    <strong>{onlineCount}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <WifiOff size={20} />
                    </div>
                    <p>Offline</p>
                    <strong>{offlineCount}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <AlertTriangle size={20} />
                    </div>
                    <p>Maintenance</p>
                    <strong>{maintenanceCount}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <Power size={20} />
                    </div>
                    <p>Disabled</p>
                    <strong>{disabledCount}</strong>
                </div>
            </div>

            <div className="staff-table-card">
                <div className="table-heading">
                    <div>
                        <h3>Classroom camera status</h3>
                        <p>
                            {lastUpdated
                                ? `Last refreshed: ${lastUpdated.toLocaleTimeString()}`
                                : 'Camera status information'}
                        </p>
                    </div>
                    <MonitorPlay size={22} />
                </div>

                {error && <div className="form-error">{error}</div>}

                {loading ? (
                    <div className="table-state">
                        Loading camera information...
                    </div>
                ) : cameras.length === 0 ? (
                    <div className="table-state">
                        <Camera size={30} />
                        <strong>No cameras available</strong>
                        <span>
                            Register classroom cameras to monitor them here.
                        </span>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="staff-table">
                            <thead>
                                <tr>
                                    <th>Camera</th>
                                    <th>Camera code</th>
                                    <th>Classroom</th>
                                    <th>Location</th>
                                    <th>Status</th>
                                    <th>Stream</th>
                                </tr>
                            </thead>

                            <tbody>
                                {cameras.map((camera) => {
                                    const unavailable =
                                        !camera.is_enabled ||
                                        camera.status !== 'online';

                                    return (
                                        <tr
                                            key={camera.id}
                                            onClick={() => openCamera(camera)}
                                            title="Click to open classroom camera"
                                            style={{
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <td>
                                                <strong>{camera.name}</strong>
                                            </td>
                                            <td>{camera.camera_code}</td>
                                            <td>
                                                {camera.classes?.name || 'Unassigned'}
                                            </td>
                                            <td>{camera.location || '—'}</td>
                                            <td>
                                                <span className="role-label">
                                                    {getStatusIcon(camera)}
                                                    {' '}
                                                    {getStatusLabel(camera)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="role-label">
                                                    {unavailable ? (
                                                        <>
                                                            <WifiOff size={16} />
                                                            Unavailable
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play size={15} />
                                                            Open stream
                                                        </>
                                                    )}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="camera-monitoring-notice">
                <MonitorPlay size={21} />
                <div>
                    <strong>Secure classroom streaming</strong>
                    <p>
                        Select an enabled classroom camera to open its live
                        stream. LIVE is displayed only after actual video
                        playback begins.
                    </p>
                </div>
            </div>

            {selectedCamera && (
                <div
                    role="presentation"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            closePlayer();
                        }
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(12, 20, 35, 0.78)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${selectedCamera.name} live camera`}
                        style={{
                            width: 'min(900px, 100%)',
                            background: '#fff',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '15px',
                                padding: '17px 20px',
                                borderBottom: '1px solid #e9edf3',
                            }}
                        >
                            <div>
                                <h3 style={{
                                    margin: 0,
                                    fontSize: '17px',
                                    color: '#172033',
                                }}>
                                    {selectedCamera.name}
                                </h3>
                                <p style={{
                                    margin: '5px 0 0',
                                    color: '#687386',
                                    fontSize: '13px',
                                }}>
                                    {selectedCamera.classes?.name || 'Unassigned'}
                                    {' · '}
                                    {selectedCamera.camera_code}
                                </p>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }}>
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 10px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        background:
                                            playbackStatus === 'live'
                                                ? '#e8f8ef'
                                                : playbackStatus === 'offline'
                                                    ? '#fff0f0'
                                                    : '#edf3ff',
                                        color:
                                            playbackStatus === 'live'
                                                ? '#16834a'
                                                : playbackStatus === 'offline'
                                                    ? '#c33b3b'
                                                    : '#2860c5',
                                    }}
                                >
                                    {playbackStatus === 'connecting' ? (
                                        <Loader2 size={13} />
                                    ) : playbackStatus === 'live' ? (
                                        <Wifi size={13} />
                                    ) : (
                                        <WifiOff size={13} />
                                    )}

                                    {playbackStatus === 'live'
                                        ? 'LIVE'
                                        : playbackStatus === 'connecting'
                                            ? 'CONNECTING'
                                            : 'OFFLINE'}
                                </span>

                                <button
                                    type="button"
                                    onClick={closePlayer}
                                    aria-label="Close video player"
                                    style={{
                                        border: 0,
                                        background: '#f0f2f6',
                                        color: '#253047',
                                        borderRadius: '8px',
                                        width: '35px',
                                        height: '35px',
                                        cursor: 'pointer',
                                        display: 'grid',
                                        placeItems: 'center',
                                    }}
                                >
                                    <X size={19} />
                                </button>
                            </div>
                        </div>

                        <div style={{
                            position: 'relative',
                            background: '#080d16',
                            aspectRatio: '16 / 9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                controls
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                }}
                            />

                            {playbackStatus !== 'live' && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '25px',
                                    textAlign: 'center',
                                    pointerEvents: 'none',
                                }}>
                                    {playbackStatus === 'connecting' ? (
                                        <>
                                            <Loader2
                                                size={34}
                                                color="#ffffff"
                                            />
                                            <strong style={{
                                                marginTop: '14px',
                                                color: '#ffffff',
                                            }}>
                                                Connecting to classroom...
                                            </strong>
                                            <span style={{
                                                marginTop: '7px',
                                                color: '#bdc7d8',
                                                fontSize: '13px',
                                            }}>
                                                Establishing secure WebRTC playback
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff
                                                size={34}
                                                color="#ff7777"
                                            />
                                            <strong style={{
                                                marginTop: '14px',
                                                color: '#ffffff',
                                            }}>
                                                Unable to play classroom video
                                            </strong>
                                            <span style={{
                                                marginTop: '8px',
                                                maxWidth: '540px',
                                                color: '#d1d8e4',
                                                fontSize: '13px',
                                            }}>
                                                {playbackError}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{
                            padding: '13px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            flexWrap: 'wrap',
                        }}>
                            <span style={{
                                fontSize: '13px',
                                color: '#687386',
                            }}>
                                {selectedCamera.location || 'Classroom camera'}
                            </span>

                            <button
                                type="button"
                                className="refresh-button"
                                onClick={closePlayer}
                            >
                                <X size={15} />
                                Close player
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
