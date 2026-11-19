
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Building2,
    RefreshCw,
    Search,
    Mail,
    Phone,
    MapPin,
    ShieldCheck,
    CheckCircle2,
    Ban,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type School = {
    id: string;
    name: string;
    school_code: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    county: string | null;
    status: 'pending' | 'active' | 'suspended' | 'rejected';
    created_at: string;
};

export default function RegisteredSchools() {
    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [success, setSuccess] = useState('');

    const fetchSchools = useCallback(async () => {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
            .from('schools')
            .select(
                'id, name, school_code, email, phone, address, county, status, created_at'
            )
            .order('created_at', { ascending: false });

        if (fetchError) {
            setError(fetchError.message);
            setSchools([]);
            setSelectedSchool(null);
        } else {
            const records = (data ?? []) as School[];
            setSchools(records);

            setSelectedSchool((current) =>
                current
                    ? records.find((school) => school.id === current.id) ?? null
                    : null
            );
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchSchools();
    }, [fetchSchools]);

    const counts = useMemo(
        () => ({
            total: schools.length,
            active: schools.filter((school) => school.status === 'active').length,
            pending: schools.filter((school) => school.status === 'pending').length,
            suspended: schools.filter((school) => school.status === 'suspended').length,
        }),
        [schools]
    );

    const filteredSchools = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return schools;

        return schools.filter((school) =>
            [
                school.name,
                school.school_code,
                school.email,
                school.phone,
                school.county,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term))
        );
    }, [schools, search]);

    const statusClass = (status: string) =>
        `registered-school-status status-${status}`;

    const changeSchoolStatus = async (newStatus: 'active' | 'suspended') => {
        if (!selectedSchool || actionLoading) return;

        const actionLabel =
            newStatus === 'active' ? 'activate' : 'suspend';

        const confirmed = window.confirm(
            `Are you sure you want to ${actionLabel} ${selectedSchool.name}?`
        );

        if (!confirmed) return;

        setActionLoading(true);
        setError('');
        setSuccess('');

        const { data, error: rpcError } = await supabase.rpc(
            'set_school_status',
            {
                target_school_id: selectedSchool.id,
                new_status: newStatus,
            }
        );

        if (rpcError) {
            setError(rpcError.message);
            setActionLoading(false);
            return;
        }

        if (!data?.success) {
            setError('The school status could not be updated.');
            setActionLoading(false);
            return;
        }

        setSuccess(
            `${selectedSchool.name} has been ${newStatus === 'active' ? 'activated' : 'suspended'} successfully.`
        );

        await fetchSchools();
        setActionLoading(false);
    };

    return (
        <div className="registered-schools-page">
            <div className="registered-schools-heading">
                <div>
                    <p className="registered-schools-eyebrow">School management</p>
                    <h1>Registered Schools</h1>
                    <p>View and manage schools registered on SchoolView.</p>
                </div>

                <button
                    className="registered-schools-refresh"
                    onClick={() => void fetchSchools()}
                    disabled={loading || actionLoading}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="registered-schools-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="registered-school-note">
                    <CheckCircle2 size={18} />
                    <div>
                        <strong>Successful</strong>
                        <p>{success}</p>
                    </div>
                </div>
            )}

            <div className="registered-schools-stats">
                <div className="registered-school-stat">
                    <span>Total schools</span>
                    <strong>{counts.total}</strong>
                </div>
                <div className="registered-school-stat">
                    <span>Active schools</span>
                    <strong>{counts.active}</strong>
                </div>
                <div className="registered-school-stat">
                    <span>Pending schools</span>
                    <strong>{counts.pending}</strong>
                </div>
                <div className="registered-school-stat">
                    <span>Suspended schools</span>
                    <strong>{counts.suspended}</strong>
                </div>
            </div>

            <div className="registered-schools-toolbar">
                <div className="registered-schools-search">
                    <Search size={17} />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search schools, codes, email or county..."
                    />
                </div>
                <span>{filteredSchools.length} schools found</span>
            </div>

            <div className="registered-schools-layout">
                <section className="registered-schools-list">
                    <div className="registered-schools-list-header">
                        All schools
                    </div>

                    {loading ? (
                        <div className="registered-schools-empty">
                            Loading schools...
                        </div>
                    ) : filteredSchools.length === 0 ? (
                        <div className="registered-schools-empty">
                            No schools found.
                        </div>
                    ) : (
                        filteredSchools.map((school) => (
                            <button
                                key={school.id}
                                className={`registered-school-item ${selectedSchool?.id === school.id ? 'selected' : ''
                                    }`}
                                onClick={() => {
                                    setSelectedSchool(school);
                                    setError('');
                                    setSuccess('');
                                }}
                            >
                                <span className="registered-school-icon">
                                    <Building2 size={19} />
                                </span>

                                <span className="registered-school-item-content">
                                    <strong>{school.name}</strong>
                                    <small>{school.school_code}</small>
                                    <span className={statusClass(school.status)}>
                                        {school.status}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </section>

                <section className="registered-school-details">
                    {!selectedSchool ? (
                        <div className="registered-school-details-empty">
                            <Building2 size={32} />
                            <strong>Select a school</strong>
                            <span>Choose a school to view its details.</span>
                        </div>
                    ) : (
                        <>
                            <div className="registered-school-details-heading">
                                <div className="registered-school-icon large">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h2>{selectedSchool.name}</h2>
                                    <span className={statusClass(selectedSchool.status)}>
                                        {selectedSchool.status}
                                    </span>
                                </div>
                            </div>

                            <div className="registered-school-information">
                                <div>
                                    <span>School code</span>
                                    <strong>{selectedSchool.school_code}</strong>
                                </div>

                                <div>
                                    <span>Registration date</span>
                                    <strong>
                                        {new Date(selectedSchool.created_at).toLocaleDateString()}
                                    </strong>
                                </div>

                                <div>
                                    <span><Mail size={14} /> Email</span>
                                    <strong>{selectedSchool.email || 'Not provided'}</strong>
                                </div>

                                <div>
                                    <span><Phone size={14} /> Phone</span>
                                    <strong>{selectedSchool.phone || 'Not provided'}</strong>
                                </div>

                                <div>
                                    <span><MapPin size={14} /> County</span>
                                    <strong>{selectedSchool.county || 'Not provided'}</strong>
                                </div>

                                <div>
                                    <span><MapPin size={14} /> Address</span>
                                    <strong>{selectedSchool.address || 'Not provided'}</strong>
                                </div>
                            </div>

                            <div className="registered-school-note">
                                <ShieldCheck size={18} />
                                <div>
                                    <strong>SchoolView registration record</strong>
                                    <p>
                                        School status changes are restricted to authorized
                                        System Managers and recorded in the security audit logs.
                                    </p>
                                </div>
                            </div>

                            <div className="registered-school-actions">
                                {selectedSchool.status === 'active' && (
                                    <button
                                        className="registered-schools-refresh"
                                        onClick={() => void changeSchoolStatus('suspended')}
                                        disabled={actionLoading}
                                    >
                                        <Ban size={16} />
                                        {actionLoading ? 'Processing...' : 'Suspend school'}
                                    </button>
                                )}

                                {selectedSchool.status === 'suspended' && (
                                    <button
                                        className="registered-schools-refresh"
                                        onClick={() => void changeSchoolStatus('active')}
                                        disabled={actionLoading}
                                    >
                                        <CheckCircle2 size={16} />
                                        {actionLoading ? 'Processing...' : 'Activate school'}
                                    </button>
                                )}

                                {(selectedSchool.status === 'pending' ||
                                    selectedSchool.status === 'rejected') && (
                                        <p>
                                            This school cannot be activated from this screen.
                                            Pending and rejected applications use the application
                                            review workflow.
                                        </p>
                                    )}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
