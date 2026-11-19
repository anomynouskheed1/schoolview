
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';

export default function SchoolApplication() {
    const navigate = useNavigate();

    const [schoolName, setSchoolName] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [county, setCounty] = useState('');
    const [town, setTown] = useState('');
    const [address, setAddress] = useState('');

    const [loading, setLoading] = useState(false);
    const [checkingUser, setCheckingUser] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function checkUser() {
            const { data, error } = await supabase.auth.getUser();

            if (error || !data.user) {
                navigate('/login');
                return;
            }

            setContactEmail(data.user.email ?? '');
            setCheckingUser(false);
        }

        void checkUser();
    }, [navigate]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data: authData, error: authError } =
                await supabase.auth.getUser();

            if (authError || !authData.user) {
                navigate('/login');
                return;
            }

            const user = authData.user;

            const { data: existing, error: existingError } = await supabase
                .from('school_applications')
                .select('id, status')
                .eq('applicant_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (existingError) throw existingError;

            if (existing?.length) {
                if (existing[0].status === 'pending') {
                    navigate('/application-status');
                    return;
                }

                if (existing[0].status === 'approved') {
                    navigate('/');
                    return;
                }
            }

            const { error: insertError } = await supabase
                .from('school_applications')
                .insert({
                    applicant_id: user.id,
                    school_name: schoolName.trim(),
                    registration_number: registrationNumber.trim(),
                    contact_email: contactEmail.trim().toLowerCase(),
                    contact_phone: contactPhone.trim(),
                    county: county.trim(),
                    town: town.trim(),
                    address: address.trim(),
                    status: 'pending',
                });

            if (insertError) throw insertError;

            navigate('/application-status');
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'We could not submit your application. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }

    if (checkingUser) {
        return <main className="auth-page">Checking your account...</main>;
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="auth-heading">
                    <h1>Register your school</h1>
                    <p>
                        Provide your school's details. Our System Manager will review
                        your application before your school is activated.
                    </p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <label htmlFor="schoolName">School name</label>
                    <input
                        id="schoolName"
                        value={schoolName}
                        onChange={(event) => setSchoolName(event.target.value)}
                        placeholder="Enter the official school name"
                        required
                    />

                    <label htmlFor="registrationNumber">
                        School registration number
                    </label>
                    <input
                        id="registrationNumber"
                        value={registrationNumber}
                        onChange={(event) => setRegistrationNumber(event.target.value)}
                        placeholder="Enter the registration number"
                        required
                    />

                    <label htmlFor="contactEmail">School contact email</label>
                    <input
                        id="contactEmail"
                        type="email"
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        placeholder="School email address"
                        required
                    />

                    <label htmlFor="contactPhone">School contact phone</label>
                    <input
                        id="contactPhone"
                        type="tel"
                        value={contactPhone}
                        onChange={(event) => setContactPhone(event.target.value)}
                        placeholder="School phone number"
                        required
                    />

                    <label htmlFor="county">County</label>
                    <input
                        id="county"
                        value={county}
                        onChange={(event) => setCounty(event.target.value)}
                        placeholder="e.g. Nairobi"
                        required
                    />

                    <label htmlFor="town">Town</label>
                    <input
                        id="town"
                        value={town}
                        onChange={(event) => setTown(event.target.value)}
                        placeholder="Enter the town"
                        required
                    />

                    <label htmlFor="address">Physical address</label>
                    <textarea
                        id="address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder="Enter the school's physical address"
                        rows={3}
                        required
                    />

                    <button type="submit" disabled={loading}>
                        {loading ? 'Submitting application...' : 'Submit school application'}
                    </button>
                </form>

                <p className="auth-footer">
                    <Link to="/login">Return to login</Link>
                </p>
            </section>
        </main>
    );
}
