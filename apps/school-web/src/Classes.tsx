
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
    School,
    Plus,
    RefreshCw,
    Users,
    GraduationCap,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type SchoolClass = {
    id: string;
    name: string;
    grade_level: string | null;
    academic_year: string;
    teacher_id: string | null;
    created_at: string;
};

type StaffMember = {
    user_id: string;
    full_name: string | null;
    email: string | null;
    role: string;
};

export default function Classes({ schoolId }: { schoolId: string }) {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [teachers, setTeachers] = useState<StaffMember[]>([]);

    const [form, setForm] = useState({
        name: '',
        grade_level: '',
        academic_year: '2026',
        teacher_id: '',
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        const [classResult, staffResult] = await Promise.all([
            supabase
                .from('classes')
                .select(
                    'id, name, grade_level, academic_year, teacher_id, created_at'
                )
                .eq('school_id', schoolId)
                .order('name'),

            supabase.rpc('get_school_staff', {
                target_school_id: schoolId,
            }),
        ]);

        if (classResult.error) {
            setError(classResult.error.message);
        } else {
            setClasses((classResult.data || []) as SchoolClass[]);
        }

        if (staffResult.error) {
            setError((current) =>
                current || `Could not load teachers: ${staffResult.error.message}`
            );
        } else {
            const members = (staffResult.data || []) as StaffMember[];
            setTeachers(members.filter((member) => member.role === 'teacher'));
        }

        setLoading(false);
    };

    useEffect(() => {
        void loadData();
    }, [schoolId]);

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setSaving(true);
        setError('');
        setSuccess('');

        const { error: insertError } = await supabase
            .from('classes')
            .insert({
                school_id: schoolId,
                name: form.name.trim(),
                grade_level: form.grade_level.trim() || null,
                academic_year: form.academic_year.trim(),
                teacher_id: form.teacher_id || null,
            });

        if (insertError) {
            setError(insertError.message);
        } else {
            setSuccess('Class created successfully.');
            setForm({
                name: '',
                grade_level: '',
                academic_year: '2026',
                teacher_id: '',
            });
            await loadData();
        }

        setSaving(false);
    };

    const getTeacherName = (teacherId: string | null) => {
        if (!teacherId) return 'Not assigned';

        const teacher = teachers.find(
            (member) => member.user_id === teacherId
        );

        return teacher?.full_name || teacher?.email || 'Teacher assigned';
    };

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>Classes Management</h2>
                    <p>Create classes and assign teachers to them.</p>
                </div>

                <div className="staff-total">
                    <School size={17} />
                    {classes.length} {classes.length === 1 ? 'Class' : 'Classes'}
                </div>
            </div>

            <div className="staff-search-card">
                <div className="section-heading">
                    <div className="section-icon">
                        <Plus size={21} />
                    </div>
                    <div>
                        <h3>Create a new class</h3>
                        <p>
                            Add a class to your school and optionally assign
                            its teacher.
                        </p>
                    </div>
                </div>

                <form className="class-form" onSubmit={handleCreate}>
                    <label htmlFor="class-name">Class name</label>
                    <input
                        id="class-name"
                        placeholder="e.g. Grade 1 East"
                        value={form.name}
                        onChange={(event) =>
                            setForm({ ...form, name: event.target.value })
                        }
                        required
                    />

                    <label htmlFor="grade-level">Grade level</label>
                    <input
                        id="grade-level"
                        placeholder="e.g. Grade 1"
                        value={form.grade_level}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                grade_level: event.target.value,
                            })
                        }
                    />

                    <label htmlFor="academic-year">Academic year</label>
                    <input
                        id="academic-year"
                        placeholder="e.g. 2026"
                        value={form.academic_year}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                academic_year: event.target.value,
                            })
                        }
                        required
                    />

                    <label htmlFor="class-teacher">Assign teacher</label>
                    <select
                        id="class-teacher"
                        value={form.teacher_id}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                teacher_id: event.target.value,
                            })
                        }
                    >
                        <option value="">No teacher assigned yet</option>
                        {teachers.map((teacher) => (
                            <option
                                key={teacher.user_id}
                                value={teacher.user_id}
                            >
                                {teacher.full_name || teacher.email || 'Teacher'}
                            </option>
                        ))}
                    </select>

                    {error && <div className="form-error">{error}</div>}
                    {success && (
                        <div className="success-message">{success}</div>
                    )}

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={saving || !form.name.trim() || !form.academic_year.trim()}
                    >
                        <Plus size={17} />
                        {saving ? 'Creating...' : 'Create class'}
                    </button>
                </form>
            </div>

            <div className="staff-table-card">
                <div className="table-heading">
                    <div>
                        <h3>School classes</h3>
                        <p>Classes registered under your school.</p>
                    </div>

                    <button
                        type="button"
                        className="refresh-button"
                        onClick={() => void loadData()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="table-state">Loading classes...</div>
                ) : classes.length === 0 ? (
                    <div className="table-state">
                        <GraduationCap size={30} />
                        <strong>No classes created yet</strong>
                        <span>Create your first class using the form above.</span>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="staff-table">
                            <thead>
                                <tr>
                                    <th>Class name</th>
                                    <th>Grade level</th>
                                    <th>Academic year</th>
                                    <th>Assigned teacher</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map((schoolClass) => (
                                    <tr key={schoolClass.id}>
                                        <td>
                                            <strong>{schoolClass.name}</strong>
                                        </td>
                                        <td>
                                            {schoolClass.grade_level || '—'}
                                        </td>
                                        <td>{schoolClass.academic_year}</td>
                                        <td>
                                            <div className="table-person">
                                                <Users size={15} />
                                                {getTeacherName(
                                                    schoolClass.teacher_id
                                                )}
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
