// ============================================================
// SettingsScreen — App preferences & account settings
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import styles from "./SettingsScreen.module.css";
import { Palette, Bell, Package, TriangleAlert, CalendarClock, Download, Trash2, Users, Plus, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { broadcastLangChange } from "../../hooks/useLanguage";
import type { SupportedLang } from "../../lib/i18n/translations";
import type { GuardianLink } from "../../hooks/useAuth";

interface SettingsScreenProps {
    onNavigate: (screen: string) => void;
}

// ---- localStorage helpers ----
function loadPref<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw !== null ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}
function savePref<T>(key: string, val: T) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export default function SettingsScreen({ onNavigate }: SettingsScreenProps) {
    const { patient, userRole, logout, updatePatient, dependents, linkDependent, unlinkDependent, switchToDependent, viewingAs, switchToSelf } = useAuth();
    const patientId = patient?.patientId ?? "";

    // ---- Appearance ----
    const [darkMode, setDarkMode] = useState(false);
    const [language, setLanguage] = useState(patient?.language ?? "en");
    const [langSaving, setLangSaving] = useState(false);
    const [langSaved, setLangSaved] = useState(false);

    // ---- Notifications ----
    const [pushNotifs, setPushNotifs] = useState(true);
    const [apptReminders, setApptReminders] = useState(true);

    // ---- Export ----
    const [exporting, setExporting] = useState(false);

    // ---- Delete account ----
    const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
    const [deleteInput, setDeleteInput] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    // ---- Guardian Access ----
    const [addingDep, setAddingDep] = useState(false);
    const [depCardId, setDepCardId] = useState("");
    const [depDob, setDepDob] = useState("");
    const [depRelationship, setDepRelationship] = useState<GuardianLink["relationship"]>("child");
    const [addDepLoading, setAddDepLoading] = useState(false);
    const [addDepError, setAddDepError] = useState("");

    // Sync language when patient data loads
    useEffect(() => {
        if (patient?.language) setLanguage(patient.language);
    }, [patient?.language]);

    // ---- Hydrate from localStorage ----
    useEffect(() => {
        const savedTheme = localStorage.getItem("arogyasutra_theme");
        setDarkMode(savedTheme === "dark");
        setPushNotifs(loadPref("arogyasutra_notif_push", true));
        setApptReminders(loadPref("arogyasutra_notif_appt", true));
    }, [patientId]);

    // ---- Dark mode ----
    const handleToggleDark = () => {
        const next = !darkMode;
        setDarkMode(next);
        if (next) {
            document.documentElement.setAttribute("data-theme", "dark");
            localStorage.setItem("arogyasutra_theme", "dark");
        } else {
            document.documentElement.removeAttribute("data-theme");
            localStorage.setItem("arogyasutra_theme", "light");
        }
    };

    // ---- Language ----
    const handleSaveLanguage = async (lang: string) => {
        if (!patientId) return;
        setLanguage(lang as SupportedLang);
        broadcastLangChange(lang as SupportedLang);
        setLangSaving(true);
        try {
            await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: patientId, role: "patient", updates: { language: lang } }),
            });
            updatePatient({ language: lang as "en" });
            setLangSaved(true);
            setTimeout(() => setLangSaved(false), 2000);
        } catch { /* silent */ } finally {
            setLangSaving(false);
        }
    };

    // ---- Notification toggles ----
    const handlePushNotifs = (val: boolean) => {
        setPushNotifs(val);
        savePref("arogyasutra_notif_push", val);
    };
    const handleApptReminders = (val: boolean) => {
        setApptReminders(val);
        savePref("arogyasutra_notif_appt", val);
    };

    // ---- Export ----
    const handleExport = async () => {
        if (!patientId || exporting) return;
        setExporting(true);
        try {
            const res = await fetch(`/api/timeline/entries?patientId=${encodeURIComponent(patientId)}`);
            const data = await res.json();
            const entries = data.entries ?? [];
            const bundle = {
                resourceType: "Bundle",
                type: "collection",
                meta: { lastUpdated: new Date().toISOString(), patientId },
                total: entries.length,
                entry: entries.map((e: Record<string, unknown>) => ({
                    fullUrl: `urn:arogyasutra:entry:${e.entryId}`,
                    resource: {
                        resourceType: "DocumentReference",
                        id: e.entryId,
                        status: "current",
                        type: { text: e.documentType },
                        subject: { reference: `Patient/${patientId}` },
                        date: e.date,
                        description: e.title,
                        author: e.doctorName ? [{ display: e.doctorName as string }] : [],
                        context: {
                            sourceInstitution: e.sourceInstitution,
                            metadata: e.metadata,
                        },
                    },
                })),
            };
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `arogyasutra_${patientId}_${new Date().toISOString().slice(0, 10)}.fhir.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { /* silent */ } finally {
            setExporting(false);
        }
    };

    // ---- Guardian: Link dependent card ----
    const handleLinkDependent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId || !depCardId || !depDob) return;
        setAddDepLoading(true);
        setAddDepError("");
        try {
            const res = await fetch("/api/guardian/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guardianId: patientId, dependentCardId: `AS-${depCardId}`, dependentDob: depDob }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Verification failed");
            linkDependent({
                cardId: data.cardId as string,
                name: data.name as string,
                dob: data.dob as string,
                relationship: depRelationship,
                linkedAt: new Date().toISOString(),
            });
            setAddingDep(false);
            setDepCardId("");
            setDepDob("");
            setDepRelationship("child");
        } catch (err) {
            setAddDepError((err as Error).message);
        } finally {
            setAddDepLoading(false);
        }
    };

    // ---- Delete account ----
    const handleDelete = async () => {
        if (!patientId || deleteInput !== "DELETE") return;
        setDeleting(true);
        setDeleteError("");
        try {
            const res = await fetch("/api/profile/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: patientId }),
            });
            if (!res.ok) throw new Error("Failed");
            await logout();
        } catch {
            setDeleteError("Failed to delete account. Please contact support.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className={styles.page}>

            {/* ======== Appearance ======== */}
            <div className={styles.card}>
                <h3 className={styles.cardTitle}><span><Palette size={16} /></span> Appearance</h3>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Dark Mode</span>
                        <span className={styles.rowDesc}>Switch to a darker theme — easier on the eyes at night</span>
                    </div>
                    <button
                        className={`${styles.toggle} ${darkMode ? styles.toggleOn : ""}`}
                        onClick={handleToggleDark}
                        aria-label="Toggle dark mode"
                    />
                </div>

                {userRole === "patient" && (
                    <div className={styles.row}>
                        <div className={styles.rowInfo}>
                            <span className={styles.rowLabel}>Language</span>
                            <span className={styles.rowDesc}>Your preferred language for the app</span>
                        </div>
                        <div className={styles.inlineGroup}>
                            <select
                                className={styles.select}
                                value={language}
                                onChange={(e) => handleSaveLanguage(e.target.value)}
                                disabled={langSaving}
                            >
                                <option value="en">English</option>
                                <option value="hi">हिन्दी</option>
                                <option value="ta">தமிழ்</option>
                                <option value="te">తెలుగు</option>
                                <option value="bn">বাংলা</option>
                                <option value="mr">मराठी</option>
                                <option value="gu">ગુજરાતી</option>
                                <option value="kn">ಕನ್ನಡ</option>
                            </select>
                            {langSaved && <span className={styles.savedHint}>✓ Saved</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* ======== Notifications ======== */}
            {userRole !== "doctor" && <div className={styles.card}>
                <h3 className={styles.cardTitle}><span><Bell size={16} /></span> Notifications</h3>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Push Notifications</span>
                        <span className={styles.rowDesc}>Alerts for emergency access, doctor grants, and updates</span>
                    </div>
                    <button
                        className={`${styles.toggle} ${pushNotifs ? styles.toggleOn : ""}`}
                        onClick={() => handlePushNotifs(!pushNotifs)}
                        aria-label="Toggle push notifications"
                    />
                </div>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>
                            <span className={styles.rowLabelIcon}><CalendarClock size={13} /></span>
                            Appointment Reminders
                        </span>
                        <span className={styles.rowDesc}>Get notified a day before your upcoming appointments</span>
                    </div>
                    <button
                        className={`${styles.toggle} ${apptReminders ? styles.toggleOn : ""}`}
                        onClick={() => handleApptReminders(!apptReminders)}
                        aria-label="Toggle appointment reminders"
                    />
                </div>
            </div>}

            {/* ======== Guardian Access ======== */}
            {userRole !== "doctor" && (
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}><span><Users size={16} /></span> Guardian Access</h3>
                    <p className={styles.sectionDesc}>
                        Link dependent cards (children, elderly parents) to view and manage their health records from this account.
                    </p>

                    {/* Currently viewing banner */}
                    {viewingAs && (
                        <div className={styles.viewingRow}>
                            <span className={styles.viewingPill}>Viewing: <strong>{viewingAs.fullName}</strong> ({viewingAs.patientId})</span>
                            <button className={styles.depAction} onClick={switchToSelf}>Back to my records</button>
                        </div>
                    )}

                    {/* Linked dependents */}
                    {dependents.map((dep) => (
                        <div className={styles.depRow} key={dep.cardId}>
                            <div className={styles.depAvatar}>
                                {dep.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className={styles.depInfo}>
                                <span className={styles.depName}>{dep.name}</span>
                                <span className={styles.depMeta}>{dep.cardId} · {dep.relationship}</span>
                            </div>
                            <div className={styles.depBtns}>
                                {viewingAs?.patientId === dep.cardId ? (
                                    <button className={styles.depActionActive} onClick={switchToSelf}>✔ Viewing</button>
                                ) : (
                                    <button className={styles.depAction} onClick={() => switchToDependent(dep)}>Switch</button>
                                )}
                                <button className={styles.depRemove} onClick={() => unlinkDependent(dep.cardId)} title="Remove">
                                    <X size={13} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Add dependent form */}
                    {addingDep ? (
                        <form onSubmit={handleLinkDependent} className={styles.addDepForm}>
                            <div className={styles.depCardWrap}>
                                <span className={styles.depCardPrefix}>AS-</span>
                                <input
                                    className={styles.depCardSuffixInput}
                                    type="text"
                                    placeholder="XXXX-XXXX-XXXX"
                                    value={depCardId}
                                    onChange={(e) => {
                                        const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 12);
                                        const g1 = digits.slice(0, 4), g2 = digits.slice(4, 8), g3 = digits.slice(8, 12);
                                        setDepCardId(!g2 ? g1 : !g3 ? `${g1}-${g2}` : `${g1}-${g2}-${g3}`);
                                    }}
                                    maxLength={17}
                                    required
                                />
                            </div>
                            <div className={styles.addDepRow}>
                                <input
                                    className={styles.depInput}
                                    type="date"
                                    placeholder="Date of Birth"
                                    value={depDob}
                                    onChange={(e) => setDepDob(e.target.value)}
                                    required
                                />
                                <select className={styles.select} value={depRelationship} onChange={(e) => setDepRelationship(e.target.value as GuardianLink["relationship"])}>
                                    <option value="child">Child</option>
                                    <option value="parent">Parent</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            {addDepError && <p className={styles.formError}>{addDepError}</p>}
                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => { setAddingDep(false); setAddDepError(""); }}>Cancel</button>
                                <button type="submit" className={styles.actionBtn} disabled={addDepLoading}>
                                    {addDepLoading ? "Verifying…" : "Link Card"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button className={styles.addDepBtn} onClick={() => setAddingDep(true)}>
                            <Plus size={13} /> Link Dependent Card
                        </button>
                    )}
                </div>
            )}

            {/* ======== Data & Privacy ======== */}
            {userRole !== "doctor" && <div className={styles.card}>
                <h3 className={styles.cardTitle}><span><Package size={16} /></span> Data &amp; Privacy</h3>

                {/* Export */}
                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Export Health Data</span>
                        <span className={styles.rowDesc}>Download all your records as a FHIR-compliant JSON bundle</span>
                    </div>
                    <button
                        className={`${styles.actionBtn} ${exporting ? styles.actionBtnDisabled : ""}`}
                        onClick={handleExport}
                        disabled={exporting}
                    >
                        <Download size={13} />
                        {exporting ? "Exporting…" : "Export"}
                    </button>
                </div>

            </div>}

            {/* ======== Danger Zone ======== */}
            <div className={styles.dangerCard}>
                <h3 className={styles.cardTitle}><span><TriangleAlert size={16} /></span> Danger Zone</h3>

                <div className={styles.expandableRow}>
                    <div className={styles.rowFlex}>
                        <div className={styles.rowInfo}>
                            <span className={styles.rowLabel}>Delete Account</span>
                            <span className={styles.rowDesc}>Permanently deletes your account and all health records. Cannot be undone.</span>
                        </div>
                        {deleteStep === "idle" && (
                            <button
                                className={styles.dangerBtn}
                                onClick={() => setDeleteStep("confirm")}
                            >
                                <Trash2 size={13} /> Delete
                            </button>
                        )}
                    </div>

                    {deleteStep === "confirm" && (
                        <div className={styles.deleteConfirmBox}>
                            <p className={styles.deleteWarning}>
                                ⚠ This will permanently delete your account and cannot be undone.
                            </p>
                            <p className={styles.deleteInstructions}>
                                Type <strong>DELETE</strong> to confirm:
                            </p>
                            <input
                                className={styles.deleteInput}
                                type="text"
                                value={deleteInput}
                                onChange={e => setDeleteInput(e.target.value)}
                                placeholder="Type DELETE here"
                                autoFocus
                            />
                            {deleteError && <p className={styles.formError}>{deleteError}</p>}
                            <div className={styles.formActions}>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => { setDeleteStep("idle"); setDeleteInput(""); setDeleteError(""); }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.dangerBtnFull}
                                    onClick={handleDelete}
                                    disabled={deleteInput !== "DELETE" || deleting}
                                >
                                    {deleting ? "Deleting…" : "Permanently Delete Account"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <p className={styles.version}>ArogyaSutra v0.1.0</p>
        </div>
    );
}

