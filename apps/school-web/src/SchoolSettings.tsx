
import { useEffect, useState } from 'react';
import {
    CalendarDays,
    Bell,
    Video,
    ShieldCheck,
    Save,
    RefreshCw,
    RotateCcw,
    CheckCircle2,
    Settings2,
    Globe,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type SchoolSettingsData = {
    academic_year: string;
    current_term: string;
    timezone: string;
    announcements_enabled: boolean;
    parent_notifications_enabled: boolean;
    live_viewing_enabled: boolean;
};

type Props = {
    schoolId: string;
};

const defaultSettings: SchoolSettingsData = {
    academic_year: '2026',
    current_term: 'Term 1',
    timezone: 'Africa/Nairobi',
    announcements_enabled: true,
    parent_notifications_enabled: true,
    live_viewing_enabled: true,
};

export default function SchoolSettings({ schoolId }: Props) {
    const [settings, setSettings] =
        useState<SchoolSettingsData>(defaultSettings);

    const [savedSettings, setSavedSettings] =
        useState<SchoolSettingsData>(defaultSettings);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const hasChanges =
        JSON.stringify(settings) !== JSON.stringify(savedSettings);

    useEffect(() => {
        void loadSettings();
    }, [schoolId]);

    async function loadSettings() {
        setLoading(true);
        setError('');
        setSuccess('');

        const { data, error: fetchError } = await supabase
            .from('school_settings')
            .select(
                'academic_year, current_term, timezone, announcements_enabled, parent_notifications_enabled, live_viewing_enabled'
            )
            .eq('school_id', schoolId)
            .maybeSingle();

        if (fetchError) {
            setError(fetchError.message);
            setLoading(false);
            return;
        }

        const loadedSettings: SchoolSettingsData = data
            ? {
                academic_year: data.academic_year,
                current_term: data.current_term,
                timezone: data.timezone,
                announcements_enabled: data.announcements_enabled,
                parent_notifications_enabled:
                    data.parent_notifications_enabled,
                live_viewing_enabled: data.live_viewing_enabled,
            }
            : { ...defaultSettings };

        setSettings(loadedSettings);
        setSavedSettings(loadedSettings);
        setLoading(false);
    }

    function updateSetting<K extends keyof SchoolSettingsData>(
        key: K,
        value: SchoolSettingsData[K]
    ) {
        setSettings((previous) => ({
            ...previous,
            [key]: value,
        }));

        setError('');
        setSuccess('');
    }

    async function saveSettings() {
        setError('');
        setSuccess('');

        if (!settings.academic_year.trim()) {
            setError('Please enter an academic year.');
            return;
        }

        if (!/^\d{4}(-\d{4})?$/.test(settings.academic_year.trim())) {
            setError('Enter a valid academic year, for example 2026 or 2026-2027.');
            return;
        }

        setSaving(true);

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            setError('Your session could not be verified. Please sign in again.');
            setSaving(false);
            return;
        }

        const { error: saveError } = await supabase
            .from('school_settings')
            .upsert(
                {
                    school_id: schoolId,
                    academic_year: settings.academic_year.trim(),
                    current_term: settings.current_term,
                    timezone: settings.timezone,
                    announcements_enabled: settings.announcements_enabled,
                    parent_notifications_enabled:
                        settings.parent_notifications_enabled,
                    live_viewing_enabled: settings.live_viewing_enabled,
                    updated_by: user.id,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'school_id',
                }
            );

        if (saveError) {
            setError(saveError.message);
        } else {
            const updatedSettings = {
                ...settings,
                academic_year: settings.academic_year.trim(),
            };

            setSettings(updatedSettings);
            setSavedSettings(updatedSettings);
            setSuccess('School settings saved successfully.');
        }

        setSaving(false);
    }

    function discardChanges() {
        setSettings({ ...savedSettings });
        setError('');
        setSuccess('');
    }

    if (loading) {
        return (
            <div className="table-state">
                Loading school settings...
            </div>
        );
    }

    return (
        <section className="school-settings-page">
            <div className="page-heading">
                <div>
                    <h2>School Settings</h2>
                    <p>
                        Configure academic information, parent communication and
                        classroom viewing preferences.
                    </p>
                </div>

                <button
                    type="button"
                    className="refresh-button"
                    onClick={() => void loadSettings()}
                    disabled={saving}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="school-settings-intro">
                <div className="school-settings-intro-icon">
                    <Settings2 size={24} />
                </div>

                <div>
                    <h3>Administration Control Centre</h3>
                    <p>
                        Manage your school's operational preferences from one place.
                        Changes are saved to your school's account.
                    </p>
                </div>
            </div>

            {error && (
                <div className="form-error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="success-message" role="status">
                    <CheckCircle2 size={17} />
                    {success}
                </div>
            )}

            <div className="school-settings-card">
                <div className="school-settings-section-heading">
                    <div className="school-settings-icon">
                        <CalendarDays size={21} />
                    </div>

                    <div>
                        <h3>Academic Configuration</h3>
                        <p>Set the current academic calendar for your school.</p>
                    </div>
                </div>

                <div className="school-settings-fields">
                    <div className="school-settings-field">
                        <label htmlFor="academic-year">Academic year</label>
                        <input
                            id="academic-year"
                            value={settings.academic_year}
                            onChange={(event) =>
                                updateSetting('academic_year', event.target.value)
                            }
                            placeholder="2026"
                        />
                        <span>Example: 2026 or 2026-2027</span>
                    </div>

                    <div className="school-settings-field">
                        <label htmlFor="current-term">Current term</label>
                        <select
                            id="current-term"
                            value={settings.current_term}
                            onChange={(event) =>
                                updateSetting('current_term', event.target.value)
                            }
                        >
                            <option value="Term 1">Term 1</option>
                            <option value="Term 2">Term 2</option>
                            <option value="Term 3">Term 3</option>
                        </select>
                    </div>

                    <div className="school-settings-field">
                        <label htmlFor="school-timezone">
                            <Globe size={15} />
                            School timezone
                        </label>

                        <select
                            id="school-timezone"
                            value={settings.timezone}
                            onChange={(event) =>
                                updateSetting('timezone', event.target.value)
                            }
                        >
                            <option value="Africa/Nairobi">
                                East Africa — Nairobi
                            </option>
                            <option value="Africa/Kampala">
                                East Africa — Kampala
                            </option>
                            <option value="Africa/Dar_es_Salaam">
                                East Africa — Dar es Salaam
                            </option>
                            <option value="UTC">UTC</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="school-settings-card">
                <div className="school-settings-section-heading">
                    <div className="school-settings-icon">
                        <Bell size={21} />
                    </div>

                    <div>
                        <h3>Parent Communication</h3>
                        <p>Manage communication preferences for parents.</p>
                    </div>
                </div>

                <div className="school-setting-option">
                    <div>
                        <strong>Announcement publishing</strong>
                        <p>
                            Allow school staff to publish announcements for parents.
                        </p>
                    </div>

                    <label className="school-setting-switch">
                        <input
                            type="checkbox"
                            checked={settings.announcements_enabled}
                            onChange={(event) =>
                                updateSetting(
                                    'announcements_enabled',
                                    event.target.checked
                                )
                            }
                            aria-label="Enable announcement publishing"
                        />
                        <span className="school-setting-slider" />
                    </label>
                </div>

                <div className="school-setting-option">
                    <div>
                        <strong>Parent notifications</strong>
                        <p>
                            Enable parent notifications for school updates.
                        </p>
                    </div>

                    <label className="school-setting-switch">
                        <input
                            type="checkbox"
                            checked={settings.parent_notifications_enabled}
                            onChange={(event) =>
                                updateSetting(
                                    'parent_notifications_enabled',
                                    event.target.checked
                                )
                            }
                            aria-label="Enable parent notifications"
                        />
                        <span className="school-setting-slider" />
                    </label>
                </div>
            </div>

            <div className="school-settings-card">
                <div className="school-settings-section-heading">
                    <div className="school-settings-icon">
                        <Video size={21} />
                    </div>

                    <div>
                        <h3>Live Classroom Preferences</h3>
                        <p>
                            Configure the school-level availability of live classroom
                            viewing.
                        </p>
                    </div>
                </div>

                <div className="school-setting-option">
                    <div>
                        <strong>Live viewing availability</strong>
                        <p>
                            Enable or disable school-level live viewing availability.
                            Individual camera permissions and parent approvals still
                            apply.
                        </p>
                    </div>

                    <label className="school-setting-switch">
                        <input
                            type="checkbox"
                            checked={settings.live_viewing_enabled}
                            onChange={(event) =>
                                updateSetting(
                                    'live_viewing_enabled',
                                    event.target.checked
                                )
                            }
                            aria-label="Enable live viewing availability"
                        />
                        <span className="school-setting-slider" />
                    </label>
                </div>
            </div>

            <div className="school-settings-security">
                <div className="school-settings-security-icon">
                    <ShieldCheck size={22} />
                </div>

                <div>
                    <h3>Security and Access Protection</h3>
                    <p>
                        School settings are restricted to authorized school
                        administrators. Parent-child approvals and camera access
                        permissions remain separately enforced.
                    </p>
                </div>
            </div>

            <div className="school-settings-actions">
                <button
                    type="button"
                    className="refresh-button"
                    onClick={discardChanges}
                    disabled={!hasChanges || saving}
                >
                    <RotateCcw size={16} />
                    Discard changes
                </button>

                <button
                    type="button"
                    className="primary-button"
                    onClick={() => void saveSettings()}
                    disabled={!hasChanges || saving}
                >
                    <Save size={17} />
                    {saving ? 'Saving settings...' : 'Save all settings'}
                </button>
            </div>
        </section>
    );
}
