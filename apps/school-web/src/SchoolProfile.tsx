
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Save, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabase';

type School = {
    id: string;
    name: string;
    school_code: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    county: string | null;
    status: string;
};

export default function SchoolProfile({ schoolId }: { schoolId: string }) {
    const [school, setSchool] = useState<School | null>(null);
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        county: '',
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadSchool = async () => {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
            .from('schools')
            .select(
                'id, name, school_code, email, phone, address, county, status'
            )
            .eq('id', schoolId)
            .single();

        if (fetchError) {
            setError(fetchError.message);
            setSchool(null);
        } else {
            const record = data as School;
            setSchool(record);

            setForm({
                name: record.name || '',
                email: record.email || '',
                phone: record.phone || '',
                address: record.address || '',
                county: record.county || '',
            });
        }

        setLoading(false);
    };

    useEffect(() => {
        void loadSchool();
    }, [schoolId]);

    const handleSave = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!school) return;

        setSaving(true);
        setError('');
        setSuccess('');

        const { data, error: updateError } = await supabase
            .from('schools')
            .update({
                name: form.name.trim(),
                email: form.email.trim() || null,
                phone: form.phone.trim() || null,
                address: form.address.trim() || null,
                county: form.county.trim() || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', schoolId)
            .select(
                'id, name, school_code, email, phone, address, county, status'
            )
            .single();

        if (updateError) {
            setError(updateError.message);
        } else {
            const record = data as School;
            setSchool(record);
            setSuccess('School profile updated successfully.');
        }

        setSaving(false);
    };

    if (loading) {
        return <div className="table-state">Loading school profile...</div>;
    }

    if (!school) {
        return (
            <div className="form-error">
                {error || 'School profile could not be loaded.'}
                <button
                    type="button"
                    className="refresh-button"
                    onClick={() => void loadSchool()}
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>School Profile</h2>
                    <p>Manage your school's official information.</p>
                </div>

                <button
                    type="button"
                    className="refresh-button"
                    onClick={() => void loadSchool()}
                    disabled={saving}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="staff-search-card">
                <div className="section-heading">
                    <div className="section-icon">
                        <Building2 size={21} />
                    </div>
                    <div>
                        <h3>School information</h3>
                        <p>
                            Keep your school's contact and location
                            information up to date.
                        </p>
                    </div>
                </div>

                <div className="registered-school-information">
                    <div>
                        <span>School code</span>
                        <strong>{school.school_code}</strong>
                    </div>
                    <div>
                        <span>Account status</span>
                        <strong>{school.status}</strong>
                    </div>
                </div>

                <form onSubmit={handleSave} className="school-profile-form">
                    <label htmlFor="school-name">School name</label>
                    <input
                        id="school-name"
                        value={form.name}
                        onChange={(event) =>
                            setForm({ ...form, name: event.target.value })
                        }
                        required
                    />

                    <label htmlFor="school-email">Contact email</label>
                    <input
                        id="school-email"
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                            setForm({ ...form, email: event.target.value })
                        }
                    />

                    <label htmlFor="school-phone">Phone number</label>
                    <input
                        id="school-phone"
                        value={form.phone}
                        onChange={(event) =>
                            setForm({ ...form, phone: event.target.value })
                        }
                    />

                    <label htmlFor="school-county">County</label>
                    <input
                        id="school-county"
                        value={form.county}
                        onChange={(event) =>
                            setForm({ ...form, county: event.target.value })
                        }
                    />

                    <label htmlFor="school-address">Physical address</label>
                    <textarea
                        id="school-address"
                        rows={3}
                        value={form.address}
                        onChange={(event) =>
                            setForm({ ...form, address: event.target.value })
                        }
                    />

                    {error && <div className="form-error">{error}</div>}
                    {success && (
                        <div className="success-message">{success}</div>
                    )}

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={saving || !form.name.trim()}
                    >
                        <Save size={17} />
                        {saving ? 'Saving...' : 'Save school profile'}
                    </button>
                </form>
            </div>
        </section>
    );
}
