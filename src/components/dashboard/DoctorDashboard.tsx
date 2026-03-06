// ============================================================
// Doctor Dashboard — Light-mode UI
// Flow: Empty state → Verify patient (Card ID → DOB → OTP) →
//       View data → End Session → back to verify
// ============================================================

"use client";

import React, { useState, Suspense, lazy } from "react";
import { isValidCardId, normalizeCardSuffix } from "../../lib/utils/cardId";
import type { CheckupEntry } from "../../lib/aws/dynamodb";
import { fmtDate, fmtDateShort } from "../../lib/utils/date";
import { validateHeight, validateWeight, validateBpSys, validateBpDia, validateCommaList, validateMaxLen, firstError } from "../../lib/utils/validate";
import styles from "./DoctorDashboard.module.css";

// Lazy-load the 3D body model to avoid SSR issues with Three.js
const BodyModel3D = lazy(() => import("../body3d/BodyModel3D"));
import type { MedicalRecord } from "../body3d/BodyModel3D";

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
    shieldCheck: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
        </svg>
    ),
    alertCircle: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
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

export interface PatientData {
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
        bpSystolic: string;
        bpDiastolic: string;
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
    allergies: string[];
    criticalMeds: string[];
    checkupHistory: CheckupEntry[];
}

/** Minimal patient context shared with the rest of the app (e.g. AssistantScreen). */
export interface DoctorPatientContext {
    cardId: string;
    name: string;
    age: number;
    gender: string;
    diagnosis: string;
    vitals: { bpSystolic: string; bpDiastolic: string };
    history: { type: string; label: string; date: string }[];
}

type VerifyStep = "card" | "dob" | "otp";

// ---- Doctor Welcome Panel (shown when no patient is verified) ----
function DoctorWelcomePanel({ doctorName }: { doctorName?: string }) {
    const hour = new Date().getHours();
    const greeting =
        hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long" }) + ", " + fmtDate(new Date());

    const tips = [
        "Verify a patient to view their 3D anatomical model and health records.",
        "Use AI Assistant to query a patient's medical history after verification.",
        "Schedule follow-up appointments directly from the patient panel.",
        "Patient sessions are encrypted — data is not stored post-session.",
    ];
    const tip = tips[new Date().getDay() % tips.length];

    return (
        <div className={styles.welcomePanel}>
            {/* Greeting */}
            <div className={styles.welcomeGreeting}>
                <span className={styles.welcomeIcon}>{Icon.stethoscope}</span>
                <div>
                    <h2 className={styles.welcomeTitle}>
                        {greeting}{doctorName ? `, Dr. ${doctorName.split(" ")[0]}` : ""}
                    </h2>
                    <p className={styles.welcomeDate}>{today}</p>
                </div>
            </div>

            {/* Daily tip */}
            <div className={styles.welcomeTip}>
                <span className={styles.welcomeTipIcon}>{Icon.alertCircle}</span>
                <p>{tip}</p>
            </div>
        </div>
    );
}

// ---- Sparkline (inline SVG, no external dependencies) ----
function Sparkline({ values, color = "var(--dd-accent)" }: { values: number[]; color?: string }) {
    if (values.length < 2) return <span className="sparklinePlaceholder">No history yet</span>;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const W = 72, H = 26, pad = 3;
    const points = values
        .map((v, i) => {
            const x = pad + (i / (values.length - 1)) * (W - pad * 2);
            const y = H - pad - ((v - min) / range) * (H - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    const [lastX, lastY] = points.split(" ").at(-1)!.split(",");
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
            <circle cx={lastX} cy={lastY} r="3" fill={color} />
        </svg>
    );
}

interface Props {
    onNavigate: (screen: string) => void;
    doctorName?: string;
    /** Called when a patient session starts (context) or ends (null). */
    onPatientVerified?: (context: DoctorPatientContext | null) => void;
    /** Full patient data persisted across navigations — pass back on remount to restore session. */
    initialPatient?: PatientData | null;
    /** Called whenever patient state changes so the parent can persist it across navigations. */
    onPatientDataChange?: (patient: PatientData | null) => void;
}

export default function DoctorDashboard({ onNavigate, doctorName, onPatientVerified, initialPatient, onPatientDataChange }: Props) {
    // Verification state
    const [verifyStep, setVerifyStep] = useState<VerifyStep>("card");
    const [cardId, setCardId] = useState(""); // stores suffix only: XXXX-XXXX-XXXX
    const fullCardId = `AS-${cardId}`;
    const [dob, setDob] = useState("");
    const [otp, setOtp] = useState("");
    const [verifyError, setVerifyError] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    // Single patient session (null until verified)
    // initialPatient allows session to be restored after navigating away and back
    const [patient, setPatient] = useState<PatientData | null>(initialPatient ?? null);

    // Sync patient state to parent without calling setState during render
    const onPatientDataChangeRef = React.useRef(onPatientDataChange);
    onPatientDataChangeRef.current = onPatientDataChange;
    React.useEffect(() => {
        onPatientDataChangeRef.current?.(patient);
    }, [patient]);

    // ---- Verification handlers ----
    const handleCardSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidCardId(fullCardId)) return;
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
            let patientName = fullCardId;
            let patientAge = 0;
            let patientGender = "Unknown";
            let patientPhone = "";
            let bloodGroup = "—";
            let weight = "—";
            let height = "—";
            let bpSystolic = "";
            let bpDiastolic = "";
            let allergies: string[] = [];
            let criticalMeds: string[] = [];

            try {
                const res = await fetch("/api/patient/lookup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cardId: fullCardId }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.patient) {
                        patientName = data.patient.name || fullCardId;
                        patientAge = data.patient.age || 0;
                        patientGender = data.patient.gender || "Unknown";
                        patientPhone = data.patient.phone || "";
                        bloodGroup = data.patient.bloodGroup || "—";
                        weight = data.patient.weight || "—";
                        height = data.patient.height || "—";
                        bpSystolic = data.patient.bpSystolic || "";
                        bpDiastolic = data.patient.bpDiastolic || "";
                        allergies = data.patient.allergies || [];
                        criticalMeds = data.patient.criticalMeds || [];
                    }
                }
            } catch {
                console.warn("Patient lookup API unavailable — using fallback data");
            }

            // Fetch checkup history (sparklines)
            let checkupHistory: CheckupEntry[] = [];
            try {
                const hr = await fetch(`/api/checkup?patientId=${encodeURIComponent(fullCardId)}&limit=12`);
                if (hr.ok) {
                    const hd = await hr.json();
                    checkupHistory = hd.history || [];
                }
            } catch { /* non-fatal */ }

            // Fetch timeline entries for body map (non-blocking)
            fetch(`/api/timeline/entries?patientId=${encodeURIComponent(fullCardId)}&viewerType=DOCTOR&viewerId=${encodeURIComponent(doctorName ?? "")}&viewerName=${encodeURIComponent(doctorName ?? "")}`)
                .then((r) => r.ok ? r.json() : null)
                .then((data) => {
                    if (!data?.entries) return;
                    const recs: MedicalRecord[] = data.entries.map((e: Record<string, unknown>) => ({
                        entryId:           e.entryId as string,
                        title:             e.title as string,
                        date:              e.date as string,
                        documentType:      e.documentType as string,
                        summary:           (e.metadata as Record<string, unknown>)?.summary as string | undefined,
                        sourceInstitution: e.sourceInstitution as string | undefined,
                        bodyPart:          (e.metadata as Record<string, unknown>)?.bodyPart as string | undefined,
                    }));
                    setTimelineRecords(recs);
                })
                .catch(() => { /* non-fatal */ });

            const verifiedPatient: PatientData = {
                cardId: fullCardId,
                name: patientName,
                age: patientAge,
                gender: patientGender,
                height,
                weight,
                bloodGroup,
                diagnosis: "Refer to medical records",
                vitals: { bpSystolic, bpDiastolic },
                history: [],
                annotations: [],
                allergies,
                criticalMeds,
                checkupHistory,
            };

            setPatient(verifiedPatient);
            onPatientVerified?.({
                cardId: verifiedPatient.cardId,
                name: verifiedPatient.name,
                age: verifiedPatient.age,
                gender: verifiedPatient.gender,
                diagnosis: verifiedPatient.diagnosis,
                vitals: verifiedPatient.vitals,
                history: verifiedPatient.history,
            });
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
        onPatientVerified?.(null);
        setVerifyStep("card");
        setVerifyError("");
        setCardId("");
        setDob("");
        setOtp("");
        setTimelineRecords([]);
        setSelectedBodyPart(null);
        setBodyPartRecords([]);
    };

    // Active annotation for body model
    const activeAnnotation = patient?.annotations?.[0] || null;

    // ---- Body map: timeline records + selected part ----
    const [timelineRecords, setTimelineRecords] = useState<MedicalRecord[]>([]);
    const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
    const [bodyPartRecords, setBodyPartRecords] = useState<MedicalRecord[]>([]);

    // ---- Modal: which one is open ("none" | "appointment" | "note" | "prescription") ----
    type ModalKind = "none" | "appointment" | "note" | "prescription";
    const [modalOpen, setModalOpen] = useState<ModalKind>("none");
    const openModal  = (k: ModalKind) => { setModalOpen(k); setSchedDone(false); setSchedError(""); setNoteError(""); setRxError(""); };
    const closeModal = () => setModalOpen("none");

    // Keep schedOpen as an alias so the existing save handler still works
    const schedOpen = modalOpen === "appointment";
    const setSchedOpen = (v: boolean | ((p: boolean) => boolean)) => {
        const next = typeof v === "function" ? v(schedOpen) : v;
        setModalOpen(next ? "appointment" : "none");
    };

    // ---- Note modal state ----
    const [noteComplaint, setNoteComplaint]     = useState("");
    const [noteFindings, setNoteFindings]       = useState("");
    const [noteDiagnosis, setNoteDiagnosis]     = useState("");
    const [noteTreatment, setNoteTreatment]     = useState("");
    const [noteFollowUp, setNoteFollowUp]       = useState("");
    const [noteAdvice, setNoteAdvice]           = useState("");
    const [noteSaving, setNoteSaving]           = useState(false);
    const [noteDone, setNoteDone]               = useState(false);
    const [noteError, setNoteError]             = useState("");

    const handleSaveNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient) return;
        setNoteSaving(true); setNoteError("");
        try {
            const res = await fetch("/api/timeline/note", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId:           patient.cardId,
                    doctorName:          doctorName || "Doctor",
                    institution:         "",
                    chiefComplaint:      noteComplaint || undefined,
                    examinationFindings: noteFindings  || undefined,
                    diagnosis:           noteDiagnosis || undefined,
                    treatmentPlan:       noteTreatment || undefined,
                    followUpDate:        noteFollowUp  || undefined,
                    advice:              noteAdvice    || undefined,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Failed");
            const saved = await res.json();
            // Append to local timeline so the body map reflects it immediately
            setTimelineRecords(prev => [saved.entry, ...prev]);
            setNoteDone(true);
            setTimeout(() => {
                closeModal();
                setNoteDone(false);
                setNoteComplaint(""); setNoteFindings(""); setNoteDiagnosis("");
                setNoteTreatment(""); setNoteFollowUp(""); setNoteAdvice("");
            }, 1800);
        } catch (err) {
            setNoteError(err instanceof Error ? err.message : "Could not save note.");
        } finally {
            setNoteSaving(false);
        }
    };

    // ---- Prescription modal state ----
    const [rxDiagnosis, setRxDiagnosis]         = useState("");
    const [rxMedications, setRxMedications]     = useState("");
    const [rxInstructions, setRxInstructions]   = useState("");
    const [rxRefills, setRxRefills]             = useState("0");
    const [rxSaving, setRxSaving]               = useState(false);
    const [rxDone, setRxDone]                   = useState(false);
    const [rxError, setRxError]                 = useState("");

    const handleSavePrescription = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient || !rxMedications.trim()) { setRxError("Add at least one medication."); return; }
        setRxSaving(true); setRxError("");
        try {
            const res = await fetch("/api/timeline/prescription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId:     patient.cardId,
                    doctorName:    doctorName || "Doctor",
                    institution:   "",
                    diagnosis:     rxDiagnosis    || undefined,
                    medications:   rxMedications,
                    instructions:  rxInstructions || undefined,
                    refillsAllowed: Number(rxRefills) || 0,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Failed");
            const saved = await res.json();
            setTimelineRecords(prev => [saved.entry, ...prev]);
            setRxDone(true);
            setTimeout(() => {
                closeModal();
                setRxDone(false);
                setRxDiagnosis(""); setRxMedications(""); setRxInstructions(""); setRxRefills("0");
            }, 1800);
        } catch (err) {
            setRxError(err instanceof Error ? err.message : "Could not save prescription.");
        } finally {
            setRxSaving(false);
        }
    };

    // ---- Checkup edit state ----
    const [checkupEditing, setCheckupEditing] = useState(false);
    const [editBpSys, setEditBpSys] = useState("");
    const [editBpDia, setEditBpDia] = useState("");
    const [editHeight, setEditHeight] = useState("");
    const [editWeight, setEditWeight] = useState("");
    const [editAllergies, setEditAllergies] = useState("");
    const [editMeds, setEditMeds] = useState("");
    const [checkupSaving, setCheckupSaving] = useState(false);
    const [checkupSaved, setCheckupSaved] = useState(false);
    const [checkupError, setCheckupError] = useState("");
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
        const err = firstError(
            validateMaxLen(schedSpecialty, "Specialty", 60),
            validateMaxLen(schedLocation, "Location", 100),
            validateMaxLen(schedNotes, "Notes", 300),
        );
        if (err) { setSchedError(err); return; }
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

    // ---- Save checkup (vitals + measurements + allergy/meds) ----
    const handleSaveCheckup = async () => {
        if (!patient) return;
        const err = firstError(
            validateHeight(editHeight),
            validateWeight(editWeight),
            validateBpSys(editBpSys),
            validateBpDia(editBpDia, editBpSys),
            validateCommaList(editAllergies, "Allergies"),
            validateCommaList(editMeds, "Critical Medications"),
        );
        if (err) { setCheckupError(err); return; }
        setCheckupSaving(true);
        setCheckupError("");
        try {
            const toArr = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
            const newAllergies = toArr(editAllergies);
            const newMeds = toArr(editMeds);

            // 1. Persist vitals + measurements to Cognito (via profile update)
            await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: doctorName || "doctor",  // logged-in doctor id
                    role: "doctor",
                    updates: {
                        targetPatientId: patient.cardId,
                        bpSystolic: editBpSys,
                        bpDiastolic: editBpDia,
                        height: editHeight,
                        weight: editWeight,
                        allergies: editAllergies,
                        criticalMeds: editMeds,
                    },
                }),
            });

            // 2. Persist checkup reading to DynamoDB for timeline history
            if (editBpSys && editBpDia) {
                await fetch("/api/checkup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patientId: patient.cardId,
                        bpSystolic: Number(editBpSys),
                        bpDiastolic: Number(editBpDia),
                        height: editHeight || patient.height,
                        weight: editWeight || patient.weight,
                        recordedBy: doctorName || "doctor",
                    }),
                });
            }

            // 3. Update local patient state
            const newEntry = editBpSys && editBpDia ? {
                patientId: patient.cardId,
                checkupId: new Date().toISOString(),
                bpSystolic: Number(editBpSys),
                bpDiastolic: Number(editBpDia),
                height: editHeight || undefined,
                weight: editWeight || undefined,
                recordedBy: doctorName || "doctor",
                recordedAt: new Date().toISOString(),
            } : null;

            setPatient(prev => prev ? {
                ...prev,
                height: editHeight || prev.height,
                weight: editWeight || prev.weight,
                vitals: {
                    bpSystolic: editBpSys || prev.vitals.bpSystolic,
                    bpDiastolic: editBpDia || prev.vitals.bpDiastolic,
                },
                allergies: newAllergies.length > 0 ? newAllergies : prev.allergies,
                criticalMeds: newMeds.length > 0 ? newMeds : prev.criticalMeds,
                checkupHistory: newEntry ? [newEntry, ...prev.checkupHistory] : prev.checkupHistory,
            } : null);

            setCheckupSaved(true);
            setTimeout(() => { setCheckupSaved(false); setCheckupEditing(false); }, 1500);
        } catch {
            setCheckupError("Could not save. Please try again.");
        } finally {
            setCheckupSaving(false);
        }
    };

    return (
        <div className={`${styles.doctorDashboard}${!patient ? " " + styles.noPatientDash : ""}`}>
            {!patient ? (
                /* ---- No-patient: single centered onboarding card ---- */
                <div className={styles.landingCard}>
                    {/* Greeting header */}
                    <div className={styles.landingHeader}>
                        <span className={styles.landingHeaderIcon}>{Icon.stethoscope}</span>
                        <div>
                            <h1 className={styles.landingTitle}>
                                {(() => {
                                    const hour = new Date().getHours();
                                    const g = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
                                    return `${g}${doctorName ? `, Dr. ${doctorName.split(" ")[0]}` : ""}`;
                                })()}
                            </h1>
                            <p className={styles.landingSubtitle}>
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </p>
                        </div>
                    </div>

                    <div className={styles.landingDivider} />

                    {/* Verify form */}
                    <div className={styles.landingVerify}>
                        <h2 className={styles.landingVerifyTitle}>Verify Patient</h2>
                        <p className={styles.landingVerifySubtitle}>Enter patient credentials to begin the session</p>

                        {/* Steps */}
                        <div className={styles.verifySteps}>
                            <div className={`${styles.verifyStep} ${verifyStep === "card" || verifyStep === "dob" || verifyStep === "otp" ? styles.verifyStepActive : ""}`}>
                                <span className={styles.verifyStepNum}>1</span>
                                <span className={styles.verifyStepLabel}>Card ID</span>
                            </div>
                            <div className={styles.verifyStepLine} />
                            <div className={`${styles.verifyStep} ${verifyStep === "dob" || verifyStep === "otp" ? styles.verifyStepActive : ""}`}>
                                <span className={styles.verifyStepNum}>2</span>
                                <span className={styles.verifyStepLabel}>DOB</span>
                            </div>
                            <div className={styles.verifyStepLine} />
                            <div className={`${styles.verifyStep} ${verifyStep === "otp" ? styles.verifyStepActive : ""}`}>
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

                        {verifyStep === "card" && (
                            <form onSubmit={handleCardSubmit} className={styles.verifyForm}>
                                <div>
                                    <label className={styles.verifyLabel}>Patient Card ID</label>
                                    <div className={styles.cardInputWrap}>
                                        <span className={styles.cardPrefix}>AS-</span>
                                        <input type="text" className={styles.cardSuffixInput} placeholder="XXXX-XXXX-XXXX"
                                            value={cardId} onChange={(e) => setCardId(normalizeCardSuffix(e.target.value))}
                                            maxLength={17} autoFocus />
                                    </div>
                                </div>
                                <p className={styles.verifyHint}>Enter the Card ID from the patient&apos;s ArogyaSutra card</p>
                                <button type="submit" className={styles.verifyBtn} disabled={!isValidCardId(fullCardId)}>Continue</button>
                            </form>
                        )}
                        {verifyStep === "dob" && (
                            <form onSubmit={handleDobSubmit} className={styles.verifyForm}>
                                <div>
                                    <label className={styles.verifyLabel}>Patient Date of Birth</label>
                                    <input type="date" className={`${styles.verifyInput} ${styles.verifyInputNormal}`}
                                        value={dob} onChange={(e) => setDob(e.target.value)} autoFocus />
                                </div>
                                <button type="submit" className={styles.verifyBtn} disabled={!dob}>Verify &amp; Send OTP</button>
                            </form>
                        )}
                        {verifyStep === "otp" && (
                            <form onSubmit={handleOtpSubmit} className={styles.verifyForm}>
                                <div>
                                    <label className={styles.verifyLabel}>Patient OTP</label>
                                    <p className={styles.verifyHint} style={{ marginBottom: 8 }}>OTP sent to patient&apos;s registered mobile</p>
                                    {DEV_OTP && <p className={styles.devOtpHint}>Dev OTP: {DEV_OTP}</p>}
                                    <div className={styles.otpRow}>
                                        {[0, 1, 2, 3, 4, 5].map((i) => (
                                            <input key={i} type="text" className={styles.otpDigit} maxLength={1}
                                                value={otp[i] || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, "");
                                                    const arr = otp.split(""); arr[i] = val; setOtp(arr.join(""));
                                                    if (val && e.target.nextElementSibling) (e.target.nextElementSibling as HTMLInputElement).focus();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Backspace" && !otp[i] && e.currentTarget.previousElementSibling)
                                                        (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
                                                }}
                                                autoFocus={i === 0} />
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" className={styles.verifyBtn} disabled={isVerifying || otp.length !== 6}>
                                    {isVerifying ? "Verifying..." : "Verify Patient"}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            ) : (
                /* ---- Patient verified: two-column layout ---- */
                <>
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
                                records={timelineRecords}
                                selectedPart={selectedBodyPart}
                                onPartClick={(part, recs) => {
                                    setSelectedBodyPart(part);
                                    setBodyPartRecords(recs);
                                }}
                            />
                        </Suspense>
                    ) : (
                        <DoctorWelcomePanel doctorName={doctorName} />
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

                    {/* Body part records drawer — slides up when a zone is clicked */}
                    {selectedBodyPart && (
                        <div className={styles.bodyPartPanel}>
                            <div className={styles.bodyPartPanelHeader}>
                                <span className={styles.bodyPartPanelTitle}>
                                    {selectedBodyPart}
                                    {bodyPartRecords.length > 0 && (
                                        <span className={styles.bodyPartPanelCount}>{bodyPartRecords.length}</span>
                                    )}
                                </span>
                                <button
                                    className={styles.bodyPartPanelClose}
                                    onClick={() => { setSelectedBodyPart(null); setBodyPartRecords([]); }}
                                    aria-label="Close"
                                >✕</button>
                            </div>
                            {bodyPartRecords.length === 0 ? (
                                <p className={styles.bodyPartEmpty}>No records found for {selectedBodyPart}.</p>
                            ) : (
                                <div className={styles.bodyPartRecordList}>
                                    {bodyPartRecords.map((r) => (
                                        <div key={r.entryId} className={styles.bodyPartRecord}>
                                            <span className={styles.bodyPartDocBadge}>{r.documentType}</span>
                                            <div className={styles.bodyPartRecordInfo}>
                                                <span className={styles.bodyPartRecordTitle}>{r.title}</span>
                                                <span className={styles.bodyPartRecordMeta}>
                                                    {r.date}{r.sourceInstitution ? ` · ${r.sourceInstitution}` : ""}
                                                </span>
                                                {r.summary && (
                                                    <span className={styles.bodyPartRecordSummary}>{r.summary}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ---- Right Column ---- */}
            <div className={styles.rightColumn}>
                    {/* ---- Patient Data Panel ---- */}
                    <>
                        <div className={styles.patientPanel}>
                            <div className={styles.patientPanelHeader}>
                                <h2>Patient Info</h2>
                                <button
                                    className={`${styles.checkupEditBtn} ${checkupEditing ? styles.checkupEditBtnActive : ""}`}
                                    onClick={() => {
                                        if (checkupEditing) {
                                            setCheckupEditing(false);
                                        } else {
                                            setEditBpSys(patient.vitals.bpSystolic);
                                            setEditBpDia(patient.vitals.bpDiastolic);
                                            setEditHeight(patient.height === "—" ? "" : patient.height);
                                            setEditWeight(patient.weight === "—" ? "" : patient.weight);
                                            setEditAllergies(patient.allergies.join(", "));
                                            setEditMeds(patient.criticalMeds.join(", "));
                                            setCheckupError("");
                                            setCheckupEditing(true);
                                        }
                                    }}
                                    title={checkupEditing ? "Cancel" : "Update checkup readings"}
                                >
                                    {checkupEditing ? Icon.chevronRight : Icon.edit}
                                    <span>{checkupEditing ? "Cancel" : "Update Checkup"}</span>
                                </button>
                            </div>

                            {/* Patient identity header */}
                            <div className={styles.patientIdentityRow}>
                                <div className={styles.patientIdentityMain}>
                                    <span className={styles.patientIdentityName}>{patient.name}</span>
                                    <span className={styles.patientIdentityCard}>{patient.cardId}</span>
                                </div>
                                <span className={styles.patientIdentityMeta}>
                                    {patient.gender}{patient.age > 0 ? `, ${patient.age} yrs` : ""}
                                    {patient.phone ? ` · ${patient.phone}` : ""}
                                </span>
                            </div>

                            {/* Stats bar: height / weight / blood group */}
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
                                    Last updated {fmtDateShort(new Date())}
                                </div>
                            </div>

                            {/* Checkup: Edit Form or Vital Cards */}
                            {checkupEditing ? (
                                <div className={styles.checkupForm}>
                                    <div className={styles.checkupFormGrid}>
                                        <div className={styles.checkupField}>
                                            <label className={styles.checkupFieldLabel}>Height (cm)</label>
                                            <input className={styles.checkupInput} type="text" placeholder="e.g. 170"
                                                value={editHeight} onChange={e => setEditHeight(e.target.value)} />
                                        </div>
                                        <div className={styles.checkupField}>
                                            <label className={styles.checkupFieldLabel}>Weight (kg)</label>
                                            <input className={styles.checkupInput} type="text" placeholder="e.g. 68"
                                                value={editWeight} onChange={e => setEditWeight(e.target.value)} />
                                        </div>
                                        <div className={styles.checkupField}>
                                            <label className={styles.checkupFieldLabel}>BP Systolic</label>
                                            <input className={styles.checkupInput} type="number" placeholder="e.g. 120" min={50} max={300}
                                                value={editBpSys} onChange={e => setEditBpSys(e.target.value)} />
                                        </div>
                                        <div className={styles.checkupField}>
                                            <label className={styles.checkupFieldLabel}>BP Diastolic</label>
                                            <input className={styles.checkupInput} type="number" placeholder="e.g. 80" min={30} max={200}
                                                value={editBpDia} onChange={e => setEditBpDia(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className={styles.checkupAllergyRow}>
                                        <div className={styles.checkupAllergyField}>
                                            <label className={styles.checkupFieldLabel}>Allergies <span className={styles.checkupFieldHint}>(comma-separated)</span></label>
                                            <textarea className={styles.checkupTextarea} rows={3} maxLength={500}
                                                placeholder="e.g. Penicillin, Aspirin"
                                                value={editAllergies} onChange={e => setEditAllergies(e.target.value)} />
                                        </div>
                                        <div className={styles.checkupAllergyField}>
                                            <label className={styles.checkupFieldLabel}>Critical Medications <span className={styles.checkupFieldHint}>(comma-separated)</span></label>
                                            <textarea className={styles.checkupTextarea} rows={3} maxLength={500}
                                                placeholder="e.g. Metformin 500mg"
                                                value={editMeds} onChange={e => setEditMeds(e.target.value)} />
                                        </div>
                                    </div>
                                    {checkupError && <p className={styles.checkupError}>{checkupError}</p>}
                                    <button
                                        className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${styles.checkupSaveBtn}`}
                                        onClick={handleSaveCheckup}
                                        disabled={checkupSaving}
                                    >
                                        {checkupSaving ? "Saving…" : checkupSaved ? "✓ Saved" : <>{Icon.filePlus} Save Checkup</>}
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.vitalsRow}>
                                    <div className={styles.vitalCard}>
                                        <div className={styles.vitalCardTop}>
                                            <span className={styles.vitalIcon}>{Icon.activity}</span>
                                            <div className={styles.vitalData}>
                                                <span className={styles.vitalLabel}>Blood Pressure</span>
                                                <span className={styles.vitalValue}>
                                                    {patient.vitals.bpSystolic && patient.vitals.bpDiastolic
                                                        ? `${patient.vitals.bpSystolic}/${patient.vitals.bpDiastolic}`
                                                        : "—"}
                                                    {patient.vitals.bpSystolic && <span className={styles.vitalUnit}>mmHg</span>}
                                                </span>
                                            </div>
                                        </div>
                                        <Sparkline
                                            values={[...patient.checkupHistory].reverse().map(c => c.bpSystolic).filter(Boolean)}
                                            color="var(--dd-accent)"
                                        />
                                    </div>

                                </div>
                            )}

                            {/* Allergies & Medications */}
                            <div className={styles.allergyMedGrid}>
                                <div className={styles.allergyMedSection}>
                                    <span className={styles.allergyMedLabel}>Allergies</span>
                                    {patient.allergies.length > 0 ? (
                                        <div className={styles.allergyTagList}>
                                            {patient.allergies.map((a, i) => (
                                                <span key={i} className={styles.tagAllergy}>{a}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className={styles.allergyMedEmpty}>None recorded</span>
                                    )}
                                </div>
                                <div className={styles.allergyMedSection}>
                                    <span className={styles.allergyMedLabel}>Critical Medications</span>
                                    {patient.criticalMeds.length > 0 ? (
                                        <div className={styles.allergyTagList}>
                                            {patient.criticalMeds.map((m, i) => (
                                                <span key={i} className={styles.tagMed}>{m}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className={styles.allergyMedEmpty}>None recorded</span>
                                    )}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className={styles.actionBar}>
                                <button className={styles.actionBtn} onClick={() => openModal("note")}>
                                    {Icon.edit} Add Notes
                                </button>
                                <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => openModal("prescription")}>
                                    {Icon.filePlus} Add Prescription
                                </button>
                                <button
                                    className={`${styles.actionBtn} ${styles.actionBtnSchedule}`}
                                    onClick={() => openModal("appointment")}
                                >
                                    {Icon.calendar} Schedule Appointment
                                </button>
                            </div>

                            {/* ---- Recent Records (timeline entries) ---- */}
                            <div className={styles.recentRecords}>
                                <div className={styles.recentRecordsHeader}>
                                    <span className={styles.recentRecordsTitle}>Recent Records</span>
                                    {timelineRecords.length > 0 && (
                                        <span className={styles.recentRecordsBadge}>{timelineRecords.length}</span>
                                    )}
                                </div>
                                {timelineRecords.length === 0 ? (
                                    <p className={styles.recentRecordsEmpty}>No records on file.</p>
                                ) : (
                                    <div className={styles.recentRecordsList}>
                                        {timelineRecords.slice(0, 8).map((r) => {
                                            const typeColor: Record<string, string> = {
                                                RX:       "#a78bfa",
                                                Consult:  "#60a5fa",
                                                Imaging:  "#34d399",
                                                Lab:      "#fbbf24",
                                                H:        "#f87171",
                                                Vacc:     "#fb923c",
                                                Other:    "#94a3b8",
                                            };
                                            const color = typeColor[r.documentType] ?? "#94a3b8";
                                            return (
                                                <div key={r.entryId} className={styles.recentRecord}>
                                                    <span
                                                        className={styles.recentRecordType}
                                                        style={{ background: `${color}22`, color }}
                                                    >{r.documentType}</span>
                                                    <div className={styles.recentRecordInfo}>
                                                        <span className={styles.recentRecordTitle}>{r.title}</span>
                                                        <span className={styles.recentRecordMeta}>
                                                            {r.date}
                                                            {r.sourceInstitution ? ` · ${r.sourceInstitution}` : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {timelineRecords.length > 8 && (
                                            <p className={styles.recentRecordsMore}>
                                                +{timelineRecords.length - 8} more — see 3D map for details
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>


                        </div>

                        {/* End session — go back to verify next patient */}
                        <button
                            className={`${styles.actionBtn} ${styles.endSessionBtn}`}
                            onClick={handleEndSession}
                        >
                            {Icon.logOut} End Patient Session
                        </button>
                    </>
            </div>
            </>
            )}

            {/* ================================================================
                MODALS — rendered at component root so they sit above all layout
                ================================================================ */}

            {/* ---- Schedule Appointment Modal ---- */}
            {modalOpen === "appointment" && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>{Icon.calendar} Schedule Appointment</span>
                            <button className={styles.modalClose} onClick={closeModal} aria-label="Close">✕</button>
                        </div>
                        {schedDone ? (
                            <div className={styles.modalSuccess}>✓ Appointment scheduled successfully</div>
                        ) : (
                            <form onSubmit={handleScheduleAppointment} className={styles.modalBody}>
                                {schedError && <div className={styles.modalError}>{schedError}</div>}
                                <div className={styles.modalRow}>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Date *</label>
                                        <input type="date" className={styles.modalInput}
                                            value={schedDate} min={new Date().toISOString().slice(0, 10)}
                                            onChange={e => setSchedDate(e.target.value)} required />
                                    </div>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Time</label>
                                        <input type="time" className={styles.modalInput}
                                            value={schedTime} onChange={e => setSchedTime(e.target.value)} />
                                    </div>
                                </div>
                                <div className={styles.modalRow}>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Specialty</label>
                                        <input type="text" className={styles.modalInput}
                                            placeholder="e.g. Cardiology" maxLength={60}
                                            value={schedSpecialty} onChange={e => setSchedSpecialty(e.target.value)} />
                                    </div>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Location / Room</label>
                                        <input type="text" className={styles.modalInput}
                                            placeholder="e.g. Room 204, Apollo" maxLength={100}
                                            value={schedLocation} onChange={e => setSchedLocation(e.target.value)} />
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label className={styles.modalLabel}>Instructions for patient</label>
                                    <textarea className={styles.modalTextarea} rows={3} maxLength={300}
                                        placeholder="Fast 8 hours before the visit, bring previous reports…"
                                        value={schedNotes} onChange={e => setSchedNotes(e.target.value)} />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.actionBtn} onClick={closeModal}>Cancel</button>
                                    <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                        disabled={schedSaving || !schedDate}>
                                        {schedSaving ? "Saving…" : "Confirm Appointment"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ---- Add Consultation Note Modal ---- */}
            {modalOpen === "note" && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>{Icon.edit} Consultation Note</span>
                            <button className={styles.modalClose} onClick={closeModal} aria-label="Close">✕</button>
                        </div>
                        {noteDone ? (
                            <div className={styles.modalSuccess}>✓ Note saved to patient timeline</div>
                        ) : (
                            <form onSubmit={handleSaveNote} className={styles.modalBody}>
                                {noteError && <div className={styles.modalError}>{noteError}</div>}
                                <div className={styles.modalField}>
                                    <label className={styles.modalLabel}>Chief Complaint</label>
                                    <input type="text" className={styles.modalInput} maxLength={200}
                                        placeholder="Patient's presenting complaint"
                                        value={noteComplaint} onChange={e => setNoteComplaint(e.target.value)} />
                                </div>
                                <div className={styles.modalField}>
                                    <label className={styles.modalLabel}>Examination Findings</label>
                                    <textarea className={styles.modalTextarea} rows={3} maxLength={1000}
                                        placeholder="Physical examination observations…"
                                        value={noteFindings} onChange={e => setNoteFindings(e.target.value)} />
                                </div>
                                <div className={styles.modalRow}>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Diagnosis</label>
                                        <input type="text" className={styles.modalInput} maxLength={200}
                                            placeholder="e.g. Acute bronchitis"
                                            value={noteDiagnosis} onChange={e => setNoteDiagnosis(e.target.value)} />
                                    </div>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Follow-up Date</label>
                                        <input type="date" className={styles.modalInput}
                                            value={noteFollowUp} onChange={e => setNoteFollowUp(e.target.value)} />
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label className={styles.modalLabel}>Treatment Plan</label>
                                    <textarea className={styles.modalTextarea} rows={2} maxLength={500}
                                        placeholder="Medications, procedures, referrals…"
                                        value={noteTreatment} onChange={e => setNoteTreatment(e.target.value)} />
                                </div>
                                <div className={styles.modalField}>
                                    <label className={styles.modalLabel}>Advice to Patient</label>
                                    <input type="text" className={styles.modalInput} maxLength={300}
                                        placeholder="Rest, hydration, diet instructions…"
                                        value={noteAdvice} onChange={e => setNoteAdvice(e.target.value)} />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.actionBtn} onClick={closeModal}>Cancel</button>
                                    <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                        disabled={noteSaving}>
                                        {noteSaving ? "Saving…" : "Save Note"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ---- Add Prescription Modal ---- */}
            {modalOpen === "prescription" && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>{Icon.filePlus} New Prescription</span>
                            <button className={styles.modalClose} onClick={closeModal} aria-label="Close">✕</button>
                        </div>
                        {rxDone ? (
                            <div className={styles.modalSuccess}>✓ Prescription saved to patient timeline</div>
                        ) : (
                            <form onSubmit={handleSavePrescription} className={styles.modalBody}>
                                {rxError && <div className={styles.modalError}>{rxError}</div>}
                                <div className={styles.modalRow}>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Diagnosis</label>
                                        <input type="text" className={styles.modalInput} maxLength={200}
                                            placeholder="e.g. Type 2 Diabetes"
                                            value={rxDiagnosis} onChange={e => setRxDiagnosis(e.target.value)} />
                                    </div>
                                    <div className={styles.modalField}>
                                        <label className={styles.modalLabel}>Refills Allowed</label>
                                        <input type="number" className={styles.modalInput} min={0} max={12}
                                            value={rxRefills} onChange={e => setRxRefills(e.target.value)} />
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label className={styles.modalLabel}>Medications * <span className={styles.modalHint}>(one per line: name + dosage + frequency)</span></label>
                                    <textarea className={styles.modalTextarea} rows={5} maxLength={1000} required
                                        placeholder={"Tab. Metformin 500mg — twice daily after meals\nCap. Vitamin D3 60000 IU — once weekly"}
                                        value={rxMedications} onChange={e => setRxMedications(e.target.value)} />
                                </div>
                                <div className={styles.modalField}>
                                    <label className={styles.modalLabel}>Special Instructions</label>
                                    <textarea className={styles.modalTextarea} rows={2} maxLength={400}
                                        placeholder="Avoid alcohol, take with food, store below 25°C…"
                                        value={rxInstructions} onChange={e => setRxInstructions(e.target.value)} />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.actionBtn} onClick={closeModal}>Cancel</button>
                                    <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                        disabled={rxSaving || !rxMedications.trim()}>
                                        {rxSaving ? "Saving…" : "Save Prescription"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
