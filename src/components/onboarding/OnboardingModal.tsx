// ============================================================
// OnboardingModal — First-login profile completion wizard
// Shown once after a new patient account is created.
// Collects: gender, blood group, height, weight, city, state,
//           pincode, and an optional emergency contact.
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import styles from "./OnboardingModal.module.css";
import { User, HeartPulse, MapPin, Phone, ChevronRight, Check } from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const STEPS = ["personal", "health", "location", "emergency"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
    personal: "About You",
    health: "Health Info",
    location: "Location",
    emergency: "Emergency Contact",
};

const STEP_ICONS: Record<Step, React.ReactNode> = {
    personal: <User size={16} />,
    health: <HeartPulse size={16} />,
    location: <MapPin size={16} />,
    emergency: <Phone size={16} />,
};

interface OnboardingModalProps {
    onComplete: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
    const { patient, updatePatient } = useAuth();

    const [step, setStep] = useState<Step>("personal");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // ---- Form state ----
    const [gender, setGender] = useState<"male" | "female" | "other">(
        (patient?.gender as "male" | "female" | "other") || "other"
    );
    const [bloodGroup, setBloodGroup] = useState(patient?.bloodGroup ?? "");
    const [height, setHeight] = useState(patient?.height ?? "");
    const [weight, setWeight] = useState(patient?.weight ?? "");
    const [city, setCity] = useState(patient?.address?.city ?? "");
    const [stateVal, setStateVal] = useState(patient?.address?.state ?? "");
    const [pincode, setPincode] = useState(patient?.address?.pincode ?? "");
    const [pincodeLoading, setPincodeLoading] = useState(false);
    const [ecName, setEcName] = useState(patient?.emergencyContacts?.[0]?.name ?? "");
    const [ecPhone, setEcPhone] = useState(patient?.emergencyContacts?.[0]?.phone ?? "");
    const [ecRel, setEcRel] = useState(patient?.emergencyContacts?.[0]?.relationship ?? "");

    // Auto-fill city + state from pincode (same as ProfileScreen)
    useEffect(() => {
        if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return;
        const controller = new AbortController();
        setPincodeLoading(true);
        fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal })
            .then(r => r.json())
            .then((data: Array<{ Status: string; PostOffice?: Array<{ State: string; District: string }> }>) => {
                if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length) {
                    const po = data[0].PostOffice[0];
                    if (po.State) setStateVal(po.State);
                    if (po.District) setCity(po.District);
                }
            })
            .catch(() => { /* ignore abort / network errors */ })
            .finally(() => setPincodeLoading(false));
        return () => controller.abort();
    }, [pincode]);

    const stepIdx = STEPS.indexOf(step);
    const isLast = step === "emergency";

    const validateStep = (): string => {
        if (step === "health") {
            const h = Number(height);
            const w = Number(weight);
            if (height && (h < 50 || h > 250)) return "Height must be between 50 and 250 cm.";
            if (weight && (w < 2 || w > 300)) return "Weight must be between 2 and 300 kg.";
        }
        if (step === "location") {
            if (pincode && !/^\d{6}$/.test(pincode)) return "Pincode must be exactly 6 digits.";
        }
        if (step === "emergency") {
            if (ecName && ecName.trim().length < 2) return "Emergency contact name is too short.";
            if (ecPhone && !/^\+?\d{10,15}$/.test(ecPhone.replace(/[\s-]/g, ""))) return "Enter a valid phone number (e.g. +919876543210).";
        }
        return "";
    };

    const handleNext = () => {
        const validationError = validateStep();
        if (validationError) { setError(validationError); return; }
        setError("");
        const next = STEPS[stepIdx + 1];
        if (next) setStep(next);
    };

    const handleBack = () => {
        const prev = STEPS[stepIdx - 1];
        if (prev) setStep(prev);
    };

    const handleSkip = () => {
        if (isLast) {
            setError("");
            handleSave(true);
            return;
        }
        handleNext();
    };

    const handleSave = async (skipContacts = false) => {
        if (!patient?.patientId) return;
        setSaving(true);
        setError("");

        const updates: Record<string, string> = {
            gender,
            ...(bloodGroup && { bloodGroup }),
            ...(height && { height }),
            ...(weight && { weight }),
            ...(city && { city }),
            ...(stateVal && { state: stateVal }),
            ...(pincode && { pincode }),
        };

        const emergencyContacts =
            !skipContacts && ecName && ecPhone
                ? JSON.stringify([{ name: ecName, phone: ecPhone, relationship: ecRel || "Other" }])
                : undefined;
        if (emergencyContacts) updates.emergencyContacts = emergencyContacts;

        try {
            const res = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: patient.patientId, role: "patient", updates }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error ?? "Save failed");
            }

            // Sync auth context so the rest of the app reflects changes instantly
            updatePatient({
                gender,
                ...(bloodGroup && { bloodGroup }),
                ...(height && { height }),
                ...(weight && { weight }),
                address: {
                    ...patient.address,
                    ...(city && { city }),
                    ...(stateVal && { state: stateVal }),
                    ...(pincode && { pincode }),
                },
                ...(!skipContacts && ecName && ecPhone
                    ? { emergencyContacts: [{ name: ecName, phone: ecPhone, relationship: ecRel || "Other" }] }
                    : {}),
            });

            onComplete();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.accentBar} />
                <div className={styles.body}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.brandBadge}>✦ ArogyaSutra</span>
                    <h2 className={styles.title}>Complete Your Profile</h2>
                    <p className={styles.subtitle}>
                        Help us personalise your experience — takes about 1 minute
                    </p>
                </div>

                {/* Step indicator */}
                <div className={styles.stepsWrap}>
                    <div className={styles.stepsTrack}>
                        {STEPS.map((s, i) => (
                            <div
                                key={s}
                                className={`${styles.stepDot} ${i < stepIdx ? styles.stepDone : ""} ${s === step ? styles.stepActive : ""}`}
                                title={STEP_LABELS[s]}
                            >
                                {i < stepIdx ? <Check size={14} /> : STEP_ICONS[s]}
                            </div>
                        ))}
                    </div>
                    <p className={styles.stepLabel}>{STEP_LABELS[step]}</p>
                </div>

                {/* ---- Step: Personal ---- */}
                {step === "personal" && (
                    <div className={styles.form}>
                        <div className={styles.field}>
                            <label className={styles.label}>Gender</label>
                            <div className={styles.genderRow}>
                                {(["male", "female", "other"] as const).map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        className={`${styles.genderBtn} ${gender === g ? styles.genderBtnActive : ""}`}
                                        onClick={() => setGender(g)}
                                    >
                                        <span className={styles.genderIcon}>{g === "male" ? "♂" : g === "female" ? "♀" : "⊹"}</span>
                                        {g === "male" ? "Male" : g === "female" ? "Female" : "Other"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ---- Step: Health ---- */}
                {step === "health" && (
                    <div className={styles.form}>
                        <div className={styles.field}>
                            <label className={styles.label}>Blood Group</label>
                            <div className={styles.chipGrid}>
                                {BLOOD_GROUPS.map((bg) => (
                                    <button
                                        key={bg}
                                        type="button"
                                        className={`${styles.chip} ${bloodGroup === bg ? styles.chipActive : ""}`}
                                        onClick={() => setBloodGroup(bg)}
                                    >
                                        {bg}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.row2}>
                            <div className={styles.field}>
                                <label className={styles.label}>Height (cm)</label>
                                <input
                                    className={styles.input}
                                    type="number"
                                    placeholder="e.g. 170"
                                    value={height}
                                    onChange={(e) => setHeight(e.target.value)}
                                    min="50"
                                    max="250"
                                    step="1"
                                    inputMode="numeric"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Weight (kg)</label>
                                <input
                                    className={styles.input}
                                    type="number"
                                    placeholder="e.g. 65"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    min="2"
                                    max="300"
                                    step="0.1"
                                    inputMode="decimal"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ---- Step: Location ---- */}
                {step === "location" && (
                    <div className={styles.form}>
                        <div className={styles.field}>
                            <label className={styles.label}>City</label>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="e.g. Mumbai"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                maxLength={50}
                                autoComplete="address-level2"
                            />
                        </div>
                        <div className={styles.row2}>
                            <div className={styles.field}>
                                <label className={styles.label}>State</label>
                                <input
                                    className={styles.input}
                                    type="text"
                                    placeholder="e.g. Maharashtra"
                                    value={stateVal}
                                    onChange={(e) => setStateVal(e.target.value)}
                                    maxLength={50}
                                    autoComplete="address-level1"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Pincode</label>
                                <input
                                    className={styles.input}
                                    type="text"
                                    placeholder="e.g. 400001"
                                    value={pincode}
                                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                                    maxLength={6}
                                    inputMode="numeric"
                                    pattern="\d{6}"
                                    autoComplete="postal-code"
                                />
                                {pincodeLoading && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>Looking up…</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ---- Step: Emergency Contact ---- */}
                {step === "emergency" && (
                    <div className={styles.form}>
                        <p className={styles.hint}>
                            In case of a medical emergency, who should be contacted?
                        </p>
                        <div className={styles.field}>
                            <label className={styles.label}>Full Name</label>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="e.g. Priya Sharma"
                                value={ecName}
                                onChange={(e) => setEcName(e.target.value)}
                                maxLength={60}
                                autoComplete="name"
                            />
                        </div>
                        <div className={styles.row2}>
                            <div className={styles.field}>
                                <label className={styles.label}>Phone</label>
                                <input
                                    className={styles.input}
                                    type="tel"
                                    placeholder="+91XXXXXXXXXX"
                                    value={ecPhone}
                                    onChange={(e) => setEcPhone(e.target.value)}
                                    maxLength={15}
                                    inputMode="tel"
                                    autoComplete="tel"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Relationship</label>
                                <input
                                    className={styles.input}
                                    type="text"
                                    placeholder="e.g. Spouse"
                                    value={ecRel}
                                    onChange={(e) => setEcRel(e.target.value)}
                                    maxLength={30}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {error && <p className={styles.error}>{error}</p>}

                {/* Actions */}
                <div className={styles.actions}>
                    {stepIdx > 0 && (
                        <button className={styles.backBtn} onClick={handleBack} disabled={saving}>
                            ← Back
                        </button>
                    )}
                    {stepIdx === 0 && (
                        <span />
                    )}
                    <div className={styles.rightActions}>
                        <button className={styles.skipBtn} onClick={handleSkip} disabled={saving}>
                            {isLast ? "Skip & Finish" : "Skip"}
                        </button>
                        {isLast ? (
                            <button className={styles.primaryBtn} onClick={() => handleSave(false)} disabled={saving}>
                                {saving ? "Saving…" : <><Check size={14} /> Finish</>}
                            </button>
                        ) : (
                            <button className={styles.primaryBtn} onClick={handleNext} disabled={saving}>
                                Next <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
}
