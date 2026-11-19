
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    RefreshCw,
    Search,
    ShieldCheck,
    Clock,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type AuditRecord = {
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

export default function ActivityLogs() {
    const [logs, setLogs] = useState<AuditRecord[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
            .from('audit_logs')
            .select(`
                id,
                school_id,
                actor_id,
                action,
                resource_type,
                resource_id,
                details,
                ip_address,
                created_at
            `)
            .order('created_at', { ascending: false })
            .limit(200);

        if (fetchError) {
            setError(fetchError.message);
            setLogs([]);
            setSelectedLog(null);
            setLoading(false);
            return;
        }

        const records = (data ?? []) as AuditRecord[];
        setLogs(records);

        setSelectedLog((current) =>
            current
                ? records.find((log) => log.id === current.id) ?? null
                : null
        );

        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    const filteredLogs = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return logs;

        return logs.filter((log) =>
            [
                log.action,
                log.resource_type,
                log.resource_id,
                log.actor_id,
                log.school_id,
                log.ip_address,
                JSON.stringify(log.details ?? {}),
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value).toLowerCase().includes(term)
                )
        );
    }, [logs, search]);

    return (
        <div className="activity-page">
            <div className="activity-heading">
                <div>
                    <p className="activity-eyebrow">Platform security</p>
                    <h1>Security & Activity Logs</h1>
                    <p>Review recorded actions and important platform events.</p>
                </div>

                <button
                    className="activity-refresh"
                    onClick={() => void fetchLogs()}
                    disabled={loading}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="activity-notice">
                <ShieldCheck size={19} />
                <span>
                    These records are retrieved from the platform audit log.
                    This page is read-only; it does not modify or delete audit records.
                </span>
            </div>

            {error && (
                <div className="activity-error">
                    {error}
                </div>
            )}

            <div className="activity-toolbar">
                <div className="activity-search">
                    <Search size={17} />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search actions, users, resources or IDs..."
                    />
                </div>

                <span>{filteredLogs.length} events</span>
            </div>

            <div className="activity-layout">
                <section className="activity-list">
                    <div className="activity-list-header">
                        <Activity size={18} />
                        <strong>Recent activity</strong>
                    </div>

                    {loading ? (
                        <div className="activity-empty">
                            Loading activity logs...
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="activity-empty">
                            <Activity size={28} />
                            <strong>No activity found</strong>
                            <span>Recorded platform events will appear here.</span>
                        </div>
                    ) : (
                        filteredLogs.map((log) => (
                            <button
                                key={log.id}
                                className={`activity-item ${selectedLog?.id === log.id ? 'selected' : ''
                                    }`}
                                onClick={() => setSelectedLog(log)}
                            >
                                <span className="activity-item-icon">
                                    <Activity size={18} />
                                </span>

                                <span className="activity-item-content">
                                    <strong>{log.action}</strong>
                                    <small>
                                        {log.resource_type || 'Platform event'}
                                    </small>
                                    <small>
                                        {new Date(log.created_at).toLocaleString()}
                                    </small>
                                </span>
                            </button>
                        ))
                    )}
                </section>

                <section className="activity-details">
                    {!selectedLog ? (
                        <div className="activity-details-empty">
                            <ShieldCheck size={34} />
                            <strong>Select an activity</strong>
                            <span>
                                Choose an event to inspect its recorded details.
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className="activity-details-heading">
                                <span className="activity-detail-icon">
                                    <ShieldCheck size={23} />
                                </span>
                                <div>
                                    <h2>{selectedLog.action}</h2>
                                    <span>
                                        {selectedLog.resource_type || 'Platform event'}
                                    </span>
                                </div>
                            </div>

                            <div className="activity-information">
                                <div>
                                    <span>Event ID</span>
                                    <strong>{selectedLog.id}</strong>
                                </div>

                                <div>
                                    <span>Actor ID</span>
                                    <strong>{selectedLog.actor_id || 'Not recorded'}</strong>
                                </div>

                                <div>
                                    <span>School ID</span>
                                    <strong>{selectedLog.school_id || 'Platform-wide'}</strong>
                                </div>

                                <div>
                                    <span>Resource type</span>
                                    <strong>{selectedLog.resource_type || 'Not recorded'}</strong>
                                </div>

                                <div>
                                    <span>Resource ID</span>
                                    <strong>{selectedLog.resource_id || 'Not recorded'}</strong>
                                </div>

                                <div>
                                    <span>IP address</span>
                                    <strong>{selectedLog.ip_address || 'Not recorded'}</strong>
                                </div>

                                <div>
                                    <span>Date and time</span>
                                    <strong>
                                        {new Date(selectedLog.created_at).toLocaleString()}
                                    </strong>
                                </div>
                            </div>

                            <div className="activity-json">
                                <div>
                                    <Clock size={17} />
                                    <strong>Event details</strong>
                                </div>
                                <pre>
                                    {JSON.stringify(
                                        selectedLog.details ?? {},
                                        null,
                                        2
                                    )}
                                </pre>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
