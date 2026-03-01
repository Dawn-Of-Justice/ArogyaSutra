"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import styles from "./EntryDetailModal.module.css";
import {
    X, Calendar, Building2, Stethoscope, Pill, FlaskConical,
    FileCheck2, FileText, Camera, ClipboardList, Pencil, Trash2,
    Check, Loader2, ChevronDown,
} from "lucide-react";
import type { HealthEntry, DocumentTypeTag } from "../../lib/types/timeline";
import DocThumbnail from "../scan/DocThumbnail";
import ZoomableImage from "../scan/ZoomableImage";

interface EntryDetailModalProps {
    entry: HealthEntry;
    onClose: () => void;
    onDeleted: () => void;
    onUpdated: (updated: Partial<HealthEntry>) => void;
}

const TYPE_OPTIONS: { value: DocumentTypeTag; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "RX", label: "Prescription", icon: <Pill size={14} />, color: "#10b981" },
    { value: "Lab", label: "Lab Report", icon: <FlaskConical size={14} />, color: "#6366f1" },
    { value: "H", label: "Hospital", icon: <Building2 size={14} />, color: "#ef4444" },
    { value: "Consult", label: "Consultation", icon: <Stethoscope size={14} />, color: "#f59e0b" },
    { value: "Imaging", label: "Imaging", icon: <Camera size={14} />, color: "#8b5cf6" },
    { value: "Insurance", label: "Insurance", icon: <FileCheck2 size={14} />, color: "#0ea5e9" },
    { value: "Other", label: "Document", icon: <FileText size={14} />, color: "#94a3b8" },
];

export default function EntryDetailModal({ entry, onClose, onDeleted, onUpdated }: EntryDetailModalProps) {
    const { patient } = useAuth();
    const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imgUrl, setImgUrl] = useState<string | null>(null);

    // Fetch presigned URL once for the zoomable viewer
    useEffect(() => {
        if (!entry.encryptedBlobKey) return;
        fetch(`/api/timeline/document-url?s3Key=${encodeURIComponent(entry.encryptedBlobKey)}`)
            .then(r => r.json())
            .then(d => { if (d.url) setImgUrl(d.url); })
            .catch(() => { });
    }, [entry.encryptedBlobKey]);

    // Edit form state
    const [editTitle, setEditTitle] = useState(entry.title);
    const [editType, setEditType] = useState<DocumentTypeTag>(entry.documentType);
    const [editDate, setEditDate] = useState(entry.date?.slice(0, 10) ?? "");
    const [typePickerOpen, setTypePickerOpen] = useState(false);

    const typeInfo = TYPE_OPTIONS.find(t => t.value === (mode === "edit" ? editType : entry.documentType)) ?? TYPE_OPTIONS[6];

    const formattedDate = (() => {
        try { return new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
        catch { return entry.date; }
    })();

    const meta = entry.metadata ?? {};

    // ---- handlers ----

    const handleSaveEdit = async () => {
        if (!patient) return;
        setSaving(true); setError(null);
        try {
            const res = await fetch("/api/timeline/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patient.patientId,
                    entryId: entry.entryId,
                    title: editTitle.trim(),
                    documentType: editType,
                    date: editDate,
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Update failed"); }
            onUpdated({ title: editTitle.trim(), documentType: editType, date: editDate });
            setMode("view");
        } catch (e) { setError((e as Error).message); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!patient) return;
        setSaving(true); setError(null);
        try {
            const res = await fetch("/api/timeline/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId: patient.patientId, entryId: entry.entryId }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Delete failed"); }
            onDeleted();
            onClose();
        } catch (e) { setError((e as Error).message); setSaving(false); setMode("view"); }
    };

    const chips = (items: string[], color = "#94a3b8") =>
        items.length > 0 ? (
            <div className={styles.chipRow}>
                {items.map((item, i) => <span key={i} className={styles.chip} style={{ borderColor: color }}>{item}</span>)}
            </div>
        ) : null;

    return (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>

                {/* ---- Header ---- */}
                <div className={styles.header} style={{ borderBottomColor: typeInfo.color + "40" }}>
                    <div className={styles.headerLeft}>
                        <span className={styles.typeIcon} style={{ background: typeInfo.color + "20", color: typeInfo.color }}>
                            {typeInfo.icon}
                        </span>
                        <div>
                            <p className={styles.typeLabel} style={{ color: typeInfo.color }}>{typeInfo.label}</p>
                            <h2 className={styles.title}>{mode === "edit" ? "Edit Record" : entry.title}</h2>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        {mode === "view" && (
                            <>
                                <button className={styles.actionBtn} onClick={() => setMode("edit")} title="Edit">
                                    <Pencil size={15} />
                                </button>
                                <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => setMode("confirmDelete")} title="Delete">
                                    <Trash2 size={15} />
                                </button>
                            </>
                        )}
                        <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
                    </div>
                </div>

                {/* ---- Delete Confirm ---- */}
                {mode === "confirmDelete" && (
                    <div className={styles.body}>
                        <div className={styles.confirmDelete}>
                            <Trash2 size={32} style={{ color: "#ef4444", marginBottom: 8 }} />
                            <h3>Delete this record?</h3>
                            <p>This action cannot be undone.</p>
                            {error && <div className={styles.errorBanner}>{error}</div>}
                            <div className={styles.confirmActions}>
                                <button className={styles.cancelBtn} onClick={() => setMode("view")} disabled={saving}>Cancel</button>
                                <button className={styles.confirmDeleteBtn} onClick={handleDelete} disabled={saving}>
                                    {saving ? <Loader2 size={14} className={styles.spinner} /> : <Trash2 size={14} />}
                                    {saving ? "Deleting…" : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---- Edit Form ---- */}
                {mode === "edit" && (
                    <div className={styles.body}>
                        <div className={styles.editForm}>
                            <div className={styles.formField}>
                                <label className={styles.formLabel}>Title</label>
                                <input
                                    className={styles.formInput}
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder="Document title"
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label className={styles.formLabel}>Category</label>
                                    <div className={styles.selectWrapper}>
                                        <button className={styles.selectBtn} onClick={() => setTypePickerOpen(v => !v)}>
                                            <span style={{ color: typeInfo.color }}>{typeInfo.icon}</span>
                                            <span>{typeInfo.label}</span>
                                            <ChevronDown size={13} />
                                        </button>
                                        {typePickerOpen && (
                                            <div className={styles.dropdown}>
                                                {TYPE_OPTIONS.map(opt => (
                                                    <button key={opt.value} className={`${styles.dropdownItem} ${editType === opt.value ? styles.dropdownItemActive : ""}`}
                                                        onClick={() => { setEditType(opt.value); setTypePickerOpen(false); }}>
                                                        <span style={{ color: opt.color }}>{opt.icon}</span> {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.formField}>
                                    <label className={styles.formLabel}>Date</label>
                                    <input type="date" className={styles.formInput} value={editDate} onChange={e => setEditDate(e.target.value)} />
                                </div>
                            </div>

                            {error && <div className={styles.errorBanner}>{error}</div>}

                            <div className={styles.editActions}>
                                <button className={styles.cancelBtn} onClick={() => { setMode("view"); setError(null); }} disabled={saving}>Cancel</button>
                                <button className={styles.saveBtn} onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}>
                                    {saving ? <Loader2 size={14} className={styles.spinner} /> : <Check size={14} />}
                                    {saving ? "Saving…" : "Save"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---- View Mode ---- */}
                {mode === "view" && (
                    <div className={styles.body}>
                        {imgUrl && <ZoomableImage src={imgUrl} alt={entry.title} />}

                        {/* Meta row */}
                        <div className={styles.metaRow}>
                            <div className={styles.metaItem}><Calendar size={14} className={styles.metaIcon} /><span>{formattedDate}</span></div>
                            {(entry.sourceInstitution || meta.institutions?.[0]) && (
                                <div className={styles.metaItem}><Building2 size={14} className={styles.metaIcon} /><span>{entry.sourceInstitution || meta.institutions![0]}</span></div>
                            )}
                            {(entry.doctorName || meta.doctors?.[0]) && (
                                <div className={styles.metaItem}><Stethoscope size={14} className={styles.metaIcon} /><span>Dr. {entry.doctorName || meta.doctors![0]}</span></div>
                            )}
                        </div>

                        {/* Status / confidence */}
                        {(entry.statusFlags?.length > 0 || entry.confidenceScore != null) && (
                            <div className={styles.flags}>
                                {entry.statusFlags?.map(f => <span key={f} className={styles.flagBadge}>{f}</span>)}
                                {entry.confidenceScore != null && <span className={styles.confidenceBadge}>{entry.confidenceScore}% AI confidence</span>}
                            </div>
                        )}

                        {/* Summary */}
                        {meta.summary && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><FileText size={13} /> Summary</h4>
                                <p className={styles.summaryText}>{meta.summary}</p>
                            </div>
                        )}

                        {/* ── Medications (RX / Consult) ── */}
                        {(meta.medications?.length ?? 0) > 0 && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><Pill size={13} /> Medications</h4>
                                <div className={styles.medTable}>
                                    {meta.medications!.map((m, i) => (
                                        <div key={i} className={styles.medRow}>
                                            <span className={styles.medName}>{m.name}</span>
                                            <div className={styles.medDetails}>
                                                {m.dosage && <span className={styles.medTag}>{m.dosage}</span>}
                                                {m.frequency && <span className={styles.medTag}>{m.frequency}</span>}
                                                {m.duration && <span className={styles.medTagAlt}>{m.duration}</span>}
                                                {m.route && <span className={styles.medTagAlt}>{m.route}</span>}
                                                {m.instructions && <span className={styles.medNote}>{m.instructions}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Diagnoses ── */}
                        {(meta.diagnoses?.length ?? 0) > 0 && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><Stethoscope size={13} /> Conditions / Diagnoses</h4>
                                <div className={styles.chipRow}>
                                    {meta.diagnoses!.map((d, i) => <span key={i} className={styles.chip} style={{ borderColor: "#f59e0b" }}>{d}</span>)}
                                </div>
                            </div>
                        )}

                        {/* ── Lab Results ── */}
                        {(meta.labTests?.length ?? 0) > 0 && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><FlaskConical size={13} /> Lab Results</h4>
                                {meta.labName && <p className={styles.metaNote}>{meta.labName}{meta.referredBy ? ` · Ref: Dr. ${meta.referredBy}` : ""}</p>}
                                <div className={styles.labTable}>
                                    {meta.labTests!.map((t, i) => (
                                        <div key={i} className={styles.labRow}>
                                            <span className={styles.labName}>{t.name}</span>
                                            <span className={styles.labValue}>{t.value}{t.unit ? ` ${t.unit}` : ""}</span>
                                            {t.referenceRange && <span className={styles.labRange}>{t.referenceRange}</span>}
                                            {t.status && (
                                                <span className={`${styles.labStatus} ${styles[`labStatus${t.status}`]}`}>{t.status}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Imaging ── */}
                        {(meta.modality || meta.findings || meta.impression) && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><Camera size={13} /> Imaging Details</h4>
                                {(meta.modality || meta.bodyPart) && (
                                    <p className={styles.metaNote}>{[meta.modality, meta.bodyPart].filter(Boolean).join(" – ")}{meta.radiologist ? ` · Dr. ${meta.radiologist}` : ""}</p>
                                )}
                                {meta.findings && <div className={styles.textBlock}><strong>Findings:</strong> {meta.findings}</div>}
                                {meta.impression && <div className={styles.textBlock}><strong>Impression:</strong> {meta.impression}</div>}
                            </div>
                        )}

                        {/* ── Hospital ── */}
                        {(meta.admissionDate || meta.dischargeDate || (meta.procedures?.length ?? 0) > 0) && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><Building2 size={13} /> Hospital Details</h4>
                                <div className={styles.infoGrid}>
                                    {meta.admissionDate && <div className={styles.infoItem}><span className={styles.infoLabel}>Admitted</span><span>{meta.admissionDate}</span></div>}
                                    {meta.dischargeDate && <div className={styles.infoItem}><span className={styles.infoLabel}>Discharged</span><span>{meta.dischargeDate}</span></div>}
                                    {meta.wardInfo && <div className={styles.infoItem}><span className={styles.infoLabel}>Ward</span><span>{meta.wardInfo}</span></div>}
                                </div>
                                {(meta.procedures?.length ?? 0) > 0 && (
                                    <div className={styles.chipRow} style={{ marginTop: 8 }}>
                                        {meta.procedures!.map((p, i) => <span key={i} className={styles.chip} style={{ borderColor: "#ef4444" }}>{p}</span>)}
                                    </div>
                                )}
                                {meta.dischargeInstructions && <div className={styles.textBlock}><strong>Discharge instructions:</strong> {meta.dischargeInstructions}</div>}
                            </div>
                        )}

                        {/* ── Consultation ── */}
                        {(meta.chiefComplaint || meta.treatmentPlan || meta.followUpDate) && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><Stethoscope size={13} /> Consultation Details</h4>
                                {meta.chiefComplaint && <div className={styles.textBlock}><strong>Chief complaint:</strong> {meta.chiefComplaint}</div>}
                                {meta.examinationFindings && <div className={styles.textBlock}><strong>Examination:</strong> {meta.examinationFindings}</div>}
                                {meta.treatmentPlan && <div className={styles.textBlock}><strong>Treatment plan:</strong> {meta.treatmentPlan}</div>}
                                {meta.followUpDate && <div className={styles.infoItem}><span className={styles.infoLabel}>Follow-up</span><span>{meta.followUpDate}</span></div>}
                                {(meta.advice?.length ?? 0) > 0 && (
                                    <div className={styles.chipRow} style={{ marginTop: 8 }}>
                                        {meta.advice!.map((a, i) => <span key={i} className={styles.chip} style={{ borderColor: "#f59e0b" }}>{a}</span>)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Insurance ── */}
                        {(meta.policyNumber || meta.insurer) && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><FileCheck2 size={13} /> Insurance Details</h4>
                                <div className={styles.infoGrid}>
                                    {meta.insurer && <div className={styles.infoItem}><span className={styles.infoLabel}>Insurer</span><span>{meta.insurer}</span></div>}
                                    {meta.policyNumber && <div className={styles.infoItem}><span className={styles.infoLabel}>Policy #</span><span>{meta.policyNumber}</span></div>}
                                    {meta.policyHolder && <div className={styles.infoItem}><span className={styles.infoLabel}>Holder</span><span>{meta.policyHolder}</span></div>}
                                    {meta.coverageAmount && <div className={styles.infoItem}><span className={styles.infoLabel}>Coverage</span><span>₹{meta.coverageAmount}</span></div>}
                                    {meta.validityPeriod && <div className={styles.infoItem}><span className={styles.infoLabel}>Validity</span><span>{meta.validityPeriod}</span></div>}
                                </div>
                            </div>
                        )}

                        {/* ── Vaccination ── */}
                        {meta.vaccineName && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><ClipboardList size={13} /> Vaccination Details</h4>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}><span className={styles.infoLabel}>Vaccine</span><span>{meta.vaccineName}</span></div>
                                    {meta.doseNumber && <div className={styles.infoItem}><span className={styles.infoLabel}>Dose</span><span>{meta.doseNumber}</span></div>}
                                    {meta.nextDueDate && <div className={styles.infoItem}><span className={styles.infoLabel}>Next due</span><span>{meta.nextDueDate}</span></div>}
                                    {meta.administeredBy && <div className={styles.infoItem}><span className={styles.infoLabel}>Given by</span><span>{meta.administeredBy}</span></div>}
                                    {meta.batchNumber && <div className={styles.infoItem}><span className={styles.infoLabel}>Batch</span><span>{meta.batchNumber}</span></div>}
                                </div>
                            </div>
                        )}

                        {/* ── Allergies ── */}
                        {(meta.allergies?.length ?? 0) > 0 && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle} style={{ color: "#ef4444" }}>⚠ Allergies</h4>
                                <div className={styles.chipRow}>
                                    {meta.allergies!.map((a, i) => <span key={i} className={styles.chip} style={{ borderColor: "#ef4444", color: "#ef4444" }}>{a}</span>)}
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
