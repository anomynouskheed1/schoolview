
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Users,
    RefreshCw,
    Search,
    UserRound,
    ShieldCheck,
    GraduationCap,
    Heart,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type Profile = {
    id: string;
    full_name: string | null;
    phone: string | null;
    created_at: string;
};

type Membership = {
    user_id: string;
    role: string;
};

type ParentLink = {
    parent_id: string;
};

type UserRecord = Profile & {
    roles: string[];
};

export default function UserManagement() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError('');

        const [
            { data: profiles, error: profilesError },
            { data: memberships, error: membershipsError },
            { data: parentLinks, error: parentLinksError },
            { data: platformAdmins, error: platformAdminsError },
        ] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, full_name, phone, created_at')
                .order('created_at', { ascending: false }),

            supabase
                .from('school_memberships')
                .select('user_id, role'),

            supabase
                .from('parent_students')
                .select('parent_id'),

            supabase
                .from('platform_admins')
                .select('user_id'),
        ]);

        const queryError =
            profilesError ||
            membershipsError ||
            parentLinksError ||
            platformAdminsError;

        if (queryError) {
            setError(queryError.message);
            setUsers([]);
            setSelectedUser(null);
            setLoading(false);
            return;
        }

        const membershipRecords = (memberships ?? []) as Membership[];
        const parentRecords = (parentLinks ?? []) as ParentLink[];
        const adminRecords = (platformAdmins ?? []) as { user_id: string }[];

        const parentIds = new Set(
            parentRecords.map((record) => record.parent_id)
        );

        const adminIds = new Set(
            adminRecords.map((record) => record.user_id)
        );

        const records: UserRecord[] = ((profiles ?? []) as Profile[]).map(
            (profile) => {
                const roles = new Set<string>();

                membershipRecords
                    .filter((membership) => membership.user_id === profile.id)
                    .forEach((membership) => roles.add(membership.role));

                if (parentIds.has(profile.id)) roles.add('parent');
                if (adminIds.has(profile.id)) roles.add('system_manager');

                return {
                    ...profile,
                    roles: Array.from(roles),
                };
            }
        );

        setUsers(records);

        setSelectedUser((current) =>
            current
                ? records.find((user) => user.id === current.id) ?? null
                : null
        );

        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchUsers();
    }, [fetchUsers]);

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return users;

        return users.filter((user) =>
            [
                user.full_name,
                user.phone,
                user.id,
                ...user.roles,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term))
        );
    }, [users, search]);

    const counts = useMemo(
        () => ({
            total: users.length,
            parents: users.filter((user) => user.roles.includes('parent')).length,
            staff: users.filter((user) =>
                user.roles.some((role) =>
                    ['school_admin', 'school_staff', 'teacher'].includes(role)
                )
            ).length,
            managers: users.filter((user) =>
                user.roles.includes('system_manager')
            ).length,
        }),
        [users]
    );

    const roleIcon = (role: string) => {
        if (role === 'system_manager') return <ShieldCheck size={14} />;
        if (role === 'parent') return <Heart size={14} />;
        if (['teacher', 'school_staff', 'school_admin'].includes(role)) {
            return <GraduationCap size={14} />;
        }
        return <UserRound size={14} />;
    };

    const formatRole = (role: string) =>
        role.replaceAll('_', ' ');

    return (
        <div className="user-management-page">
            <div className="user-management-heading">
                <div>
                    <p className="user-management-eyebrow">Platform administration</p>
                    <h1>User Management</h1>
                    <p>View registered SchoolView accounts and their assigned roles.</p>
                </div>

                <button
                    className="user-management-refresh"
                    onClick={() => void fetchUsers()}
                    disabled={loading}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="user-management-error">
                    {error}
                </div>
            )}

            <div className="user-management-stats">
                <div className="user-management-stat">
                    <span>Total accounts</span>
                    <strong>{counts.total}</strong>
                </div>
                <div className="user-management-stat">
                    <span>Parents</span>
                    <strong>{counts.parents}</strong>
                </div>
                <div className="user-management-stat">
                    <span>School staff</span>
                    <strong>{counts.staff}</strong>
                </div>
                <div className="user-management-stat">
                    <span>System Managers</span>
                    <strong>{counts.managers}</strong>
                </div>
            </div>

            <div className="user-management-toolbar">
                <div className="user-management-search">
                    <Search size={17} />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, phone, account ID or role..."
                    />
                </div>

                <span>{filteredUsers.length} accounts found</span>
            </div>

            <div className="user-management-layout">
                <section className="user-management-list">
                    <div className="user-management-list-header">
                        Registered accounts
                    </div>

                    {loading ? (
                        <div className="user-management-empty">Loading accounts...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="user-management-empty">No accounts found.</div>
                    ) : (
                        filteredUsers.map((user) => (
                            <button
                                key={user.id}
                                className={`user-management-item ${selectedUser?.id === user.id ? 'selected' : ''
                                    }`}
                                onClick={() => setSelectedUser(user)}
                            >
                                <span className="user-management-avatar">
                                    <UserRound size={19} />
                                </span>

                                <span className="user-management-item-content">
                                    <strong>{user.full_name || 'Unnamed account'}</strong>
                                    <small>{user.phone || 'No phone provided'}</small>
                                    <span className="user-management-role-count">
                                        {user.roles.length
                                            ? user.roles.map(formatRole).join(', ')
                                            : 'No assigned role'}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </section>

                <section className="user-management-details">
                    {!selectedUser ? (
                        <div className="user-management-details-empty">
                            <Users size={32} />
                            <strong>Select an account</strong>
                            <span>Choose a user to view account information.</span>
                        </div>
                    ) : (
                        <>
                            <div className="user-management-details-heading">
                                <span className="user-management-avatar large">
                                    <UserRound size={25} />
                                </span>
                                <div>
                                    <h2>{selectedUser.full_name || 'Unnamed account'}</h2>
                                    <span>Registered SchoolView user</span>
                                </div>
                            </div>

                            <div className="user-management-information">
                                <div>
                                    <span>Account ID</span>
                                    <strong>{selectedUser.id}</strong>
                                </div>

                                <div>
                                    <span>Phone number</span>
                                    <strong>{selectedUser.phone || 'Not provided'}</strong>
                                </div>

                                <div>
                                    <span>Registration date</span>
                                    <strong>
                                        {new Date(selectedUser.created_at).toLocaleDateString()}
                                    </strong>
                                </div>
                            </div>

                            <div className="user-management-assigned-roles">
                                <h3>Assigned roles</h3>

                                {selectedUser.roles.length === 0 ? (
                                    <p>No roles currently assigned.</p>
                                ) : (
                                    selectedUser.roles.map((role) => (
                                        <div className="user-management-role" key={role}>
                                            {roleIcon(role)}
                                            <span>{formatRole(role)}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="user-management-note">
                                <ShieldCheck size={18} />
                                <div>
                                    <strong>Account security</strong>
                                    <p>
                                        Account permissions are controlled through authorized
                                        role assignment and backend security policies. This
                                        screen does not modify passwords or permissions.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
