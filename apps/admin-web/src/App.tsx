
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import SchoolApplications from './SchoolApplications';
import RegisteredSchools from './RegisteredSchools';
import UserManagement from './UserManagement';
import Monitoring from './Monitoring';
import Analytics from './Analytics';
import ActivityLogs from './ActivityLogs';
import './App.css';

type AccessContext = {
  role: string;
  school_id?: string | null;
  school_name?: string | null;
  access_status?: string | null;
};

type NavigationItem = {
  label: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'School Applications', icon: ClipboardList },
  { label: 'Registered Schools', icon: Building2 },
  { label: 'User Management', icon: Users },
  { label: 'Monitoring', icon: Activity },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Security & Activity Logs', icon: ShieldCheck },
];

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) throw loginError;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <section className="admin-login-card">
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <ShieldCheck size={25} />
          </div>
          <div>
            <h2>SchoolView</h2>
            <span>System Administration</span>
          </div>
        </div>

        <div className="admin-login-heading">
          <span className="admin-eyebrow">SECURE ADMINISTRATION</span>
          <h1>Welcome back</h1>
          <p>
            Sign in using your authorized System Manager account.
          </p>
        </div>

        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email address"
            autoComplete="username"
            required
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            className="admin-primary-button admin-login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in securely'}
          </button>
        </form>

        <div className="admin-login-footer">
          <ShieldCheck size={15} />
          <span>Authorized personnel only</span>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="admin-loading-screen">
      <div className="admin-loading-icon">
        <ShieldCheck size={28} />
      </div>
      <h2>SchoolView</h2>
      <p>{message}</p>
      <div className="admin-spinner" />
    </main>
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
    <main className="admin-loading-screen">
      <div className="admin-denied-icon">
        <ShieldCheck size={28} />
      </div>
      <h2>Access restricted</h2>
      <p>{message}</p>
      <button
        type="button"
        className="admin-primary-button"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </main>
  );
}

function Dashboard({
  userEmail,
  onSignOut,
}: {
  userEmail: string;
  onSignOut: () => void;
}) {
  const [activePage, setActivePage] = useState('Overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function selectPage(page: string) {
    setActivePage(page);
    setMobileMenuOpen(false);
  }

  return (
    <div className="admin-shell">
      {mobileMenuOpen && (
        <button
          className="admin-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar ${mobileMenuOpen ? 'admin-sidebar-open' : ''}`}
      >
        <div className="admin-sidebar-brand">
          <div className="admin-brand-icon">
            <ShieldCheck size={23} />
          </div>
          <div>
            <strong>SchoolView</strong>
            <span>System Manager</span>
          </div>
          <button
            className="admin-mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="admin-nav-label">PLATFORM MANAGEMENT</div>

        <nav className="admin-navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.label;

            return (
              <button
                key={item.label}
                type="button"
                className={`admin-nav-link ${active ? 'active' : ''}`}
                onClick={() => selectPage(item.label)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-account">
            <div className="admin-avatar">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="admin-account-details">
              <strong>System Manager</strong>
              <span>{userEmail}</span>
            </div>
          </div>

          <button
            type="button"
            className="admin-signout-button"
            onClick={onSignOut}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div>
              <h1>{activePage}</h1>
              <p>SchoolView platform administration</p>
            </div>
          </div>

          <div className="admin-topbar-right">
            <span className="admin-status-indicator" />
            <span>System Manager</span>
          </div>
        </header>

        <section className="admin-content">
          {activePage === 'Overview' ? (
            <>
              <div className="admin-page-heading">
                <div>
                  <h2>Platform Overview</h2>
                  <p>
                    Monitor and manage the SchoolView platform from one place.
                  </p>
                </div>
                <div className="admin-role-badge">
                  <ShieldCheck size={16} />
                  Authorized access
                </div>
              </div>

              <div className="admin-welcome-card">
                <div>
                  <span className="admin-eyebrow">SYSTEM MANAGEMENT</span>
                  <h2>Welcome to SchoolView</h2>
                  <p>
                    Your central platform for managing schools, applications,
                    users and system activity.
                  </p>
                </div>
                <div className="admin-welcome-icon">
                  <Building2 size={43} />
                </div>
              </div>

              <div className="admin-section-heading">
                <h3>Platform modules</h3>
                <p>Choose a section from the navigation to manage it.</p>
              </div>

              <div className="admin-module-grid">
                {navigationItems.slice(1).map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      className="admin-module-card"
                      onClick={() => selectPage(item.label)}
                    >
                      <div className="admin-module-icon">
                        <Icon size={22} />
                      </div>
                      <strong>{item.label}</strong>
                      <span>Open module</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : activePage === 'School Applications' ? (
            <SchoolApplications />
          ) : activePage === 'Registered Schools' ? (
            <RegisteredSchools />
          ) : activePage === 'User Management' ? (
            <UserManagement />
          ) : activePage === 'Monitoring' ? (
            <Monitoring />
          ) : activePage === 'Analytics' ? (
            <Analytics />
          ) : activePage === 'Security & Activity Logs' ? (
            <ActivityLogs />
          ) : (
            <div className="admin-placeholder-card">
              <div className="admin-module-icon">
                {(() => {
                  const item = navigationItems.find(
                    (entry) => entry.label === activePage,
                  );
                  const Icon = item?.icon ?? LayoutDashboard;
                  return <Icon size={25} />;
                })()}
              </div>
              <h2>{activePage}</h2>
              <p>
                This module has not been implemented yet. We will build it
                step by step, starting with school applications.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [isSystemManager, setIsSystemManager] = useState(false);
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setAccessError(error.message);
      }

      setSession(data.session);
      setAuthLoading(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
      setIsSystemManager(false);
      setAccessError('');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function verifySystemManager() {
      if (!session?.user.id) {
        setIsSystemManager(false);
        setAccessLoading(false);
        return;
      }

      setAccessLoading(true);
      setIsSystemManager(false);
      setAccessError('');

      const { data, error } = await supabase.rpc(
        'get_my_access_context',
      );

      if (!active) return;

      if (error) {
        setAccessError(
          'We could not verify your administrator permissions. Please try again.',
        );
        setAccessLoading(false);
        return;
      }

      const contexts = (
        Array.isArray(data) ? data : data ? [data] : []
      ) as AccessContext[];

      const authorized = contexts.some(
        (context) => context.role === 'system_manager',
      );

      setIsSystemManager(authorized);
      setAccessLoading(false);

      if (!authorized) {
        setAccessError(
          'This account does not have System Manager permissions.',
        );
      }
    }

    void verifySystemManager();

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setIsSystemManager(false);
    setAccessError('');
  }

  if (authLoading) {
    return <LoadingScreen message="Checking your session..." />;
  }

  if (!session) {
    return <LoginPage />;
  }

  if (accessLoading) {
    return <LoadingScreen message="Verifying administrator permissions..." />;
  }

  if (!isSystemManager) {
    return (
      <AccessDenied
        message={
          accessError ||
          'Your account is not authorized to access this dashboard.'
        }
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <Dashboard
      userEmail={session.user.email || 'System Manager'}
      onSignOut={handleSignOut}
    />
  );
}
