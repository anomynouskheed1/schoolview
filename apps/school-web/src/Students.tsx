
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
    Users,
    UserPlus,
    RefreshCw,
    GraduationCap,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type Student = {
    id: string;
    full_name: string;
    admission_number: string;
    class_id: string | null;
    date_of_birth: string | null;
    gender: string | null;
    status: string;
    created_at: string;
};

type SchoolClass = {
    id: string;
    name: string;
    grade_level: string | null;
};

export default function Students({ schoolId }: { schoolId: string }) {
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');

    const [form, setForm] = useState({
        full_name: '',
        admission_number: '',
        class_id: '',
        date_of_birth: '',
        gender: '',
    });

    const loadData = async () => {
        setLoading(true);
        setError('');

        const [studentResult, classResult] = await Promise.all([
            supabase
                .from('students')
                .select(
                    'id, full_name, admission_number, class_id, date_of_birth, gender, status, created_at'
                )
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false }),

            supabase
                .from('classes')
                .select('id, name, grade_level')
                .eq('school_id', schoolId)
                .order('name'),
        ]);

        if (studentResult.error) {
            setError(studentResult.error.message);
        } else {
            setStudents((studentResult.data || []) as Student[]);
        }

        if (classResult.error) {
            setError((current) =>
                current || classResult.error.message
            );
        } else {
            setClasses((classResult.data || []) as SchoolClass[]);
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
            .from('students')
            .insert({
                school_id: schoolId,
                full_name: form.full_name.trim(),
                admission_number: form.admission_number.trim(),
                class_id: form.class_id || null,
                date_of_birth: form.date_of_birth || null,
                gender: form.gender || null,
                status: 'active',
            });

        if (insertError) {
            setError(insertError.message);
        } else {
            setSuccess('Student registered successfully.');

            setForm({
                full_name: '',
                admission_number: '',
                class_id: '',
                date_of_birth: '',
                gender: '',
            });

            await loadData();
        }

        setSaving(false);
    };

    const getClassName = (classId: string | null) => {
        if (!classId) return 'Not assigned';

        const schoolClass = classes.find(
            (item) => item.id === classId
        );

        return schoolClass?.name || 'Class not found';
    };

    const filteredStudents = students.filter((student) => {
        const term = search.toLowerCase();

        return (
            student.full_name.toLowerCase().includes(term) ||
            student.admission_number.toLowerCase().includes(term)
        );
    });

    return (
        <section>
            <div className="page-heading">
                <div>
                    <h2>Students Management</h2>
                    <p>Register and manage students in your school.</p>
                </div>

                <div className="staff-total">
                    <Users size={17} />
                    {students.length} {students.length === 1 ? 'Student' : 'Students'}
                </div>
            </div>

            <div className="staff-search-card">
                <div className="section-heading">
                    <div className="section-icon">
                        <UserPlus size={21} />
                    </div>
                    <div>
                        <h3>Register a student</h3>
                        <p>
                            Add a student and assign them to one of your
                            school's classes.
                        </p>
                    </div>
                </div>

                <form className="student-form" onSubmit={handleCreate}>
                    <label htmlFor="student-name">Student full name</label>
                    <input
                        id="student-name"
                        placeholder="Enter student's full name"
                        value={form.full_name}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                full_name: event.target.value,
                            })
                        }
                        required
                    />

                    <label htmlFor="admission-number">Admission number</label>
                    <input
                        id="admission-number"
                        placeholder="e.g. SUN-002"
                        value={form.admission_number}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                admission_number: event.target.value,
                            })
                        }
                        required
                    />

                    <label htmlFor="student-class">Assign class</label>
                    <select
                        id="student-class"
                        value={form.class_id}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                class_id: event.target.value,
                            })
                        }
                    >
                        <option value="">No class assigned yet</option>
                        {classes.map((schoolClass) => (
                            <option
                                key={schoolClass.id}
                                value={schoolClass.id}
                            >
                                {schoolClass.name}
                                {schoolClass.grade_level
                                    ? ` (${schoolClass.grade_level})`
                                    : ''}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="student-dob">Date of birth</label>
                    <input
                        id="student-dob"
                        type="date"
                        value={form.date_of_birth}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                date_of_birth: event.target.value,
                            })
                        }
                    />

                    <label htmlFor="student-gender">Gender</label>
                    <select
                        id="student-gender"
                        value={form.gender}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                gender: event.target.value,
                            })
                        }
                    >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>

                    {error && <div className="form-error">{error}</div>}
                    {success && (
                        <div className="success-message">{success}</div>
                    )}

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={
                            saving ||
                            !form.full_name.trim() ||
                            !form.admission_number.trim()
                        }
                    >
                        <UserPlus size={17} />
                        {saving ? 'Registering...' : 'Register student'}
                    </button>
                </form>
            </div>

            <div className="staff-table-card">
                <div className="table-heading">
                    <div>
                        <h3>Registered students</h3>
                        <p>All students registered under your school.</p>
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

                <div className="student-search">
                    <input
                        type="search"
                        placeholder="Search by student name or admission number..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="table-state">Loading students...</div>
                ) : filteredStudents.length === 0 ? (
                    <div className="table-state">
                        <GraduationCap size={30} />
                        <strong>
                            {students.length === 0
                                ? 'No students registered yet'
                                : 'No matching students'}
                        </strong>
                        <span>
                            {students.length === 0
                                ? 'Register your first student using the form above.'
                                : 'Try another name or admission number.'}
                        </span>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="staff-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Admission number</th>
                                    <th>Class</th>
                                    <th>Date of birth</th>
                                    <th>Gender</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => (
                                    <tr key={student.id}>
                                        <td>
                                            <strong>{student.full_name}</strong>
                                        </td>
                                        <td>{student.admission_number}</td>
                                        <td>{getClassName(student.class_id)}</td>
                                        <td>
                                            {student.date_of_birth || '—'}
                                        </td>
                                        <td>
                                            {student.gender || '—'}
                                        </td>
                                        <td>
                                            <span className="role-label">
                                                {student.status}
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
