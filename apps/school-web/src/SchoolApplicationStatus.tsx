
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

type Application = {
    id: string;
    school_name: string;
    status: 'pending' | 'approved' | 'rejected';
    review_notes: string | null;
    created_at: string;
};

export default function SchoolApplicationStatus() {
    const navigate = useNavigate();

    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadApplication() {
            const { data: authData, error: authError } =
                await supabase.auth.getUser();

            if (authError || !authData.user) {
                navigate('/login', { replace: true });
                return;
            }

            const { data, error: queryError } = await supabase
                .from('school_applications')
                .select('id, school_name, status, review_notes, created_at')
                .eq('applicant_id', authData.user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (queryError) {
                setError(queryError.message);
            } else {
                setApplication(data as Application | null);
            }

            setLoading(false);
        }

        void loadApplication();
    }, [navigate]);

    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            setError(error.message);
            return;
        }

        navigate('/login', { replace: true });
    }

    if (loading) {
        return (
            <main className="auth-page">
                <div className="auth-card">Loading application status...</div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="auth-page">
                <div className="auth-card">
                    <h1>Unable to load application</h1>
                    <div className="auth-error">{error}</div>
                </div>
            </main>
        );
    }

    if (!application) {
        return (
            <main className="auth-page">
                <div className="auth-card">
                    <h1>No application found</h1>
                    <p>You haven't submitted a school application yet.</p>
                    <button onClick={() => navigate('/apply')}>
                        Submit an application
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="auth-heading">
                    <h1>School application status</h1>
                    <p>{application.school_name}</p>
                </div>

                {application.status === 'pending' && (
                    <div className="auth-success">
                        <h3>Application under review</h3>
                        <p>
                            Your application has been received. Our System Manager
                            will review your school's information.
                        </p>
                        <p>
                            Submitted on:{' '}
                            {new Date(application.created_at).toLocaleDateString()}
                        </p>
                    </div>
                )}

                {application.status === 'approved' && (
                    <div className="auth-success">
                        <h3>School application approved!</h3>
                        <p>
                            Your school has been registered. Your school administrator
                            access has been granted.
                        </p>
                        <button onClick={() => navigate('/', { replace: true })}>
                            Open school dashboard
                        </button>
                    </div>
                )}

                {application.status === 'rejected' && (
                    <div className="auth-error">
                        <h3>Application not approved</h3>
                        <p>
                            {application.review_notes ||
                                'Please contact SchoolView support for more information.'}
                        </p>
                        <button onClick={() => navigate('/apply')}>
                            Submit another application
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    className="secondary-button"
                    onClick={handleSignOut}
                >
                    Sign out
                </button>
            </section>
        </main>
    );
}
