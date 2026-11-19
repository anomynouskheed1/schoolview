
import { useEffect, useState } from 'react';
import {
    Users,
    RefreshCw,
    UserRound,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type ParentLink = {
    id: string;
    parent_id: string;
    student_id: string;
    relationship: string;
    status: string;
    created_at: string;
    profiles: {
        full_name: string | null;
        phone: string | null;
    } | null;
    students: {
        full_name: string;
        admission_number: string;
    } | null;
};

export default function Parents({ schoolId }: { schoolId: string }) {
    const [parents, setParents] = useState<ParentLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const loadParents = async () => {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
            .from('parent_students')
            .select(`
                id,
                parent_id,
                student_id,
                relationship,
                status,
                created_at,
                profiles(full_name, phone),
                students(full_name, admission_number)
            `)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (fetchError) {
            setError(fetchError.message);
            setParents([]);
        } else {
            setParents((data || []) as unknown as ParentLink[]);
        }

        setLoading(false);
    };

    useEffect(() => {
        void loadParents();
    }, [schoolId]);

    const filteredParents = parents.filter((parent) => {
        const term = search.toLowerCase();

        const matchesSearch =
            (parent.profiles?.full_name || '').toLowerCase().includes(term) ||
            (parent.profiles?.phone || '').toLowerCase().includes(term) ||
            (parent.students?.full_name || '').toLowerCase().includes(term) ||
            (parent.students?.admission_number || '').toLowerCase().includes(term);

        const matchesStatus =
            statusFilter === 'all' || parent.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const uniqueParents = new Set(parents.map((parent) => parent.parent_id));

    const approvedCount = parents.filter(
        (parent) => parent.status === 'approved'
    ).length;

    const pendingCount = parents.filter(
        (parent) => parent.status === 'pending'
    ).length;

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>Parents & Guardians</h2>
                    <p>View family accounts linked to your students.</p>
                </div>

                <div className="staff-total">
                    <Users size={17} />
                    {uniqueParents.size} {uniqueParents.size === 1 ? 'Parent' : 'Parents'}
                </div>
            </div>

            <div className="stats-grid parent-stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <Users size={20} />
                    </div>
                    <p>Parent accounts</p>
                    <strong>{uniqueParents.size}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <UserRound size={20} />
                    </div>
                    <p>Approved links</p>
                    <strong>{approvedCount}</strong>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <RefreshCw size={20} />
                    </div>
                    <p>Pending links</p>
                    <strong>{pendingCount}</strong>
                </div>
            </div>

            <div className="staff-table-card">
                <div className="table-heading">
                    <div>
                        <h3>Linked parents and guardians</h3>
                        <p>Each record represents a parent-child relationship.</p>
                    </div>

                    <button
                        type="button"
                        className="refresh-button"
                        onClick={() => void loadParents()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>

                <div className="parent-filters">
                    <input
                        type="search"
                        placeholder="Search parent, phone or student..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="revoked">Revoked</option>
                    </select>
                </div>

                {error && <div className="form-error">{error}</div>}

                {loading ? (
                    <div className="table-state">Loading parent records...</div>
                ) : filteredParents.length === 0 ? (
                    <div className="table-state">
                        <Users size={30} />
                        <strong>No parent records found</strong>
                        <span>
                            Parent-child relationships will appear here when
                            they are submitted.
                        </span>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="staff-table">
                            <thead>
                                <tr>
                                    <th>Parent / Guardian</th>
                                    <th>Phone</th>
                                    <th>Student</th>
                                    <th>Admission number</th>
                                    <th>Relationship</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredParents.map((parent) => (
                                    <tr key={parent.id}>
                                        <td>
                                            <strong>
                                                {parent.profiles?.full_name || 'Parent account'}
                                            </strong>
                                        </td>
                                        <td>{parent.profiles?.phone || '—'}</td>
                                        <td>
                                            {parent.students?.full_name || 'Student record'}
                                        </td>
                                        <td>
                                            {parent.students?.admission_number || '—'}
                                        </td>
                                        <td>
                                            <span className="role-label">
                                                {parent.relationship}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="role-label">
                                                {parent.status}
                                            </span>
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
