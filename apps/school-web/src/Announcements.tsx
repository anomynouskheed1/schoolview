
import { useEffect, useState } from 'react';
import {
    Megaphone,
    Send,
    RefreshCw,
    CalendarDays,
    Users,
    AlertTriangle,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type Announcement = {
    id: string;
    title: string;
    body: string;
    category: string;
    priority: string;
    class_id: string | null;
    published_at: string | null;
    created_at: string;
};

type SchoolClass = {
    id: string;
    name: string;
};

type Props = {
    schoolId: string;
};

export default function Announcements({ schoolId }: Props) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState('general');
    const [priority, setPriority] = useState('normal');
    const [classId, setClassId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        void loadData();
    }, [schoolId]);

    async function loadData() {
        setLoading(true);
        setError('');

        const [
            announcementResult,
            classResult,
            settingsResult,
        ] = await Promise.all([
            supabase
                .from('announcements')
                .select(
                    'id, title, body, category, priority, class_id, published_at, created_at'
                )
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false }),

            supabase
                .from('classes')
                .select('id, name')
                .eq('school_id', schoolId)
                .order('name'),

            supabase
                .from('school_settings')
                .select('announcements_enabled')
                .eq('school_id', schoolId)
                .maybeSingle(),
        ]);

        if (announcementResult.error) {
            setError(announcementResult.error.message);
        } else {
            setAnnouncements(announcementResult.data || []);
        }

        if (classResult.error) {
            setError(classResult.error.message);
        } else {
            setClasses(classResult.data || []);
        }

        if (settingsResult.error) {
            setError(settingsResult.error.message);
        } else {
            setAnnouncementsEnabled(
                settingsResult.data?.announcements_enabled ?? true
            );
        }

        setLoading(false);
    }

    async function publishAnnouncement(
        e: React.FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!announcementsEnabled) {
            setError(
                'Announcement publishing is currently disabled by your school administrator.'
            );
            return;
        }

        if (!title.trim() || !body.trim()) {
            setError('Please enter both an announcement title and message.');
            return;
        }

        setSubmitting(true);

        try {
            const { data, error: publishError } = await supabase.rpc(
                'publish_school_announcement',
                {
                    target_school_id: schoolId,
                    announcement_title: title.trim(),
                    announcement_body: body.trim(),
                    announcement_category: category,
                    announcement_priority: priority,
                    target_class_id: classId || null,
                }
            );

            if (publishError) {
                throw publishError;
            }

            if (!data?.success) {
                throw new Error('The announcement could not be published.');
            }

            const notificationCount = data.notifications_created ?? 0;

            setTitle('');
            setBody('');
            setCategory('general');
            setPriority('normal');
            setClassId('');

            setSuccess(
                notificationCount > 0
                    ? `Announcement published successfully. ${notificationCount} parent notification(s) created.`
                    : 'Announcement published successfully. No parent notifications were created because notifications are disabled or there are no eligible parents.'
            );

            await loadData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Something went wrong while publishing the announcement.'
            );
        } finally {
            setSubmitting(false);
        }
    }

    function getClassName(id: string | null) {
        if (!id) return 'All classes';

        return (
            classes.find((schoolClass) => schoolClass.id === id)?.name ||
            'Selected class'
        );
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleString();
    }

    return (
        <div className="page-content">
            <div className="section-heading">
                <div>
                    <h2>Announcements Management</h2>
                    <p>Create and publish announcements for parents.</p>
                </div>

                <button
                    type="button"
                    className="refresh-button"
                    onClick={() => void loadData()}
                    disabled={loading || submitting}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="camera-form-card">
                <div className="section-icon">
                    <Megaphone size={20} />
                </div>

                <h3>Create Announcement</h3>
                <p>Share important information with parents and guardians.</p>

                {!announcementsEnabled && (
                    <div className="form-error" role="alert">
                        Announcement publishing is currently disabled in School
                        Settings. You can still view previously published announcements.
                    </div>
                )}

                <form className="class-form" onSubmit={publishAnnouncement}>
                    <label htmlFor="announcement-title">
                        Announcement Title
                    </label>
                    <input
                        id="announcement-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter announcement title"
                        required
                        disabled={!announcementsEnabled || submitting}
                    />

                    <label htmlFor="announcement-body">Message</label>
                    <textarea
                        id="announcement-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write your announcement..."
                        rows={5}
                        required
                        disabled={!announcementsEnabled || submitting}
                    />

                    <div className="announcement-form-grid">
                        <div>
                            <label htmlFor="announcement-category">
                                Category
                            </label>
                            <select
                                id="announcement-category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                disabled={!announcementsEnabled || submitting}
                            >
                                <option value="general">General</option>
                                <option value="urgent">Urgent</option>
                                <option value="academic">Academic</option>
                                <option value="event">Event</option>
                                <option value="reminder">Reminder</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="announcement-priority">
                                Priority
                            </label>
                            <select
                                id="announcement-priority"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                disabled={!announcementsEnabled || submitting}
                            >
                                <option value="normal">Normal</option>
                                <option value="important">Important</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <label htmlFor="announcement-class">Audience</label>
                    <select
                        id="announcement-class"
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        disabled={!announcementsEnabled || submitting}
                    >
                        <option value="">All classes</option>
                        {classes.map((schoolClass) => (
                            <option key={schoolClass.id} value={schoolClass.id}>
                                {schoolClass.name}
                            </option>
                        ))}
                    </select>

                    {error && (
                        <div className="form-error" role="alert">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="success-message" role="status">
                            {success}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={submitting || !announcementsEnabled}
                    >
                        <Send size={16} />
                        {submitting ? 'Publishing...' : 'Publish Announcement'}
                    </button>
                </form>
            </div>

            <div className="staff-table-card">
                <div className="section-heading">
                    <div>
                        <h3>Published Announcements</h3>
                        <p>Announcements created by your school.</p>
                    </div>
                    <span>{announcements.length} total</span>
                </div>

                {loading ? (
                    <p>Loading announcements...</p>
                ) : announcements.length === 0 ? (
                    <div className="empty-state">
                        <Megaphone size={30} />
                        <p>No announcements have been published yet.</p>
                    </div>
                ) : (
                    <div className="announcement-list">
                        {announcements.map((announcement) => (
                            <article
                                className="announcement-card"
                                key={announcement.id}
                            >
                                <div className="announcement-card-heading">
                                    <div>
                                        <h4>{announcement.title}</h4>
                                        <span className="role-label">
                                            {announcement.category}
                                        </span>
                                        <span className="role-label">
                                            {announcement.priority}
                                        </span>
                                    </div>

                                    {announcement.priority === 'urgent' && (
                                        <AlertTriangle size={19} />
                                    )}
                                </div>

                                <p className="announcement-message">
                                    {announcement.body}
                                </p>

                                <div className="announcement-meta">
                                    <span>
                                        <Users size={14} />
                                        {getClassName(announcement.class_id)}
                                    </span>

                                    <span>
                                        <CalendarDays size={14} />
                                        {formatDate(
                                            announcement.published_at ||
                                            announcement.created_at
                                        )}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
