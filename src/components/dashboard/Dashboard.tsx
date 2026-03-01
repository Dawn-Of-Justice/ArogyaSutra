// ============================================================
// Dashboard — Patient Home
// ============================================================

"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useTimeline } from "../../hooks/useTimeline";
import styles from "./Dashboard.module.css";
import {
    ScanLine, ClipboardList, FileText, FlaskConical,
    Building2, Stethoscope, ImageIcon, CalendarClock,
} from "lucide-react";
import { GeminiIcon } from "../common/GeminiIcon";
import ScanModal from "../scan/ScanModal";
import EntryDetailModal from "../timeline/EntryDetailModal";
import type { HealthEntry } from "../../lib/types/timeline";
import type { Appointment } from "../../lib/types/appointment";

interface DashboardProps {
    onNavigate: (screen: string) => void;
}

const DOC_TYPE_ICONS: Record<string, { icon: React.ReactNode; cls: string }> = {
    RX: { icon: <FileText size={18} />, cls: styles.entryIconRX },
    Lab: { icon: <FlaskConical size={18} />, cls: styles.entryIconLab },
    H: { icon: <Building2 size={18} />, cls: styles.entryIconH },
    Consult: { icon: <Stethoscope size={18} />, cls: styles.entryIconConsult },
    Imaging: { icon: <ImageIcon size={18} />, cls: styles.entryIconImaging },
    Other: { icon: <ClipboardList size={18} />, cls: styles.entryIconOther },
};

const TAG_STYLES: Record<string, string> = {
    RX: styles.tagRX,
    Lab: styles.tagLab,
    H: styles.tagH,
    Consult: styles.tagConsult,
    Imaging: styles.tagImaging,
    Other: styles.tagOther,
};

function daysFromNow(date: Date): string {
    const diff = Math.round((date.getTime() - Date.now()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `In ${diff} days`;
}

function dayKey(date: Date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const DOC_TYPE_ICON_MAP: Record<string, string> = {
    Consult: "🩺",
    H: "🏥",
    RX: "💊",
    Lab: "🧪",
    Imaging: "🧠",
    Vacc: "💉",
};

export default function Dashboard({ onNavigate }: DashboardProps) {
    const { patient } = useAuth();
    const { entries, loadTimeline, isLoading } = useTimeline();
    const [scanOpen, setScanOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HealthEntry | null>(null);
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [apptLoading, setApptLoading] = useState(false);
    const [reschedulingId, setReschedulingId] = useState<string | null>(null);
    const [reschedDate, setReschedDate] = useState("");
    const [reschedTime, setReschedTime] = useState("");
    const [reschedSaving, setReschedSaving] = useState(false);

    const handleReschedule = async () => {
        if (!reschedulingId || !reschedDate || !patient?.patientId) return;
        setReschedSaving(true);
        try {
            await fetch(`/api/appointments/${reschedulingId}?patientId=${encodeURIComponent(patient.patientId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ appointmentDate: reschedDate, time: reschedTime || undefined }),
            });
            // Refresh
            const res = await fetch(`/api/appointments?patientId=${encodeURIComponent(patient.patientId)}`);
            const data = await res.json();
            setAppointments((data.appointments ?? []).filter(
                (a: Appointment) => a.status === "scheduled" && new Date(a.appointmentDate).getTime() >= Date.now() - 86400000
            ));
            setReschedulingId(null);
            setReschedDate("");
            setReschedTime("");
        } catch { /* silent */ } finally {
            setReschedSaving(false);
        }
    };

    // ---- Fetch scheduled appointments from dedicated table ----
    useEffect(() => {
        if (!patient?.patientId) return;
        setApptLoading(true);
        fetch(`/api/appointments?patientId=${encodeURIComponent(patient.patientId)}`)
            .then(r => r.json())
            .then(data => setAppointments((data.appointments ?? []).filter(
                (a: Appointment) => a.status === "scheduled" && new Date(a.appointmentDate).getTime() >= Date.now() - 86400000
            )))
            .catch(() => setAppointments([]))
            .finally(() => setApptLoading(false));
    }, [patient?.patientId]);

    // ---- Derive doctor visits from timeline entries ----
    const doctorVisits = entries
        .filter(e => (e.documentType === "Consult" || e.documentType === "H") && e.doctorName)
        .map(e => ({
            name: e.doctorName!,
            specialty: e.sourceInstitution || (e.documentType === "H" ? "Hospitalisation" : "Consultation"),
            date: new Date(e.date),
            dateLabel: new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            icon: DOC_TYPE_ICON_MAP[e.documentType] || "🩺",
        }));

    // Shape appointments for display
    const upcoming = appointments
        .map(a => ({
            name: a.doctorName,
            specialty: a.specialty || "Appointment",
            date: new Date(a.appointmentDate),
            time: a.time || "—",
            location: a.location || "—",
            appointmentId: a.appointmentId,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Build day → events lookup
    const apptsByDay = new Map<string, typeof upcoming>();
    for (const a of upcoming) {
        const k = dayKey(a.date);
        apptsByDay.set(k, [...(apptsByDay.get(k) ?? []), a]);
    }
    const visitsByDay = new Map<string, typeof doctorVisits>();
    for (const v of doctorVisits) {
        const k = dayKey(v.date);
        visitsByDay.set(k, [...(visitsByDay.get(k) ?? []), v]);
    }

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
        if (cached) { setPhotoUrl(cached); return; }
        // No local cache — fetch presigned URL from S3 (same as ProfileScreen)
        fetch(`/api/profile/photo?userId=${patient.patientId}&role=patient`)
            .then((r) => r.json())
            .then((data) => { if (data.url) setPhotoUrl(data.url); })
            .catch(() => { });
    }, [patient?.patientId]);

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
        <>
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
                        <button className={styles.actionCard} onClick={() => setScanOpen(true)}>
                            <div className={`${styles.actionIcon} ${styles.actionIconScan}`}><ScanLine size={24} /></div>
                            <span className={styles.actionLabel}>Scan Document</span>
                            <span className={styles.actionHint}>Camera or Gallery</span>
                        </button>
                        <button className={styles.actionCard} onClick={() => onNavigate("assistant")}>
                            <div className={`${styles.actionIcon} ${styles.actionIconAI}`}><GeminiIcon size={24} /></div>
                            <span className={styles.actionLabel}>AI Assistant</span>
                            <span className={styles.actionHint}>Ask about health</span>
                        </button>
                        <button className={styles.actionCard} onClick={() => onNavigate("timeline")}>
                            <div className={`${styles.actionIcon} ${styles.actionIconTimeline}`}><ClipboardList size={24} /></div>
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
                                            onClick={() => setSelectedEntry(entry)}
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
                                    </div>

                    {/* Mini Calendar + Upcoming Appointments */}
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
                            {Array.from({ length: firstDay }).map((_, i) => (
                                <span key={`e${i}`} />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                                const k = `${calYear}-${calMonth}-${day}`;
                                const appts = apptsByDay.get(k) ?? [];
                                const visits = visitsByDay.get(k) ?? [];
                                const hasAppt = appts.length > 0;
                                const hasVisit = visits.length > 0;
                                return (
                                    <div
                                        key={day}
                                        className={styles.calDayWrapper}
                                        onMouseEnter={() => (hasAppt || hasVisit) ? setHoveredDay(k) : undefined}
                                        onMouseLeave={() => setHoveredDay(null)}
                                    >
                                        <span className={`${styles.calDay} ${isToday ? styles.calDayToday : ""} ${hasAppt && !isToday ? styles.calDayAppt : ""} ${hasVisit && !isToday && !hasAppt ? styles.calDayVisit : ""}`}>
                                            {day}
                                        </span>
                                        {hoveredDay === k && (hasAppt || hasVisit) && (
                                            <div className={styles.calTooltip}>
                                                {appts.map((a, ai) => (
                                                    <div key={`a${ai}`} className={styles.calTooltipRow}>
                                                        <span className={styles.calTooltipDotAppt} />
                                                        <div>
                                                            <span className={styles.calTooltipName}>{a.name}</span>
                                                            <span className={styles.calTooltipSub}>{a.time} · {a.location}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {visits.map((v, vi) => (
                                                    <div key={`v${vi}`} className={styles.calTooltipRow}>
                                                        <span className={styles.calTooltipDotVisit} />
                                                        <div>
                                                            <span className={styles.calTooltipName}>{v.name}</span>
                                                            <span className={styles.calTooltipSub}>{v.specialty}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Compact upcoming appointments */}
                        {upcoming.length > 0 ? (
                            <div className={styles.calApptList}>
                                <span className={styles.calApptHeading}>
                                    <CalendarClock size={11} /> Upcoming
                                </span>
                                {upcoming.map((appt, i) => (
                                    <div key={i}>
                                        <div className={styles.calApptRow}>
                                            <span className={styles.calApptDot} />
                                            <div className={styles.calApptInfo}>
                                                <span className={styles.calApptName}>{appt.name}</span>
                                                <span className={styles.calApptSub}>{appt.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {appt.time}</span>
                                            </div>
                                            <span className={styles.calApptBadge}>{daysFromNow(appt.date)}</span>
                                            <button
                                                className={styles.rescheduleLink}
                                                onClick={() => {
                                                    if (reschedulingId === appt.appointmentId) {
                                                        setReschedulingId(null);
                                                    } else {
                                                        setReschedulingId(appt.appointmentId);
                                                        setReschedDate(appt.date.toISOString().slice(0, 10));
                                                        setReschedTime(appt.time === "—" ? "" : appt.time);
                                                    }
                                                }}
                                            >
                                                {reschedulingId === appt.appointmentId ? "Cancel" : "Reschedule"}
                                            </button>
                                        </div>
                                        {reschedulingId === appt.appointmentId && (
                                            <div className={styles.rescheduleForm}>
                                                <div className={styles.rescheduleRow}>
                                                    <input
                                                        type="date"
                                                        className={styles.rescheduleInput}
                                                        value={reschedDate}
                                                        min={new Date().toISOString().slice(0, 10)}
                                                        onChange={e => setReschedDate(e.target.value)}
                                                    />
                                                    <input
                                                        type="time"
                                                        className={styles.rescheduleInput}
                                                        value={reschedTime}
                                                        onChange={e => setReschedTime(e.target.value)}
                                                        style={{ maxWidth: 90 }}
                                                    />
                                                </div>
                                                <div className={styles.rescheduleActions}>
                                                    <button className={styles.rescheduleBtn} onClick={() => setReschedulingId(null)}>Cancel</button>
                                                    <button
                                                        className={`${styles.rescheduleBtn} ${styles.rescheduleBtnSave}`}
                                                        onClick={handleReschedule}
                                                        disabled={reschedSaving || !reschedDate}
                                                    >
                                                        {reschedSaving ? "Saving..." : "Save"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : !apptLoading && (
                            <p className={styles.calNoAppt}>No upcoming appointments</p>
                        )}
                    </div>

                    {/* Recent Doctor Visits */}
                    <div className={styles.visitsCard}>
                        <h3 className={styles.visitsTitle}>Recent Doctor Visits</h3>
                        {isLoading ? (
                            <div className={styles.skeleton}>{[1,2].map(i => <div key={i} className={styles.skeletonLine} />)}</div>
                        ) : doctorVisits.length === 0 ? (
                            <p className={styles.calNoAppt}>No visits recorded yet.</p>
                        ) : (
                            <div className={styles.visitsList}>
                                {doctorVisits.map((v, i) => (
                                    <div key={i} className={styles.visitRow}>
                                        <div className={styles.visitIcon}>{v.icon}</div>
                                        <div className={styles.visitInfo}>
                                            <span className={styles.visitName}>{v.name}</span>
                                            <span className={styles.visitSpec}>{v.specialty}</span>
                                        </div>
                                        <span className={styles.visitDate}>{v.dateLabel}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div >
            {scanOpen && (
                <ScanModal
                    onClose={() => setScanOpen(false)}
                    onSaved={() => { setScanOpen(false); loadTimeline(); }}
                />
            )}
            {selectedEntry && (
                <EntryDetailModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                    onDeleted={() => { setSelectedEntry(null); loadTimeline(); }}
                    onUpdated={(updated) => setSelectedEntry(prev => prev ? { ...prev, ...updated } : prev)}
                />
            )}
        </>
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
