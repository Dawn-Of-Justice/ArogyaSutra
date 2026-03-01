// ============================================================
// Access Log Screen
// Displays a chronological audit trail of everyone who has
// accessed the patient's health records:
//   • Self  — patient viewing / updating their own records
//   • Doctor — a doctor granted access viewing the timeline
//   • Emergency — break-glass emergency access event
// ============================================================

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    User,
    Stethoscope,
    ShieldAlert,
    MapPin,
    FileText,
    Clock,
    Layers,
    Activity,
    AlertTriangle,
    RefreshCw,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import styles from "./AccessLogScreen.module.css";

// --------------- Types ---------------

type AccessType = "self" | "doctor" | "emergency";

interface AccessEvent {
    id: string;
    type: AccessType;
    actorName: string;
    actorRole?: string;
    action: string;
    record?: string;
    timestamp: Date;
    location?: string;
    device?: string;
}

type FilterTab = "all" | AccessType;

// --------------- Helpers ---------------

function relativeTime(date: Date): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 172800) return "Yesterday";
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function groupLabel(date: Date): string {
    const now = new Date();
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return "This Week";
    if (diff < 30) return "This Month";
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// --------------- Component dot + badge helpers ---------------

const DOT_CLASS: Record<AccessType, string> = {
    self: styles.dotSelf,
    doctor: styles.dotDoctor,
    emergency: styles.dotEmergency,
};

const BADGE_CLASS: Record<AccessType, string> = {
    self: styles.badgeSelf,
    doctor: styles.badgeDoctor,
    emergency: styles.badgeEmergency,
};

const BADGE_LABEL: Record<AccessType, string> = {
    self: "You",
    doctor: "Doctor",
    emergency: "Emergency",
};

function ActorIcon({ type }: { type: AccessType }) {
    if (type === "doctor") return <Stethoscope size={18} />;
    if (type === "emergency") return <ShieldAlert size={18} />;
    return <User size={18} />;
}

// --------------- Main component ---------------

export default function AccessLogScreen() {
    const { patient } = useAuth();
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<AccessEvent[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterTab>("all");

    const fetchLogs = useCallback(async (cursor?: string) => {
        if (!patient?.patientId) return;
        cursor ? setLoadingMore(true) : setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ patientId: patient.patientId, limit: "50" });
            if (cursor) params.set("cursor", cursor);
            const res = await fetch(`/api/access-log?${params}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? `HTTP ${res.status}`);
            }
            const data = await res.json() as {
                events: (Omit<AccessEvent, "timestamp"> & { timestamp: string })[];
                nextCursor: string | null;
            };
            const parsed: AccessEvent[] = data.events.map((e) => ({
                ...e,
                timestamp: new Date(e.timestamp),
            }));
            setEvents((prev) => cursor ? [...prev, ...parsed] : parsed);
            setNextCursor(data.nextCursor);
        } catch (err) {
            setError((err as Error).message ?? "Failed to load access log.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [patient?.patientId]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Filtered list
    const filtered = useMemo(
        () => filter === "all" ? events : events.filter((e) => e.type === filter),
        [events, filter]
    );

    // Group by date label
    const grouped = useMemo(() => {
        const groups: { label: string; items: AccessEvent[] }[] = [];
        filtered.forEach((ev) => {
            const lbl = groupLabel(ev.timestamp);
            const last = groups[groups.length - 1];
            if (last && last.label === lbl) {
                last.items.push(ev);
            } else {
                groups.push({ label: lbl, items: [ev] });
            }
        });
        return groups;
    }, [filtered]);

    // Tab counts
    const counts = useMemo(() => ({
        all: events.length,
        self: events.filter((e) => e.type === "self").length,
        doctor: events.filter((e) => e.type === "doctor").length,
        emergency: events.filter((e) => e.type === "emergency").length,
    }), [events]);

    const TABS: { key: FilterTab; label: string }[] = [
        { key: "all", label: "All" },
        { key: "self", label: "Self" },
        { key: "doctor", label: "Doctors" },
        { key: "emergency", label: "Emergency" },
    ];

    return (
        <div className={styles.screen}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h2 className={styles.title}>Access Log</h2>
                    <p className={styles.subtitle}>Every time your health records were accessed — by you, your doctors, or emergency personnel.</p>
                </div>
                {!loading && (
                    <button className={styles.refreshBtn} onClick={() => fetchLogs()} title="Refresh">
                        <RefreshCw size={14} />
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            <div className={styles.filterRow}>
                {TABS.map((tab) => {
                    const isActive = filter === tab.key;
                    return (
                        <button
                            key={tab.key}
                            className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ""}`}
                            onClick={() => setFilter(tab.key)}
                        >
                            {tab.key === "self" && <User size={13} />}
                            {tab.key === "doctor" && <Stethoscope size={13} />}
                            {tab.key === "emergency" && <ShieldAlert size={13} />}
                            {tab.key === "all" && <Layers size={13} />}
                            {tab.label}
                            {!loading && (
                                <span className={isActive ? styles.filterCount : styles.filterCountInactive}>
                                    {counts[tab.key]}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Error state */}
            {error && (
                <div className={styles.errorBanner}>
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                    <button className={styles.retryBtn} onClick={() => fetchLogs()}>Retry</button>
                </div>
            )}

            {/* Timeline */}
            {loading ? (
                <div className={styles.skeleton}>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={styles.skelRow}>
                            <div className={styles.skelDot} />
                            <div className={styles.skelCard} />
                        </div>
                    ))}
                </div>
            ) : !error && filtered.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}><Activity size={26} /></div>
                    <p className={styles.emptyTitle}>{events.length === 0 ? "No access events yet" : "No matching events"}</p>
                    <p className={styles.emptyDesc}>
                        {events.length === 0
                            ? "Access events will appear here as you and others interact with your records."
                            : "No events match the selected filter."}
                    </p>
                </div>
            ) : (
                <>
                    <div className={styles.timeline}>
                        {grouped.map(({ label, items }) => (
                            <React.Fragment key={label}>
                                <div className={styles.dateGroup}>{label}</div>
                                {items.map((ev) => (
                                    <div key={ev.id} className={styles.entry}>
                                        {/* Dot */}
                                        <div className={`${styles.dot} ${DOT_CLASS[ev.type]}`}>
                                            <ActorIcon type={ev.type} />
                                        </div>

                                        {/* Card */}
                                        <div className={styles.card}>
                                            <div className={styles.cardTopRow}>
                                                <div className={styles.cardLeft}>
                                                    <span className={styles.actorName}>
                                                        {ev.type === "self" ? "You" : ev.actorName}
                                                    </span>
                                                    <span className={`${styles.typeBadge} ${BADGE_CLASS[ev.type]}`}>
                                                        {BADGE_LABEL[ev.type]}
                                                    </span>
                                                    {ev.actorRole && (
                                                        <span className={styles.typeBadge} style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)" }}>
                                                            {ev.actorRole}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={styles.timestamp}>
                                                    <Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                                                    {relativeTime(ev.timestamp)}
                                                </span>
                                            </div>

                                            <p className={styles.actionText}>{ev.action}</p>

                                            {(ev.record || ev.location || ev.device) && (
                                                <div className={styles.detailRow}>
                                                    {ev.record && (
                                                        <span className={styles.detailChip}>
                                                            <FileText size={11} />
                                                            {ev.record}
                                                        </span>
                                                    )}
                                                    {ev.location && (
                                                        <span className={`${styles.detailChip} ${styles.detailChipEmergency}`}>
                                                            <MapPin size={11} />
                                                            {ev.location}
                                                        </span>
                                                    )}
                                                    {ev.device && (
                                                        <span className={styles.detailChip}>
                                                            <User size={11} />
                                                            {ev.device}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Load more */}
                    {nextCursor && (
                        <div className={styles.loadMoreRow}>
                            <button
                                className={styles.loadMoreBtn}
                                onClick={() => fetchLogs(nextCursor)}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Loading…" : "Load older events"}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
