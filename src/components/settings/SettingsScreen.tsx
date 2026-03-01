// ============================================================
// SettingsScreen — App preferences & account settings
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import styles from "./SettingsScreen.module.css";
import { Palette, Bell, Package, TriangleAlert, CalendarClock, Download, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

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
    const { patient, userRole, logout, updatePatient } = useAuth();
    const patientId = patient?.patientId ?? "";

    // ---- Appearance ----
    const [darkMode, setDarkMode] = useState(false);
    const [language, setLanguage] = useState(patient?.language ?? "en");
    const [langSaving, setLangSaving] = useState(false);
    const [langSaved, setLangSaved] = useState(false);

    // ---- Notifications ----
    const [pushNotifs, setPushNotifs] = useState(true);
    const [apptReminders, setApptReminders] = useState(true);

    // ---- Emergency Info ----
    const [emergencyOpen, setEmergencyOpen] = useState(false);
    const [editBloodGroup, setEditBloodGroup] = useState(patient?.bloodGroup ?? "");
    const [editAllergies, setEditAllergies] = useState("");
    const [editCriticalMeds, setEditCriticalMeds] = useState("");
    const [emergencySaving, setEmergencySaving] = useState(false);
    const [emergencySaved, setEmergencySaved] = useState(false);
    const [emergencyError, setEmergencyError] = useState("");

    // ---- Export ----
    const [exporting, setExporting] = useState(false);

    // ---- Delete account ----
    const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
    const [deleteInput, setDeleteInput] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    // ---- Hydrate from localStorage ----
    useEffect(() => {
        const savedTheme = localStorage.getItem("arogyasutra_theme");
        setDarkMode(savedTheme === "dark");
        setPushNotifs(loadPref("arogyasutra_notif_push", true));
        setApptReminders(loadPref("arogyasutra_notif_appt", true));
        if (patientId) {
            const em = loadPref<{ allergies: string; criticalMeds: string }>(
                `arogyasutra_emergency_${patientId}`,
                { allergies: "", criticalMeds: "" }
            );
            setEditAllergies(em.allergies);
            setEditCriticalMeds(em.criticalMeds);
        }
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
    const handleSaveLanguage = async () => {
        if (!patientId || language === (patient?.language ?? "en")) return;
        setLangSaving(true);
        try {
            await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: patientId, role: "patient", updates: { language } }),
            });
            updatePatient({ language: language as "en" });
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

    // ---- Emergency info ----
    const handleSaveEmergency = async () => {
        setEmergencySaving(true);
        setEmergencyError("");
        try {
            if (patientId && editBloodGroup !== (patient?.bloodGroup ?? "")) {
                await fetch("/api/profile/update", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: patientId, role: "patient", updates: { bloodGroup: editBloodGroup } }),
                });
                updatePatient({ bloodGroup: editBloodGroup });
            }
            if (patientId) {
                savePref(`arogyasutra_emergency_${patientId}`, {
                    allergies: editAllergies,
                    criticalMeds: editCriticalMeds,
                });
            }
            setEmergencySaved(true);
            setTimeout(() => { setEmergencySaved(false); setEmergencyOpen(false); }, 1500);
        } catch {
            setEmergencyError("Failed to save. Please try again.");
        } finally {
            setEmergencySaving(false);
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
                                onChange={(e) => setLanguage(e.target.value)}
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
                            {language !== (patient?.language ?? "en") && (
                                <button
                                    className={styles.saveBtn}
                                    onClick={handleSaveLanguage}
                                    disabled={langSaving}
                                >
                                    {langSaving ? "Saving…" : langSaved ? "✓ Saved" : "Save"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ======== Notifications ======== */}
            <div className={styles.card}>
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
            </div>

            {/* ======== Data & Privacy ======== */}
            <div className={styles.card}>
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

                {/* Emergency Info */}
                <div className={styles.expandableRow}>
                    <div className={styles.rowFlex}>
                        <div className={styles.rowInfo}>
                            <span className={styles.rowLabel}>
                                <span className={styles.rowLabelIcon}><ShieldAlert size={13} /></span>
                                Emergency Info
                            </span>
                            <span className={styles.rowDesc}>Blood group, known allergies, and critical medications visible during emergencies</span>
                        </div>
                        <button
                            className={styles.actionBtn}
                            onClick={() => setEmergencyOpen(o => !o)}
                        >
                            {emergencyOpen ? "Close" : "Edit"}
                        </button>
                    </div>

                    {emergencyOpen && (
                        <div className={styles.emergencyForm}>
                            {emergencyError && <p className={styles.formError}>{emergencyError}</p>}
                            {emergencySaved && <p className={styles.formSuccess}>✓ Saved successfully</p>}

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Blood Group</label>
                                    <select
                                        className={styles.select}
                                        value={editBloodGroup}
                                        onChange={e => setEditBloodGroup(e.target.value)}
                                    >
                                        <option value="">— Select —</option>
                                        {["A+", "A−", "B+", "B−", "O+", "O−", "AB+", "AB−"].map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Known Allergies</label>
                                <textarea
                                    className={styles.textarea}
                                    rows={2}
                                    placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                                    value={editAllergies}
                                    onChange={e => setEditAllergies(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Critical Medications</label>
                                <textarea
                                    className={styles.textarea}
                                    rows={2}
                                    placeholder="e.g. Warfarin 5mg daily, Insulin 10 units"
                                    value={editCriticalMeds}
                                    onChange={e => setEditCriticalMeds(e.target.value)}
                                />
                            </div>

                            <div className={styles.formActions}>
                                <button className={styles.cancelBtn} onClick={() => setEmergencyOpen(false)}>Cancel</button>
                                <button
                                    className={styles.saveBtn}
                                    onClick={handleSaveEmergency}
                                    disabled={emergencySaving}
                                >
                                    {emergencySaving ? "Saving…" : "Save Emergency Info"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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

