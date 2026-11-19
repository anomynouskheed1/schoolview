
import { useCallback, useEffect, useState } from 'react';
import {
    RefreshCw,
    School,
    FileText,
    Users,
    GraduationCap,
    Camera,
    Link2,
    TrendingUp,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type AnalyticsData = {
    schools: {
        total: number;
        active: number;
        pending: number;
        suspended: number;
        rejected: number;
    };
    applications: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
    };
    users: number;
    students: number;
    parent_links: {
        total: number;
        approved: number;
        pending: number;
        rejected: number;
    };
    cameras: {
        total: number;
        online: number;
        offline: number;
        maintenance: number;
        disabled: number;
    };
};

const emptyData: AnalyticsData = {
    schools: { total: 0, active: 0, pending: 0, suspended: 0, rejected: 0 },
    applications: { total: 0, pending: 0, approved: 0, rejected: 0 },
    users: 0,
    students: 0,
    parent_links: { total: 0, approved: 0, pending: 0, rejected: 0 },
    cameras: { total: 0, online: 0, offline: 0, maintenance: 0, disabled: 0 },
};

export default function Analytics() {
    const [data, setData] = useState<AnalyticsData>(emptyData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setError('');

        const { data: result, error: fetchError } =
            await supabase.rpc('get_platform_analytics');

        if (fetchError) {
            setError(fetchError.message);
            setLoading(false);
            return;
        }

        setData({
            ...emptyData,
            ...(result as Partial<AnalyticsData>),
        });

        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchAnalytics();
    }, [fetchAnalytics]);

    const MetricCard = ({
        title,
        value,
        icon: Icon,
        description,
    }: {
        title: string;
        value: number;
        icon: typeof School;
        description: string;
    }) => (
        <div className="analytics-card">
            <div className="analytics-card-top">
                <span>{title}</span>
                <div className="analytics-icon">
                    <Icon size={20} />
                </div>
            </div>
            <strong>{loading ? '—' : value.toLocaleString()}</strong>
            <small>{description}</small>
        </div>
    );

    return (
        <div className="analytics-page">
            <div className="analytics-heading">
                <div>
                    <p className="analytics-eyebrow">Platform insights</p>
                    <h1>Analytics</h1>
                    <p>Understand SchoolView's overall platform activity.</p>
                </div>

                <button
                    className="analytics-refresh"
                    onClick={() => void fetchAnalytics()}
                    disabled={loading}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="analytics-error">
                    {error}
                </div>
            )}

            <div className="analytics-summary">
                <MetricCard
                    title="Registered schools"
                    value={data.schools.total}
                    icon={School}
                    description={`${data.schools.active} active schools`}
                />
                <MetricCard
                    title="Total applications"
                    value={data.applications.total}
                    icon={FileText}
                    description={`${data.applications.pending} awaiting review`}
                />
                <MetricCard
                    title="Registered users"
                    value={data.users}
                    icon={Users}
                    description="Platform accounts"
                />
                <MetricCard
                    title="Students"
                    value={data.students}
                    icon={GraduationCap}
                    description="Registered student records"
                />
                <MetricCard
                    title="Cameras"
                    value={data.cameras.total}
                    icon={Camera}
                    description={`${data.cameras.online} reported online`}
                />
                <MetricCard
                    title="Parent links"
                    value={data.parent_links.total}
                    icon={Link2}
                    description={`${data.parent_links.approved} approved links`}
                />
            </div>

            <div className="analytics-sections">
                <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                        <School size={19} />
                        <h2>School status</h2>
                    </div>

                    {[
                        ['Active', data.schools.active],
                        ['Pending', data.schools.pending],
                        ['Suspended', data.schools.suspended],
                        ['Rejected', data.schools.rejected],
                    ].map(([label, value]) => (
                        <div className="analytics-row" key={label}>
                            <span>{label}</span>
                            <strong>{loading ? '—' : value}</strong>
                        </div>
                    ))}
                </section>

                <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                        <FileText size={19} />
                        <h2>Application outcomes</h2>
                    </div>

                    {[
                        ['Pending', data.applications.pending],
                        ['Approved', data.applications.approved],
                        ['Rejected', data.applications.rejected],
                    ].map(([label, value]) => (
                        <div className="analytics-row" key={label}>
                            <span>{label}</span>
                            <strong>{loading ? '—' : value}</strong>
                        </div>
                    ))}
                </section>

                <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                        <Camera size={19} />
                        <h2>Camera status</h2>
                    </div>

                    {[
                        ['Online', data.cameras.online],
                        ['Offline', data.cameras.offline],
                        ['Maintenance', data.cameras.maintenance],
                        ['Disabled', data.cameras.disabled],
                    ].map(([label, value]) => (
                        <div className="analytics-row" key={label}>
                            <span>{label}</span>
                            <strong>{loading ? '—' : value}</strong>
                        </div>
                    ))}
                </section>

                <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                        <Link2 size={19} />
                        <h2>Parent approvals</h2>
                    </div>

                    {[
                        ['Approved', data.parent_links.approved],
                        ['Pending', data.parent_links.pending],
                        ['Rejected', data.parent_links.rejected],
                    ].map(([label, value]) => (
                        <div className="analytics-row" key={label}>
                            <span>{label}</span>
                            <strong>{loading ? '—' : value}</strong>
                        </div>
                    ))}
                </section>
            </div>

            <div className="analytics-footer">
                <TrendingUp size={18} />
                <span>
                    Statistics are calculated from the current database records.
                    Live stream health and historical trends are not included yet.
                </span>
            </div>
        </div>
    );
}
