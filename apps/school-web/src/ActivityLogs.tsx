
import { useEffect, useMemo, useState } from 'react';
import {
    ShieldCheck,
    RefreshCw,
    Search,
    Clock,
    User,
    FileText,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type ActivityLog = {
    id: string;
    school_id: string | null;
    actor_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
};

type Props = {
    schoolId: string;
};

export default function ActivityLogs({ schoolId }: Props) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadLogs();
    }, [schoolId]);

    async function loadLogs() {
        setLoading(true);
        setError('');

        const { data, error: queryError } = await supabase
            .from('audit_logs')
            .select(
                'id, school_id, actor_id, action, resource_type, resource_id, details, ip_address, created_at'
            )
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (queryError) {
            setError(queryError.message);
        } else {
            setLogs((data || []) as ActivityLog[]);
        }

        setLoading(false);
    }

    const filteredLogs = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return logs;

        return logs.filter((log) => {
            const searchableText = [
                log.action,
                log.resource_type,
                log.resource_id,
                log.actor_id,
                JSON.stringify(log.details || {}),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchableText.includes(term);
        });
    }, [logs, search]);

    function formatDate(date: string) {
        return new Date(date).toLocaleString();
    }

    function formatAction(action: string) {
        return action
            .replace(/[._-]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function formatActor(actorId: string | null) {
        if (!actorId) return 'System';
        return `${actorId.slice(0, 8)}...`;
    }

    return (
        <div className="page-content">
            <div className="section-heading">
                <div>
                    <h2>Security & Activity Logs</h2>
                    <p>Monitor important actions performed within your school.</p>
                </div>

                <button
                    type="button"
                    className="refresh-button"
                    onClick={loadLogs}
                    disabled={loading}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="section-icon">
                        <ShieldCheck size={20} />
                    </div>
                    <h3>{logs.length}</h3>
                    <p>Recorded Activities</p>
                </div>

                <div className="stat-card">
                    <div className="section-icon">
                        <Clock size={20} />
                    </div>
                    <h3>
                        {logs.filter((log) => {
                            const logDate = new Date(log.created_at);
                            const today = new Date();

                            return logDate.toDateString() === today.toDateString();
                        }).length}
                    </h3>
                    <p>Activities Today</p>
                </div>
            </div>

            <div className="staff-search-card">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search actions, users, or resources..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="staff-table-card">
                <div className="section-heading">
                    <div>
                        <h3>Activity History</h3>
                        <p>Showing the latest 200 recorded activities.</p>
                    </div>

                    <span>{filteredLogs.length} records</span>
                </div>

                {loading ? (
                    <p>Loading activity logs...</p>
                ) : filteredLogs.length === 0 ? (
                    <div className="empty-state">
                        <ShieldCheck size={30} />
                        <p>
                            {search
                                ? 'No activities match your search.'
                                : 'No activity records found yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="activity-log-list">
                        {filteredLogs.map((log) => (
                            <article className="activity-log-card" key={log.id}>
                                <div className="activity-log-icon">
                                    <FileText size={19} />
                                </div>

                                <div className="activity-log-content">
                                    <div className="activity-log-heading">
                                        <h4>{formatAction(log.action)}</h4>
                                        <span>{formatDate(log.created_at)}</span>
                                    </div>

                                    <div className="activity-log-meta">
                                        <span>
                                            <User size={14} />
                                            {formatActor(log.actor_id)}
                                        </span>

                                        {log.resource_type && (
                                            <span>
                                                Resource: {log.resource_type}
                                            </span>
                                        )}

                                        {log.resource_id && (
                                            <span>
                                                ID: {log.resource_id.slice(0, 12)}
                                            </span>
                                        )}
                                    </div>

                                    {log.details &&
                                        Object.keys(log.details).length > 0 && (
                                            <details className="activity-log-details">
                                                <summary>View activity details</summary>
                                                <pre>
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
