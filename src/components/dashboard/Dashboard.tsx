// ============================================================
// Dashboard — Patient Home
// ============================================================

"use client";

import React, { useEffect, useState } from "react";
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

// Mock recent doctor visits (replace with real data when available)
const MOCK_DOCTOR_VISITS = [
    { name: "Dr. Priya Sharma", specialty: "General Physician", date: "24 Feb 2026", icon: "🩺" },
    { name: "Dr. Arun Mehta", specialty: "Cardiologist", date: "10 Feb 2026", icon: "🫀" },
    { name: "Dr. Nisha Patel", specialty: "Dermatologist", date: "02 Jan 2026", icon: "💆" },
];

export default function Dashboard({ onNavigate }: DashboardProps) {
    const { patient } = useAuth();
    const { entries, loadTimeline, isLoading } = useTimeline();

    useEffect(() => {
        loadTimeline();
    }, [loadTimeline]);

    const recentEntries = entries.slice(0, 5);
    const greeting = getGreeting();

    const initials = (patient?.fullName || "P")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!patient?.patientId) return;
        const cached = localStorage.getItem(`profilePhoto_${patient.patientId}`);
        if (cached) setPhotoUrl(cached);
    }, [patient?.patientId]);

    const latestVitals = extractLatestVitals(entries);

    // ---- Mini Calendar state ----
    const today = new Date();
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [calYear, setCalYear] = useState(today.getFullYear());

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const monthName = new Date(calYear, calMonth).toLocaleString("en-IN", { month: "long" });

    const prevMonth = () => {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
    };

    return (
        <div className={styles.dashboard}>
            {/* ---- Left: Health Overview ---- */}
            <div className={styles.main}>
                {/* Greeting */}
                <div className={styles.greeting}>
                    <span className={styles.greetingLabel}>{greeting} 👋</span>
                    <span className={styles.greetingName}>{patient?.fullName || "Patient"}</span>
                </div>

                {/* Quick Actions */}
                <div className={styles.quickActions}>
                    <button className={styles.actionCard} onClick={() => onNavigate("upload")}>
                        <div className={`${styles.actionIcon} ${styles.actionIconScan}`}>📷</div>
                        <span className={styles.actionLabel}>Scan Document</span>
                        <span className={styles.actionHint}>Camera or Gallery</span>
                    </button>
                    <button className={styles.actionCard} onClick={() => onNavigate("assistant")}>
                        <div className={`${styles.actionIcon} ${styles.actionIconAI}`}>🤖</div>
                        <span className={styles.actionLabel}>AI Assistant</span>
                        <span className={styles.actionHint}>Ask about health</span>
                    </button>
                    <button className={styles.actionCard} onClick={() => onNavigate("timeline")}>
                        <div className={`${styles.actionIcon} ${styles.actionIconTimeline}`}>📋</div>
                        <span className={styles.actionLabel}>Timeline</span>
                        <span className={styles.actionHint}>View all records</span>
                    </button>
                </div>


                {/* Recent Records */}
                <section className={styles.recordsSection}>
                    <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>Recent Events</h3>
                        <button className={styles.seeAll} onClick={() => onNavigate("timeline")}>
                            See all →
                        </button>
                    </div>
                    {isLoading ? (
                        <div className={styles.skeleton}>
                            {[1, 2, 3].map((i) => <div key={i} className={styles.skeletonLine} />)}
                        </div>
                    ) : recentEntries.length === 0 ? (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyIcon}>📄</span>
                            <p className={styles.emptyText}>No records yet. Scan your first document!</p>
                        </div>
                    ) : (
                        <div className={styles.entryList}>
                            {recentEntries.map((entry) => {
                                const typeInfo = DOC_TYPE_ICONS[entry.documentType] || DOC_TYPE_ICONS.Other;
                                const tagStyle = TAG_STYLES[entry.documentType] || TAG_STYLES.Other;
                                return (
                                    <div
                                        key={entry.entryId}
                                        className={styles.entryCard}
                                        onClick={() => onNavigate(`entry/${entry.entryId}`)}
                                    >
                                        <div className={`${styles.entryTypeIcon} ${typeInfo.cls}`}>{typeInfo.icon}</div>
                                        <div className={styles.entryInfo}>
                                            <h4 className={styles.entryTitle}>{entry.title}</h4>
                                            {entry.sourceInstitution && (
                                                <p className={styles.entryInstitution}>{entry.sourceInstitution}</p>
                                            )}
                                        </div>
                                        <div className={styles.entryMeta}>
                                            <span className={styles.entryDate}>
                                                {new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                            </span>
                                            <span className={`${styles.docTag} ${tagStyle}`}>{entry.documentType}</span>
                                        </div>
                                        <span className={styles.entryChevron}>›</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* ---- Right: Aside Panel ---- */}
            <aside className={styles.aside}>
                {/* Patient Info Card */}
                <div className={styles.profileCard}>
                    <div className={styles.avatarLarge}>
                        {photoUrl ? (
                            <img src={photoUrl} alt="Profile"
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                        ) : initials}
                    </div>
                    <div className={styles.profileDetails}>
                        <h2 className={styles.profileName}>{patient?.fullName || "Patient"}</h2>
                        <p className={styles.profileCardId}>{patient?.patientId || "—"}</p>
                        <div className={styles.profileBadges}>
                            <span className={styles.badge}>
                                {patient?.gender === "male" ? "♂ Male" : patient?.gender === "female" ? "♀ Female" : "⚧ Other"}
                            </span>
                            {patient?.dateOfBirth && (
                                <span className={styles.badge}>{calculateAge(patient.dateOfBirth)} yrs</span>
                            )}
                        </div>
                    </div>
                    <div className={styles.profileVitals}>
                        <div className={styles.profileVitalItem}>
                            <span className={styles.profileVitalIcon}>🫀</span>
                            <div className={styles.profileVitalData}>
                                <span className={styles.profileVitalLabel}>BP</span>
                                <span className={styles.profileVitalValue}>{latestVitals.bp || "—"} <small>mmHg</small></span>
                            </div>
                        </div>
                        <div className={styles.profileVitalItem}>
                            <span className={styles.profileVitalIcon}>⚖️</span>
                            <div className={styles.profileVitalData}>
                                <span className={styles.profileVitalLabel}>Weight</span>
                                <span className={styles.profileVitalValue}>{latestVitals.weight || patient?.weight || "—"} <small>kg</small></span>
                            </div>
                        </div>
                        <div className={styles.profileVitalItem}>
                            <span className={styles.profileVitalIcon}>📏</span>
                            <div className={styles.profileVitalData}>
                                <span className={styles.profileVitalLabel}>Height</span>
                                <span className={styles.profileVitalValue}>{latestVitals.height || patient?.height || "—"} <small>cm</small></span>
                            </div>
                        </div>
                        <div className={styles.profileVitalItem}>
                            <span className={styles.profileVitalIcon}>🌡️</span>
                            <div className={styles.profileVitalData}>
                                <span className={styles.profileVitalLabel}>Temp</span>
                                <span className={styles.profileVitalValue}>{latestVitals.temp || "—"} <small>°C</small></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mini Calendar */}
                <div className={styles.calendarCard}>
                    <div className={styles.calHeader}>
                        <button className={styles.calNav} onClick={prevMonth}>‹</button>
                        <span className={styles.calTitle}>{monthName} {calYear}</span>
                        <button className={styles.calNav} onClick={nextMonth}>›</button>
                    </div>
                    <div className={styles.calGrid}>
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                            <span key={d} className={styles.calDayName}>{d}</span>
                        ))}
                        {/* Empty cells before first day */}
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <span key={`e${i}`} />
                        ))}
                        {/* Day cells */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                            return (
                                <span key={day} className={`${styles.calDay} ${isToday ? styles.calDayToday : ""}`}>
                                    {day}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Doctor Visits */}
                <div className={styles.visitsCard}>
                    <h3 className={styles.visitsTitle}>Recent Doctor Visits</h3>
                    <div className={styles.visitsList}>
                        {MOCK_DOCTOR_VISITS.map((v, i) => (
                            <div key={i} className={styles.visitRow}>
                                <div className={styles.visitIcon}>{v.icon}</div>
                                <div className={styles.visitInfo}>
                                    <span className={styles.visitName}>{v.name}</span>
                                    <span className={styles.visitSpec}>{v.specialty}</span>
                                </div>
                                <span className={styles.visitDate}>{v.date}</span>
                            </div>
                        ))}
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
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
}

interface LatestVitals { bp: string; weight: string; height: string; temp: string; }

function extractLatestVitals(
    entries: { metadata: { vitals?: { type: string; value: string }[] } }[]
): LatestVitals {
    const vitals: LatestVitals = { bp: "", weight: "", height: "", temp: "" };
    for (const entry of entries) {
        if (!entry.metadata?.vitals) continue;
        for (const v of entry.metadata.vitals) {
            if (v.type === "blood_pressure" && !vitals.bp) vitals.bp = v.value;
            if (v.type === "weight" && !vitals.weight) vitals.weight = v.value;
            if (v.type === "height" && !vitals.height) vitals.height = v.value;
            if (v.type === "temperature" && !vitals.temp) vitals.temp = v.value;
        }
        if (vitals.bp && vitals.weight && vitals.height && vitals.temp) break;
    }
    return vitals;
}
