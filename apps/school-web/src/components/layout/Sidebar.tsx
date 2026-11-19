
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    UserRoundCheck,
    ClipboardCheck,
    Camera,
    Megaphone,
    UserCog,
    Settings,
    LogOut,
    School,
} from 'lucide-react';

const navigation = [
    {
        title: 'MAIN MENU',
        items: [
            { label: 'Overview', icon: LayoutDashboard, path: '/' },
            { label: 'Staff', icon: Users, path: '/staff' },
            { label: 'Students', icon: GraduationCap, path: '/students' },
            { label: 'Parents', icon: UserRoundCheck, path: '/parents' },
            { label: 'Approvals', icon: ClipboardCheck, path: '/approvals' },
        ],
    },
    {
        title: 'SCHOOL MANAGEMENT',
        items: [
            { label: 'Classes', icon: School, path: '/classes' },
            { label: 'Cameras', icon: Camera, path: '/cameras' },
            { label: 'Announcements', icon: Megaphone, path: '/announcements' },
            { label: 'Settings', icon: Settings, path: '/settings' },
        ],
    },
];

interface SidebarProps {
    activePath: string;
}

export default function Sidebar({ activePath }: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="brand-icon">
                    <School size={23} />
                </div>

                <div>
                    <h2>SchoolView</h2>
                    <span>School administration</span>
                </div>
            </div>

            <div className="school-selector">
                <div className="school-avatar">
                    <School size={20} />
                </div>

                <div className="school-selector-info">
                    <strong>My School</strong>
                    <span>Administration</span>
                </div>
            </div>

            <nav className="sidebar-navigation">
                {navigation.map((section) => (
                    <div className="nav-section" key={section.title}>
                        <p className="nav-section-title">{section.title}</p>

                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const active = activePath === item.path;

                            return (
                                <a
                                    key={item.path}
                                    href={item.path}
                                    className={`nav-item ${active ? 'active' : ''}`}
                                >
                                    <Icon size={19} strokeWidth={1.8} />
                                    <span>{item.label}</span>
                                </a>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="sidebar-bottom">
                <a href="/staff" className="nav-item">
                    <UserCog size={19} />
                    <span>Staff management</span>
                </a>

                <button className="logout-button" type="button">
                    <LogOut size={19} />
                    <span>Sign out</span>
                </button>
            </div>
        </aside>
    );
}
