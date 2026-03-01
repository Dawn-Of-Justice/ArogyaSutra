// ============================================================
// Doctor Dashboard — Light-mode UI
// Flow: Empty state → Verify patient (Card ID → DOB → OTP) →
//       View data → End Session → back to verify
// ============================================================

"use client";

import React, { useState, Suspense, lazy } from "react";
import { isValidCardId, normalizeCardInput } from "../../lib/utils/cardId";
import styles from "./DoctorDashboard.module.css";

// Lazy-load the 3D body model to avoid SSR issues with Three.js
const BodyModel3D = lazy(() => import("../body3d/BodyModel3D"));

// Dev mode OTP — in production, OTP comes from the patient's phone
const DEV_OTP = process.env.NODE_ENV === "development" ? "000000" : null;



/* ---- Inline SVG icons (professional, mono-weight) ---- */
const Icon = {
    user: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    heart: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0L12 5.36l-.77-.78a5.4 5.4 0 0 0-7.65 7.65l1.06 1.06L12 20.65l7.36-7.36 1.06-1.06a5.4 5.4 0 0 0 0-7.65z" />
        </svg>
    ),
    activity: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    clipboard: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
    ),
    calendar: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    edit: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    filePlus: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
    ),
    stethoscope: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
            <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
            <circle cx="20" cy="10" r="2" />
        </svg>
    ),
    scan: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <rect x="7" y="7" width="10" height="10" rx="1" />
        </svg>
    ),
    imageOff: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
            <line x1="13.5" y1="13.5" x2="6" y2="21" />
            <path d="M18 12l3 3" />
            <path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59" />
            <path d="M21 15V5a2 2 0 0 0-2-2H9" />
        </svg>
    ),
    logOut: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
    moreVertical: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
        </svg>
    ),
    alertTriangle: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    chevronRight: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    ),
};

/* ---- History item icon map (text-based, not emoji) ---- */
function historyIcon(type: string) {
    switch (type) {
        case "checkup": return Icon.stethoscope;
        case "surgery": return Icon.activity;
        case "followup": return Icon.clipboard;
        default: return Icon.clipboard;
    }
}

interface PatientData {
    cardId: string;
    name: string;
    age: number;
    gender: string;
    height: string;
    weight: string;
    bloodGroup: string;
    phone?: string;
    diagnosis: string;
    vitals: {
        bp: string;
        heartRate: string;
    };
    history: {
        type: string;
        label: string;
        date: string;
        active?: boolean;
    }[];
    annotations: {
        bodyPart: string;
        title: string;
        date: string;
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

    // Single patient session (null until verified)
    const [patient, setPatient] = useState<PatientData | null>(null);

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
        setVerifyStep("otp");
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) return;
        setIsVerifying(true);
        setVerifyError("");

        try {
            // Simulate OTP verification delay (replace with real Cognito verify in production)
            await new Promise((r) => setTimeout(r, 800));

            // ---- Fetch real patient data from Cognito via server-side API ----
            let patientName = cardId;
            let patientAge = 0;
            let patientGender = "Unknown";
            let patientPhone = "";
            let bloodGroup = "—";
            let weight = "—";

            try {
                const res = await fetch("/api/patient/lookup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cardId }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.patient) {
                        patientName = data.patient.name || cardId;
                        patientAge = data.patient.age || 0;
                        patientGender = data.patient.gender || "Unknown";
                        patientPhone = data.patient.phone || "";
                        bloodGroup = data.patient.bloodGroup || "—";
                        weight = data.patient.weight || "—";
                    }
                }
            } catch {
                // Backend not reachable — use minimal info from the card ID itself
                console.warn("Patient lookup API unavailable — using fallback data");
            }

            const verifiedPatient: PatientData = {
                cardId,
                name: patientName,
                age: patientAge,
                gender: patientGender,
                height: "—",
                weight,
                bloodGroup,
                // Diagnosis and history come from medical records (HealthLake / timeline)
                // These will be populated in a future Medical Records API integration
                diagnosis: "Refer to medical records",
                vitals: { bp: "—", heartRate: "—" },
                history: [],
                annotations: [],
            };

            setPatient(verifiedPatient);
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

    const handleEndSession = () => {
        setPatient(null);
        setVerifyStep("card");
        setVerifyError("");
        setCardId("");
        setDob("");
        setOtp("");
    };

    // Active annotation for body model
    const activeAnnotation = patient?.annotations?.[0] || null;

    // ---- Schedule appointment (doctor sets next visit) ----
    const [schedOpen, setSchedOpen] = useState(false);
    const [schedDate, setSchedDate] = useState("");
    const [schedTime, setSchedTime] = useState("");
    const [schedSpecialty, setSchedSpecialty] = useState("");
    const [schedLocation, setSchedLocation] = useState("");
    const [schedNotes, setSchedNotes] = useState("");
    const [schedSaving, setSchedSaving] = useState(false);
    const [schedDone, setSchedDone] = useState(false);
    const [schedError, setSchedError] = useState("");

    const handleScheduleAppointment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient || !schedDate) return;
        setSchedSaving(true);
        setSchedError("");
        try {
            const res = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patient.cardId,
                    appointmentDate: schedDate,
                    time: schedTime || undefined,
                    doctorName: doctorName || "Doctor",
                    specialty: schedSpecialty || undefined,
                    location: schedLocation || undefined,
                    notes: schedNotes || undefined,
                }),
            });
            if (!res.ok) throw new Error("Failed");
            setSchedDone(true);
            setTimeout(() => {
                setSchedOpen(false);
                setSchedDone(false);
                setSchedDate(""); setSchedTime(""); setSchedSpecialty("");
                setSchedLocation(""); setSchedNotes("");
            }, 2000);
        } catch {
            setSchedError("Could not save appointment. Please try again.");
        } finally {
            setSchedSaving(false);
        }
    };

    return (
        <div className={styles.doctorDashboard}>
            {/* ---- Left Column: 3D Body Model ---- */}
            <div className={styles.leftColumn}>
                <div className={styles.bodyModelArea}>
                    {patient ? (
                        <Suspense fallback={
                            <div className={styles.bodyModelPlaceholder}>
                                <span>Loading 3D model…</span>
                            </div>
                        }>
                            <BodyModel3D
                                gender={patient.gender === "Female" ? "female" : "male"}
                            />
                        </Suspense>
                    ) : (
                        <div className={styles.bodyModelPlaceholder}>
                            <span className={styles.placeholderIcon}>{Icon.scan}</span>
                            <span>Verify a patient to view anatomical model</span>
                        </div>
                    )}

                    {/* Annotation card (floating) */}
                    {activeAnnotation && (
                        <div className={styles.annotationCard}>
                            <div className={styles.annotationThumb}>
                                {Icon.activity}
                            </div>
                            <div className={styles.annotationText}>
                                <strong>{activeAnnotation.title}</strong>
                                <span>{activeAnnotation.date}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ---- Right Column ---- */}
            <div className={styles.rightColumn}>
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
                            <div className={styles.verifyError}>
                                <span className={styles.verifyErrorIcon}>{Icon.alertTriangle}</span>
                                {verifyError}
                            </div>
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
                                    Verify &amp; Send OTP
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
                                        <p className={styles.devOtpHint}>
                                            Dev OTP: {DEV_OTP}
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
                    </div>
                ) : (
                    /* ---- Patient Data Panel ---- */
                    <>
                        <div className={styles.patientPanel}>
                            <div className={styles.patientPanelHeader}>
                                <h2>Patient Info</h2>
                                <button className={styles.moreBtn} title="More options">
                                    {Icon.moreVertical}
                                </button>
                            </div>

                            {/* Patient identity — top */}
                            <div className={styles.patientFooter}>
                                <span className={styles.patientFooterName}>{patient.name}</span>
                                <span className={styles.patientFooterMeta}>
                                    {patient.gender}{patient.age > 0 ? `, ${patient.age} yrs` : ""}
                                    {patient.phone ? ` · ${patient.phone}` : ""}
                                </span>
                                <span className={styles.patientFooterCard}>{patient.cardId}</span>
                            </div>

                            {/* Stats bar: height / weight / blood group + last updated */}
                            <div className={styles.statsBar}>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Height</span>
                                    <span className={styles.statValue}>{patient.height}</span>
                                </div>
                                <div className={styles.statDivider} />
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Weight</span>
                                    <span className={styles.statValue}>{patient.weight}</span>
                                </div>
                                {patient.bloodGroup !== "—" && (
                                    <>
                                        <div className={styles.statDivider} />
                                        <div className={styles.statItem}>
                                            <span className={styles.statLabel}>Blood</span>
                                            <span className={`${styles.statValue} ${styles.statValueAccent}`}>
                                                {patient.bloodGroup}
                                            </span>
                                        </div>
                                    </>
                                )}
                                <div className={styles.lastUpdated}>
                                    <span className={styles.lastUpdatedDot} />
                                    Last updated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </div>
                            </div>

                            {/* Vitals */}
                            <div className={styles.vitalsRow}>
                                <div className={styles.vitalCard}>
                                    <span className={styles.vitalIcon}>{Icon.activity}</span>
                                    <div className={styles.vitalData}>
                                        <span className={styles.vitalLabel}>Blood Pressure</span>
                                        <span className={styles.vitalValue}>
                                            {patient.vitals.bp}
                                            <span className={styles.vitalUnit}>mmHg</span>
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.vitalCard}>
                                    <span className={styles.vitalIcon}>{Icon.heart}</span>
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
                                        {patient.history.length === 0 ? (
                                            <div style={{
                                                padding: "var(--space-4)",
                                                textAlign: "center",
                                                color: "var(--color-text-tertiary)",
                                                fontSize: "var(--text-sm)"
                                            }}>
                                                No history from medical records yet
                                            </div>
                                        ) : (
                                            patient.history.map((item, i) => (
                                                <div
                                                    key={i}
                                                    className={`${styles.historyItem} ${item.active ? styles.historyItemActive : ""
                                                        }`}
                                                >
                                                    <span className={styles.historyIcon}>{historyIcon(item.type)}</span>
                                                    <div className={styles.historyMeta}>
                                                        <span className={styles.historyLabel}>{item.label}</span>
                                                        <span className={styles.historyDate}>{item.date}</span>
                                                    </div>
                                                    {item.active && (
                                                        <span className={styles.historyArrow}>{Icon.chevronRight}</span>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div className={styles.xrayArea}>
                                    <h3 className={styles.sectionTitle}>X-Ray Docs</h3>
                                    <div className={styles.xrayImageBox}>{Icon.imageOff}</div>
                                    <p className={styles.xrayCaption}>No X-ray images uploaded</p>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className={styles.actionBar}>
                                <button className={styles.actionBtn}>
                                    {Icon.edit} Add Notes
                                </button>
                                <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
                                    {Icon.filePlus} Add Prescription
                                </button>
                                <button
                                    className={`${styles.actionBtn} ${styles.actionBtnSchedule}`}
                                    onClick={() => { setSchedOpen(o => !o); setSchedDone(false); setSchedError(""); }}
                                >
                                    {Icon.calendar} Schedule Appointment
                                </button>
                            </div>

                            {/* Schedule appointment form */}
                            {schedOpen && (
                                <form className={styles.apptForm} onSubmit={handleScheduleAppointment}>
                                    <h4 className={styles.apptFormTitle}>Next Appointment</h4>
                                    {schedDone && (
                                        <div className={styles.apptSuccess}>
                                            ✓ Appointment scheduled successfully
                                        </div>
                                    )}
                                    {schedError && (
                                        <div className={styles.apptError}>{schedError}</div>
                                    )}
                                    <div className={styles.apptFormRow}>
                                        <div className={styles.apptFormGroup}>
                                            <label className={styles.verifyLabel}>Date *</label>
                                            <input
                                                type="date"
                                                className={`${styles.verifyInput} ${styles.verifyInputNormal}`}
                                                value={schedDate}
                                                min={new Date().toISOString().slice(0, 10)}
                                                onChange={e => setSchedDate(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className={styles.apptFormGroup}>
                                            <label className={styles.verifyLabel}>Time</label>
                                            <input
                                                type="time"
                                                className={`${styles.verifyInput} ${styles.verifyInputNormal}`}
                                                value={schedTime}
                                                onChange={e => setSchedTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.apptFormRow}>
                                        <div className={styles.apptFormGroup}>
                                            <label className={styles.verifyLabel}>Specialty</label>
                                            <input
                                                type="text"
                                                className={styles.verifyInput}
                                                placeholder="e.g. Cardiology"
                                                value={schedSpecialty}
                                                onChange={e => setSchedSpecialty(e.target.value)}
                                            />
                                        </div>
                                        <div className={styles.apptFormGroup}>
                                            <label className={styles.verifyLabel}>Location</label>
                                            <input
                                                type="text"
                                                className={styles.verifyInput}
                                                placeholder="e.g. Room 204"
                                                value={schedLocation}
                                                onChange={e => setSchedLocation(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.apptFormGroup}>
                                        <label className={styles.verifyLabel}>Notes</label>
                                        <input
                                            type="text"
                                            className={styles.verifyInput}
                                            placeholder="Instructions for patient (optional)"
                                            value={schedNotes}
                                            onChange={e => setSchedNotes(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.apptFormActions}>
                                        <button
                                            type="button"
                                            className={styles.actionBtn}
                                            onClick={() => setSchedOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                            disabled={schedSaving || !schedDate}
                                        >
                                            {schedSaving ? "Saving..." : "Confirm Appointment"}
                                        </button>
                                    </div>
                                </form>
                            )}


                        </div>

                        {/* End session — go back to verify next patient */}
                        <button
                            className={`${styles.actionBtn} ${styles.endSessionBtn}`}
                            onClick={handleEndSession}
                        >
                            {Icon.logOut} End Patient Session
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
