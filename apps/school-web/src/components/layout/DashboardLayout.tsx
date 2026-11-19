
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const pageDetails: Record<string, { title: string; subtitle: string }> = {
    '/': {
        title: 'Overview',
        subtitle: 'Welcome to your school administration dashboard.',
    },
    '/staff': {
        title: 'Staff Management',
        subtitle: 'Manage teachers and school staff members.',
    },
    '/students': {
        title: 'Students',
        subtitle: 'Manage student records and class assignments.',
    },
    '/parents': {
        title: 'Parents',
        subtitle: 'Manage parent accounts and student relationships.',
    },
    '/approvals': {
        title: 'Approvals',
        subtitle: 'Review pending parent and student link requests.',
    },
    '/classes': {
        title: 'Classes',
        subtitle: 'Manage classes and academic information.',
    },
    '/cameras': {
        title: 'Cameras',
        subtitle: 'Manage classroom cameras and live monitoring.',
    },
    '/announcements': {
        title: 'Announcements',
        subtitle: 'Communicate important school updates.',
    },
    '/settings': {
        title: 'Settings',
        subtitle: 'Manage your school preferences.',
    },
};

export default function DashboardLayout({
    children,
}: DashboardLayoutProps) {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const page = pageDetails[location.pathname] ?? {
        title: 'SchoolView',
        subtitle: 'School administration',
    };

    return (
        <div className="dashboard-layout">
            {menuOpen && (
                <button
                    type="button"
                    className="sidebar-overlay"
                    aria-label="Close navigation"
                    onClick={() => setMenuOpen(false)}
                />
            )}

            <div className={menuOpen ? 'sidebar-wrapper sidebar-open' : 'sidebar-wrapper'}>
                <Sidebar activePath={location.pathname} />
            </div>

            <main className="dashboard-main">
                <Topbar
                    title={page.title}
                    subtitle={page.subtitle}
                    onMenuClick={() => setMenuOpen(!menuOpen)}
                />

                <div className="dashboard-content">
                    {children}
                </div>
            </main>
        </div>
    );
}
