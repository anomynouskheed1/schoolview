
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Camera,
    RefreshCw,
    Search,
    Wifi,
    WifiOff,
    Wrench,
    MonitorPlay,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type CameraRecord = {
    id: string;
    school_id: string;
    class_id: string | null;
    camera_code: string;
    name: string;
    location: string | null;
    status: 'online' | 'offline' | 'maintenance' | 'disabled';
    is_enabled: boolean;
    created_at: string;
    schools: {
        name: string;
        school_code: string;
    } | null;
    classes: {
        name: string;
        grade_level: string | null;
    } | null;
};

export default function Monitoring() {
    const [cameras, setCameras] = useState<CameraRecord[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<CameraRecord | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchCameras = useCallback(async () => {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
            .from('cameras')
            .select(`
        id,
        school_id,
        class_id,
        camera_code,
        name,
        location,
        status,
        is_enabled,
        created_at,
        schools (
          name,
          school_code
        ),
        classes (
          name,
          grade_level
        )
      `)
            .order('created_at', { ascending: false });

        if (fetchError) {
            setError(fetchError.message);
            setCameras([]);
            setSelectedCamera(null);
            setLoading(false);
            return;
        }

        const records = (data ?? []) as unknown as CameraRecord[];

        setCameras(records);

        setSelectedCamera((current) =>
            current
                ? records.find((camera) => camera.id === current.id) ?? null
                : null
        );

        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchCameras();
    }, [fetchCameras]);

    const counts = useMemo(
        () => ({
            total: cameras.length,
            online: cameras.filter(
                (camera) => camera.status === 'online' && camera.is_enabled
            ).length,
            offline: cameras.filter(
                (camera) => camera.status === 'offline'
            ).length,
            maintenance: cameras.filter(
                (camera) => camera.status === 'maintenance'
            ).length,
            disabled: cameras.filter(
                (camera) => !camera.is_enabled || camera.status === 'disabled'
            ).length,
        }),
        [cameras]
    );

    const filteredCameras = useMemo(() => {
        const term = search.trim().toLowerCase();

        return cameras.filter((camera) => {
            const matchesSearch =
                !term ||
                [
                    camera.name,
                    camera.camera_code,
                    camera.location,
                    camera.schools?.name,
                    camera.schools?.school_code,
                    camera.classes?.name,
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(term));

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'disabled'
                    ? !camera.is_enabled || camera.status === 'disabled'
                    : camera.status === statusFilter);

            return matchesSearch && matchesStatus;
        });
    }, [cameras, search, statusFilter]);

    const statusClass = (status: string) =>
        `monitoring-status status-${status}`;

    return (
        <div className="monitoring-page">
            <div className="monitoring-heading">
                <div>
                    <p className="monitoring-eyebrow">Infrastructure management</p>
                    <h1>Camera Monitoring</h1>
                    <p>Monitor camera records and their reported database status.</p>
                </div>

                <button
                    className="monitoring-refresh"
                    onClick={() => void fetchCameras()}
                    disabled={loading}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="monitoring-error">
                    {error}
                </div>
            )}

            <div className="monitoring-notice">
                <MonitorPlay size={18} />
                <span>
                    These are database-reported camera statuses. Live stream health
                    will be connected separately through the MediaMTX monitoring
                    service.
                </span>
            </div>

            <div className="monitoring-stats">
                <div className="monitoring-stat">
                    <span>Total cameras</span>
                    <strong>{counts.total}</strong>
                </div>

                <div className="monitoring-stat">
                    <span>Online</span>
                    <strong>{counts.online}</strong>
                </div>

                <div className="monitoring-stat">
                    <span>Offline</span>
                    <strong>{counts.offline}</strong>
                </div>

                <div className="monitoring-stat">
                    <span>Maintenance</span>
                    <strong>{counts.maintenance}</strong>
                </div>
            </div>

            <div className="monitoring-toolbar">
                <div className="monitoring-search">
                    <Search size={17} />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search camera, school, classroom or code..."
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="monitoring-filter"
                >
                    <option value="all">All statuses</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="disabled">Disabled</option>
                </select>

                <span>{filteredCameras.length} cameras found</span>
            </div>

            <div className="monitoring-layout">
                <section className="monitoring-list">
                    <div className="monitoring-list-header">
                        Registered cameras
                    </div>

                    {loading ? (
                        <div className="monitoring-empty">Loading cameras...</div>
                    ) : filteredCameras.length === 0 ? (
                        <div className="monitoring-empty">
                            <Camera size={28} />
                            <strong>No cameras found</strong>
                            <span>Camera records will appear here when registered.</span>
                        </div>
                    ) : (
                        filteredCameras.map((camera) => (
                            <button
                                key={camera.id}
                                className={`monitoring-item ${selectedCamera?.id === camera.id ? 'selected' : ''
                                    }`}
                                onClick={() => setSelectedCamera(camera)}
                            >
                                <span className="monitoring-camera-icon">
                                    <Camera size={19} />
                                </span>

                                <span className="monitoring-item-content">
                                    <strong>{camera.name}</strong>
                                    <small>{camera.camera_code}</small>
                                    <span className={statusClass(camera.status)}>
                                        {camera.status}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </section>

                <section className="monitoring-details">
                    {!selectedCamera ? (
                        <div className="monitoring-details-empty">
                            <Camera size={34} />
                            <strong>Select a camera</strong>
                            <span>Choose a camera to view its monitoring details.</span>
                        </div>
                    ) : (
                        <>
                            <div className="monitoring-details-heading">
                                <span className="monitoring-camera-icon large">
                                    <Camera size={25} />
                                </span>

                                <div>
                                    <h2>{selectedCamera.name}</h2>
                                    <span className={statusClass(selectedCamera.status)}>
                                        {selectedCamera.status}
                                    </span>
                                </div>
                            </div>

                            <div className="monitoring-information">
                                <div>
                                    <span>Camera code</span>
                                    <strong>{selectedCamera.camera_code}</strong>
                                </div>

                                <div>
                                    <span>School</span>
                                    <strong>
                                        {selectedCamera.schools?.name || 'Not available'}
                                    </strong>
                                </div>

                                <div>
                                    <span>School code</span>
                                    <strong>
                                        {selectedCamera.schools?.school_code || 'Not available'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Classroom</span>
                                    <strong>
                                        {selectedCamera.classes?.name || 'Not assigned'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Grade level</span>
                                    <strong>
                                        {selectedCamera.classes?.grade_level || 'Not available'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Location</span>
                                    <strong>
                                        {selectedCamera.location || 'Not provided'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Enabled in database</span>
                                    <strong>
                                        {selectedCamera.is_enabled ? 'Yes' : 'No'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Registration date</span>
                                    <strong>
                                        {new Date(selectedCamera.created_at).toLocaleDateString()}
                                    </strong>
                                </div>
                            </div>

                            <div className="monitoring-health-note">
                                {selectedCamera.status === 'online' && selectedCamera.is_enabled ? (
                                    <Wifi size={20} />
                                ) : selectedCamera.status === 'maintenance' ? (
                                    <Wrench size={20} />
                                ) : selectedCamera.status === 'disabled' || !selectedCamera.is_enabled ? (
                                    <Camera size={20} />
                                ) : (
                                    <WifiOff size={20} />
                                )}

                                <div>
                                    <strong>Database status: {selectedCamera.status}</strong>
                                    <p>
                                        {selectedCamera.status === 'online' && selectedCamera.is_enabled
                                            ? 'This camera is marked online in the database. Actual stream availability has not yet been verified.'
                                            : 'This camera is not currently reported as online and enabled. Live connectivity checks will be integrated later.'}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
