
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

export default function SchoolRegister() {
    const navigate = useNavigate();

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError('');
        setSuccess('');

        if (password.length < 8) {
            setError('Your password must contain at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Your passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const { data, error: signupError } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        phone: phone.trim(),
                    },
                    emailRedirectTo: `${window.location.origin}/login`,
                },
            });

            if (signupError) throw signupError;

            if (data.session) {
                navigate('/apply');
                return;
            }

            setSuccess(
                'Your account has been created. Please check your email and verify your address. After verification, return here and log in to submit your school application.'
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to create your account. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="auth-heading">
                    <h1>Create your SchoolView account</h1>
                    <p>
                        Register using your own details as the representative of your
                        school.
                    </p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {success && <div className="auth-success">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <label htmlFor="fullName">Your full name</label>
                    <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Enter your full name"
                        autoComplete="name"
                        required
                    />

                    <label htmlFor="phone">Phone number</label>
                    <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="Enter your phone number"
                        autoComplete="tel"
                        required
                    />

                    <label htmlFor="email">Email address</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your email address"
                        autoComplete="email"
                        required
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        minLength={8}
                        required
                    />

                    <label htmlFor="confirmPassword">Confirm password</label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Enter your password again"
                        autoComplete="new-password"
                        required
                    />

                    <button type="submit" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create account'}
                    </button>
                </form>

                <p className="auth-footer">
                    Already registered? <Link to="/login">Log in</Link>
                </p>
            </section>
        </main>
    );
}
