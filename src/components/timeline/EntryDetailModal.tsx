"use client";

import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import styles from "./EntryDetailModal.module.css";
import {
    X, Calendar, Building2, Stethoscope, Pill, FlaskConical,
    FileCheck2, FileText, Camera, ClipboardList, Pencil, Trash2,
    Check, Loader2, ChevronDown,
} from "lucide-react";
import type { HealthEntry, DocumentTypeTag } from "../../lib/types/timeline";
import DocThumbnail from "../scan/DocThumbnail";

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
                        {entry.encryptedBlobKey && (
                            <div className={styles.imageWrapper}>
                                <DocThumbnail s3Key={entry.encryptedBlobKey} alt={entry.title}
                                    style={{ width: "100%", height: 220, borderRadius: "var(--radius-xl)" }} />
                            </div>
                        )}

                        <div className={styles.metaRow}>
                            <div className={styles.metaItem}><Calendar size={14} className={styles.metaIcon} /><span>{formattedDate}</span></div>
                            {entry.sourceInstitution && <div className={styles.metaItem}><Building2 size={14} className={styles.metaIcon} /><span>{entry.sourceInstitution}</span></div>}
                            {entry.doctorName && <div className={styles.metaItem}><Stethoscope size={14} className={styles.metaIcon} /><span>Dr. {entry.doctorName}</span></div>}
                        </div>

                        {(entry.statusFlags?.length > 0 || entry.confidenceScore != null) && (
                            <div className={styles.flags}>
                                {entry.statusFlags?.map(f => <span key={f} className={styles.flagBadge}>{f}</span>)}
                                {entry.confidenceScore != null && <span className={styles.confidenceBadge}>{entry.confidenceScore}% AI confidence</span>}
                            </div>
                        )}

                        {(entry.metadata?.medications?.length ?? 0) > 0 && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><Pill size={13} /> Medications</h4>
                                {chips(entry.metadata?.medications ?? [], "#10b981")}
                            </div>
                        )}
                        {(entry.metadata?.diagnoses?.length ?? 0) > 0 && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><Stethoscope size={13} /> Conditions</h4>
                                {chips(entry.metadata?.diagnoses ?? [], "#f59e0b")}
                            </div>
                        )}
                        {(entry.metadata?.labTests?.length ?? 0) > 0 && (
                            <div className={styles.section}>
                                <h4 className={styles.sectionTitle}><FlaskConical size={13} /> Lab Tests</h4>
                                {chips(entry.metadata?.labTests ?? [], "#6366f1")}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
