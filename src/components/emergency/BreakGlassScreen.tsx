// ============================================================
// Break-Glass Emergency Access Screen
// For Emergency Personnel (first responders) ONLY
// Accessible from Login screen — no patient auth required
// Logs access to DynamoDB, notifies patient, timed session
// ============================================================

"use client";

import React, { useState } from "react";
import { useCountdown } from "../../hooks/useCountdown";
import type { BreakGlassResponse, GeoLocation } from "../../lib/types/emergency";
import styles from "./BreakGlassScreen.module.css";

interface Props {
    onClose: () => void;
}

export default function BreakGlassScreen({ onClose }: Props) {
    const [step, setStep] = useState<"credentials" | "data">("credentials");
    const [form, setForm] = useState({
        mciNumber: "",
        name: "",
        institution: "",
        patientId: "",
        reason: "",
    });
    const [emergencyData, setEmergencyData] = useState<BreakGlassResponse["emergencyData"] | null>(null);
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
                    patientId: form.patientId.toUpperCase().trim(),
                    mciNumber: form.mciNumber.trim(),
                    personnelName: form.name.trim(),
                    institution: form.institution.trim(),
                    reason: form.reason.trim(),
                    geolocation: geo,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Emergency access denied");

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
            {/* Header bar */}
            <div className={styles.header}>
                <span className={styles.headerBadge}>🆘 EMERGENCY ACCESS</span>
                <button className={styles.closeBtn} onClick={onClose} title="Cancel">✕</button>
            </div>

            <div className={styles.body}>
                {step === "credentials" && (
                    <div className={styles.panel}>
                        <div className={styles.warningBanner}>
                            <span className={styles.warningIcon}>⚠️</span>
                            <div>
                                <strong>Break-Glass Protocol</strong>
                                <p>This access is logged, geolocation-stamped, and the patient is notified immediately.</p>
                            </div>
                        </div>

                        {error && <div className={styles.errorBox}>{error}</div>}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Patient ArogyaSutra Card ID</label>
                                <input
                                    className={styles.input}
                                    placeholder="AS-XXXX-XXXX"
                                    value={form.patientId}
                                    onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                                    required
                                    autoFocus
                                />
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
                                />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Emergency Reason</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder="Briefly describe the emergency situation..."
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    required
                                    rows={2}
                                />
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

                        <h2 className={styles.dataTitle}>Critical Emergency Information</h2>
                        <p className={styles.dataSubtitle}>Critical-Only View • Audit logged • Patient notified</p>

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
                    </div>
                )}
            </div>
        </div>
    );
}
