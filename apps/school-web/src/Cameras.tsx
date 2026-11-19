
import { useEffect, useState } from 'react';
import {
    Camera,
    Plus,
    RefreshCw,
    Power,
    Pencil,
    X,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type SchoolClass = {
    id: string;
    name: string;
};

type SchoolCamera = {
    id: string;
    camera_code: string;
    name: string;
    location: string | null;
    class_id: string | null;
    status: 'online' | 'offline' | 'maintenance' | 'disabled';
    is_enabled: boolean;
    classes: { name: string } | null;
};

const emptyForm = {
    camera_code: '',
    name: '',
    location: '',
    class_id: '',
};

export default function Cameras({ schoolId }: { schoolId: string }) {
    const [cameras, setCameras] = useState<SchoolCamera[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);

    const loadData = async () => {
        setLoading(true);
        setError('');

        const [cameraResult, classResult] = await Promise.all([
            supabase
                .from('cameras')
                .select('id, camera_code, name, location, class_id, status, is_enabled, classes(name)')
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false }),

            supabase
                .from('classes')
                .select('id, name')
                .eq('school_id', schoolId)
                .order('name'),
        ]);

        if (cameraResult.error) {
            setError(cameraResult.error.message);
            setCameras([]);
        } else {
            setCameras((cameraResult.data || []) as unknown as SchoolCamera[]);
        }

        if (classResult.error) {
            setError((previous) =>
                previous
                    ? `${previous} | ${classResult.error!.message}`
                    : classResult.error!.message
            );
            setClasses([]);
        } else {
            setClasses(classResult.data || []);
        }

        setLoading(false);
    };

    useEffect(() => {
        void loadData();
    }, [schoolId]);

    const openCreateForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setMessage('');
        setShowForm(true);
    };

    const openEditForm = (camera: SchoolCamera) => {
        setEditingId(camera.id);
        setForm({
            camera_code: camera.camera_code,
            name: camera.name,
            location: camera.location || '',
            class_id: camera.class_id || '',
        });
        setError('');
        setMessage('');
        setShowForm(true);
    };

    const saveCamera = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!form.camera_code.trim() || !form.name.trim()) {
            setError('Camera code and camera name are required.');
            return;
        }

        setSaving(true);
        setError('');
        setMessage('');

        const cameraData = {
            camera_code: form.camera_code.trim(),
            name: form.name.trim(),
            location: form.location.trim() || null,
            class_id: form.class_id || null,
        };

        const result = editingId
            ? await supabase
                .from('cameras')
                .update(cameraData)
                .eq('id', editingId)
                .eq('school_id', schoolId)
            : await supabase
                .from('cameras')
                .insert({
                    ...cameraData,
                    school_id: schoolId,
                    status: 'offline',
                    is_enabled: true,
                });

        if (result.error) {
            setError(result.error.message);
        } else {
            setMessage(editingId ? 'Camera updated successfully.' : 'Camera registered successfully.');
            setShowForm(false);
            setForm(emptyForm);
            setEditingId(null);
            await loadData();
        }

        setSaving(false);
    };

    const toggleCamera = async (camera: SchoolCamera) => {
        const nextEnabled = !camera.is_enabled;

        if (!window.confirm(
            `${nextEnabled ? 'Enable' : 'Disable'} ${camera.name}?`
        )) {
            return;
        }

        setError('');
        setMessage('');

        const { error: updateError } = await supabase
            .from('cameras')
            .update({
                is_enabled: nextEnabled,
                status: nextEnabled ? 'offline' : 'disabled',
            })
            .eq('id', camera.id)
            .eq('school_id', schoolId);

        if (updateError) {
            setError(updateError.message);
        } else {
            setMessage(`${camera.name} ${nextEnabled ? 'enabled' : 'disabled'} successfully.`);
            await loadData();
        }
    };

    const onlineCount = cameras.filter((camera) => camera.status === 'online').length;
    const offlineCount = cameras.filter((camera) => camera.status === 'offline').length;
    const disabledCount = cameras.filter((camera) => !camera.is_enabled).length;

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>Camera Management</h2>
                    <p>Register and manage your school's classroom cameras.</p>
                </div>

                <button type="button" className="primary-button" onClick={openCreateForm}>
                    <Plus size={16} /> Add Camera
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon"><Camera size={20} /></div>
                    <p>Total cameras</p>
                    <strong>{cameras.length}</strong>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Camera size={20} /></div>
                    <p>Online</p>
                    <strong>{onlineCount}</strong>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Camera size={20} /></div>
                    <p>Offline</p>
                    <strong>{offlineCount}</strong>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Power size={20} /></div>
                    <p>Disabled</p>
                    <strong>{disabledCount}</strong>
                </div>
            </div>

            {showForm && (
                <div className="staff-table-card camera-form-card">
                    <div className="table-heading">
                        <div>
                            <h3>{editingId ? 'Edit Camera' : 'Register New Camera'}</h3>
                            <p>Enter the camera details and assign it to a class.</p>
                        </div>
                        <button
                            type="button"
                            className="refresh-button"
                            onClick={() => setShowForm(false)}
                        >
                            <X size={15} /> Close
                        </button>
                    </div>

                    <form className="camera-form" onSubmit={saveCamera}>
                        <label>
                            Camera code
                            <input
                                value={form.camera_code}
                                onChange={(event) => setForm({ ...form, camera_code: event.target.value })}
                                placeholder="e.g. CAM-G1-001"
                                required
                            />
                        </label>

                        <label>
                            Camera name
                            <input
                                value={form.name}
                                onChange={(event) => setForm({ ...form, name: event.target.value })}
                                placeholder="e.g. Grade 1 Classroom Camera"
                                required
                            />
                        </label>

                        <label>
                            Location
                            <input
                                value={form.location}
                                onChange={(event) => setForm({ ...form, location: event.target.value })}
                                placeholder="e.g. Grade 1 classroom"
                            />
                        </label>

                        <label>
                            Assign class
                            <select
                                value={form.class_id}
                                onChange={(event) => setForm({ ...form, class_id: event.target.value })}
                            >
                                <option value="">No class assigned</option>
                                {classes.map((schoolClass) => (
                                    <option key={schoolClass.id} value={schoolClass.id}>
                                        {schoolClass.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button type="submit" className="primary-button" disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Register Camera'}
                        </button>
                    </form>
                </div>
            )}

            <div className="staff-table-card">
                <div className="table-heading">
                    <div>
                        <h3>Registered cameras</h3>
                        <p>Manage camera details, class assignments and availability.</p>
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
                {message && <div className="success-message">{message}</div>}

                {loading ? (
                    <div className="table-state">Loading cameras...</div>
                ) : cameras.length === 0 ? (
                    <div className="table-state">
                        <Camera size={30} />
                        <strong>No cameras registered</strong>
                        <span>Add your first classroom camera to get started.</span>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="staff-table">
                            <thead>
                                <tr>
                                    <th>Camera</th>
                                    <th>Code</th>
                                    <th>Location</th>
                                    <th>Assigned class</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {cameras.map((camera) => (
                                    <tr key={camera.id}>
                                        <td><strong>{camera.name}</strong></td>
                                        <td>{camera.camera_code}</td>
                                        <td>{camera.location || '—'}</td>
                                        <td>{camera.classes?.name || 'Unassigned'}</td>
                                        <td>
                                            <span className="role-label">
                                                {camera.is_enabled ? camera.status : 'disabled'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="parent-request-actions">
                                                <button
                                                    type="button"
                                                    className="refresh-button"
                                                    onClick={() => openEditForm(camera)}
                                                >
                                                    <Pencil size={13} /> Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="refresh-button"
                                                    onClick={() => void toggleCamera(camera)}
                                                >
                                                    <Power size={13} />
                                                    {camera.is_enabled ? 'Disable' : 'Enable'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
