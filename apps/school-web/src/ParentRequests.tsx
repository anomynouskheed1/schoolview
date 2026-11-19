
import { useEffect, useState } from 'react';
import { Check, X, RefreshCw, ClipboardList } from 'lucide-react';
import { supabase } from './lib/supabase';

type ParentRequest = {
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

export default function ParentRequests({ schoolId }: { schoolId: string }) {
    const [requests, setRequests] = useState<ParentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadRequests = async () => {
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
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (fetchError) {
            setError(fetchError.message);
            setRequests([]);
        } else {
            setRequests((data || []) as unknown as ParentRequest[]);
        }

        setLoading(false);
    };

    useEffect(() => {
        void loadRequests();
    }, [schoolId]);

    const reviewRequest = async (
        requestId: string,
        decision: 'approved' | 'rejected'
    ) => {
        const action = decision === 'approved' ? 'approve' : 'reject';

        if (!window.confirm(`Are you sure you want to ${action} this parent request?`)) {
            return;
        }

        setProcessingId(requestId);
        setError('');
        setMessage('');

        const { error: reviewError } = await supabase.rpc(
            'review_parent_request',
            {
                target_parent_student_id: requestId,
                decision,
                review_notes: null,
            }
        );

        if (reviewError) {
            setError(reviewError.message);
        } else {
            setMessage(
                decision === 'approved'
                    ? 'Parent request approved successfully.'
                    : 'Parent request rejected successfully.'
            );

            await loadRequests();
        }

        setProcessingId(null);
    };

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>Parent Requests</h2>
                    <p>Review requests from parents who want to link their children to your school.</p>
                </div>

                <div className="staff-total">
                    <ClipboardList size={17} />
                    {requests.length} Pending
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <ClipboardList size={20} />
                    </div>
                    <p>Pending requests</p>
                    <strong>{requests.length}</strong>
                </div>
            </div>

            <div className="staff-table-card">
                <div className="table-heading">
                    <div>
                        <h3>Requests awaiting review</h3>
                        <p>Confirm the parent and student details before making a decision.</p>
                    </div>

                    <button
                        type="button"
                        className="refresh-button"
                        onClick={() => void loadRequests()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>

                {error && <div className="form-error">{error}</div>}
                {message && <div className="success-message">{message}</div>}

                {loading ? (
                    <div className="table-state">Loading parent requests...</div>
                ) : requests.length === 0 ? (
                    <div className="table-state">
                        <ClipboardList size={30} />
                        <strong>No pending requests</strong>
                        <span>New parent-child link requests will appear here.</span>
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
                                    <th>Submitted</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {requests.map((request) => (
                                    <tr key={request.id}>
                                        <td>
                                            <strong>
                                                {request.profiles?.full_name || 'Parent account'}
                                            </strong>
                                        </td>
                                        <td>{request.profiles?.phone || '—'}</td>
                                        <td>{request.students?.full_name || 'Student record'}</td>
                                        <td>{request.students?.admission_number || '—'}</td>
                                        <td>
                                            <span className="role-label">
                                                {request.relationship}
                                            </span>
                                        </td>
                                        <td>
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div className="parent-request-actions">
                                                <button
                                                    type="button"
                                                    className="parent-approve-button"
                                                    disabled={processingId !== null}
                                                    onClick={() =>
                                                        void reviewRequest(request.id, 'approved')
                                                    }
                                                >
                                                    <Check size={14} />
                                                    {processingId === request.id ? 'Working...' : 'Approve'}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="parent-reject-button"
                                                    disabled={processingId !== null}
                                                    onClick={() =>
                                                        void reviewRequest(request.id, 'rejected')
                                                    }
                                                >
                                                    <X size={14} />
                                                    Reject
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
