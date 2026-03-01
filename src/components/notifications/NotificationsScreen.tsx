// ============================================================
// NotificationsScreen — Full notifications list
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import styles from "./NotificationsScreen.module.css";
import {
    User, ClipboardList, ShieldCheck, Pill, Hospital,
    FileText, ShieldAlert, Settings, Bell, CheckCheck,
} from "lucide-react";

interface NotificationsScreenProps {
    onNavigate: (screen: string) => void;
    userId?: string;
}

interface Notification {
    id: number;
    icon: React.ReactNode;
    title: string;
    desc: string;
    time: string;
    unread: boolean;
    category: "all" | "system" | "security" | "health";
}

const INITIAL_NOTIFICATIONS: Notification[] = [
    { id: 1, icon: <User size={16} />, title: "Welcome to ArogyaSutra!", desc: "Your health vault is ready. Start by scanning your first medical document to build your digital timeline.", time: "Just now", unread: true, category: "system" },
    { id: 2, icon: <ClipboardList size={16} />, title: "Timeline synced", desc: "All your health records are up to date. Your encrypted data has been verified against the latest backup.", time: "2 min ago", unread: true, category: "health" },
    { id: 3, icon: <ShieldCheck size={16} />, title: "Security check passed", desc: "Your encryption keys have been verified. Zero-knowledge encryption is active — your data is safe.", time: "5 min ago", unread: false, category: "security" },
    { id: 4, icon: <Pill size={16} />, title: "Medication reminder", desc: "Don't forget to take your prescribed medications today. Check your timeline for dosage details.", time: "1 hour ago", unread: false, category: "health" },
    { id: 5, icon: <Hospital size={16} />, title: "Doctor access granted", desc: "Dr. Sharma now has read access to your health timeline. You can revoke access anytime from Settings.", time: "2 hours ago", unread: false, category: "security" },
    { id: 6, icon: <FileText size={16} />, title: "Document processed", desc: "Your lab report from Metropolis Labs has been digitized with 94% confidence. Review the extracted data.", time: "Yesterday", unread: false, category: "health" },
    { id: 7, icon: <ShieldAlert size={16} />, title: "Break-Glass access logged", desc: "Emergency access was attempted for your records. Check your audit log for full details.", time: "2 days ago", unread: false, category: "security" },
    { id: 8, icon: <Settings size={16} />, title: "App updated to v0.1.0", desc: "ArogyaSutra has been updated with new features including the AI Clinical Assistant and improved offline support.", time: "3 days ago", unread: false, category: "system" },
];

type Filter = "all" | "system" | "security" | "health";

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

export default function NotificationsScreen({ onNavigate, userId }: NotificationsScreenProps) {
    // Initialise from localStorage instantly (no flicker), then hydrate from DynamoDB
    const [notifications, setNotifications] = useState<Notification[]>(() => {
        if (!userId || typeof window === "undefined") return INITIAL_NOTIFICATIONS;
        return applyReadIds(INITIAL_NOTIFICATIONS, localReadIds(userId));
    });
    const [filter, setFilter] = useState<Filter>("all");

    // On mount: fetch authoritative read state from DynamoDB
    useEffect(() => {
        if (!userId) return;
        fetch(`/api/notifications/read-state?userId=${encodeURIComponent(userId)}`)
            .then((r) => r.json())
            .then(({ readIds }) => {
                if (!Array.isArray(readIds)) return;
                saveLocalReadIds(userId, readIds);
                setNotifications(applyReadIds(INITIAL_NOTIFICATIONS, readIds));
            })
            .catch(() => { /* keep localStorage state on network/config error */ });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Persist to localStorage (instant) + DynamoDB (durable) on every change
    useEffect(() => {
        if (!userId) return;
        const readIds = notifications.filter((n) => !n.unread).map((n) => n.id);
        saveLocalReadIds(userId, readIds);
        fetch("/api/notifications/read-state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, readIds }),
        }).catch(() => { /* localStorage already updated — DynamoDB syncs next login */ });
    }, [notifications, userId]);

    const filtered = filter === "all"
        ? notifications
        : notifications.filter((n) => n.category === filter);

    const unreadCount = notifications.filter((n) => n.unread).length;

    const handleMarkAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    };

    const handleClick = (id: number) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
        );
    };

    const FILTERS: { key: Filter; label: string }[] = [
        { key: "all", label: "All" },
        { key: "health", label: "Health" },
        { key: "security", label: "Security" },
        { key: "system", label: "System" },
    ];

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <h2>Notifications</h2>
                <div className={styles.headerActions}>
                    <button
                        className={styles.markReadBtn}
                        onClick={handleMarkAllRead}
                        disabled={unreadCount === 0}
                    >
                        <CheckCheck size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                        Mark all read
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filters}>
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ""}`}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}><Bell size={36} /></div>
                    <h3>No notifications</h3>
                    <p>You&apos;re all caught up!</p>
                </div>
            ) : (
                <div className={styles.list}>
                    {filtered.map((n) => (
                        <div
                            key={n.id}
                            className={`${styles.item} ${n.unread ? styles.itemUnread : ""}`}
                            onClick={() => handleClick(n.id)}
                        >
                            <div className={styles.itemIcon}>{n.icon}</div>
                            <div className={styles.itemBody}>
                                <span className={styles.itemTitle}>{n.title}</span>
                                <span className={styles.itemDesc}>{n.desc}</span>
                            </div>
                            <div className={styles.itemMeta}>
                                <span className={styles.itemTime}>{n.time}</span>
                                {n.unread && <span className={styles.unreadDot} />}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
