
import { Bell, Search, Menu } from 'lucide-react';

interface TopbarProps {
    title: string;
    subtitle: string;
    onMenuClick: () => void;
}

export default function Topbar({
    title,
    subtitle,
    onMenuClick,
}: TopbarProps) {
    return (
        <header className="topbar">
            <div className="topbar-heading">
                <button
                    type="button"
                    className="mobile-menu-button"
                    onClick={onMenuClick}
                    aria-label="Open navigation"
                >
                    <Menu size={22} />
                </button>

                <div>
                    <h1>{title}</h1>
                    <p>{subtitle}</p>
                </div>
            </div>

            <div className="topbar-actions">
                <button
                    type="button"
                    className="topbar-icon-button"
                    aria-label="Search"
                >
                    <Search size={20} />
                </button>

                <button
                    type="button"
                    className="topbar-icon-button notification-button"
                    aria-label="Notifications"
                >
                    <Bell size={20} />
                    <span />
                </button>

                <div className="topbar-profile">
                    <div className="profile-avatar">SA</div>
                    <div className="profile-details">
                        <strong>School Admin</strong>
                        <span>Administrator</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
