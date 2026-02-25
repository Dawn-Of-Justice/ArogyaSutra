// ============================================================
// Doctor Dashboard — Light-mode UI
// Flow: Empty state → Verify patient (Card ID → DOB → OTP) → View data
// Reference: Patient Queue + 3D Model + Patient Info panel
// ============================================================

"use client";

import React, { useState, Suspense } from "react";
import { isValidCardId, normalizeCardInput } from "../../lib/utils/cardId";
import styles from "./DoctorDashboard.module.css";

// Dev mode OTP — in production, OTP comes from the patient's phone
const DEV_OTP = process.env.NODE_ENV === "development" ? "000000" : null;

// Lazy load the 3D body model (will be replaced with GLTF)
const BodyModel3D = React.lazy(() => import("../body3d/BodyModel3D"));

interface PatientData {
    cardId: string;
    name: string;
    age: number;
    gender: string;
    weight: string;
    bloodGroup: string;
    diagnosis: string;
    vitals: {
        bp: string;
        heartRate: string;
    };
    history: {
        icon: string;
        label: string;
        date: string;
        active?: boolean;
    }[];
    annotations: {
        bodyPart: string;
        title: string;
        date: string;
        icon: string;
    }[];
}

type VerifyStep = "card" | "dob" | "otp";

interface Props {
    onNavigate: (screen: string) => void;
    doctorName?: string;
}

export default function DoctorDashboard({ onNavigate, doctorName }: Props) {
    // Verification state
    const [verifyStep, setVerifyStep] = useState<VerifyStep>("card");
    const [cardId, setCardId] = useState("");
    const [dob, setDob] = useState("");
    const [otp, setOtp] = useState("");
    const [verifyError, setVerifyError] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    // Patient data (null until verified)
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [verifiedPatients, setVerifiedPatients] = useState<PatientData[]>([]);
    const [activePatientIdx, setActivePatientIdx] = useState(0);

    // ---- Verification handlers ----
    const handleCardSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidCardId(cardId)) return;
        setVerifyError("");
        setVerifyStep("dob");
    };

    const handleDobSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!dob) return;
        setVerifyError("");
        // In production, this would call the patient auth API
        // For now, move to OTP step
        setVerifyStep("otp");
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) return;
        setIsVerifying(true);
        setVerifyError("");

        try {
            // Simulate verification — in production, call the verify-patient API
            await new Promise((r) => setTimeout(r, 1000));

            // Mock patient data based on card ID
            const mockPatient: PatientData = {
                cardId,
                name: "Rachman Bilhaq",
                age: 48,
                gender: "Male",
                weight: "68 kg",
                bloodGroup: "A+",
                diagnosis: "Knee replacement",
                vitals: { bp: "120/80", heartRate: "110" },
                history: [
                    { icon: "🦴", label: "Backpain Checkup", date: "12/2/2019" },
                    { icon: "🏥", label: "Knee Surgery", date: "12/2/2023", active: true },
                    { icon: "📋", label: "Knee Control after Surgery", date: "12/2/2023" },
                    { icon: "🩺", label: "Medical Checkup", date: "12/2/2023" },
                ],
                annotations: [
                    { bodyPart: "right-knee", title: "Knee Replacement", date: "12/2/2023", icon: "🦴" },
                ],
            };

            setPatient(mockPatient);
            setVerifiedPatients((prev) => [...prev, mockPatient]);
            setActivePatientIdx(verifiedPatients.length);

            // Reset verification form
            setCardId("");
            setDob("");
            setOtp("");
            setVerifyStep("card");
        } catch {
            setVerifyError("Verification failed. Please check credentials.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleNewPatient = () => {
        setPatient(null);
        setVerifyStep("card");
        setVerifyError("");
    };

    const totalPatients = verifiedPatients.length;
    const currentIdx = patient ? activePatientIdx + 1 : 0;

    const goToPrevPatient = () => {
        if (activePatientIdx > 0) {
            const idx = activePatientIdx - 1;
            setActivePatientIdx(idx);
            setPatient(verifiedPatients[idx]);
        }
    };

    const goToNextPatient = () => {
        if (activePatientIdx < verifiedPatients.length - 1) {
            const idx = activePatientIdx + 1;
            setActivePatientIdx(idx);
            setPatient(verifiedPatients[idx]);
        }
    };

    // Active annotation for body model
    const activeAnnotation = patient?.annotations?.[0] || null;

    return (
        <div className={styles.doctorDashboard}>
            {/* ---- Left Column: Body Model ---- */}
            <div className={styles.leftColumn}>
                <div className={styles.bodyModelArea}>
                    {/* Model tools */}
                    <div className={styles.modelTools}>
                        <button className={styles.modelToolBtn} title="Cursor">✦</button>
                        <button className={styles.modelToolBtn} title="Zoom In">⊕</button>
                        <button className={styles.modelToolBtn} title="Zoom Out">⊖</button>
                        <button className={styles.modelToolBtn} title="Fullscreen">⛶</button>
                    </div>

                    {/* Body model or placeholder */}
                    {patient ? (
                        <Suspense
                            fallback={
                                <div className={styles.bodyModelPlaceholder}>
                                    <span>🫀</span>
                                    <span>Loading 3D Model...</span>
                                </div>
                            }
                        >
                            <BodyModel3D annotations={patient.annotations} />
                        </Suspense>
                    ) : (
                        <div className={styles.bodyModelPlaceholder}>
                            <span>🫀</span>
                            <span>Verify a patient to view anatomical model</span>
                        </div>
                    )}

                    {/* Annotation card (floating) */}
                    {activeAnnotation && (
                        <div className={styles.annotationCard}>
                            <div className={styles.annotationThumb}>
                                {activeAnnotation.icon}
                            </div>
                            <div className={styles.annotationText}>
                                <strong>{activeAnnotation.title}</strong>
                                <span>{activeAnnotation.date}</span>
                            </div>
                        </div>
                    )}

                    {/* Model navigation */}
                    <div className={styles.modelNav}>
                        <button
                            className={styles.modelNavBtn}
                            onClick={goToPrevPatient}
                            disabled={activePatientIdx <= 0}
                            title="Previous patient"
                        >
                            ‹
                        </button>
                        <button
                            className={styles.modelNavBtn}
                            onClick={goToNextPatient}
                            disabled={activePatientIdx >= verifiedPatients.length - 1}
                            title="Next patient"
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

            {/* ---- Right Column ---- */}
            <div className={styles.rightColumn}>
                {/* If no patient is verified, show verification form */}
                {!patient ? (
                    <div className={styles.verifyPanel}>
                        <h2 className={styles.verifyTitle}>Verify Patient</h2>
                        <p className={styles.verifySubtitle}>
                            Enter patient credentials to access their health records
                        </p>

                        {/* Steps */}
                        <div className={styles.verifySteps}>
                            <div className={`${styles.verifyStep} ${verifyStep === "card" || verifyStep === "dob" || verifyStep === "otp"
                                ? styles.verifyStepActive : ""
                                }`}>
                                <span className={styles.verifyStepNum}>1</span>
                                <span className={styles.verifyStepLabel}>Card ID</span>
                            </div>
                            <div className={styles.verifyStepLine} />
                            <div className={`${styles.verifyStep} ${verifyStep === "dob" || verifyStep === "otp"
                                ? styles.verifyStepActive : ""
                                }`}>
                                <span className={styles.verifyStepNum}>2</span>
                                <span className={styles.verifyStepLabel}>DOB</span>
                            </div>
                            <div className={styles.verifyStepLine} />
                            <div className={`${styles.verifyStep} ${verifyStep === "otp" ? styles.verifyStepActive : ""
                                }`}>
                                <span className={styles.verifyStepNum}>3</span>
                                <span className={styles.verifyStepLabel}>OTP</span>
                            </div>
                        </div>

                        {verifyError && (
                            <div className={styles.verifyError}>⚠️ {verifyError}</div>
                        )}

                        {/* Step 1: Card ID */}
                        {verifyStep === "card" && (
                            <form onSubmit={handleCardSubmit} className={styles.verifyForm}>
                                <div>
                                    <label className={styles.verifyLabel}>Patient Card ID</label>
                                    <input
                                        type="text"
                                        className={styles.verifyInput}
                                        placeholder="AS-XXXX-XXXX"
                                        value={cardId}
                                        onChange={(e) => setCardId(normalizeCardInput(e.target.value))}
                                        maxLength={12}
                                        autoFocus
                                    />
                                </div>
                                <p className={styles.verifyHint}>
                                    Enter the Card ID from the patient&apos;s ArogyaSutra card
                                </p>
                                <button
                                    type="submit"
                                    className={styles.verifyBtn}
                                    disabled={!isValidCardId(cardId)}
                                >
                                    Continue
                                </button>
                            </form>
                        )}

                        {/* Step 2: DOB */}
                        {verifyStep === "dob" && (
                            <form onSubmit={handleDobSubmit} className={styles.verifyForm}>
                                <div>
                                    <label className={styles.verifyLabel}>Patient Date of Birth</label>
                                    <input
                                        type="date"
                                        className={`${styles.verifyInput} ${styles.verifyInputNormal}`}
                                        value={dob}
                                        onChange={(e) => setDob(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className={styles.verifyBtn}
                                    disabled={!dob}
                                >
                                    Verify & Send OTP
                                </button>
                            </form>
                        )}

                        {/* Step 3: OTP */}
                        {verifyStep === "otp" && (
                            <form onSubmit={handleOtpSubmit} className={styles.verifyForm}>
                                <div>
                                    <label className={styles.verifyLabel}>Patient OTP</label>
                                    <p className={styles.verifyHint} style={{ marginBottom: 8 }}>
                                        OTP sent to patient&apos;s registered mobile
                                    </p>
                                    {DEV_OTP && (
                                        <p className={styles.verifyHint} style={{ color: 'var(--dd-accent)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                                            🧪 Dev OTP: {DEV_OTP}
                                        </p>
                                    )}
                                    <div className={styles.otpRow}>
                                        {[0, 1, 2, 3, 4, 5].map((i) => (
                                            <input
                                                key={i}
                                                type="text"
                                                className={styles.otpDigit}
                                                maxLength={1}
                                                value={otp[i] || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, "");
                                                    const arr = otp.split("");
                                                    arr[i] = val;
                                                    setOtp(arr.join(""));
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
                                </div>
                                <button
                                    type="submit"
                                    className={styles.verifyBtn}
                                    disabled={isVerifying || otp.length !== 6}
                                >
                                    {isVerifying ? "Verifying..." : "Verify Patient"}
                                </button>
                            </form>
                        )}

                        {/* Show verified patients count */}
                        {totalPatients > 0 && (
                            <p
                                className={styles.verifyHint}
                                style={{ marginTop: 16, cursor: "pointer", color: "var(--dd-accent)" }}
                                onClick={() => {
                                    setPatient(verifiedPatients[verifiedPatients.length - 1]);
                                    setActivePatientIdx(verifiedPatients.length - 1);
                                }}
                            >
                                ← Back to {verifiedPatients[verifiedPatients.length - 1].name}
                            </p>
                        )}
                    </div>
                ) : (
                    /* ---- Patient Data Panel ---- */
                    <>
                        <div className={styles.patientPanel}>
                            <div className={styles.patientPanelHeader}>
                                <h2>Patient Info</h2>
                                <button className={styles.moreBtn} title="More options">⋮</button>
                            </div>

                            {/* Profile */}
                            <div className={styles.patientProfile}>
                                <div className={styles.patientAvatar}>👤</div>
                                <div className={styles.patientMeta}>
                                    <div className={styles.patientTags}>
                                        <span className={styles.tag}>{patient.weight}</span>
                                        <span className={`${styles.tag} ${styles.tagAccent}`}>
                                            {patient.bloodGroup}
                                        </span>
                                    </div>
                                    <span className={styles.patientName}>{patient.name}</span>
                                    <span className={styles.patientSubMeta}>
                                        {patient.gender} • {patient.age} years old
                                    </span>
                                </div>
                                <div>
                                    <span className={styles.diagnosisLabel}>Diagnosis:</span>
                                    <div className={styles.diagnosisValue}>{patient.diagnosis}</div>
                                </div>
                            </div>

                            {/* Vitals */}
                            <div className={styles.vitalsRow}>
                                <div className={styles.vitalCard}>
                                    <span className={styles.vitalIcon}>🫀</span>
                                    <div className={styles.vitalData}>
                                        <span className={styles.vitalLabel}>Blood Pressure</span>
                                        <span className={styles.vitalValue}>
                                            {patient.vitals.bp}
                                            <span className={styles.vitalUnit}>mmHg</span>
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.vitalCard}>
                                    <span className={styles.vitalIcon}>❤️</span>
                                    <div className={styles.vitalData}>
                                        <span className={styles.vitalLabel}>Heart rate</span>
                                        <span className={styles.vitalValue}>
                                            {patient.vitals.heartRate}
                                            <span className={styles.vitalUnit}>bpm</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Medical History & X-Ray */}
                            <div className={styles.twoColumns}>
                                <div>
                                    <h3 className={styles.sectionTitle}>Medical History</h3>
                                    <div className={styles.historyList}>
                                        {patient.history.map((item, i) => (
                                            <div
                                                key={i}
                                                className={`${styles.historyItem} ${item.active ? styles.historyItemActive : ""
                                                    }`}
                                            >
                                                <span className={styles.historyIcon}>{item.icon}</span>
                                                <div className={styles.historyMeta}>
                                                    <span className={styles.historyLabel}>{item.label}</span>
                                                    <span className={styles.historyDate}>{item.date}</span>
                                                </div>
                                                {item.active && (
                                                    <span className={styles.historyArrow}>›</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className={styles.xrayArea}>
                                    <h3 className={styles.sectionTitle}>X-Ray Docs</h3>
                                    <div className={styles.xrayImageBox}>🩻</div>
                                    <p className={styles.xrayCaption}>No X-ray images uploaded</p>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className={styles.actionBar}>
                                <button className={styles.actionBtn}>📅 Schedule</button>
                                <button className={styles.actionBtn}>📝 Add Notes</button>
                                <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
                                    📋 Add Prescription
                                </button>
                            </div>
                        </div>

                        {/* Verify another patient button */}
                        <button
                            className={styles.actionBtn}
                            onClick={handleNewPatient}
                            style={{ alignSelf: "flex-start" }}
                        >
                            ➕ Verify Another Patient
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
