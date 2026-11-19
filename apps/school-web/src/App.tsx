import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  School,
  LogOut,
  Menu,
  X,
  Search,
  LoaderCircle,
  UserPlus,
  ClipboardList,
  ShieldCheck,
  MonitorPlay,
  Camera,
  Megaphone,
  Settings,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import SchoolRegister from './SchoolRegister';
import SchoolApplication from './SchoolApplication';
import SchoolApplicationStatus from './SchoolApplicationStatus';
import SchoolProfile from './SchoolProfile';
import Classes from './Classes';
import Students from './Students';
import Parents from './Parents';
import ParentRequests from './ParentRequests';
import Cameras from './Cameras';
import CameraAccess from './CameraAccess';
import LiveMonitoring from './LiveMonitoring';
import Announcements from './Announcements';
import ActivityLogs from './ActivityLogs';
import SchoolSettings from './SchoolSettings';
import './App.css';

type AccessContext = {
  role: string;
  school_id: string | null;
  school_name: string | null;
  access_status: string | null;
};

type Profile = {
  full_name: string | null;
  phone: string | null;
};

type StaffMember = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
};

type StaffCandidate = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
};

type AppUser = {
  id: string;
  email?: string;
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const [user, setUser] = useState<AppUser | null>(null);
  const [access, setAccess] = useState<AccessContext | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadUserAccess = useCallback(async (userId: string) => {
    setLoading(true);
    setAccessError('');
    setAccess(null);
    setProfile(null);

    const [
      { data: accessRows, error: accessRpcError },
      { data: profileData, error: profileError },
    ] = await Promise.all([
      supabase.rpc('get_my_access_context'),
      supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    if (accessRpcError) {
      setAccessError(accessRpcError.message);
      setLoading(false);
      return;
    }

    if (profileError) {
      setAccessError(profileError.message);
      setLoading(false);
      return;
    }

    const rows = (accessRows ?? []) as AccessContext[];

    const schoolAdminAccess = rows.find(
      (item) =>
        item.role === 'school_admin' &&
        item.school_id &&
        item.access_status === 'active',
    );

    if (!schoolAdminAccess) {
      setAccessError(
        'This account does not have active school administrator access.',
      );
      setLoading(false);
      return;
    }

    setAccess(schoolAdminAccess);
    setProfile(profileData as Profile | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setAccessError(error.message);
        setLoading(false);
        return;
      }

      const currentUser = data.session?.user;

      if (currentUser) {
        setUser({
          id: currentUser.id,
          email: currentUser.email,
        });

        await loadUserAccess(currentUser.id);
      } else {
        setUser(null);
        setAccess(null);
        setProfile(null);
        setLoading(false);
      }
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const currentUser = session?.user;

      if (!currentUser) {
        setUser(null);
        setAccess(null);
        setProfile(null);
        setAccessError('');
        setLoading(false);
        return;
      }

      setUser({
        id: currentUser.id,
        email: currentUser.email,
      });

      void loadUserAccess(currentUser.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserAccess]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAccessError(error.message);
    }
  };

  if (loading) {
    return <LoadingScreen message="Preparing your school dashboard..." />;
  }

  // Public registration page
  if (location.pathname === '/register') {
    return user ? (
      <Navigate to="/apply" replace />
    ) : (
      <SchoolRegister />
    );
  }

  // School application page: authenticated applicants can access this
  // before they receive the school_admin role.
  if (location.pathname === '/apply') {
    return user ? <SchoolApplication /> : <LoginPage />;
  }

  // Application status is also available before school_admin access
  // has been granted.
  if (location.pathname === '/application-status') {
    return user ? <SchoolApplicationStatus /> : <LoginPage />;
  }

  // All remaining pages require an authenticated account.
  if (!user) {
    return <LoginPage />;
  }

  if (!access || !access.school_id) {
    return (
      <AccessDenied
        message={
          accessError ||
          'Your account does not have permission to access this dashboard.'
        }
        onSignOut={handleSignOut}
      />
    );
  }

  const accountEmail = user.email || 'Account';

  return (
    <div className="app-shell">
      <button
        type="button"
        className={`mobile-sidebar-backdrop ${mobileMenuOpen ? 'visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-label="Close navigation"
      />

      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <School size={23} />
          </div>

          <div>
            <h2>SchoolView</h2>
            <span>School administration</span>
          </div>

          <button
            type="button"
            className="mobile-close-button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="school-identity">
          <div className="school-identity-icon">
            <School size={20} />
          </div>

          <div>
            <strong>{access.school_name || 'School'}</strong>
            <span>School administration</span>
          </div>
        </div>
        <div className="sidebar-nav">
          <div className="sidebar-section" >
            <p className="sidebar-section-label">SCHOOL MANAGEMENT</p>

            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <LayoutDashboard size={19} />
              <span>Overview</span>
            </NavLink>

            <NavLink
              to="/staff"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Users size={19} />
              <span>Staff</span>
            </NavLink>
            <NavLink
              to="/school-profile"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <School size={19} />
              <span>School Profile</span>
            </NavLink>

            <NavLink
              to="/classes"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <School size={19} />
              <span>Classes</span>
            </NavLink>

            <NavLink
              to="/students"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Users size={19} />
              <span>Students</span>
            </NavLink>

            <NavLink
              to="/parents"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Users size={19} />
              <span>Parents & Guardians</span>
            </NavLink>
            <NavLink
              to="/parent-requests"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <ClipboardList size={19} />
              <span>Parent Requests</span>
            </NavLink>

            <NavLink
              to="/cameras"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Camera size={19} />
              <span>Camera Management</span>
            </NavLink>

            <NavLink
              to="/camera-access"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <ShieldCheck size={19} />
              <span>Camera Access</span>
            </NavLink>

            <NavLink
              to="/live-monitoring"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <MonitorPlay size={19} />
              <span>Live Monitoring</span>
            </NavLink>

            <NavLink
              to="/announcements"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Megaphone size={19} />
              <span>Announcements</span>
            </NavLink>

            <NavLink
              to="/activity-logs"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <ClipboardList size={19} />
              <span>Security & Activity Logs</span>
            </NavLink>

            <NavLink
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Settings size={19} />
              <span>School Settings</span>
            </NavLink>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {getInitials(profile?.full_name, accountEmail)}
            </div>

            <div className="sidebar-user-details">
              <strong>{profile?.full_name || accountEmail}</strong>
              <span>School administrator</span>
            </div>
          </div>

          <button
            type="button"
            className="sign-out-button"
            onClick={handleSignOut}
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div>
              <h1>
                {location.pathname === '/staff'
                  ? 'Staff Management'
                  : location.pathname === '/school-profile'
                    ? 'School Profile'
                    : location.pathname === '/classes'
                      ? 'Classes Management'
                      : location.pathname === '/students'
                        ? 'Students Management'
                        : location.pathname === '/parents'
                          ? 'Parents & Guardians'
                          : location.pathname === '/parent-requests'
                            ? 'Parent Requests'
                            : location.pathname === '/cameras'
                              ? 'Camera Management'
                              : location.pathname === '/camera-access'
                                ? 'Camera Access'
                                : location.pathname === '/live-monitoring'
                                  ? 'Live Monitoring'
                                  : location.pathname === '/announcements'
                                    ? 'Announcements Management'
                                    : location.pathname === '/activity-logs'
                                      ? 'Security & Activity Logs'
                                      : location.pathname === '/settings'
                                        ? 'School Settings'
                                        : 'Overview'}
              </h1>
              <p>{access.school_name}</p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-account">
              <div className="topbar-avatar">
                {getInitials(profile?.full_name, accountEmail)}
              </div>

              <div>
                <strong>{profile?.full_name || accountEmail}</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <div className="dashboard-page">
          <Routes>
            <Route
              path="/"
              element={<OverviewPage schoolId={access.school_id} />}
            />

            <Route
              path="/staff"
              element={<StaffPage schoolId={access.school_id} />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />

            <Route
              path="/school-profile"
              element={<SchoolProfile schoolId={access.school_id} />}
            />
            <Route
              path="/classes"
              element={<Classes schoolId={access.school_id} />}
            />
            <Route
              path="/students"
              element={<Students schoolId={access.school_id} />}
            />
            <Route
              path="/parents"
              element={<Parents schoolId={access.school_id} />}
            />
            <Route
              path="/parent-requests"
              element={<ParentRequests schoolId={access.school_id} />}
            />
            <Route
              path="/cameras"
              element={<Cameras schoolId={access.school_id} />}
            />
            <Route
              path="/camera-access"
              element={<CameraAccess schoolId={access.school_id} />}
            />
            <Route
              path="/live-monitoring"
              element={<LiveMonitoring schoolId={access.school_id} />}
            />
            <Route
              path="/announcements"
              element={<Announcements schoolId={access.school_id} />}
            />
            <Route
              path="/activity-logs"
              element={<ActivityLogs schoolId={access.school_id} />}
            />
            <Route
              path="/settings"
              element={<SchoolSettings schoolId={access.school_id} />}
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function getInitials(name?: string | null, email?: string) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  return email?.slice(0, 2).toUpperCase() || 'SV';
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="full-screen-state">
      <LoaderCircle className="loading-spinner" size={32} />
      <p>{message}</p>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setSubmitting(false);
      return;
    }

    const { data: accessRows, error: accessError } =
      await supabase.rpc('get_my_access_context');

    if (accessError) {
      setError(accessError.message);
      setSubmitting(false);
      return;
    }

    const rows = (accessRows ?? []) as AccessContext[];

    const hasSchoolAdminAccess = rows.some(
      (item) =>
        item.role === 'school_admin' &&
        item.school_id &&
        item.access_status === 'active'
    );

    navigate(hasSchoolAdminAccess ? '/' : '/apply', {
      replace: true,
    });

    setSubmitting(false);
  };

  return (
    <div className="auth-screen">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-brand-mark">
          <School size={27} />
        </div>

        <h1>SchoolView</h1>
        <p className="login-description">
          Sign in to your school administration account.
        </p>

        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          autoComplete="email"
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        {error && <div className="form-error">{error}</div>}

        <button
          type="submit"
          className="primary-button login-submit"
          disabled={submitting}
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="login-footnote">
          School representatives can{' '}
          <Link to="/register">create an account</Link>
        </p>
      </form>
    </div>
  );
}

function AccessDenied({
  message,
  onSignOut,
}: {
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="full-screen-state">
      <ShieldCheck size={38} />
      <h2>Access unavailable</h2>
      <p>{message}</p>
      <button
        type="button"
        className="primary-button"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </div>
  );
}

function OverviewPage({ schoolId }: { schoolId: string }) {
  const [stats, setStats] = useState({
    staff: 0,
    students: 0,
    classes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError('');

      const [
        { count: staffCount, error: staffError },
        { count: studentCount, error: studentError },
        { count: classCount, error: classError },
      ] = await Promise.all([
        supabase
          .from('school_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId),
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId),
        supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId),
      ]);

      const firstError = staffError || studentError || classError;

      if (firstError) {
        setError(firstError.message);
      } else {
        setStats({
          staff: staffCount ?? 0,
          students: studentCount ?? 0,
          classes: classCount ?? 0,
        });
      }

      setLoading(false);
    };

    void loadStats();
  }, [schoolId]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>School overview</h2>
          <p>Here is what's happening in your school.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="stats-grid">
        <StatCard
          icon={<Users size={21} />}
          label="Staff members"
          value={loading ? '—' : stats.staff}
        />

        <StatCard
          icon={<School size={21} />}
          label="Students"
          value={loading ? '—' : stats.students}
        />

        <StatCard
          icon={<LayoutDashboard size={21} />}
          label="Classes"
          value={loading ? '—' : stats.classes}
        />
      </div>

      <div className="dashboard-information-card">
        <h3>School administration</h3>
        <p>
          Your dashboard is connected to your school account. Use Staff
          Management to find existing SchoolView accounts and assign
          teachers or school staff.
        </p>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function StaffPage({ schoolId }: { schoolId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [candidates, setCandidates] = useState<StaffCandidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('teacher');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError('');

    const { data, error: staffError } = await supabase.rpc(
      'get_school_staff',
      { target_school_id: schoolId },
    );

    if (staffError) {
      setError(staffError.message);
      setStaff([]);
    } else {
      setStaff((data ?? []) as StaffMember[]);
    }

    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCandidates([]);

    if (searchTerm.trim().length < 3) {
      setError('Enter at least three characters to search.');
      return;
    }

    setSearching(true);

    const { data, error: searchError } = await supabase.rpc(
      'search_school_staff_candidates',
      {
        target_school_id: schoolId,
        search_term: searchTerm.trim(),
      },
    );

    if (searchError) {
      setError(searchError.message);
    } else {
      setCandidates((data ?? []) as StaffCandidate[]);

      if (!data?.length) {
        setSuccess('No matching unassigned accounts were found.');
      }
    }

    setSearching(false);
  };

  const handleAssign = async (candidate: StaffCandidate) => {
    setError('');
    setSuccess('');
    setAssigningUserId(candidate.user_id);

    const { error: assignError } = await supabase.rpc(
      'assign_school_role',
      {
        target_school_id: schoolId,
        target_user_id: candidate.user_id,
        target_role: selectedRole,
      },
    );

    if (assignError) {
      setError(assignError.message);
      setAssigningUserId('');
      return;
    }

    setSuccess(
      `${candidate.full_name || candidate.email} was assigned as ${selectedRole.replace('_', ' ')}.`,
    );

    setCandidates((current) =>
      current.filter((item) => item.user_id !== candidate.user_id),
    );

    setAssigningUserId('');
    await loadStaff();
  };

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>Staff management</h2>
          <p>Find registered accounts and assign school roles.</p>
        </div>

        <div className="staff-total">
          <Users size={18} />
          <span>{staff.length} staff members</span>
        </div>
      </div>

      <div className="staff-search-card">
        <div className="section-heading">
          <div className="section-icon">
            <UserPlus size={21} />
          </div>
          <div>
            <h3>Add a staff member</h3>
            <p>
              Search for an existing SchoolView account. New accounts
              must register before they can be assigned.
            </p>
          </div>
        </div>

        <form className="staff-search-form" onSubmit={handleSearch}>
          <div className="search-input-wrap">
            <Search size={19} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by email, name or phone number"
              minLength={3}
            />
          </div>

          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            aria-label="Staff role"
          >
            <option value="teacher">Teacher</option>
            <option value="school_staff">School staff</option>
          </select>

          <button
            type="submit"
            className="primary-button"
            disabled={searching}
          >
            {searching ? 'Searching...' : 'Search accounts'}
          </button>
        </form>

        {candidates.length > 0 && (
          <div className="candidate-list">
            <h4>Matching accounts</h4>

            {candidates.map((candidate) => (
              <div className="candidate-row" key={candidate.user_id}>
                <div className="candidate-avatar">
                  {getInitials(candidate.full_name, candidate.email)}
                </div>

                <div className="candidate-details">
                  <strong>{candidate.full_name || 'Name not provided'}</strong>
                  <span>{candidate.email}</span>
                  {candidate.phone && <span>{candidate.phone}</span>}
                </div>

                <button
                  type="button"
                  className="primary-button assign-button"
                  disabled={!!assigningUserId}
                  onClick={() => void handleAssign(candidate)}
                >
                  {assigningUserId === candidate.user_id
                    ? 'Assigning...'
                    : `Assign ${selectedRole === 'teacher' ? 'teacher' : 'staff'}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="staff-table-card">
        <div className="table-heading">
          <div>
            <h3>School staff</h3>
            <p>Accounts currently assigned to this school.</p>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={() => void loadStaff()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="table-state">
            <LoaderCircle className="loading-spinner" size={24} />
            <span>Loading staff members...</span>
          </div>
        ) : staff.length === 0 ? (
          <div className="table-state">
            <Users size={30} />
            <strong>No staff members assigned yet</strong>
            <span>Search for a registered account above to get started.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                </tr>
              </thead>

              <tbody>
                {staff.map((member) => (
                  <tr key={member.user_id}>
                    <td>
                      <div className="table-person">
                        <div className="candidate-avatar">
                          {getInitials(member.full_name, member.email)}
                        </div>
                        <strong>
                          {member.full_name || 'Name not provided'}
                        </strong>
                      </div>
                    </td>
                    <td>{member.email}</td>
                    <td>{member.phone || '—'}</td>
                    <td>
                      <span className="role-label">
                        {member.role.replace('_', ' ')}
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

export default App;
