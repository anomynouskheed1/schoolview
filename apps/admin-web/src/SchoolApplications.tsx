
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Building2,
    CheckCircle2,
    Clock3,
    FileText,
    Mail,
    MapPin,
    Phone,
    RefreshCw,
    Search,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

type SchoolApplication = {
    id: string;
    applicant_id: string;
    school_name: string;
    registration_number: string;
    contact_email: string;
    contact_phone: string;
    county: string;
    town: string;
    address: string;
    status: ApplicationStatus;
    review_notes: string | null;
    created_at: string;
    reviewed_at: string | null;
};

type StatusFilter = 'all' | ApplicationStatus;

export default function SchoolApplications() {
    const [applications, setApplications] = useState<SchoolApplication[]>([]);
    const [selectedApplication, setSelectedApplication] =
        useState<SchoolApplication | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadApplications = useCallback(async () => {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
            .from('school_applications')
            .select(`
        id,
        applicant_id,
        school_name,
        registration_number,
        contact_email,
        contact_phone,
        county,
        town,
        address,
        status,
        review_notes,
        created_at,
        reviewed_at
      `)
            .order('created_at', { ascending: false });

        if (fetchError) {
            setError(fetchError.message);
            setApplications([]);
        } else {
            setApplications((data || []) as SchoolApplication[]);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        void loadApplications();
    }, [loadApplications]);

    const counts = useMemo(() => ({
        all: applications.length,
        pending: applications.filter((item) => item.status === 'pending').length,
        approved: applications.filter((item) => item.status === 'approved').length,
        rejected: applications.filter((item) => item.status === 'rejected').length,
    }), [applications]);

    const filteredApplications = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        return applications.filter((application) => {
            const matchesStatus =
                statusFilter === 'all' || application.status === statusFilter;

            const matchesSearch =
                !term ||
                [
                    application.school_name,
                    application.registration_number,
                    application.contact_email,
                    application.contact_phone,
                    application.county,
                    application.town,
                ].some((value) => value?.toLowerCase().includes(term));

            return matchesStatus && matchesSearch;
        });
    }, [applications, searchTerm, statusFilter]);

    const selectApplication = (application: SchoolApplication) => {
        setSelectedApplication(application);
        setReviewNotes(application.review_notes || '');
        setSuccess('');
        setError('');
    };

    const reviewApplication = async (
        decision: 'approve' | 'reject'
    ) => {
        if (!selectedApplication) return;

        if (selectedApplication.status !== 'pending') {
            setError('This application has already been reviewed.');
            return;
        }

        if (
            decision === 'reject' &&
            !reviewNotes.trim()
        ) {
            setError('Please provide a reason for rejecting this application.');
            return;
        }

        const confirmed = window.confirm(
            decision === 'approve'
                ? `Approve ${selectedApplication.school_name}? This will create the school and assign its first administrator.`
                : `Reject ${selectedApplication.school_name}'s application?`
        );

        if (!confirmed) return;

        setProcessing(true);
        setError('');
        setSuccess('');

        const functionName =
            decision === 'approve'
                ? 'approve_school_application'
                : 'reject_school_application';

        const argumentsForRpc =
            decision === 'approve'
                ? {
                    target_application_id: selectedApplication.id,
                    approval_notes: reviewNotes.trim() || null,
                }
                : {
                    target_application_id: selectedApplication.id,
                    rejection_notes: reviewNotes.trim(),
                };

        const { error: reviewError } = await supabase.rpc(
            functionName,
            argumentsForRpc
        );

        if (reviewError) {
            setError(reviewError.message);
            setProcessing(false);
            return;
        }

        setSuccess(
            decision === 'approve'
                ? 'School application approved successfully.'
                : 'School application rejected successfully.'
        );

        setSelectedApplication(null);
        setReviewNotes('');

        await loadApplications();
        setProcessing(false);
    };

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('en-KE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });

    const statusLabel = (status: ApplicationStatus) => {
        if (status === 'approved') return 'Approved';
        if (status === 'rejected') return 'Rejected';
        return 'Pending review';
    };

    return (
        <div className="applications-page">
            <div className="applications-heading">
                <div>
                    <div className="applications-eyebrow">
                        <ShieldCheck size={15} />
                        PLATFORM MANAGEMENT
                    </div>
                    <h1>School Applications</h1>
                    <p>
                        Review school registration requests and manage their approval.
                    </p>
                </div>

                <button
                    className="applications-refresh"
                    onClick={() => void loadApplications()}
                    disabled={loading || processing}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="applications-alert applications-alert-error">
                    <XCircle size={18} />
                    {error}
                </div>
            )}

            {success && (
                <div className="applications-alert applications-alert-success">
                    <CheckCircle2 size={18} />
                    {success}
                </div>
            )}

            <div className="applications-stats">
                <div className="applications-stat">
                    <span>Total applications</span>
                    <strong>{counts.all}</strong>
                </div>

                <div className="applications-stat">
                    <span>Pending review</span>
                    <strong>{counts.pending}</strong>
                </div>

                <div className="applications-stat">
                    <span>Approved</span>
                    <strong>{counts.approved}</strong>
                </div>

                <div className="applications-stat">
                    <span>Rejected</span>
                    <strong>{counts.rejected}</strong>
                </div>
            </div>

            <div className="applications-toolbar">
                <div className="applications-filters">
                    {(
                        ['all', 'pending', 'approved', 'rejected'] as StatusFilter[]
                    ).map((filter) => (
                        <button
                            key={filter}
                            className={
                                statusFilter === filter
                                    ? 'applications-filter active'
                                    : 'applications-filter'
                            }
                            onClick={() => {
                                setStatusFilter(filter);
                                setSelectedApplication(null);
                            }}
                        >
                            {filter === 'all'
                                ? 'All'
                                : filter.charAt(0).toUpperCase() + filter.slice(1)}
                            <span>{counts[filter]}</span>
                        </button>
                    ))}
                </div>

                <div className="applications-search">
                    <Search size={17} />
                    <input
                        type="search"
                        placeholder="Search schools, email or county..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
            </div>

            <div className="applications-layout">
                <section className="applications-list">
                    <div className="applications-list-header">
                        <h2>Submitted applications</h2>
                        <span>{filteredApplications.length} results</span>
                    </div>

                    {loading ? (
                        <div className="applications-empty">
                            <RefreshCw className="applications-spinner" size={24} />
                            <p>Loading applications...</p>
                        </div>
                    ) : filteredApplications.length === 0 ? (
                        <div className="applications-empty">
                            <FileText size={30} />
                            <h3>No applications found</h3>
                            <p>
                                There are no applications matching your current search or
                                filter.
                            </p>
                        </div>
                    ) : (
                        <div className="applications-items">
                            {filteredApplications.map((application) => (
                                <button
                                    key={application.id}
                                    className={
                                        selectedApplication?.id === application.id
                                            ? 'application-item selected'
                                            : 'application-item'
                                    }
                                    onClick={() => selectApplication(application)}
                                >
                                    <div className="application-item-icon">
                                        <Building2 size={21} />
                                    </div>

                                    <div className="application-item-content">
                                        <strong>{application.school_name}</strong>
                                        <span>
                                            {application.town || application.county}
                                        </span>
                                        <small>
                                            Submitted {formatDate(application.created_at)}
                                        </small>
                                    </div>

                                    <span
                                        className={`application-status status-${application.status}`}
                                    >
                                        {statusLabel(application.status)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className="application-details">
                    {!selectedApplication ? (
                        <div className="applications-empty application-details-empty">
                            <FileText size={32} />
                            <h3>Application details</h3>
                            <p>
                                Select an application to review its information and make a
                                decision.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="application-details-header">
                                <div>
                                    <span className="applications-detail-label">
                                        APPLICATION DETAILS
                                    </span>
                                    <h2>{selectedApplication.school_name}</h2>
                                </div>

                                <span
                                    className={`application-status status-${selectedApplication.status}`}
                                >
                                    {statusLabel(selectedApplication.status)}
                                </span>
                            </div>

                            <div className="application-information">
                                <div className="application-information-row">
                                    <FileText size={18} />
                                    <div>
                                        <span>Registration number</span>
                                        <strong>
                                            {selectedApplication.registration_number || 'Not provided'}
                                        </strong>
                                    </div>
                                </div>

                                <div className="application-information-row">
                                    <Mail size={18} />
                                    <div>
                                        <span>Contact email</span>
                                        <strong>{selectedApplication.contact_email}</strong>
                                    </div>
                                </div>

                                <div className="application-information-row">
                                    <Phone size={18} />
                                    <div>
                                        <span>Contact phone</span>
                                        <strong>{selectedApplication.contact_phone}</strong>
                                    </div>
                                </div>

                                <div className="application-information-row">
                                    <MapPin size={18} />
                                    <div>
                                        <span>County</span>
                                        <strong>{selectedApplication.county}</strong>
                                    </div>
                                </div>

                                <div className="application-information-row">
                                    <Building2 size={18} />
                                    <div>
                                        <span>Town</span>
                                        <strong>{selectedApplication.town}</strong>
                                    </div>
                                </div>

                                <div className="application-information-row">
                                    <MapPin size={18} />
                                    <div>
                                        <span>Physical address</span>
                                        <strong>{selectedApplication.address}</strong>
                                    </div>
                                </div>

                                <div className="application-information-row">
                                    <Clock3 size={18} />
                                    <div>
                                        <span>Submission date</span>
                                        <strong>{formatDate(selectedApplication.created_at)}</strong>
                                    </div>
                                </div>
                            </div>

                            {selectedApplication.status !== 'pending' && (
                                <div className="application-previous-review">
                                    <strong>Review information</strong>
                                    <p>
                                        {selectedApplication.review_notes ||
                                            'No review notes were provided.'}
                                    </p>
                                    {selectedApplication.reviewed_at && (
                                        <small>
                                            Reviewed {formatDate(selectedApplication.reviewed_at)}
                                        </small>
                                    )}
                                </div>
                            )}

                            {selectedApplication.status === 'pending' && (
                                <div className="application-review-form">
                                    <label htmlFor="application-review-notes">
                                        Review notes
                                    </label>
                                    <textarea
                                        id="application-review-notes"
                                        rows={4}
                                        placeholder="Add approval notes or explain why the application is being rejected..."
                                        value={reviewNotes}
                                        onChange={(event) => setReviewNotes(event.target.value)}
                                        disabled={processing}
                                    />

                                    <div className="application-review-actions">
                                        <button
                                            className="application-reject-button"
                                            onClick={() => void reviewApplication('reject')}
                                            disabled={processing}
                                        >
                                            <XCircle size={17} />
                                            Reject
                                        </button>

                                        <button
                                            className="application-approve-button"
                                            onClick={() => void reviewApplication('approve')}
                                            disabled={processing}
                                        >
                                            <CheckCircle2 size={17} />
                                            Approve school
                                        </button>
                                    </div>

                                    {processing && (
                                        <p className="application-processing">
                                            Processing your decision...
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
