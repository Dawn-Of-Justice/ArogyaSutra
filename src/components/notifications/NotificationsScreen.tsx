// ============================================================
// NotificationsScreen — Full notifications list
// ============================================================

"use client";

import React, { useState } from "react";
import styles from "./NotificationsScreen.module.css";

interface NotificationsScreenProps {
    onNavigate: (screen: string) => void;
}

interface Notification {
    id: number;
    icon: string;
    title: string;
    desc: string;
    time: string;
    unread: boolean;
    category: "all" | "system" | "security" | "health";
}

const INITIAL_NOTIFICATIONS: Notification[] = [
    { id: 1, icon: "🟢", title: "Welcome to ArogyaSutra!", desc: "Your health vault is ready. Start by scanning your first medical document to build your digital timeline.", time: "Just now", unread: true, category: "system" },
    { id: 2, icon: "📋", title: "Timeline synced", desc: "All your health records are up to date. Your encrypted data has been verified against the latest backup.", time: "2 min ago", unread: true, category: "health" },
    { id: 3, icon: "🔒", title: "Security check passed", desc: "Your encryption keys have been verified. Zero-knowledge encryption is active — your data is safe.", time: "5 min ago", unread: false, category: "security" },
    { id: 4, icon: "💊", title: "Medication reminder", desc: "Don't forget to take your prescribed medications today. Check your timeline for dosage details.", time: "1 hour ago", unread: false, category: "health" },
    { id: 5, icon: "🏥", title: "Doctor access granted", desc: "Dr. Sharma now has read access to your health timeline. You can revoke access anytime from Settings.", time: "2 hours ago", unread: false, category: "security" },
    { id: 6, icon: "📄", title: "Document processed", desc: "Your lab report from Metropolis Labs has been digitized with 94% confidence. Review the extracted data.", time: "Yesterday", unread: false, category: "health" },
    { id: 7, icon: "🛡️", title: "Break-Glass access logged", desc: "Emergency access was attempted for your records. Check your audit log for full details.", time: "2 days ago", unread: false, category: "security" },
    { id: 8, icon: "⚙️", title: "App updated to v0.1.0", desc: "ArogyaSutra has been updated with new features including the AI Clinical Assistant and improved offline support.", time: "3 days ago", unread: false, category: "system" },
];

type Filter = "all" | "system" | "security" | "health";

export default function NotificationsScreen({ onNavigate }: NotificationsScreenProps) {
    const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
    const [filter, setFilter] = useState<Filter>("all");

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
                        ✓ Mark all read
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
                    <div className={styles.emptyIcon}>🔔</div>
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
