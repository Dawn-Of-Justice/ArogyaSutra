// ============================================================
// NotificationsScreen — Full notifications list
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import styles from "./NotificationsScreen.module.css";
import {
    Bell, CheckCheck,
} from "lucide-react";
import {
    ALL_NOTIFICATIONS, applyReadIds, localReadIds, saveLocalReadIds,
    type AppNotification, type NotifCategory,
} from "../../lib/utils/notifications";

interface NotificationsScreenProps {
    onNavigate: (screen: string) => void;
    userId?: string;
}

type Filter = NotifCategory;

export default function NotificationsScreen({ onNavigate, userId }: NotificationsScreenProps) {
    // Initialise from localStorage instantly (no flicker), then hydrate from DynamoDB
    const [notifications, setNotifications] = useState<AppNotification[]>(() => {
        if (!userId || typeof window === "undefined") return ALL_NOTIFICATIONS;
        return applyReadIds(ALL_NOTIFICATIONS, localReadIds(userId));
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
                setNotifications(applyReadIds(ALL_NOTIFICATIONS, readIds));
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
