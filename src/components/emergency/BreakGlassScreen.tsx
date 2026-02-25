// ============================================================
// Break-Glass Emergency Access Screen
// For emergency personnel to access critical data
// ============================================================

"use client";

import React, { useState } from "react";
import { useCountdown } from "../../hooks/useCountdown";
import * as accessService from "../../lib/services/access.service";
import type { BreakGlassResponse, GeoLocation } from "../../lib/types/emergency";
import styles from "./BreakGlassScreen.module.css";

export default function BreakGlassScreen() {
    const [step, setStep] = useState<"credentials" | "countdown" | "data">("credentials");
    const [form, setForm] = useState({ mciNumber: "", name: "", institution: "", patientId: "", reason: "" });
    const [response, setResponse] = useState<BreakGlassResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const countdown = useCountdown({
        duration: 300, // 5 minutes
        onExpire: () => {
            if (response) {
                accessService.endBreakGlassSession(response.sessionId, form.patientId);
                setStep("credentials");
                setResponse(null);
            }
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            let geo: GeoLocation = { latitude: 0, longitude: 0, accuracy: 0, timestamp: new Date().toISOString() };
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
                );
                geo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date().toISOString() };
            } catch {
                throw new Error("Location access is required for emergency access");
            }

            const result = await accessService.initiateBreakGlass({
                patientId: form.patientId,
                credentials: { mciRegistrationNumber: form.mciNumber, personnelName: form.name, institution: form.institution, designation: "Emergency" },
                geoLocation: geo,
                reason: form.reason,
            });

            setResponse(result);
            setStep("countdown");
            countdown.start();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.warning}>⚠️ EMERGENCY ACCESS ONLY ⚠️</div>

            {step === "credentials" && (
                <div className={styles.card}>
                    <h1 className={styles.title}>🚨 Break-Glass Protocol</h1>
                    <p className={styles.subtitle}>This access is logged, time-limited, and notifies the patient.</p>
                    {error && <div className={styles.error}>{error}</div>}
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <input className={styles.input} placeholder="MCI Registration Number" value={form.mciNumber} onChange={(e) => setForm({ ...form, mciNumber: e.target.value })} required />
                        <input className={styles.input} placeholder="Your Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                        <input className={styles.input} placeholder="Institution / Hospital" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} required />
                        <input className={styles.input} placeholder="Patient Card ID (AS-XXXX-XXXX)" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required />
                        <textarea className={styles.textarea} placeholder="Emergency reason..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
                        <button type="submit" className={styles.emergencyButton} disabled={isLoading}>
                            {isLoading ? "Verifying..." : "🔓 Initiate Emergency Access"}
                        </button>
                    </form>
                </div>
            )}

            {step === "countdown" && response && (
                <div className={styles.card}>
                    <div className={styles.countdownRing}>
                        <svg viewBox="0 0 120 120" className={styles.countdownSvg}>
                            <circle cx="60" cy="60" r="54" className={styles.countdownBg} />
                            <circle cx="60" cy="60" r="54" className={styles.countdownProgress}
                                style={{ strokeDashoffset: `${339.3 * (1 - countdown.progress)}` }} />
                        </svg>
                        <span className={styles.countdownText}>{countdown.formatted}</span>
                    </div>
                    <h2 className={styles.title}>Emergency Access Active</h2>
                    <p className={styles.subtitle}>Critical-Only View • Session expires in {countdown.formatted}</p>
                    <button className={styles.viewButton} onClick={() => setStep("data")}>View Emergency Data</button>
                </div>
            )}

            {step === "data" && response && (
                <div className={styles.card}>
                    <div className={styles.timerBar}>{countdown.formatted} remaining</div>
                    <h2 className={styles.title}>Emergency Health Data</h2>
                    <div className={styles.dataSection}>
                        <h3>🩸 Blood Group</h3>
                        <p className={styles.dataValue}>{response.emergencyData.bloodGroup}</p>
                    </div>
                    <div className={styles.dataSection}>
                        <h3>⚠️ Allergies</h3>
                        {response.emergencyData.allergies.length > 0
                            ? response.emergencyData.allergies.map((a, i) => <span key={i} className={styles.tag}>{a}</span>)
                            : <p className={styles.noData}>None recorded</p>}
                    </div>
                    <div className={styles.dataSection}>
                        <h3>💊 Critical Medications</h3>
                        {response.emergencyData.criticalMedications.length > 0
                            ? response.emergencyData.criticalMedications.map((m, i) => <span key={i} className={styles.tag}>{m}</span>)
                            : <p className={styles.noData}>None recorded</p>}
                    </div>
                    <div className={styles.dataSection}>
                        <h3>🏥 Active Conditions</h3>
                        {response.emergencyData.activeConditions.length > 0
                            ? response.emergencyData.activeConditions.map((c, i) => <span key={i} className={styles.tag}>{c}</span>)
                            : <p className={styles.noData}>None recorded</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
