// ============================================================
// Break-Glass Emergency Access Screen
// For Emergency Personnel (first responders) ONLY
// Accessible from Login screen — no patient auth required
// Logs access to DynamoDB, notifies patient, timed session
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import { useCountdown } from "../../hooks/useCountdown";
import type { BreakGlassResponse, GeoLocation } from "../../lib/types/emergency";
import { fmtDate } from "../../lib/utils/date";
import LogoAnimated from "../common/LogoAnimated";
import styles from "./BreakGlassScreen.module.css";

interface Props {
    onClose: () => void;
}

const BG_STORAGE_KEY = "bg_personnel";

export default function BreakGlassScreen({ onClose }: Props) {
    const [step, setStep] = useState<"credentials" | "data">("credentials");
    const [form, setForm] = useState({
        mciNumber: "",
        name: "",
        institution: "",
        patientId: "",
        reason: "Unconscious / Unresponsive patient",
    });

    // Pre-fill saved personnel details on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(BG_STORAGE_KEY);
            if (saved) {
                const { mciNumber, name, institution } = JSON.parse(saved);
                setForm((f) => ({ ...f, mciNumber: mciNumber || "", name: name || "", institution: institution || "" }));
            }
        } catch { /* ignore corrupt data */ }
    }, []);
    const [emergencyData, setEmergencyData] = useState<BreakGlassResponse["emergencyData"] & {
        patientName?: string;
        patientAge?: number | null;
        emergencyContacts?: { name: string; relationship: string; phone: string }[];
    } | null>(null);
    const [sessionId, setSessionId] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const countdown = useCountdown({
        duration: 300, // 5 minutes per Req 6
        onExpire: () => {
            // Auto-terminate session
            endSession();
        },
    });

    const endSession = () => {
        if (sessionId) {
            fetch("/api/emergency/end", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
            }).catch(() => { /* non-blocking */ });
        }
        onClose();
    };

    const getGeolocation = (): Promise<GeoLocation> =>
        new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation not supported by this device"));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) =>
                    resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        timestamp: new Date().toISOString(),
                    }),
                () => reject(new Error("Location access is required for emergency access. Please allow location and try again.")),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const geo = await getGeolocation();

            const res = await fetch("/api/emergency/access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: `AS-${form.patientId}`.toUpperCase().trim(),
                    mciNumber: form.mciNumber.trim(),
                    personnelName: form.name.trim(),
                    institution: form.institution.trim(),
                    reason: form.reason.trim(),
                    geolocation: geo,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Emergency access denied");

            // Persist personnel details for future use
            try {
                localStorage.setItem(BG_STORAGE_KEY, JSON.stringify({
                    mciNumber: form.mciNumber.trim(),
                    name: form.name.trim(),
                    institution: form.institution.trim(),
                }));
            } catch { /* storage full — ignore */ }

            setEmergencyData(data.emergencyData);
            setSessionId(data.sessionId);
            setStep("data");
            countdown.start();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // Progress bar width from countdown
    const progressPct = countdown.progress * 100;
    const isUrgent = countdown.remaining < 60;

    return (
        <div className={styles.overlay}>
            {/* ─── Header ─── */}
            <div className={styles.header}>
                <div className={styles.headerLogo}>
                    <LogoAnimated width={52} showText={false} background="none" idSuffix="bg" />
                    <span className={styles.headerBrandName}>ArogyaSutra</span>
                </div>
                <div className={styles.headerDivider} />
                <span className={styles.headerBadge}>
                    <span className={styles.headerBadgeDot} />
                    Emergency Access
                </span>
                <span className={styles.headerSpacer} />
                <button className={styles.closeBtn} onClick={onClose} title="Cancel">✕</button>
            </div>

            <div className={styles.body}>
                {step === "credentials" && (
                    <div className={styles.panel}>
                        {/* Logo — matches login screen branding */}
                        <div className={styles.panelBrand}>
                            <LogoAnimated width={200} background="none" idSuffix="bg2" />
                        </div>

                        {/* Panel hero */}
                        <div className={styles.panelHero}>
                            <h1 className={styles.panelHeroTitle}>🚨 Break-Glass Emergency Access</h1>
                            <p className={styles.panelHeroSub}>
                                For authorised first responders only. All access is cryptographically logged,
                                geolocation-stamped, and the patient is notified immediately.
                            </p>
                        </div>

                        <div className={styles.warningBanner}>
                            <span className={styles.warningIcon}>⚠️</span>
                            <div>
                                <strong>Break-Glass Protocol Active</strong>
                                <p>Misuse of this access constitutes a criminal offence under applicable data-protection law.</p>
                            </div>
                        </div>

                        {error && <div className={styles.errorBox}>{error}</div>}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Patient ArogyaSutra Card ID</label>
                                <div className={styles.cardInputWrap}>
                                    <span className={styles.cardPrefix}>AS-</span>
                                    <input
                                        className={styles.cardSuffixInput}
                                        placeholder="XXXX-XXXX-XXXX"
                                        value={form.patientId}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 12);
                                            const g1 = digits.slice(0, 4), g2 = digits.slice(4, 8), g3 = digits.slice(8, 12);
                                            const suffix = !g2 ? g1 : !g3 ? `${g1}-${g2}` : `${g1}-${g2}-${g3}`;
                                            setForm({ ...form, patientId: suffix });
                                        }}
                                        required
                                        autoFocus
                                        maxLength={14}
                                    />
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.label}>MCI Registration Number</label>
                                    <input
                                        className={styles.input}
                                        placeholder="e.g. KA-28411"
                                        value={form.mciNumber}
                                        onChange={(e) => setForm({ ...form, mciNumber: e.target.value })}
                                        required
                                        maxLength={30}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.label}>Your Full Name</label>
                                    <input
                                        className={styles.input}
                                        placeholder="Dr. / Paramedic Name"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        maxLength={80}
                                    />
                                </div>
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Institution / Hospital</label>
                                <input
                                    className={styles.input}
                                    placeholder="e.g. Apollo Hospitals, Bangalore"
                                    value={form.institution}
                                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                                    required
                                    maxLength={100}
                                />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Emergency Reason</label>
                                <select
                                    className={styles.input}
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    required
                                >
                                    <option value="Unconscious / Unresponsive patient">Unconscious / Unresponsive patient</option>
                                    <option value="Road traffic accident">Road traffic accident</option>
                                    <option value="Cardiac arrest / CPR in progress">Cardiac arrest / CPR in progress</option>
                                    <option value="Severe allergic reaction / Anaphylaxis">Severe allergic reaction / Anaphylaxis</option>
                                    <option value="Drug overdose / Poisoning">Drug overdose / Poisoning</option>
                                    <option value="Respiratory distress">Respiratory distress</option>
                                    <option value="Stroke / Seizure">Stroke / Seizure</option>
                                    <option value="Trauma / Major injury">Trauma / Major injury</option>
                                    <option value="Other emergency">Other emergency</option>
                                </select>
                            </div>
                            <div className={styles.geoNotice}>
                                📍 Your location will be captured and logged when you proceed.
                            </div>
                            <button
                                type="submit"
                                className={styles.accessBtn}
                                disabled={isLoading}
                            >
                                {isLoading ? "Verifying & locating..." : "🔓 Access Emergency Records"}
                            </button>
                        </form>
                    </div>
                )}

                {step === "data" && emergencyData && (
                    <div className={styles.panel}>
                        {/* Countdown strip */}
                        <div className={`${styles.timerStrip} ${isUrgent ? styles.timerUrgent : ""}`}>
                            <span className={styles.timerLabel}>
                                {isUrgent ? "⚠️ Session expiring" : "Session active"}
                            </span>
                            <span className={styles.timerValue}>{countdown.formatted} remaining</span>
                            <button className={styles.endBtn} onClick={endSession}>End Session</button>
                        </div>
                        <div className={styles.timerBar}>
                            <div
                                className={`${styles.timerFill} ${isUrgent ? styles.timerFillUrgent : ""}`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>

                        {/* Patient header */}
                        <div className={styles.patientHeader}>
                            <div className={styles.patientAvatarLg}>
                                {emergencyData.patientName?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className={styles.patientHeaderInfo}>
                                <p className={styles.patientName}>
                                    <span className={styles.patientNameText}>
                                        {emergencyData.patientName || `AS-${form.patientId}`.toUpperCase()}
                                    </span>
                                    {emergencyData.patientAge != null && (
                                        <span className={styles.patientAge}>{emergencyData.patientAge} yrs</span>
                                    )}
                                </p>
                                <div className={styles.patientMeta}>
                                    <span className={styles.patientIdPill}>{`AS-${form.patientId}`.toUpperCase()}</span>
                                    <span className={styles.patientMetaTag}>·</span>
                                    <span className={styles.patientMetaTag}>Critical-only view</span>
                                    <span className={styles.patientMetaTag}>·</span>
                                    <span className={styles.patientMetaTag}>Audit logged</span>
                                </div>
                            </div>
                        </div>

                        <h2 className={styles.dataTitle}>Medical Information</h2>
                        {emergencyData.updatedAt && (() => {
                            const updatedMs = new Date(emergencyData.updatedAt).getTime();
                            const daysSince = Math.floor((Date.now() - updatedMs) / 86400000);
                            const isStale = daysSince > 90;
                            return (
                                <div className={`${styles.lastUpdated} ${isStale ? styles.lastUpdatedStale : ""}`}>
                                    <span className={styles.lastUpdatedIcon}>{isStale ? "⚠️" : "🕐"}</span>
                                    <span>
                                        <strong>Last updated:</strong> {fmtDate(emergencyData.updatedAt)}
                                        {isStale && (
                                            <span className={styles.staleWarning}>
                                                {" — "}{daysSince} days ago. Verify with patient if conscious.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })()}

                        <div className={styles.dataGrid}>
                            {/* Blood Group — most critical */}
                            <div className={`${styles.dataCard} ${styles.dataCardBlood}`}>
                                <span className={styles.dataCardIcon}>🩸</span>
                                <span className={styles.dataCardLabel}>Blood Group</span>
                                <span className={styles.dataCardValue}>
                                    {emergencyData.bloodGroup || "—"}
                                </span>
                            </div>

                            {/* Allergies */}
                            <div className={`${styles.dataCard} ${styles.dataCardAllergy}`}>
                                <span className={styles.dataCardIcon}>⚠️</span>
                                <span className={styles.dataCardLabel}>Known Allergies</span>
                                <div className={styles.tagList}>
                                    {emergencyData.allergies.length > 0
                                        ? emergencyData.allergies.map((a, i) => (
                                            <span key={i} className={`${styles.tag} ${styles.tagAllergy}`}>{a}</span>
                                        ))
                                        : <span className={styles.noData}>None on record</span>}
                                </div>
                            </div>

                            {/* Critical Medications */}
                            <div className={styles.dataCard}>
                                <span className={styles.dataCardIcon}>💊</span>
                                <span className={styles.dataCardLabel}>Critical Medications</span>
                                <div className={styles.tagList}>
                                    {emergencyData.criticalMedications.length > 0
                                        ? emergencyData.criticalMedications.map((m, i) => (
                                            <span key={i} className={`${styles.tag} ${styles.tagMed}`}>{m}</span>
                                        ))
                                        : <span className={styles.noData}>None on record</span>}
                                </div>
                            </div>

                            {/* Active Conditions */}
                            <div className={styles.dataCard}>
                                <span className={styles.dataCardIcon}>🏥</span>
                                <span className={styles.dataCardLabel}>Active Conditions</span>
                                <div className={styles.tagList}>
                                    {emergencyData.activeConditions.length > 0
                                        ? emergencyData.activeConditions.map((c, i) => (
                                            <span key={i} className={`${styles.tag} ${styles.tagCondition}`}>{c}</span>
                                        ))
                                        : <span className={styles.noData}>None on record</span>}
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contacts */}
                        {emergencyData.emergencyContacts && emergencyData.emergencyContacts.length > 0 && (
                            <>
                                <div className={styles.sectionDivider} />
                                <h2 className={styles.dataTitle}>Emergency Contacts</h2>
                                <div className={styles.emContactsSection}>
                                    <div className={styles.emContactsList}>
                                        {emergencyData.emergencyContacts.map((c, i) => (
                                            <div key={i} className={styles.emContactCard}>
                                                <div className={styles.emContactAvatar}>{c.name?.[0]?.toUpperCase() || "?"}</div>
                                                <div className={styles.emContactInfo}>
                                                    <span className={styles.emContactName}>{c.name}</span>
                                                    <span className={styles.emContactMeta}>{c.relationship}</span>
                                                </div>
                                                <a href={`tel:${c.phone}`} className={styles.emContactCall}>📲 {c.phone}</a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Audit notice */}
                        <div className={styles.auditFooter}>
                            <span className={styles.auditDot} />
                            Access logged · Patient notified · Session ID: {sessionId.slice(0, 8)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
