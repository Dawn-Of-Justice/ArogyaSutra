// ============================================================
// AppShell — Desktop Layout Shell
// Wide sidebar (220px) with icon + text labels, grouped sections,
// user card at bottom. Inspired by modern health-app sidebars.
// ============================================================

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import styles from "./AppShell.module.css";

interface NavItem {
    id: string;
    icon: string;
    label: string;
    badge?: number;
}

interface AppShellProps {
    children: React.ReactNode;
    activeScreen: string;
    onNavigate: (screen: string) => void;
    pageTitle: string;
    userName: string;
    userRole: string;
    userId?: string;
}

const PATIENT_NAV_MAIN: NavItem[] = [
    { id: "dashboard", icon: "🏠", label: "Dashboard" },
    { id: "timeline", icon: "📋", label: "Timeline" },
    { id: "upload", icon: "📷", label: "Scan Document" },
    { id: "assistant", icon: "🤖", label: "AI Assistant" },
    { id: "access", icon: "🔗", label: "Doctor Access" },
];

const PATIENT_NAV_BOTTOM: NavItem[] = [
    { id: "help", icon: "❓", label: "Help" },
    { id: "settings", icon: "⚙️", label: "Settings" },
];

const DOCTOR_NAV_MAIN: NavItem[] = [
    { id: "doctor-dashboard", icon: "🏥", label: "Dashboard" },
    { id: "timeline", icon: "📋", label: "Records" },
    { id: "assistant", icon: "🤖", label: "AI Assistant" },
];

const DOCTOR_NAV_BOTTOM: NavItem[] = [
    { id: "help", icon: "❓", label: "Help" },
    { id: "settings", icon: "⚙️", label: "Settings" },
];

export default function AppShell({
    children,
    activeScreen,
    onNavigate,
    pageTitle,
    userName,
    userRole,
    userId,
}: AppShellProps) {
    const { logout } = useAuth();
    const isDoctor = userRole === "Doctor";
    const navMain = isDoctor ? DOCTOR_NAV_MAIN : PATIENT_NAV_MAIN;
    const navBottom = isDoctor ? DOCTOR_NAV_BOTTOM : PATIENT_NAV_BOTTOM;

    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!userId) return;
        const cached = localStorage.getItem(`profilePhoto_${userId}`);
        if (cached) setPhotoUrl(cached);
    }, [userId]);

    // ---- User card popover menu ----
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [menuOpen]);

    const handleSignOut = async () => {
        setMenuOpen(false);
        await logout();
    };

    // ---- Notification panel ----
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!notifOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [notifOpen]);

    interface Notification { id: number; icon: string; title: string; desc: string; time: string; unread: boolean; }

    const SHELL_NOTIFS: Notification[] = [
        { id: 1, icon: "🟢", title: "Welcome to ArogyaSutra!", desc: "Your health vault is ready. Start by scanning a document.", time: "Just now", unread: true },
        { id: 2, icon: "📋", title: "Timeline synced", desc: "All your health records are up to date.", time: "2 min ago", unread: true },
        { id: 3, icon: "🔒", title: "Security check passed", desc: "Your encryption keys have been verified.", time: "5 min ago", unread: false },
    ];

    function applyReadIds(base: Notification[], readIds: number[]): Notification[] {
        const set = new Set(readIds);
        return base.map((n) => ({ ...n, unread: !set.has(n.id) }));
    }

    function localReadIds(uid: string): number[] {
        try {
            const raw = localStorage.getItem(`notif_read_${uid}`);
            return raw ? (JSON.parse(raw) as number[]) : [];
        } catch { return []; }
    }

    function saveLocalReadIds(uid: string, readIds: number[]) {
        try { localStorage.setItem(`notif_read_${uid}`, JSON.stringify(readIds)); } catch { /* ignore */ }
    }

    // Initialise from localStorage instantly (no flicker), then hydrate from DynamoDB
    const [notifications, setNotifications] = useState<Notification[]>(() => {
        if (!userId || typeof window === "undefined") return SHELL_NOTIFS;
        return applyReadIds(SHELL_NOTIFS, localReadIds(userId));
    });

    // On mount: fetch authoritative read state from DynamoDB and reconcile
    useEffect(() => {
        if (!userId) return;
        fetch(`/api/notifications/read-state?userId=${encodeURIComponent(userId)}`)
            .then((r) => r.json())
            .then(({ readIds }) => {
                if (!Array.isArray(readIds)) return;
                saveLocalReadIds(userId, readIds);
                setNotifications(applyReadIds(SHELL_NOTIFS, readIds));
            })
            .catch(() => { /* silently keep localStorage state */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Persist to both localStorage (instant) and DynamoDB (durable) on every change
    useEffect(() => {
        if (!userId) return;
        const readIds = notifications.filter((n) => !n.unread).map((n) => n.id);
        saveLocalReadIds(userId, readIds);
        fetch("/api/notifications/read-state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, readIds }),
        }).catch(() => { /* localStorage already updated — DynamoDB will sync next login */ });
    }, [notifications, userId]);

    const unreadCount = notifications.filter((n) => n.unread).length;

    const handleMarkAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    };

    const handleNotifClick = (id: number) => {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, unread: false } : n));
    };

    const handleViewAll = () => {
        setNotifOpen(false);
        onNavigate("notifications");
    };

    return (
        <div className={styles.shell}>
            {/* ---- Sidebar ---- */}
            <aside className={styles.sidebar}>
                {/* Logo */}
                <div className={styles.sidebarLogo}>
                    <span className={styles.logoName}>Arogya<span className={styles.logoAccent}>Sutra</span></span>
                </div>

                {/* Main nav group */}
                <div className={styles.navGroup}>
                    <span className={styles.navGroupLabel}>Menu</span>
                    <nav className={styles.sidebarNav}>
                        {navMain.map((item) => (
                            <button
                                key={item.id}
                                className={`${styles.navBtn} ${activeScreen === item.id ? styles.navBtnActive : ""}`}
                                onClick={() => onNavigate(item.id)}
                            >
                                <span className={styles.navIcon}>{item.icon}</span>
                                <span className={styles.navLabel}>{item.label}</span>
                                {item.badge != null && (
                                    <span className={styles.navBadge}>{item.badge}</span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Spacer */}
                <div className={styles.navSpacer} />

                {/* Bottom nav group */}
                <div className={styles.navGroup}>
                    <span className={styles.navGroupLabel}>Account</span>
                    <nav className={styles.sidebarNav}>
                        {navBottom.map((item) => (
                            <button
                                key={item.id}
                                className={`${styles.navBtn} ${activeScreen === item.id ? styles.navBtnActive : ""}`}
                                onClick={() => onNavigate(item.id)}
                            >
                                <span className={styles.navIcon}>{item.icon}</span>
                                <span className={styles.navLabel}>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* User card at bottom */}
                <div className={styles.userCardWrap} ref={menuRef}>
                    <button className={styles.userCard} onClick={() => onNavigate("profile")}>
                        <div className={styles.userAvatar}>
                            {photoUrl ? (
                                <img src={photoUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                            ) : (
                                <span>{initials}</span>
                            )}
                        </div>
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{userName || "User"}</span>
                            <span className={styles.userRole}>{userRole}</span>
                        </div>
                    </button>
                    <button
                        className={styles.userMoreBtn}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                        aria-label="More options"
                    >
                        ⋮
                    </button>

                    {menuOpen && (
                        <div className={styles.popoverMenu}>
                            <button className={styles.popoverItem} onClick={() => { setMenuOpen(false); onNavigate("profile"); }}>
                                <span>👤</span> My Profile
                            </button>
                            <div className={styles.popoverDivider} />
                            <button className={`${styles.popoverItem} ${styles.popoverDanger}`} onClick={handleSignOut}>
                                <span>🚪</span> Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* ---- Top Bar ---- */}
            <header className={styles.topbar}>
                <div className={styles.topbarLeft}>
                    <h1 className={styles.pageTitle}>{pageTitle}</h1>
                </div>

                <div className={styles.searchBox}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Find Anything..."
                    />
                </div>

                <div className={styles.topbarRight}>
                    <div className={styles.notifWrap} ref={notifRef}>
                        <button
                            className={styles.notifBtn}
                            title="Notifications"
                            onClick={() => setNotifOpen((v) => !v)}
                        >
                            🔔
                            {unreadCount > 0 && <span className={styles.notifDot}>{unreadCount}</span>}
                        </button>

                        {notifOpen && (
                            <div className={styles.notifPanel}>
                                <div className={styles.notifHeader}>
                                    <span className={styles.notifTitle}>Notifications</span>
                                    <button
                                        className={styles.notifMarkAll}
                                        onClick={handleMarkAllRead}
                                        disabled={unreadCount === 0}
                                    >
                                        Mark all read
                                    </button>
                                </div>
                                <div className={styles.notifList}>
                                    {notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={`${styles.notifItem} ${n.unread ? styles.notifItemUnread : ""}`}
                                            onClick={() => handleNotifClick(n.id)}
                                        >
                                            <span className={styles.notifItemIcon}>{n.icon}</span>
                                            <div className={styles.notifItemBody}>
                                                <span className={styles.notifItemTitle}>{n.title}</span>
                                                <span className={styles.notifItemDesc}>{n.desc}</span>
                                            </div>
                                            <span className={styles.notifItemTime}>{n.time}</span>
                                        </div>
                                    ))}
                                </div>
                                <button className={styles.notifViewAll} onClick={handleViewAll}>View all notifications</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ---- Main Content ---- */}
            <main className={styles.content}>{children}</main>
        </div>
    );
}
