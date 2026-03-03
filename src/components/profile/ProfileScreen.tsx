// ============================================================
// ProfileScreen — Unified profile for Patient + Doctor
// Photo upload → S3 (KMS-encrypted) via /api/profile/photo
// Profile edits persisted in Cognito attributes
// ============================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { fmtDate } from "../../lib/utils/date";
import { useAuth } from "../../hooks/useAuth";
import styles from "./ProfileScreen.module.css";
import {
    Pencil, Check, X, Camera, User, Phone, Heart, Shield,
    MapPin, LogOut, Stethoscope, AlertTriangle,
} from "lucide-react";

interface ProfileScreenProps {
    onNavigate: (screen: string) => void;
}


/** Format a date string for display */
function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch {
        return dateStr;
    }
}

/** Calculate age from DOB string */
function calcAge(dob: string): number {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
}

export default function ProfileScreen({ onNavigate }: ProfileScreenProps) {
    const { patient, doctor, userRole, logout, updatePatient, updateDoctor } = useAuth();
    const isDoctor = userRole === "doctor";

    const userId = isDoctor ? doctor?.doctorId : patient?.patientId;
    const photoStorageKey = `profilePhoto_${userId}`;

    // ---- Photo state ----
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ---- Edit mode ----
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editable fields — synced from auth data via useEffect (handles async load)
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editCity, setEditCity] = useState("");
    const [editState, setEditState] = useState("");
    const [editPincode, setEditPincode] = useState("");
    const [editLine1, setEditLine1] = useState("");
    const [editLanguage, setEditLanguage] = useState("en");
    const [editDob, setEditDob] = useState("");
    const [editGender, setEditGender] = useState("other");
    const [editHeight, setEditHeight] = useState("");
    const [editWeight, setEditWeight] = useState("");
    const [editBloodGroup, setEditBloodGroup] = useState("");
    // Doctor-specific
    const [editInstitution, setEditInstitution] = useState("");
    const [editDesignation, setEditDesignation] = useState("");

    // ---- Emergency Info ----
    const [emergencyAllergies, setEmergencyAllergies] = useState<string[]>([]);
    const [emergencyCriticalMeds, setEmergencyCriticalMeds] = useState<string[]>([]);
    // Doctor's own emergency data
    const [doctorEmAllergies, setDoctorEmAllergies] = useState<string[]>([]);
    const [doctorEmMeds, setDoctorEmMeds] = useState<string[]>([]);
    // Edit mode
    const [emergencyEditing, setEmergencyEditing] = useState(false);
    const [editEmAllergiesTxt, setEditEmAllergiesTxt] = useState("");
    const [editEmMedsTxt, setEditEmMedsTxt] = useState("");
    const [emergencySaving, setEmergencySaving] = useState(false);
    const [emergencySaved, setEmergencySaved] = useState(false);
    const [emergencyError, setEmergencyError] = useState("");
    // Visibility toggles (patient only)
    const [emShowBloodGroup, setEmShowBloodGroup] = useState(true);
    const [emShowAllergies, setEmShowAllergies] = useState(true);
    const [emShowMeds, setEmShowMeds] = useState(true);
    // Last updated timestamp (ISO string)
    const [emergencyUpdatedAt, setEmergencyUpdatedAt] = useState<string | null>(null);

    // Load emergency info from localStorage for both roles
    useEffect(() => {
        if (!userId) return;
        try {
            const raw = localStorage.getItem(`arogyasutra_emergency_${userId}`);
            const data = raw ? JSON.parse(raw) : {};
            const toArr = (s: string) => (s || "").split(",").map((x: string) => x.trim()).filter(Boolean);
            if (isDoctor) {
                setDoctorEmAllergies(toArr(data.allergies));
                setDoctorEmMeds(toArr(data.criticalMeds));
            } else {
                setEmergencyAllergies(toArr(data.allergies));
                setEmergencyCriticalMeds(toArr(data.criticalMeds));
                setEmShowBloodGroup(data.showBloodGroup !== false);
                setEmShowAllergies(data.showAllergies !== false);
                setEmShowMeds(data.showMeds !== false);
            }
            if (data.updatedAt) setEmergencyUpdatedAt(data.updatedAt);
        } catch { /* ignore */ }
    }, [userId, isDoctor]);

    // Sync editable fields from auth data whenever patient/doctor loads
    useEffect(() => {
        if (isDoctor && doctor) {
            setEditName(doctor.fullName || "");
            setEditPhone(doctor.phone || "");
            setEditInstitution(doctor.institution || "");
            setEditDesignation(doctor.designation || "");
        } else if (!isDoctor && patient) {
            setEditName(patient.fullName || "");
            setEditPhone(patient.phone || "");
            setEditCity(patient.address?.city || "");
            setEditState(patient.address?.state || "");
            setEditPincode(patient.address?.pincode || "");
            setEditLine1(patient.address?.line1 || "");
            setEditLanguage(patient.language || "en");
            setEditDob(patient.dateOfBirth || "");
            setEditGender(patient.gender || "other");
            setEditHeight(patient.height || "");
            setEditWeight(patient.weight || "");
            setEditBloodGroup(patient.bloodGroup || "");
        }
    }, [isDoctor, doctor, patient]);

    // ---- Re-fetch profile from API if data looks empty (fallback from login) ----
    const [profileLoading, setProfileLoading] = useState(false);
    useEffect(() => {
        if (!userId || isDoctor) return;
        // If patient exists but core fields are empty, the login-time fetch likely failed
        if (patient && !patient.fullName) {
            setProfileLoading(true);
            fetch(`/api/profile/me?userId=${encodeURIComponent(userId)}&role=patient`)
                .then((r) => {
                    if (!r.ok) throw new Error(`${r.status}`);
                    return r.json();
                })
                .then((data) => {
                    if (data.profile?.fullName) {
                        updatePatient({
                            ...data.profile,
                            gender: (data.profile.gender || "other") as "male" | "female" | "other",
                            language: data.profile.language || "en",
                            emergencyContacts: data.profile.emergencyContacts ?? [],
                        });
                    }
                })
                .catch((err) => {
                    console.error("[ProfileScreen] re-fetch failed:", err);
                    setError(`Could not load profile data. Please try logging out and back in.`);
                })
                .finally(() => setProfileLoading(false));
        }
    }, [userId, isDoctor, patient, updatePatient]);

    // ---- Load saved photo from localStorage (fast) + S3 (authoritative) ----
    // photoVersion increments on every upload so stale GET responses are ignored
    const photoVersionRef = useRef(0);

    useEffect(() => {
        if (!userId) return;
        // Restore from localStorage immediately for instant display
        const cached = localStorage.getItem(photoStorageKey);
        if (cached) setPhotoUrl(cached);

        // Capture current version — if user uploads before this resolves, discard result
        const version = photoVersionRef.current;
        fetch(`/api/profile/photo?userId=${userId}&role=${isDoctor ? "doctor" : "patient"}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.url && photoVersionRef.current === version) {
                    setPhotoUrl(data.url);
                }
            })
            .catch(() => {/* silently fall back to cached */ });
    }, [userId, isDoctor, photoStorageKey]);

    // ---- Handle photo file selection ----
    const handlePhotoChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file || !userId) return;

            setUploading(true);
            photoVersionRef.current += 1; // invalidate any in-flight S3 GET
            try {
                // Read as base64 for preview + upload
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const base64 = ev.target?.result as string;
                    // Show preview immediately
                    setPhotoUrl(base64);
                    localStorage.setItem(photoStorageKey, base64);

                    // Upload to S3 via our API (KMS-encrypted at rest)
                    try {
                        await fetch("/api/profile/photo", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                userId,
                                role: isDoctor ? "doctor" : "patient",
                                imageBase64: base64,
                                mimeType: file.type,
                            }),
                        });
                    } catch {
                        console.warn("S3 upload failed — using local cache");
                    } finally {
                        setUploading(false);
                    }
                };
                reader.readAsDataURL(file);
            } catch {
                setUploading(false);
            }
        },
        [userId, isDoctor, photoStorageKey]
    );

    // ---- Emergency Info: open edit ----
    const handleEditEmergency = () => {
        if (emergencyEditing) { setEmergencyEditing(false); return; }
        setEditEmAllergiesTxt(
            (isDoctor ? doctorEmAllergies : emergencyAllergies).join(", ")
        );
        setEditEmMedsTxt(
            (isDoctor ? doctorEmMeds : emergencyCriticalMeds).join(", ")
        );
        setEmergencyError("");
        setEmergencyEditing(true);
    };

    // ---- Emergency Info: save ----
    const handleSaveEmergency = async () => {
        setEmergencySaving(true);
        setEmergencyError("");
        try {
            const toArr = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
            const allergiesArr = toArr(editEmAllergiesTxt);
            const medsArr = toArr(editEmMedsTxt);
            const nowIso = new Date().toISOString();
            if (isDoctor) {
                localStorage.setItem(`arogyasutra_emergency_${userId}`, JSON.stringify({
                    allergies: editEmAllergiesTxt,
                    criticalMeds: editEmMedsTxt,
                    updatedAt: nowIso,
                }));
                setDoctorEmAllergies(allergiesArr);
                setDoctorEmMeds(medsArr);
            } else {
                localStorage.setItem(`arogyasutra_emergency_${userId}`, JSON.stringify({
                    allergies: editEmAllergiesTxt,
                    criticalMeds: editEmMedsTxt,
                    showBloodGroup: emShowBloodGroup,
                    showAllergies: emShowAllergies,
                    showMeds: emShowMeds,
                    updatedAt: nowIso,
                }));
                setEmergencyAllergies(allergiesArr);
                setEmergencyCriticalMeds(medsArr);
                setEmergencyUpdatedAt(nowIso);
                // Also persist to Cognito so doctors can see allergies/meds during consultation
                try {
                    await fetch("/api/profile/update", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            userId,
                            role: "patient",
                            updates: {
                                allergies: editEmAllergiesTxt,
                                criticalMeds: editEmMedsTxt,
                            },
                        }),
                    });
                } catch { /* non-fatal — localStorage is the source of truth */ }
            }
            setEmergencySaved(true);
            setTimeout(() => { setEmergencySaved(false); setEmergencyEditing(false); }, 1200);
        } catch {
            setEmergencyError("Failed to save. Please try again.");
        } finally {
            setEmergencySaving(false);
        }
    };

    // ---- Emergency visibility toggle (instant save) ----
    const handleToggleVisibility = (field: "bloodGroup" | "allergies" | "meds") => {
        const next = {
            bloodGroup: field === "bloodGroup" ? !emShowBloodGroup : emShowBloodGroup,
            allergies: field === "allergies" ? !emShowAllergies : emShowAllergies,
            meds: field === "meds" ? !emShowMeds : emShowMeds,
        };
        setEmShowBloodGroup(next.bloodGroup);
        setEmShowAllergies(next.allergies);
        setEmShowMeds(next.meds);
        if (userId) {
            try {
                const raw = localStorage.getItem(`arogyasutra_emergency_${userId}`);
                const data = raw ? JSON.parse(raw) : {};
                localStorage.setItem(`arogyasutra_emergency_${userId}`, JSON.stringify({
                    ...data,
                    showBloodGroup: next.bloodGroup,
                    showAllergies: next.allergies,
                    showMeds: next.meds,
                }));
            } catch { /* ignore */ }
        }
    };

    // ---- Save profile edits ----
    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Update in-context immediately (optimistic UI)
            if (isDoctor) {
                updateDoctor({
                    fullName: editName,
                    phone: editPhone,
                    institution: editInstitution,
                    designation: editDesignation,
                });
            } else {
                updatePatient({
                    fullName: editName,
                    phone: editPhone,
                    language: editLanguage as import("../../lib/types/patient").Language,
                    gender: editGender as "male" | "female" | "other",
                    height: editHeight || undefined,
                    weight: editWeight || undefined,
                    bloodGroup: editBloodGroup || undefined,
                    address: { line1: editLine1, city: editCity, state: editState, pincode: editPincode, country: "IN" as const },
                });
            }

            // 2. Persist to Cognito (await so we catch failures)
            // NOTE: dateOfBirth is NOT included — birthdate is immutable in Cognito
            const res = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: isDoctor ? doctor?.doctorId : patient?.patientId,
                    role: isDoctor ? "doctor" : "patient",
                    updates: isDoctor
                        ? { fullName: editName, phone: editPhone, institution: editInstitution, designation: editDesignation }
                        : {
                            fullName: editName,
                            phone: editPhone,
                            language: editLanguage,
                            gender: editGender,
                            height: editHeight,
                            weight: editWeight,
                            bloodGroup: editBloodGroup,
                            city: editCity,
                            state: editState,
                            pincode: editPincode,
                            line1: editLine1,
                        },
                }),
            });

            if (!res.ok) {
                const { error } = await res.json().catch(() => ({ error: "Server error" }));
                throw new Error(error || `Save failed (${res.status})`);
            }

            setSaved(true);
            setEditing(false);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(`Could not save: ${(err as Error).message}`);
        } finally {
            setSaving(false);
        }
    };

    // ---- Derived display values ----
    const displayName = isDoctor ? doctor?.fullName : patient?.fullName;
    const initials = (displayName || "?")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    if (profileLoading) {
        return (
            <div className={styles.page} style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
                <span style={{ color: "var(--brand-teal, #319795)", fontSize: 16 }}>Loading profile…</span>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* ---- Header: Avatar + name + badge ---- */}
            <div className={styles.headerCard}>
                <div className={styles.avatarWrap}>
                    <div className={styles.avatar}>
                        {photoUrl ? (
                            <img src={photoUrl} alt="Profile" className={styles.avatarImg} />
                        ) : (
                            initials
                        )}
                    </div>
                    {uploading && (
                        <div className={styles.avatarUploading}>…</div>
                    )}
                    <button
                        className={styles.avatarUploadBtn}
                        onClick={() => fileInputRef.current?.click()}
                        title="Change profile photo"
                    >
                        <Camera size={14} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className={styles.uploadInput}
                        onChange={handlePhotoChange}
                    />
                </div>

                <div className={styles.profileInfo}>
                    <h1 className={styles.profileName}>{displayName || "—"}</h1>
                    <div className={styles.profileSubline}>
                        <span className={`${styles.profileBadge} ${isDoctor ? styles.profileBadgeDoctor : ""}`}>
                            {isDoctor ? "🩺 Doctor" : "🛡️ Patient"}
                        </span>
                        {isDoctor ? (
                            <span className={styles.idPill}>{doctor?.mciNumber ? `MCI: ${doctor.mciNumber}` : "—"}</span>
                        ) : (
                            <span className={styles.idPill}>{patient?.patientId || "—"}</span>
                        )}
                    </div>
                    <button
                        className={`${styles.editToggle} ${editing ? styles.editToggleActive : ""}`}
                        onClick={() => { setEditing(!editing); setSaved(false); }}
                    >
                        {editing ? <Check size={14} /> : <Pencil size={14} />}
                        {editing ? "Editing…" : "Edit Profile"}
                    </button>
                </div>
            </div>

            {/* ---- Patient cards ---- */}
            {!isDoctor && patient && (
                <>
                    <div className={styles.cardsGrid}>
                        {/* Personal Info */}
                        <div className={styles.card}>
                            <h2 className={styles.cardTitle}>
                                <span className={styles.cardTitleIcon}><User size={20} /></span>
                                Personal Information
                            </h2>
                            <div className={styles.fieldGrid}>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Full Name</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editName} onChange={(e) => setEditName(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{patient.fullName}</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Date of Birth <span style={{ fontSize: 11, color: 'var(--brand-coral)', fontWeight: 600 }}></span></span>
                                    <span className={styles.fieldValue}>{formatDate(patient.dateOfBirth)}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Age</span>
                                    <span className={styles.fieldValue}>{calcAge(patient.dateOfBirth)} years</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Gender</span>
                                    {editing ? (
                                        <select
                                            className={styles.fieldInput}
                                            value={editGender}
                                            onChange={(e) => setEditGender(e.target.value)}
                                        >
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other / Prefer not to say</option>
                                        </select>
                                    ) : (
                                        <span className={styles.fieldValue} style={{ textTransform: "capitalize" }}>
                                            {patient.gender}
                                        </span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Card ID</span>
                                    <span className={`${styles.fieldValue}`} style={{ fontFamily: "monospace" }}>{patient.patientId}</span>
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className={styles.card}>
                            <h2 className={styles.cardTitle}>
                                <span className={styles.cardTitleIcon}><Phone size={16} /></span>
                                Contact &amp; Address
                            </h2>
                            <div className={styles.fieldGrid}>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Phone <span style={{ fontSize: 11, color: 'var(--brand-coral)', fontWeight: 600 }}></span></span>
                                    <span className={styles.fieldValue}>{patient.phone || "—"}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Address Line 1</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editLine1} onChange={(e) => setEditLine1(e.target.value)} placeholder="Street / Flat" />
                                    ) : (
                                        <span className={styles.fieldValue}>{patient.address?.line1 || "—"}</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>City</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{patient.address?.city || "—"}</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>State</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editState} onChange={(e) => setEditState(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{patient.address?.state || "—"}</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Pincode</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editPincode} onChange={(e) => setEditPincode(e.target.value)} maxLength={6} />
                                    ) : (
                                        <span className={styles.fieldValue}>{patient.address?.pincode || "—"}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Health & Vitals */}
                    <div className={`${styles.card} ${styles.cardFull}`}>
                        <h2 className={styles.cardTitle}>
                            <span className={styles.cardTitleIcon}><Heart size={16} /></span>
                            Health &amp; Vitals
                        </h2>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Height</span>
                                {editing ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <input
                                            className={styles.fieldInput}
                                            type="number"
                                            value={editHeight}
                                            onChange={(e) => setEditHeight(e.target.value)}
                                            placeholder="e.g. 170"
                                            min={50}
                                            max={250}
                                        />
                                        <span className={styles.fieldUnit}>cm</span>
                                    </div>
                                ) : (
                                    <span className={styles.fieldValue}>{patient.height ? `${patient.height} cm` : "—"}</span>
                                )}
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Weight</span>
                                {editing ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <input
                                            className={styles.fieldInput}
                                            type="number"
                                            value={editWeight}
                                            onChange={(e) => setEditWeight(e.target.value)}
                                            placeholder="e.g. 68"
                                            min={10}
                                            max={300}
                                            step="0.1"
                                        />
                                        <span className={styles.fieldUnit}>kg</span>
                                    </div>
                                ) : (
                                    <span className={styles.fieldValue}>{patient.weight ? `${patient.weight} kg` : "—"}</span>
                                )}
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Blood Group</span>
                                {editing ? (
                                    <select
                                        className={styles.fieldInput}
                                        value={editBloodGroup}
                                        onChange={(e) => setEditBloodGroup(e.target.value)}
                                    >
                                        <option value="">Not set</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A−</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B−</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O−</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB−</option>
                                    </select>
                                ) : (
                                    <span className={styles.fieldValue}>{patient.bloodGroup || "—"}</span>
                                )}
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>BMI</span>
                                <span className={styles.fieldValue}>
                                    {patient.height && patient.weight
                                        ? (Number(patient.weight) / Math.pow(Number(patient.height) / 100, 2)).toFixed(1)
                                        : "—"}
                                </span>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Blood Pressure <span style={{ fontSize: 10, color: 'var(--brand-coral, #E53E3E)', fontWeight: 600, marginLeft: 4 }}>Doctor only</span></span>
                                <span className={styles.fieldValue}>
                                    {patient.bpSystolic && patient.bpDiastolic
                                        ? `${patient.bpSystolic}/${patient.bpDiastolic} mmHg`
                                        : "—"}
                                </span>
                            </div>

                        </div>
                    </div>

                    {/* Emergency Info */}
                    <div className={`${styles.card} ${styles.cardFull}`}>
                        <div className={styles.emCardHeader}>
                            <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                                <span className={styles.cardTitleIcon}><AlertTriangle size={16} /></span>
                                Emergency Info
                            </h2>
                            <button className={`${styles.editToggle} ${emergencyEditing ? styles.editToggleActive : ""}`} onClick={handleEditEmergency}>
                                {emergencyEditing ? <X size={13} /> : <Pencil size={13} />}
                                {emergencyEditing ? "Cancel" : "Edit"}
                            </button>
                        </div>

                        {!emergencyEditing && (
                            <>
                                <p className={styles.emNote}>
                                    This information will be shown to emergency first responders
                                </p>
                                {emergencyUpdatedAt && (() => {
                                    const daysSince = Math.floor((Date.now() - new Date(emergencyUpdatedAt).getTime()) / 86400000);
                                    const isStale = daysSince > 90;
                                    return (
                                        <div className={`${styles.emLastUpdated} ${isStale ? styles.emLastUpdatedStale : ""}`}>
                                            <span>{isStale ? "⚠️" : "🕐"}</span>
                                            <span>
                                                <strong>Last updated:</strong> {fmtDate(emergencyUpdatedAt)}
                                                {isStale && <span className={styles.emStaleWarning}>{" — "}{daysSince} days ago. Please keep this up to date.</span>}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </>
                        )}

                        {emergencyEditing ? (
                            <div className={styles.emForm}>
                                {emergencyError && <p className={styles.emError}>{emergencyError}</p>}
                                {emergencySaved && <p className={styles.emSuccess}>✓ Saved</p>}

                                <div className={styles.emFormGroup}>
                                    <label className={styles.emLabel}>Known Allergies <span className={styles.emLabelHint}>(comma-separated)</span></label>
                                    <textarea className={styles.emTextarea} rows={2} placeholder="e.g. Penicillin, Sulfa drugs, Peanuts" value={editEmAllergiesTxt} onChange={e => setEditEmAllergiesTxt(e.target.value)} />
                                </div>

                                <div className={styles.emFormGroup}>
                                    <label className={styles.emLabel}>Critical Medications <span className={styles.emLabelHint}>(comma-separated)</span></label>
                                    <textarea className={styles.emTextarea} rows={2} placeholder="e.g. Warfarin 5mg daily, Insulin 10 units" value={editEmMedsTxt} onChange={e => setEditEmMedsTxt(e.target.value)} />
                                </div>

                                <div className={styles.emFormActions}>
                                    <button className={styles.emCancelBtn} onClick={() => setEmergencyEditing(false)}>Cancel</button>
                                    <button className={styles.emSaveBtn} onClick={handleSaveEmergency} disabled={emergencySaving}>
                                        {emergencySaving ? "Saving…" : "Save"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={styles.emergencyInfoGrid}>
                                    <div className={styles.emergencySection}>
                                        <span className={styles.emergencySectionLabel}>Allergies</span>
                                        {emergencyAllergies.length > 0 ? (
                                            <div className={styles.tagList}>
                                                {emergencyAllergies.map((a, i) => <span key={i} className={styles.tagAllergy}>{a}</span>)}
                                            </div>
                                        ) : <span className={styles.emergencyEmpty}>None recorded</span>}
                                    </div>
                                    <div className={styles.emergencySection}>
                                        <span className={styles.emergencySectionLabel}>Critical Medications</span>
                                        {emergencyCriticalMeds.length > 0 ? (
                                            <div className={styles.tagList}>
                                                {emergencyCriticalMeds.map((m, i) => <span key={i} className={styles.tagMed}>{m}</span>)}
                                            </div>
                                        ) : <span className={styles.emergencyEmpty}>None recorded</span>}
                                    </div>
                                </div>

                                <div className={styles.emVisDivider} />
                                <div className={styles.emVisSection}>
                                    <span className={styles.emVisTitle}>Visible to first responders</span>
                                    <div className={styles.emVisGrid}>
                                        <div className={styles.emVisRow}>
                                            <span className={styles.emVisLabel}>Blood Group</span>
                                            <button className={`${styles.emToggle} ${emShowBloodGroup ? styles.emToggleOn : ""}`} onClick={() => handleToggleVisibility("bloodGroup")} aria-label="Toggle blood group visibility" />
                                        </div>
                                        <div className={styles.emVisRow}>
                                            <span className={styles.emVisLabel}>Allergies</span>
                                            <button className={`${styles.emToggle} ${emShowAllergies ? styles.emToggleOn : ""}`} onClick={() => handleToggleVisibility("allergies")} aria-label="Toggle allergies visibility" />
                                        </div>
                                        <div className={styles.emVisRow}>
                                            <span className={styles.emVisLabel}>Critical Medications</span>
                                            <button className={`${styles.emToggle} ${emShowMeds ? styles.emToggleOn : ""}`} onClick={() => handleToggleVisibility("meds")} aria-label="Toggle medications visibility" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Emergency Contacts */}
                    {patient.emergencyContacts && patient.emergencyContacts.length > 0 && (
                        <div className={`${styles.card} ${styles.cardFull}`}>
                            <h2 className={styles.cardTitle}>
                                <span className={styles.cardTitleIcon}><Shield size={16} /></span>
                                Emergency Contacts
                            </h2>
                            <div className={styles.contactList}>
                                {patient.emergencyContacts.map((c, i) => (
                                    <div key={i} className={styles.contactItem}>
                                        <div className={styles.contactAvatar}>
                                            {c.name?.[0]?.toUpperCase() || "?"}
                                        </div>
                                        <div className={styles.contactInfo}>
                                            <div className={styles.contactName}>{c.name}</div>
                                            <div className={styles.contactMeta}>{c.relationship} · {c.phone}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ---- Doctor cards ---- */}
            {isDoctor && doctor && (
                <>
                    <div className={styles.cardsGrid}>
                        {/* Professional Info */}
                        <div className={styles.card}>
                            <h2 className={styles.cardTitle}>
                                <span className={styles.cardTitleIcon}><Stethoscope size={16} /></span>
                                Professional Details
                            </h2>
                            <div className={styles.fieldGrid}>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Full Name</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editName} onChange={(e) => setEditName(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{doctor.fullName}</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>MCI Number</span>
                                    <span className={`${styles.fieldValue}`} style={{ fontFamily: "monospace" }}>{doctor.mciNumber || "—"}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Designation</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editDesignation} onChange={(e) => setEditDesignation(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{doctor.designation || "—"}</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Institution</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editInstitution} onChange={(e) => setEditInstitution(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{doctor.institution || "—"}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className={styles.card}>
                            <h2 className={styles.cardTitle}>
                                <span className={styles.cardTitleIcon}><Phone size={16} /></span>
                                Contact Details
                            </h2>
                            <div className={styles.fieldGrid}>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Email</span>
                                    <span className={styles.fieldValue}>{doctor.email || "—"}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Phone</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{doctor.phone || "—"}</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Doctor ID</span>
                                    <span className={`${styles.fieldValue}`} style={{ fontFamily: "monospace" }}>{doctor.doctorId}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Doctor Emergency Info */}
                    <div className={`${styles.card} ${styles.cardFull}`}>
                        <div className={styles.emCardHeader}>
                            <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                                <span className={styles.cardTitleIcon}><AlertTriangle size={16} /></span>
                                My Emergency Info
                            </h2>
                            <button className={`${styles.editToggle} ${emergencyEditing ? styles.editToggleActive : ""}`} onClick={handleEditEmergency}>
                                {emergencyEditing ? <X size={13} /> : <Pencil size={13} />}
                                {emergencyEditing ? "Cancel" : "Edit"}
                            </button>
                        </div>

                        {emergencyEditing ? (
                            <div className={styles.emForm}>
                                {emergencyError && <p className={styles.emError}>{emergencyError}</p>}
                                {emergencySaved && <p className={styles.emSuccess}>✓ Saved</p>}
                                <div className={styles.emFormGroup}>
                                    <label className={styles.emLabel}>Known Allergies <span className={styles.emLabelHint}>(comma-separated)</span></label>
                                    <textarea className={styles.emTextarea} rows={2} placeholder="e.g. Penicillin, Sulfa drugs, Peanuts" value={editEmAllergiesTxt} onChange={e => setEditEmAllergiesTxt(e.target.value)} />
                                </div>
                                <div className={styles.emFormGroup}>
                                    <label className={styles.emLabel}>Critical Medications <span className={styles.emLabelHint}>(comma-separated)</span></label>
                                    <textarea className={styles.emTextarea} rows={2} placeholder="e.g. Warfarin 5mg daily, Insulin 10 units" value={editEmMedsTxt} onChange={e => setEditEmMedsTxt(e.target.value)} />
                                </div>
                                <div className={styles.emFormActions}>
                                    <button className={styles.emCancelBtn} onClick={() => setEmergencyEditing(false)}>Cancel</button>
                                    <button className={styles.emSaveBtn} onClick={handleSaveEmergency} disabled={emergencySaving}>
                                        {emergencySaving ? "Saving…" : "Save"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                {emergencyUpdatedAt && (() => {
                                    const daysSince = Math.floor((Date.now() - new Date(emergencyUpdatedAt).getTime()) / 86400000);
                                    const isStale = daysSince > 90;
                                    return (
                                        <div className={`${styles.emLastUpdated} ${isStale ? styles.emLastUpdatedStale : ""}`}>
                                            <span>{isStale ? "⚠️" : "🕐"}</span>
                                            <span>
                                                <strong>Last updated:</strong> {fmtDate(emergencyUpdatedAt)}
                                                {isStale && <span className={styles.emStaleWarning}>{" — "}{daysSince} days ago. Please keep this up to date.</span>}
                                            </span>
                                        </div>
                                    );
                                })()}
                            <div className={styles.emergencyInfoGrid}>
                                <div className={styles.emergencySection}>
                                    <span className={styles.emergencySectionLabel}>Allergies</span>
                                    {doctorEmAllergies.length > 0 ? (
                                        <div className={styles.tagList}>
                                            {doctorEmAllergies.map((a, i) => <span key={i} className={styles.tagAllergy}>{a}</span>)}
                                        </div>
                                    ) : <span className={styles.emergencyEmpty}>None recorded</span>}
                                </div>
                                <div className={styles.emergencySection}>
                                    <span className={styles.emergencySectionLabel}>Critical Medications</span>
                                    {doctorEmMeds.length > 0 ? (
                                        <div className={styles.tagList}>
                                            {doctorEmMeds.map((m, i) => <span key={i} className={styles.tagMed}>{m}</span>)}
                                        </div>
                                    ) : <span className={styles.emergencyEmpty}>None recorded</span>}
                                </div>
                            </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ---- Save/Cancel bar (editing mode only) ---- */}
            {editing && (
                <div className={styles.saveRow}>
                    <button className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>
            )}
            {saved && <span className={styles.successMsg}>✓ Profile updated</span>}
            {error && (
                <div style={{ margin: "8px 0", padding: "10px 16px", background: "rgba(229,62,62,0.10)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 10, color: "#c53030", fontSize: 14 }}>
                    ⚠️ {error} — <button style={{ background: "none", border: "none", color: "#c53030", cursor: "pointer", textDecoration: "underline" }} onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* ---- Logout ---- */}
            <div className={styles.logoutCard}>
                <div className={styles.logoutInfo}>
                    <span className={styles.logoutTitle}>Sign out</span>
                    <span className={styles.logoutSub}>You will be returned to the login screen</span>
                </div>
                <button
                    className={styles.logoutBtn}
                    onClick={async () => {
                        try {
                            await logout();
                        } catch {
                            // Auth state is cleared even if the API call fails
                        }
                        // Navigation is handled by AppRouter watching auth state —
                        // no manual navigate needed.
                    }}
                >
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </div>
    );
}
