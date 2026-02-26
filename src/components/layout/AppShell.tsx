// ============================================================
// AppShell — Desktop Layout Shell
// Sidebar nav + top bar + main content area
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import styles from "./AppShell.module.css";

interface NavItem {
    id: string;
    icon: string;
    label: string;
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

const PATIENT_NAV: NavItem[] = [
    { id: "dashboard", icon: "🏠", label: "Home" },
    { id: "timeline", icon: "📋", label: "Timeline" },
    { id: "upload", icon: "📷", label: "Scan" },
    { id: "assistant", icon: "🤖", label: "AI Assistant" },
    { id: "access", icon: "🔗", label: "Doctor Access" },
];

const PATIENT_NAV_BOTTOM: NavItem[] = [
    { id: "settings", icon: "⚙️", label: "Settings" },
];

const DOCTOR_NAV: NavItem[] = [
    { id: "doctor-dashboard", icon: "🏥", label: "Dashboard" },
    { id: "timeline", icon: "📋", label: "Records" },
    { id: "assistant", icon: "🤖", label: "AI Assistant" },
];

const DOCTOR_NAV_BOTTOM: NavItem[] = [
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
    const isDoctor = userRole === "Doctor";
    const navItems = isDoctor ? DOCTOR_NAV : PATIENT_NAV;
    const navBottomItems = isDoctor ? DOCTOR_NAV_BOTTOM : PATIENT_NAV_BOTTOM;

    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

    // Read profile photo from localStorage (set by ProfileScreen)
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!userId) return;
        const cached = localStorage.getItem(`profilePhoto_${userId}`);
        if (cached) setPhotoUrl(cached);
    }, [userId]);

    return (
        <div className={styles.shell}>
            {/* ---- Sidebar ---- */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    {isDoctor ? "➕" : "🛡️"}
                </div>

                <nav className={styles.sidebarNav}>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.navBtn} ${activeScreen === item.id ? styles.navBtnActive : ""}`}
                            onClick={() => onNavigate(item.id)}
                            data-tooltip={item.label}
                            title={item.label}
                        >
                            {item.icon}
                        </button>
                    ))}
                </nav>

                <div className={styles.navDivider} />

                <div className={styles.sidebarBottom}>
                    {navBottomItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.navBtn} ${activeScreen === item.id ? styles.navBtnActive : ""}`}
                            onClick={() => onNavigate(item.id)}
                            data-tooltip={item.label}
                            title={item.label}
                        >
                            {item.icon}
                        </button>
                    ))}
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
                    <button className={styles.notifBtn} title="Notifications">
                        🔔
                        <span className={styles.notifDot} />
                    </button>
                    <button
                        className={styles.profilePill}
                        onClick={() => onNavigate("profile")}
                    >
                        <div className={styles.profileAvatar}>
                            {photoUrl ? (
                                <img src={photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                            ) : (
                                initials
                            )}
                        </div>
                        <div className={styles.profileInfo}>
                            <span className={styles.profileName}>{userName}</span>
                            <span className={styles.profileRole}>{userRole}</span>
                        </div>
                        <span className={styles.profileChevron}>▾</span>
                    </button>
                </div>
            </header>

            {/* ---- Main Content ---- */}
            <main className={styles.content}>{children}</main>
        </div>
    );
}
