
import { useEffect, useState } from 'react';
import {
    ShieldCheck,
    RefreshCw,
    Plus,
    X,
    LockKeyhole,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type Camera = {
    id: string;
    name: string;
    camera_code: string;
    is_enabled: boolean;
};

type ParentLink = {
    id: string;
    parent_id: string;
    student_id: string;
    relationship: string;
    profiles: { full_name: string | null } | null;
    students: { full_name: string; admission_number: string } | null;
};

type CameraGrant = {
    id: string;
    camera_id: string;
    parent_student_id: string;
    granted_at: string;
    expires_at: string | null;
    revoked_at: string | null;
    cameras: { name: string; camera_code: string } | null;
    parent_students: {
        profiles: { full_name: string | null } | null;
        students: { full_name: string; admission_number: string } | null;
    } | null;
};

export default function CameraAccess({ schoolId }: { schoolId: string }) {
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
    const [grants, setGrants] = useState<CameraGrant[]>([]);
    const [liveViewingEnabled, setLiveViewingEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [cameraId, setCameraId] = useState('');
    const [parentStudentId, setParentStudentId] = useState('');
    const [expiry, setExpiry] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        const [
            cameraResult,
            parentResult,
            grantResult,
            settingsResult,
        ] = await Promise.all([
            supabase
                .from('cameras')
                .select('id, name, camera_code, is_enabled')
                .eq('school_id', schoolId)
                .eq('is_enabled', true)
                .order('name'),

            supabase
                .from('parent_students')
                .select(`
                    id,
                    parent_id,
                    student_id,
                    relationship,
                    profiles(full_name),
                    students(full_name, admission_number)
                `)
                .eq('school_id', schoolId)
                .eq('status', 'approved')
                .order('created_at', { ascending: false }),

            supabase
                .from('camera_access')
                .select(`
                    id,
                    camera_id,
                    parent_student_id,
                    granted_at,
                    expires_at,
                    revoked_at,
                    cameras(name, camera_code),
                    parent_students(
                        profiles(full_name),
                        students(full_name, admission_number)
                    )
                `)
                .eq('school_id', schoolId)
                .order('granted_at', { ascending: false }),

            supabase
                .from('school_settings')
                .select('live_viewing_enabled')
                .eq('school_id', schoolId)
                .maybeSingle(),
        ]);

        if (cameraResult.error) {
            setError(cameraResult.error.message);
        } else {
            setCameras(cameraResult.data || []);
        }

        if (parentResult.error) {
            setError((previous) => previous || parentResult.error!.message);
        } else {
            setParentLinks(
                (parentResult.data || []) as unknown as ParentLink[]
            );
        }

        if (grantResult.error) {
            setError((previous) => previous || grantResult.error!.message);
        } else {
            setGrants(
                (grantResult.data || []) as unknown as CameraGrant[]
            );
        }

        if (settingsResult.error) {
            setError((previous) => previous || settingsResult.error!.message);
        } else {
            setLiveViewingEnabled(
                settingsResult.data?.live_viewing_enabled ?? true
            );
        }

        setLoading(false);
    };

    useEffect(() => {
        void loadData();
    }, [schoolId]);

    const grantAccess = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!liveViewingEnabled) {
            setError(
                'Live viewing is disabled in School Settings. New camera access cannot be granted.'
            );
            return;
        }

        if (!cameraId || !parentStudentId) {
            setError('Select a camera and an approved parent-child link.');
            return;
        }

        setSaving(true);
        setError('');
        setMessage('');

        try {
            const { error: grantError } = await supabase.rpc(
                'grant_camera_access',
                {
                    target_camera_id: cameraId,
                    target_parent_student_id: parentStudentId,
                    access_expiry: expiry
                        ? new Date(expiry).toISOString()
                        : null,
                }
            );

            if (grantError) {
                throw grantError;
            }

            setMessage('Camera access granted successfully.');
            setShowForm(false);
            setCameraId('');
            setParentStudentId('');
            setExpiry('');

            await loadData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to grant camera access.'
            );
        } finally {
            setSaving(false);
        }
    };

    const revokeAccess = async (grant: CameraGrant) => {
        if (
            !window.confirm(
                'Are you sure you want to revoke this camera access?'
            )
        ) {
            return;
        }

        setError('');
        setMessage('');

        const { error: revokeError } = await supabase.rpc(
            'revoke_camera_access',
            {
                target_camera_access_id: grant.id,
            }
        );

        if (revokeError) {
            setError(revokeError.message);
        } else {
            setMessage('Camera access revoked successfully.');
            await loadData();
        }
    };

    const activeGrants = grants.filter(
        (grant) =>
            !grant.revoked_at &&
            (!grant.expires_at ||
                new Date(grant.expires_at).getTime() > Date.now())
    );

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>Camera Access</h2>
                    <p>
                        Control which approved parents can access classroom cameras.
                    </p>
                </div>

                <button
                    type="button"
                    className="primary-button"
                    disabled={!liveViewingEnabled || loading}
                    onClick={() => {
                        setError('');
                        setMessage('');
                        setShowForm(!showForm);
                    }}
                >
                    {showForm ? <X size={16} /> : <Plus size={16} />}
                    {showForm ? 'Close' : 'Grant Access'}
                </button>
            </div>

            {!liveViewingEnabled && (
                <div className="form-error" role="alert">
                    <LockKeyhole size={17} />
                    Live viewing is currently disabled in School Settings.
                    New camera access grants are blocked. Existing access
                    records remain available for review and revocation.
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <ShieldCheck size={20} />
                    </div>
                    <p>Total access records</p>
                    <strong>{grants.length}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <LockKeyhole size={20} />
                    </div>
                    <p>Currently active</p>
                    <strong>{activeGrants.length}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <X size={20} />
                    </div>
                    <p>Revoked or expired</p>
                    <strong>{grants.length - activeGrants.length}</strong>
                </div>
            </div>

            {showForm && liveViewingEnabled && (
                <div className="staff-table-card camera-form-card">
                    <div className="table-heading">
                        <div>
                            <h3>Grant Camera Access</h3>
                            <p>
                                Only approved parent-child links can receive access.
                            </p>
                        </div>
                    </div>

                    <form className="camera-form" onSubmit={grantAccess}>
                        <label>
                            Classroom camera
                            <select
                                value={cameraId}
                                onChange={(event) =>
                                    setCameraId(event.target.value)
                                }
                                required
                            >
                                <option value="">Select camera</option>
                                {cameras.map((camera) => (
                                    <option key={camera.id} value={camera.id}>
                                        {camera.name} ({camera.camera_code})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Parent and student
                            <select
                                value={parentStudentId}
                                onChange={(event) =>
                                    setParentStudentId(event.target.value)
                                }
                                required
                            >
                                <option value="">Select approved parent</option>
                                {parentLinks.map((link) => (
                                    <option key={link.id} value={link.id}>
                                        {link.profiles?.full_name || 'Parent'} —{' '}
                                        {link.students?.full_name || 'Student'} (
                                        {link.students?.admission_number ||
                                            'No admission number'}
                                        )
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Access expiry (optional)
                            <input
                                type="datetime-local"
                                value={expiry}
                                onChange={(event) =>
                                    setExpiry(event.target.value)
                                }
                                min={new Date(Date.now() + 60000)
                                    .toISOString()
                                    .slice(0, 16)}
                            />
                        </label>

                        <button
                            type="submit"
                            className="primary-button"
                            disabled={
                                saving ||
                                cameras.length === 0 ||
                                parentLinks.length === 0
                            }
                        >
                            {saving ? 'Granting...' : 'Grant Access'}
                        </button>

                        {cameras.length === 0 && (
                            <p>
                                No enabled cameras are available. Register and
                                enable a camera first.
                            </p>
                        )}

                        {parentLinks.length === 0 && (
                            <p>
                                No approved parent-child links are available yet.
                            </p>
                        )}
                    </form>
                </div>
            )}

            <div className="staff-table-card">
                <div className="table-heading">
                    <div>
                        <h3>Camera access records</h3>
                        <p>
                            Review and revoke existing parent camera permissions.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="refresh-button"
                        onClick={() => void loadData()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                {error && <div className="form-error">{error}</div>}
                {message && (
                    <div className="success-message">{message}</div>
                )}

                {loading ? (
                    <div className="table-state">
                        Loading access records...
                    </div>
                ) : grants.length === 0 ? (
                    <div className="table-state">
                        <ShieldCheck size={30} />
                        <strong>No camera access records</strong>
                        <span>
                            Granted parent permissions will appear here.
                        </span>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="staff-table">
                            <thead>
                                <tr>
                                    <th>Parent</th>
                                    <th>Student</th>
                                    <th>Camera</th>
                                    <th>Granted</th>
                                    <th>Expiry</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {grants.map((grant) => {
                                    const active = activeGrants.some(
                                        (item) => item.id === grant.id
                                    );

                                    return (
                                        <tr key={grant.id}>
                                            <td>
                                                {grant.parent_students?.profiles
                                                    ?.full_name || 'Parent account'}
                                            </td>
                                            <td>
                                                {grant.parent_students?.students
                                                    ?.full_name || 'Student'}
                                            </td>
                                            <td>
                                                {grant.cameras?.name || 'Camera'}
                                            </td>
                                            <td>
                                                {new Date(
                                                    grant.granted_at
                                                ).toLocaleDateString()}
                                            </td>
                                            <td>
                                                {grant.expires_at
                                                    ? new Date(
                                                        grant.expires_at
                                                    ).toLocaleString()
                                                    : 'No expiry'}
                                            </td>
                                            <td>
                                                <span className="role-label">
                                                    {active
                                                        ? 'active'
                                                        : grant.revoked_at
                                                            ? 'revoked'
                                                            : 'expired'}
                                                </span>
                                            </td>
                                            <td>
                                                {active && (
                                                    <button
                                                        type="button"
                                                        className="parent-reject-button"
                                                        onClick={() =>
                                                            void revokeAccess(
                                                                grant
                                                            )
                                                        }
                                                    >
                                                        <X size={13} /> Revoke
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
