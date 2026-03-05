// ============================================================
// AppShell — Desktop Layout Shell
// Wide sidebar (220px) with icon + text labels, grouped sections,
// user card at bottom. Inspired by modern health-app sidebars.
// ============================================================

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../hooks/useLanguage";
import styles from "./AppShell.module.css";
import {
    LayoutDashboard, ClipboardList, Camera, Link2,
    HelpCircle, Settings, Hospital, User, LogOut,
    Bell, Search, MoreVertical, CheckCheck, ShieldCheck, X, Users,
} from "lucide-react";
import { GeminiIcon } from "../common/GeminiIcon";

interface NavItem {
    id: string;
    icon: React.ReactNode;
    label: string;
    badge?: number;
}

interface TimelineEntry {
    entryId: string;
    title: string;
    documentType: string;
    doctorName?: string;
    sourceInstitution?: string;
    date?: string;
}

interface SearchResult {
    id: string;
    type: "nav" | "record";
    icon: React.ReactNode;
    label: string;
    desc?: string;
    badge?: string;
    navTarget: string;
    /** For record results, the entryId to open in the detail modal. */
    entryId?: string;
}

interface AppShellProps {
    children: React.ReactNode;
    activeScreen: string;
    onNavigate: (screen: string) => void;
    pageTitle: string;
    userName: string;
    userRole: string;
    userId?: string;
    /** When a doctor has an active patient session, pass the patientId to unlock Records nav. */
    activePatientId?: string;
    /** Called when user clicks a specific health record in global search. */
    onRecordSelect?: (entryId: string) => void;
}

// Nav items are built inside the component so labels react to language changes

export default function AppShell({
    children,
    activeScreen,
    onNavigate,
    pageTitle,
    userName,
    userRole,
    userId,
    activePatientId,
    onRecordSelect,
}: AppShellProps) {
    const { logout, viewingAs, switchToDependent, switchToSelf, dependents } = useAuth();
    const { t } = useLanguage();
    const isDoctor = userRole === "Doctor";

    const navMain: NavItem[] = isDoctor
        ? [
            { id: "doctor-dashboard", icon: <Hospital size={18} />, label: t("nav_dashboard") },
            ...(activePatientId ? [{ id: "timeline", icon: <ClipboardList size={18} />, label: t("nav_records") }] : []),
            { id: "assistant", icon: <GeminiIcon size={18} />, label: t("nav_assistant") },
        ]
        : [
            { id: "dashboard", icon: <LayoutDashboard size={18} />, label: t("nav_dashboard") },
            { id: "timeline", icon: <ClipboardList size={18} />, label: t("nav_timeline") },
            { id: "assistant", icon: <GeminiIcon size={18} />, label: t("nav_assistant") },
            { id: "access", icon: <Link2 size={18} />, label: t("nav_access") },
        ];

    const navBottom: NavItem[] = [
        { id: "help", icon: <HelpCircle size={18} />, label: t("nav_help") },
        { id: "settings", icon: <Settings size={18} />, label: t("nav_settings") },
    ];

    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!userId) return;
        const key = `profilePhoto_${userId}`;

        // Show cached base64 immediately for instant display
        const cached = localStorage.getItem(key);
        if (cached) setPhotoUrl(cached);

        // Fetch authoritative URL from S3 (covers cases where localStorage was cleared)
        const role = isDoctor ? "doctor" : "patient";
        fetch(`/api/profile/photo?userId=${userId}&role=${role}`)
            .then((r) => r.json())
            .then((data) => { if (data.url) setPhotoUrl(data.url); })
            .catch(() => {/* silently use cached */ });

        // Keep sidebar avatar in sync when photo is uploaded from ProfileScreen
        const handlePhotoUpdate = (e: Event) => {
            const detail = (e as CustomEvent<{ key: string; url: string }>).detail;
            if (detail.key === key) setPhotoUrl(detail.url);
        };
        window.addEventListener("profilePhotoUpdated", handlePhotoUpdate);
        return () => window.removeEventListener("profilePhotoUpdated", handlePhotoUpdate);
    }, [userId, isDoctor]);

    // ---- Apply saved theme + language on mount ----
    useEffect(() => {
        const saved = localStorage.getItem("arogyasutra_theme");
        if (saved === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
        const lang = localStorage.getItem("arogyasutra_language");
        if (lang) document.documentElement.setAttribute("lang", lang);
    }, []);

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

    interface Notification { id: number; icon: React.ReactNode; title: string; desc: string; time: string; unread: boolean; }

    const SHELL_NOTIFS: Notification[] = [
        { id: 1, icon: <User size={14} />, title: "Welcome to ArogyaSutra!", desc: "Your health vault is ready. Start by scanning a document.", time: "Just now", unread: true },
        { id: 2, icon: <ClipboardList size={14} />, title: "Timeline synced", desc: "All your health records are up to date.", time: "2 min ago", unread: true },
        { id: 3, icon: <ShieldCheck size={14} />, title: "Security check passed", desc: "Your encryption keys have been verified.", time: "5 min ago", unread: false },
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

    // ---- Global search ----
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchActiveIdx, setSearchActiveIdx] = useState(-1);
    const searchRef = useRef<HTMLDivElement>(null);
    const [entriesCache, setEntriesCache] = useState<TimelineEntry[] | null>(null);
    const entriesFetchedRef = useRef(false);

    // Prefetch timeline entries in the background:
    // - For patients: their own records
    // - For doctors: the active patient's records (re-fetches when activePatientId changes)
    useEffect(() => {
        const fetchId = isDoctor ? activePatientId : userId;
        if (!fetchId) return;
        // Re-fetch when the doctor switches patients
        if (!isDoctor && entriesFetchedRef.current) return;
        entriesFetchedRef.current = true;
        setEntriesCache(null);
        const prefetchParams = new URLSearchParams({ patientId: fetchId });
        if (isDoctor && userId) {
            prefetchParams.set("viewerType", "DOCTOR");
            prefetchParams.set("viewerId", userId);
            prefetchParams.set("viewerName", userName);
        }
        fetch(`/api/timeline/entries?${prefetchParams.toString()}`)
            .then((r) => r.json())
            .then((data) => { setEntriesCache(data.entries ?? []); })
            .catch(() => { /* silently ignore – search just won't show records */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDoctor, userId, activePatientId]);

    // Close search dropdown on outside click
    useEffect(() => {
        if (!searchOpen) return;
        const handle = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
                setSearchActiveIdx(-1);
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [searchOpen]);

    // Run search whenever query changes
    useEffect(() => {
        const lq = searchQuery.trim().toLowerCase();
        if (!lq) { setSearchResults([]); return; }

        const buildResults: SearchResult[] = [];

        // --- Navigation items ---
        const allNavItems: { id: string; icon: React.ReactNode; label: string }[] = [
            ...(isDoctor
                ? [
                    { id: "doctor-dashboard", icon: <Hospital size={16} />, label: t("nav_dashboard") },
                    { id: "timeline", icon: <ClipboardList size={16} />, label: t("nav_records") },
                    { id: "assistant", icon: <GeminiIcon size={16} />, label: t("nav_assistant") },
                ]
                : [
                    { id: "dashboard", icon: <LayoutDashboard size={16} />, label: t("nav_dashboard") },
                    { id: "timeline", icon: <ClipboardList size={16} />, label: t("nav_timeline") },
                    { id: "assistant", icon: <GeminiIcon size={16} />, label: t("nav_assistant") },
                    { id: "access", icon: <Link2 size={16} />, label: t("nav_access") },
                ]),
            { id: "help", icon: <HelpCircle size={16} />, label: t("nav_help") },
            { id: "settings", icon: <Settings size={16} />, label: t("nav_settings") },
            { id: "profile", icon: <User size={16} />, label: t("my_profile") },
            { id: "notifications", icon: <Bell size={16} />, label: t("notif_title") },
        ];

        allNavItems.forEach((item) => {
            if (item.label.toLowerCase().includes(lq)) {
                buildResults.push({
                    id: `nav-${item.id}`,
                    type: "nav",
                    icon: item.icon,
                    label: item.label,
                    navTarget: item.id,
                });
            }
        });

        // --- Health records (patient or doctor with active patient session) ---
        if (entriesCache) {
            entriesCache
                .filter((e) =>
                    [e.title, e.documentType, e.doctorName, e.sourceInstitution]
                        .some((f) => f?.toLowerCase().includes(lq))
                )
                .slice(0, 6)
                .forEach((e) => {
                    buildResults.push({
                        id: `rec-${e.entryId}`,
                        type: "record",
                        icon: <ClipboardList size={16} />,
                        label: e.title || "Health Record",
                        desc: [e.doctorName, e.sourceInstitution].filter(Boolean).join(" · "),
                        badge: e.documentType,
                        navTarget: "timeline",                        entryId: e.entryId,                    });
                });
        }

        setSearchResults(buildResults);
        setSearchActiveIdx(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, entriesCache, isDoctor, t]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!searchOpen || searchResults.length === 0) {
            if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSearchActiveIdx((prev) => Math.min(prev + 1, searchResults.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSearchActiveIdx((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" && searchActiveIdx >= 0) {
            e.preventDefault();
            const target = searchResults[searchActiveIdx]?.navTarget;
            const eid = searchResults[searchActiveIdx]?.entryId;
            if (target) {
                if (eid && onRecordSelect) onRecordSelect(eid);
                onNavigate(target); setSearchQuery(""); setSearchOpen(false); setSearchActiveIdx(-1);
            }
        } else if (e.key === "Escape") {
            setSearchOpen(false);
            setSearchQuery("");
            setSearchActiveIdx(-1);
        }
    };

    return (
        <div className={styles.shell}>
            {/* ---- Sidebar ---- */}
            <aside className={styles.sidebar}>
                {/* Logo */}
                <button
                    className={styles.sidebarLogo}
                    onClick={() => onNavigate(isDoctor ? "doctor-dashboard" : "dashboard")}
                    style={{ background: "none", border: "none", cursor: "pointer", width: "100%" }}
                >
                    <span className={styles.logoName}>Arogya<span className={styles.logoAccent}>Sutra</span></span>
                </button>

                {/* Viewing-as banner — shown when guardian is viewing a dependent's records */}
                {viewingAs && (
                    <div className={styles.viewingBanner}>
                        <span className={styles.viewingBannerLabel}>Viewing</span>
                        <span className={styles.viewingBannerName}>{viewingAs.fullName}</span>
                        <button
                            className={styles.viewingBannerClose}
                            onClick={switchToSelf}
                            title="Back to my records"
                            aria-label="Switch back to my records"
                        >
                            <X size={11} />
                        </button>
                    </div>
                )}

                {/* Main nav group */}
                <div className={styles.navGroup}>
                    <span className={styles.navGroupLabel}>{t("nav_group_menu")}</span>
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
                    <span className={styles.navGroupLabel}>{t("nav_group_account")}</span>
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
                            <span className={styles.userRole}>{isDoctor ? t("role_doctor") : t("role_patient")}</span>
                        </div>
                    </button>
                    <button
                        className={styles.userMoreBtn}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                        aria-label="More options"
                    >
                        <MoreVertical size={16} />
                    </button>

                    {menuOpen && (
                        <div className={styles.popoverMenu}>
                            <button className={styles.popoverItem} onClick={() => { setMenuOpen(false); onNavigate("profile"); }}>
                                <User size={14} /> {t("my_profile")}
                            </button>
                            {/* Dependent account switcher (patients with linked cards only) */}
                            {!isDoctor && dependents.length > 0 && (
                                <>
                                    <div className={styles.popoverDivider} />
                                    <div className={styles.popoverSectionLabel}><Users size={11} /> Switch Account</div>
                                    {viewingAs ? (
                                        <button className={styles.popoverItem} onClick={() => { switchToSelf(); setMenuOpen(false); }}>
                                            <User size={14} /> My Records
                                        </button>
                                    ) : null}
                                    {dependents.map((dep) => (
                                        <button
                                            key={dep.cardId}
                                            className={`${styles.popoverItem} ${viewingAs?.patientId === dep.cardId ? styles.popoverItemActive : ""}`}
                                            onClick={() => { switchToDependent(dep); setMenuOpen(false); onNavigate("dashboard"); }}
                                        >
                                            <Users size={14} /> {dep.name}
                                        </button>
                                    ))}
                                </>
                            )}
                            <div className={styles.popoverDivider} />
                            <button className={`${styles.popoverItem} ${styles.popoverDanger}`} onClick={handleSignOut}>
                                <LogOut size={14} /> {t("sign_out")}
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

                <div className={styles.searchBox} ref={searchRef}>
                    <span className={styles.searchIcon}><Search size={15} /></span>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder={t("search_placeholder")}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSearchOpen(true);
                            setSearchActiveIdx(-1);
                        }}
                        onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
                        onKeyDown={handleSearchKeyDown}
                        autoComplete="off"
                    />
                    {searchQuery && (
                        <button
                            className={styles.searchClear}
                            onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchOpen(false); setSearchActiveIdx(-1); }}
                            aria-label="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}

                    {/* Search dropdown — onMouseDown preventDefault keeps input focused so clicks always fire */}
                    {searchOpen && searchQuery.trim() && (
                        <div className={styles.searchDropdown} onMouseDown={(e) => e.preventDefault()}>
                            {searchResults.length === 0 ? (
                                <div className={styles.searchEmpty}>No results for &ldquo;{searchQuery}&rdquo;</div>
                            ) : (
                                <>
                                    {/* Navigation section */}
                                    {searchResults.filter((r) => r.type === "nav").length > 0 && (
                                        <>
                                            <div className={styles.searchSection}>Navigation</div>
                                            {searchResults
                                                .filter((r) => r.type === "nav")
                                                .map((r) => {
                                                    const globalIdx = searchResults.findIndex((x) => x.id === r.id);
                                                    return (
                                                        <button
                                                            key={r.id}
                                                            type="button"
                                                            className={`${styles.searchResult} ${globalIdx === searchActiveIdx ? styles.searchResultActive : ""}`}
                                                            onMouseEnter={() => setSearchActiveIdx(globalIdx)}
                                                            onClick={() => { onNavigate(r.navTarget); setSearchQuery(""); setSearchOpen(false); setSearchActiveIdx(-1); }}
                                                        >
                                                            <span className={styles.searchResultIcon}>{r.icon}</span>
                                                            <div className={styles.searchResultBody}>
                                                                <span className={styles.searchResultLabel}>{r.label}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                        </>
                                    )}

                                    {/* Health records section */}
                                    {searchResults.filter((r) => r.type === "record").length > 0 && (
                                        <>
                                            <div className={styles.searchSection}>Health Records</div>
                                            {searchResults
                                                .filter((r) => r.type === "record")
                                                .map((r) => {
                                                    const globalIdx = searchResults.findIndex((x) => x.id === r.id);
                                                    return (
                                                        <button
                                                            key={r.id}
                                                            type="button"
                                                            className={`${styles.searchResult} ${globalIdx === searchActiveIdx ? styles.searchResultActive : ""}`}
                                                            onMouseEnter={() => setSearchActiveIdx(globalIdx)}
                                                            onClick={() => { if (r.entryId && onRecordSelect) onRecordSelect(r.entryId); onNavigate(r.navTarget); setSearchQuery(""); setSearchOpen(false); setSearchActiveIdx(-1); }}
                                                        >
                                                            <span className={styles.searchResultIcon}>{r.icon}</span>
                                                            <div className={styles.searchResultBody}>
                                                                <span className={styles.searchResultLabel}>{r.label}</span>
                                                                {r.desc && <span className={styles.searchResultDesc}>{r.desc}</span>}
                                                            </div>
                                                            {r.badge && <span className={styles.searchResultBadge}>{r.badge}</span>}
                                                        </button>
                                                    );
                                                })}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.topbarRight}>
                    <div className={styles.notifWrap} ref={notifRef}>
                        <button
                            className={styles.notifBtn}
                            title="Notifications"
                            onClick={() => setNotifOpen((v) => !v)}
                        >
                            <Bell size={18} />
                            {unreadCount > 0 && <span className={styles.notifDot}>{unreadCount}</span>}
                        </button>

                        {notifOpen && (
                            <div className={styles.notifPanel}>
                                <div className={styles.notifHeader}>
                                    <span className={styles.notifTitle}>{t("notif_title")}</span>
                                    <button
                                        className={styles.notifMarkAll}
                                        onClick={handleMarkAllRead}
                                        disabled={unreadCount === 0}
                                    >
                                        <CheckCheck size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                                        {t("notif_mark_all")}
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
                                <button className={styles.notifViewAll} onClick={handleViewAll}>{t("notif_view_all")}</button>
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
