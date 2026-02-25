// ============================================================
// Login Screen — Dual-role Authentication
// Patient: Card ID → DOB → OTP
// Doctor:  MCI Number + Password
// ============================================================

"use client";

import React, { useState } from "react";
import { useAuth, type UserRole } from "../../hooks/useAuth";
import { useCountdown } from "../../hooks/useCountdown";
import { isValidCardId, normalizeCardInput } from "../../lib/utils/cardId";
import styles from "./LoginScreen.module.css";

export default function LoginScreen() {
    const {
        state, initiateLogin, verifyDob, verifyOtp,
        doctorLogin, error, isLoading, lockStatus,
    } = useAuth();

    const [role, setRole] = useState<UserRole>("patient");

    // Patient fields
    const [cardId, setCardId] = useState("");
    const [dob, setDob] = useState("");
    const [otp, setOtp] = useState("");
    const [maskedPhone, setMaskedPhone] = useState("");
    const [devOtp, setDevOtp] = useState("");

    // Doctor fields
    const [doctorId, setDoctorId] = useState("");
    const [password, setPassword] = useState("");

    const otpCountdown = useCountdown({
        duration: 300,
        onExpire: () => alert("OTP expired. Please request a new one."),
    });

    // ---- Patient handlers ----
    const handleCardIdSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidCardId(cardId)) return;
        await initiateLogin(cardId);
    };

    const handleDobSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const challengeParams = await verifyDob(cardId, dob);
        if (challengeParams.maskedPhone) setMaskedPhone(challengeParams.maskedPhone);
        if (challengeParams.devOtp) setDevOtp(challengeParams.devOtp);
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await verifyOtp(cardId, otp);
    };

    // ---- Doctor handler ----
    const handleDoctorLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await doctorLogin(doctorId.trim(), password);
        } catch {
            // error is set in context
        }
    };

    // ---- Lock screen ----
    if (lockStatus.isLocked) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.lockIcon}>🔒</div>
                    <h2 className={styles.title}>Account Locked</h2>
                    <p className={styles.subtitle}>
                        Too many failed attempts. Try again after{" "}
                        {lockStatus.lockUntil
                            ? new Date(lockStatus.lockUntil).toLocaleTimeString()
                            : "30 minutes"}.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {/* Logo & Branding */}
                <div className={styles.brand}>
                    <div className={styles.logo}>
                        <span className={styles.logoIcon}>🛡️</span>
                    </div>
                    <h1 className={styles.appName}>ArogyaSutra</h1>
                    <p className={styles.tagline}>Your Health. Your Control. Zero Knowledge.</p>
                </div>

                {/* Role Toggle */}
                <div className={styles.roleToggle}>
                    <button
                        className={`${styles.roleBtn} ${role === "patient" ? styles.roleBtnActive : ""}`}
                        onClick={() => setRole("patient")}
                        type="button"
                    >
                        <span className={styles.roleIcon}>👤</span>
                        Patient
                    </button>
                    <button
                        className={`${styles.roleBtn} ${role === "doctor" ? styles.roleBtnActive : ""}`}
                        onClick={() => setRole("doctor")}
                        type="button"
                    >
                        <span className={styles.roleIcon}>🩺</span>
                        Doctor
                    </button>
                </div>

                {/* Error display */}
                {error && (
                    <div className={styles.error}>
                        <span>⚠️</span> {error.replace(/^[A-Z_]+:\s*/, "")}
                    </div>
                )}

                {/* ====== PATIENT FLOW ====== */}
                {role === "patient" && (
                    <>
                        {/* Step indicator */}
                        <div className={styles.steps}>
                            <div className={`${styles.step} ${state !== "UNAUTHENTICATED" ? styles.stepActive : ""}`}>
                                <span className={styles.stepNumber}>1</span>
                                <span className={styles.stepLabel}>Card ID</span>
                            </div>
                            <div className={styles.stepLine} />
                            <div className={`${styles.step} ${state === "DOB_VERIFIED" || state === "OTP_SENT" || state === "AUTHENTICATED" ? styles.stepActive : ""}`}>
                                <span className={styles.stepNumber}>2</span>
                                <span className={styles.stepLabel}>DOB</span>
                            </div>
                            <div className={styles.stepLine} />
                            <div className={`${styles.step} ${state === "OTP_SENT" || state === "AUTHENTICATED" ? styles.stepActive : ""}`}>
                                <span className={styles.stepNumber}>3</span>
                                <span className={styles.stepLabel}>OTP</span>
                            </div>
                        </div>

                        {/* Step 1: Card ID */}
                        {state === "UNAUTHENTICATED" && (
                            <form onSubmit={handleCardIdSubmit} className={styles.form}>
                                <label className={styles.label}>ArogyaSutra Card ID</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="AS-XXXX-XXXX"
                                    value={cardId}
                                    onChange={(e) => setCardId(normalizeCardInput(e.target.value))}
                                    maxLength={12}
                                    autoFocus
                                />
                                <p className={styles.hint}>Enter the Card ID printed on your ArogyaSutra card</p>
                                <button type="submit" className={styles.button} disabled={isLoading || !isValidCardId(cardId)}>
                                    {isLoading ? "Verifying..." : "Continue"}
                                </button>
                            </form>
                        )}

                        {/* Step 2: Date of Birth */}
                        {state === "CARD_ID_ENTERED" && (
                            <form onSubmit={handleDobSubmit} className={styles.form}>
                                <label className={styles.label}>Date of Birth</label>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                    autoFocus
                                />
                                <button type="submit" className={styles.button} disabled={isLoading || !dob}>
                                    {isLoading ? "Verifying..." : "Verify & Send OTP"}
                                </button>
                            </form>
                        )}

                        {/* Step 3: OTP */}
                        {state === "OTP_SENT" && (
                            <form onSubmit={handleOtpSubmit} className={styles.form}>
                                <label className={styles.label}>One-Time Password</label>
                                {maskedPhone && <p className={styles.hint}>Sent to {maskedPhone}</p>}
                                {devOtp && (
                                    <p className={styles.hint} style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                                        🧪 Dev OTP: {devOtp}
                                    </p>
                                )}
                                <div className={styles.otpContainer}>
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                        <input
                                            key={i}
                                            type="text"
                                            className={styles.otpDigit}
                                            maxLength={1}
                                            value={otp[i] || ""}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "");
                                                const newOtp = otp.split("");
                                                newOtp[i] = val;
                                                setOtp(newOtp.join(""));
                                                if (val && e.target.nextElementSibling) {
                                                    (e.target.nextElementSibling as HTMLInputElement).focus();
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Backspace" && !otp[i] && e.currentTarget.previousElementSibling) {
                                                    (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
                                                }
                                            }}
                                            autoFocus={i === 0}
                                        />
                                    ))}
                                </div>
                                <div className={styles.countdown}>
                                    <span>{otpCountdown.formatted}</span>
                                </div>
                                <button type="submit" className={styles.button} disabled={isLoading || otp.length !== 6}>
                                    {isLoading ? "Authenticating..." : "Unlock Records"}
                                </button>
                            </form>
                        )}
                    </>
                )}

                {/* ====== DOCTOR FLOW ====== */}
                {role === "doctor" && (
                    <form onSubmit={handleDoctorLogin} className={styles.form}>
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>MCI Number / Username</label>
                            <input
                                type="text"
                                className={`${styles.input} ${styles.inputLeft}`}
                                placeholder="e.g. MCI-12345"
                                value={doctorId}
                                onChange={(e) => setDoctorId(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>Password</label>
                            <input
                                type="password"
                                className={`${styles.input} ${styles.inputLeft}`}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            className={styles.button}
                            disabled={isLoading || !doctorId.trim() || !password}
                        >
                            {isLoading ? "Signing in..." : "Sign In as Doctor"}
                        </button>
                    </form>
                )}

                {/* Security badge */}
                <div className={styles.security}>
                    <span className={styles.securityIcon}>🔐</span>
                    <span>End-to-End Encrypted • Zero Knowledge</span>
                </div>
            </div>
        </div>
    );
}
