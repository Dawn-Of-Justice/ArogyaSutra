// ============================================================
// Dashboard — Patient Home (Redesigned)
// Two-column: health overview + profile panel
// ============================================================

"use client";

import React, { useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useTimeline } from "../../hooks/useTimeline";
import styles from "./Dashboard.module.css";

interface DashboardProps {
    onNavigate: (screen: string) => void;
}

const DOC_TYPE_ICONS: Record<string, { icon: string; cls: string }> = {
    RX: { icon: "💊", cls: styles.entryIconRX },
    Lab: { icon: "🧪", cls: styles.entryIconLab },
    H: { icon: "🏥", cls: styles.entryIconH },
    Consult: { icon: "🩺", cls: styles.entryIconConsult },
    Imaging: { icon: "📸", cls: styles.entryIconImaging },
    Other: { icon: "📄", cls: styles.entryIconOther },
};

const TAG_STYLES: Record<string, string> = {
    RX: styles.tagRX,
    Lab: styles.tagLab,
    H: styles.tagH,
    Consult: styles.tagConsult,
    Imaging: styles.tagImaging,
    Other: styles.tagOther,
};

export default function Dashboard({ onNavigate }: DashboardProps) {
    const { patient } = useAuth();
    const { entries, loadTimeline, isLoading } = useTimeline();

    useEffect(() => {
        loadTimeline();
    }, [loadTimeline]);

    const recentEntries = entries.slice(0, 5);
    const greeting = getGreeting();

    const initials =
        (patient?.fullName || "P")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

    // Extract latest vitals from timeline entries
    const latestVitals = extractLatestVitals(entries);

    return (
        <div className={styles.dashboard}>
            {/* ---- Left: Health Overview ---- */}
            <div className={styles.main}>
                {/* Greeting */}
                <div className={styles.greeting}>
                    <span className={styles.greetingLabel}>{greeting} 👋</span>
                    <span className={styles.greetingName}>
                        {patient?.fullName || "Patient"}
                    </span>
                </div>

                {/* Quick Actions */}
                <div className={styles.quickActions}>
                    <button
                        className={styles.actionCard}
                        onClick={() => onNavigate("upload")}
                    >
                        <div className={`${styles.actionIcon} ${styles.actionIconScan}`}>
                            📷
                        </div>
                        <span className={styles.actionLabel}>Scan Document</span>
                        <span className={styles.actionHint}>Camera or Gallery</span>
                    </button>
                    <button
                        className={styles.actionCard}
                        onClick={() => onNavigate("assistant")}
                    >
                        <div className={`${styles.actionIcon} ${styles.actionIconAI}`}>
                            🤖
                        </div>
                        <span className={styles.actionLabel}>AI Assistant</span>
                        <span className={styles.actionHint}>Ask about health</span>
                    </button>
                    <button
                        className={styles.actionCard}
                        onClick={() => onNavigate("access")}
                    >
                        <div className={`${styles.actionIcon} ${styles.actionIconShare}`}>
                            🔗
                        </div>
                        <span className={styles.actionLabel}>Share Access</span>
                        <span className={styles.actionHint}>Manage sharing</span>
                    </button>
                    <button
                        className={styles.actionCard}
                        onClick={() => onNavigate("emergency")}
                    >
                        <div
                            className={`${styles.actionIcon} ${styles.actionIconEmergency}`}
                        >
                            🚨
                        </div>
                        <span className={styles.actionLabel}>Emergency</span>
                        <span className={styles.actionHint}>Break-Glass</span>
                    </button>
                </div>

                {/* Vitals Grid */}
                <section className={styles.vitalsSection}>
                    <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>Vitals</h3>
                    </div>
                    <div className={styles.vitalsGrid}>
                        <div className={styles.vitalCard}>
                            <div className={`${styles.vitalIcon} ${styles.vitalIconBP}`}>
                                🫀
                            </div>
                            <span className={styles.vitalLabel}>Blood Pressure</span>
                            <div className={styles.vitalValueRow}>
                                <span className={styles.vitalValue}>
                                    {latestVitals.bp || "—"}
                                </span>
                                <span className={styles.vitalUnit}>mmHg</span>
                            </div>
                        </div>
                        <div className={styles.vitalCard}>
                            <div className={`${styles.vitalIcon} ${styles.vitalIconHR}`}>
                                💓
                            </div>
                            <span className={styles.vitalLabel}>Heart Rate</span>
                            <div className={styles.vitalValueRow}>
                                <span className={styles.vitalValue}>
                                    {latestVitals.hr || "—"}
                                </span>
                                <span className={styles.vitalUnit}>bpm</span>
                            </div>
                        </div>
                        <div className={styles.vitalCard}>
                            <div className={`${styles.vitalIcon} ${styles.vitalIconSPO2}`}>
                                🩸
                            </div>
                            <span className={styles.vitalLabel}>SpO₂</span>
                            <div className={styles.vitalValueRow}>
                                <span className={styles.vitalValue}>
                                    {latestVitals.spo2 || "—"}
                                </span>
                                <span className={styles.vitalUnit}>%</span>
                            </div>
                        </div>
                        <div className={styles.vitalCard}>
                            <div
                                className={`${styles.vitalIcon} ${styles.vitalIconWeight}`}
                            >
                                ⚖️
                            </div>
                            <span className={styles.vitalLabel}>Weight</span>
                            <div className={styles.vitalValueRow}>
                                <span className={styles.vitalValue}>
                                    {latestVitals.weight || "—"}
                                </span>
                                <span className={styles.vitalUnit}>kg</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recent Records */}
                <section className={styles.recordsSection}>
                    <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>Recent Records</h3>
                        <button
                            className={styles.seeAll}
                            onClick={() => onNavigate("timeline")}
                        >
                            See all →
                        </button>
                    </div>
                    {isLoading ? (
                        <div className={styles.skeleton}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className={styles.skeletonLine} />
                            ))}
                        </div>
                    ) : recentEntries.length === 0 ? (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyIcon}>📄</span>
                            <p className={styles.emptyText}>
                                No records yet. Scan your first document!
                            </p>
                        </div>
                    ) : (
                        <div className={styles.entryList}>
                            {recentEntries.map((entry) => {
                                const typeInfo =
                                    DOC_TYPE_ICONS[entry.documentType] ||
                                    DOC_TYPE_ICONS.Other;
                                const tagStyle =
                                    TAG_STYLES[entry.documentType] || TAG_STYLES.Other;
                                return (
                                    <div
                                        key={entry.entryId}
                                        className={styles.entryCard}
                                        onClick={() =>
                                            onNavigate(`entry/${entry.entryId}`)
                                        }
                                    >
                                        <div
                                            className={`${styles.entryTypeIcon} ${typeInfo.cls}`}
                                        >
                                            {typeInfo.icon}
                                        </div>
                                        <div className={styles.entryInfo}>
                                            <h4 className={styles.entryTitle}>
                                                {entry.title}
                                            </h4>
                                            {entry.sourceInstitution && (
                                                <p className={styles.entryInstitution}>
                                                    {entry.sourceInstitution}
                                                </p>
                                            )}
                                        </div>
                                        <div className={styles.entryMeta}>
                                            <span className={styles.entryDate}>
                                                {new Date(entry.date).toLocaleDateString(
                                                    "en-IN",
                                                    {
                                                        day: "numeric",
                                                        month: "short",
                                                    }
                                                )}
                                            </span>
                                            <span
                                                className={`${styles.docTag} ${tagStyle}`}
                                            >
                                                {entry.documentType}
                                            </span>
                                        </div>
                                        <span className={styles.entryChevron}>›</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* ---- Right: Profile Panel ---- */}
            <aside className={styles.aside}>
                {/* Patient Info Card */}
                <div className={styles.profileCard}>
                    <div className={styles.avatarLarge}>{initials}</div>
                    <div className={styles.profileDetails}>
                        <h2 className={styles.profileName}>
                            {patient?.fullName || "Patient"}
                        </h2>
                        <p className={styles.profileCardId}>
                            {patient?.patientId || "—"}
                        </p>
                        <div className={styles.profileBadges}>
                            <span className={styles.badge}>
                                {patient?.gender === "male"
                                    ? "♂ Male"
                                    : patient?.gender === "female"
                                        ? "♀ Female"
                                        : "⚧ Other"}
                            </span>
                            {patient?.dateOfBirth && (
                                <span className={styles.badge}>
                                    {calculateAge(patient.dateOfBirth)} yrs
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={styles.profileFields}>
                        <div className={styles.fieldRow}>
                            <span className={styles.fieldLabel}>Phone</span>
                            <span className={styles.fieldValue}>
                                {patient?.phone || "—"}
                            </span>
                        </div>
                        <div className={styles.fieldRow}>
                            <span className={styles.fieldLabel}>DOB</span>
                            <span className={styles.fieldValue}>
                                {patient?.dateOfBirth
                                    ? new Date(
                                        patient.dateOfBirth
                                    ).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })
                                    : "—"}
                            </span>
                        </div>
                        <div className={styles.fieldRow}>
                            <span className={styles.fieldLabel}>Language</span>
                            <span className={styles.fieldValue}>
                                {patient?.language?.toUpperCase() || "EN"}
                            </span>
                        </div>
                        <div className={styles.fieldRow}>
                            <span className={styles.fieldLabel}>Records</span>
                            <span className={styles.fieldValue}>{entries.length}</span>
                        </div>
                    </div>
                </div>

                {/* Upcoming */}
                <div className={styles.upcomingCard}>
                    <h3 className={styles.upcomingTitle}>📅 Upcoming</h3>
                    <div className={styles.upcomingEmpty}>
                        No upcoming appointments
                    </div>
                </div>

                {/* Encryption Badge */}
                <div className={styles.encryptionCard}>
                    <span className={styles.encryptionIcon}>🔐</span>
                    <div className={styles.encryptionInfo}>
                        <span className={styles.encryptionLabel}>
                            Zero-Knowledge Encrypted
                        </span>
                        <span className={styles.encryptionText}>
                            Your records are encrypted with a key only you control.
                        </span>
                    </div>
                </div>
            </aside>
        </div>
    );
}

// ---- Helpers ----

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
}

function calculateAge(dob: string): number {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

interface LatestVitals {
    bp: string;
    hr: string;
    spo2: string;
    weight: string;
}

function extractLatestVitals(
    entries: { metadata: { vitals?: { type: string; value: string }[] } }[]
): LatestVitals {
    const vitals: LatestVitals = { bp: "", hr: "", spo2: "", weight: "" };
    for (const entry of entries) {
        if (!entry.metadata?.vitals) continue;
        for (const v of entry.metadata.vitals) {
            if (v.type === "blood_pressure" && !vitals.bp) vitals.bp = v.value;
            if (v.type === "heart_rate" && !vitals.hr) vitals.hr = v.value;
            if (v.type === "spo2" && !vitals.spo2) vitals.spo2 = v.value;
            if (v.type === "weight" && !vitals.weight) vitals.weight = v.value;
        }
        if (vitals.bp && vitals.hr && vitals.spo2 && vitals.weight) break;
    }
    return vitals;
}
