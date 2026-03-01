// ============================================================
// ScanModal — Inline document capture + AI extraction + review
// Triggered from Dashboard FAB / Timeline FAB — no separate screen
// ============================================================

"use client";

import React, { useState, useRef, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import styles from "./ScanModal.module.css";
import {
    Camera, FolderOpen, X, RefreshCw, Check, ChevronDown,
    Pill, FlaskConical, Building2, Stethoscope, Camera as ImagingIcon,
    FileCheck2, FileText, Loader2,
} from "lucide-react";
import type { DocumentTypeTag } from "../../lib/types/timeline";

// ---- Types -------------------------------------------------------

interface ExtractionResult {
    documentType: DocumentTypeTag;
    confidence: number;
    title: string;
    metadata: {
        medications: string[];
        diagnoses: string[];
        labTests: string[];
        doctors: string[];
        institutions: string[];
        dates: string[];
    };
}

interface ScanModalProps {
    onClose: () => void;
    onSaved: () => void; // callback to refresh timeline after save
}

// ---- Doc type picker data ----------------------------------------

const DOC_TYPE_OPTIONS: { value: DocumentTypeTag; label: string; icon: React.ReactNode }[] = [
    { value: "RX", label: "Prescription", icon: <Pill size={14} /> },
    { value: "Lab", label: "Lab Report", icon: <FlaskConical size={14} /> },
    { value: "H", label: "Hospital", icon: <Building2 size={14} /> },
    { value: "Consult", label: "Consultation", icon: <Stethoscope size={14} /> },
    { value: "Imaging", label: "Imaging", icon: <ImagingIcon size={14} /> },
    { value: "Insurance", label: "Insurance", icon: <FileCheck2 size={14} /> },
    { value: "Other", label: "Other", icon: <FileText size={14} /> },
];

type Step = "capture" | "extracting" | "review" | "saving" | "done";

// ---- Component ---------------------------------------------------

export default function ScanModal({ onClose, onSaved }: ScanModalProps) {
    const { patient } = useAuth();

    const [step, setStep] = useState<Step>("capture");
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Review form state
    const [title, setTitle] = useState("");
    const [docType, setDocType] = useState<DocumentTypeTag>("Other");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [s3Key, setS3Key] = useState("");
    const [typePickerOpen, setTypePickerOpen] = useState(false);

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (f: File) => {
        setError(null);
        setFile(f);
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(f);

        // Upload + extract
        setStep("extracting");
        try {
            const form = new FormData();
            form.append("file", f);
            form.append("patientId", patient?.patientId ?? "");

            const res = await fetch("/api/upload", { method: "POST", body: form });
            // Read as text first — avoids JSON parse crash if server returns HTML error page
            const text = await res.text();
            let body: Record<string, unknown>;
            try { body = JSON.parse(text); }
            catch { throw new Error(`Server error (${res.status})`); }

            if (!res.ok) throw new Error((body.error as string) ?? "Extraction failed");

            const ext = body.extraction as ExtractionResult;
            setExtraction(ext);
            setDocType(ext.documentType);
            setTitle(ext.title);
            // Pre-fill date from extracted dates if available
            if (ext.metadata.dates?.[0]) {
                // Try to parse DD/MM/YYYY or similar
                const d = ext.metadata.dates[0];
                const isoMatch = d.match(/(\d{4})[\-\/](\d{2})[\-\/](\d{2})/);
                const ddmmMatch = d.match(/(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/);
                if (isoMatch) setDate(d.slice(0, 10));
                else if (ddmmMatch) setDate(`${ddmmMatch[3]}-${ddmmMatch[2]}-${ddmmMatch[1]}`);
            }
            // Store s3Key for saving
            setS3Key((body.s3Key as string) ?? "");
            setStep("review");
        } catch (err) {
            setError((err as Error).message);
            setStep("capture");
        }
    }, [patient]);

    const handleSave = async () => {
        if (!extraction || !patient) return;
        setStep("saving");
        setError(null);
        try {
            const res = await fetch("/api/timeline/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patient.patientId,
                    title: title.trim(),
                    documentType: docType,
                    date,
                    s3Key,
                    confidence: extraction.confidence,
                    metadata: extraction.metadata,
                }),
            });
            const text = await res.text();
            let body: Record<string, unknown>;
            try { body = JSON.parse(text); } catch { throw new Error(`Save failed (${res.status})`); }
            if (!res.ok) throw new Error((body.error as string) ?? "Failed to save");

            setStep("done");
            setTimeout(() => { onSaved(); onClose(); }, 1200);
        } catch (err) {
            setError((err as Error).message);
            setStep("review");
        }
    };

    const selectedType = DOC_TYPE_OPTIONS.find((t) => t.value === docType);

    const confidenceColor =
        (extraction?.confidence ?? 0) >= 80
            ? "var(--color-accent)"
            : (extraction?.confidence ?? 0) >= 60
                ? "var(--color-warning)"
                : "var(--color-error, #ef4444)";

    return (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>
                {/* ---- Header ---- */}
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {step === "capture" && "Scan Document"}
                        {step === "extracting" && "Analysing…"}
                        {step === "review" && "Review & Confirm"}
                        {step === "saving" && "Saving…"}
                        {step === "done" && "Saved!"}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* ---- Step: Capture ---- */}
                {step === "capture" && (
                    <div className={styles.captureStep}>
                        {error && <div className={styles.errorBanner}>{error}</div>}

                        <div className={styles.captureOptions}>
                            <button
                                className={styles.captureBtn}
                                onClick={() => cameraInputRef.current?.click()}
                            >
                                <div className={styles.captureBtnIcon}>
                                    <Camera size={28} />
                                </div>
                                <span className={styles.captureBtnLabel}>Open Camera</span>
                                <span className={styles.captureBtnHint}>Take a photo</span>
                            </button>

                            <div className={styles.captureDivider}>or</div>

                            <button
                                className={styles.captureBtn}
                                onClick={() => galleryInputRef.current?.click()}
                            >
                                <div className={styles.captureBtnIcon}>
                                    <FolderOpen size={28} />
                                </div>
                                <span className={styles.captureBtnLabel}>Choose File</span>
                                <span className={styles.captureBtnHint}>Gallery or storage</span>
                            </button>
                        </div>

                        <p className={styles.captureHint}>
                            Supports JPEG · PNG · WebP · Max 10 MB
                        </p>

                        {/* Hidden inputs */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: "none" }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                        />
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                        />
                    </div>
                )}

                {/* ---- Step: Extracting ---- */}
                {step === "extracting" && (
                    <div className={styles.extractingStep}>
                        {preview && (
                            <img src={preview} alt="Document preview" className={styles.previewImg} />
                        )}
                        <div className={styles.extractingStatus}>
                            <Loader2 size={24} className={styles.spinner} />
                            <span>Running AI analysis…</span>
                        </div>
                        <div className={styles.extractingSteps}>
                            <span className={styles.extractStep}>✓ Uploading image</span>
                            <span className={styles.extractStep}>⟳ Extracting text (Textract)</span>
                            <span className={styles.extractStepPending}>◌ Detecting medical entities</span>
                            <span className={styles.extractStepPending}>◌ Classifying document</span>
                        </div>
                    </div>
                )}

                {/* ---- Step: Review ---- */}
                {step === "review" && extraction && (
                    <div className={styles.reviewStep}>
                        <div className={styles.reviewLayout}>
                            {/* Preview thumbnail */}
                            {preview && (
                                <img src={preview} alt="Document preview" className={styles.reviewThumb} />
                            )}

                            {/* AI Result badge */}
                            <div className={styles.aiResult}>
                                <span className={styles.aiLabel}>AI Detected</span>
                                <span className={styles.aiType}>{selectedType?.icon} {selectedType?.label}</span>
                                <span
                                    className={styles.aiConfidence}
                                    style={{ color: confidenceColor }}
                                >
                                    {extraction.confidence}% confidence
                                </span>
                            </div>
                        </div>

                        {/* Editable fields */}
                        <div className={styles.form}>
                            <div className={styles.formField}>
                                <label className={styles.label}>Document Title</label>
                                <input
                                    className={styles.input}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Blood Test – CBC"
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label className={styles.label}>Category</label>
                                    <div className={styles.selectWrapper}>
                                        <button
                                            className={styles.selectBtn}
                                            onClick={() => setTypePickerOpen((v) => !v)}
                                        >
                                            {selectedType?.icon}
                                            <span>{selectedType?.label}</span>
                                            <ChevronDown size={14} />
                                        </button>
                                        {typePickerOpen && (
                                            <div className={styles.dropdown}>
                                                {DOC_TYPE_OPTIONS.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        className={`${styles.dropdownItem} ${docType === opt.value ? styles.dropdownItemActive : ""}`}
                                                        onClick={() => { setDocType(opt.value); setTypePickerOpen(false); }}
                                                    >
                                                        {opt.icon} {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.formField}>
                                    <label className={styles.label}>Date</label>
                                    <input
                                        type="date"
                                        className={styles.input}
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Extracted entities summary */}
                            {(extraction.metadata.medications.length > 0 ||
                                extraction.metadata.diagnoses.length > 0 ||
                                extraction.metadata.doctors.length > 0) && (
                                    <div className={styles.entitySummary}>
                                        {extraction.metadata.medications.length > 0 && (
                                            <div className={styles.entityGroup}>
                                                <span className={styles.entityGroupLabel}>Medications</span>
                                                <div className={styles.entityChips}>
                                                    {extraction.metadata.medications.slice(0, 4).map((m) => (
                                                        <span key={m} className={styles.chip}>{m}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {extraction.metadata.diagnoses.length > 0 && (
                                            <div className={styles.entityGroup}>
                                                <span className={styles.entityGroupLabel}>Conditions</span>
                                                <div className={styles.entityChips}>
                                                    {extraction.metadata.diagnoses.slice(0, 3).map((d) => (
                                                        <span key={d} className={styles.chip}>{d}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {extraction.metadata.doctors.length > 0 && (
                                            <div className={styles.entityGroup}>
                                                <span className={styles.entityGroupLabel}>Doctor</span>
                                                <div className={styles.entityChips}>
                                                    {extraction.metadata.doctors.slice(0, 2).map((d) => (
                                                        <span key={d} className={styles.chip}>Dr. {d}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                        </div>

                        {error && <div className={styles.errorBanner}>{error}</div>}

                        <div className={styles.reviewActions}>
                            <button
                                className={styles.retryBtn}
                                onClick={() => { setStep("capture"); setPreview(null); setFile(null); setExtraction(null); }}
                            >
                                <RefreshCw size={14} /> Retake
                            </button>
                            <button
                                className={styles.saveBtn}
                                onClick={handleSave}
                                disabled={!title.trim()}
                            >
                                <Check size={16} /> Save to Timeline
                            </button>
                        </div>
                    </div>
                )}

                {/* ---- Step: Saving / Done ---- */}
                {(step === "saving" || step === "done") && (
                    <div className={styles.savingStep}>
                        {step === "saving" ? (
                            <>
                                <Loader2 size={32} className={styles.spinner} />
                                <p>Saving to your timeline…</p>
                            </>
                        ) : (
                            <>
                                <div className={styles.doneIcon}><Check size={32} /></div>
                                <p>Record saved successfully!</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
