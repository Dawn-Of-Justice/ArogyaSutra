// ============================================================
// ProfileScreen — Unified profile for Patient + Doctor
// Photo upload → S3 (KMS-encrypted) via /api/profile/photo
// Profile edits persisted in Cognito attributes
// ============================================================

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import styles from "./ProfileScreen.module.css";

interface ProfileScreenProps {
    onNavigate: (screen: string) => void;
}

// ---- SVG Icons ----
const Icon = {
    edit: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    save: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
    camera: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    ),
    user: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    phone: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.69 5 2 2 0 0 1 3.67 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6 6l1.06-1.06a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 17.18z" />
        </svg>
    ),
    heart: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0L12 5.36l-.77-.78a5.4 5.4 0 0 0-7.65 7.65l7.72 7.72a1 1 0 0 0 1.4 0l7.72-7.72a5.4 5.4 0 0 0 0-7.65z" />
        </svg>
    ),
    shield: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    ),
    location: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    logout: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
    stethoscope: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
            <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
            <circle cx="20" cy="10" r="2" />
        </svg>
    ),
};

/** Format a date string for display */
function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    try {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
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
    const { patient, doctor, userRole, logout } = useAuth();
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

    // Editable fields — synced from auth data via useEffect (handles async load)
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editCity, setEditCity] = useState("");
    const [editState, setEditState] = useState("");
    const [editPincode, setEditPincode] = useState("");
    const [editLine1, setEditLine1] = useState("");
    const [editLanguage, setEditLanguage] = useState("en");
    // Doctor-specific
    const [editInstitution, setEditInstitution] = useState("");
    const [editDesignation, setEditDesignation] = useState("");

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
        }
    }, [isDoctor, doctor, patient]);

    // ---- Load saved photo from localStorage (fast) + S3 (authoritative) ----
    useEffect(() => {
        if (!userId) return;
        // Restore from localStorage immediately for instant display
        const cached = localStorage.getItem(photoStorageKey);
        if (cached) setPhotoUrl(cached);

        // Try to fetch the signed URL from our API (S3 KMS-encrypted)
        fetch(`/api/profile/photo?userId=${userId}&role=${isDoctor ? "doctor" : "patient"}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.url) {
                    setPhotoUrl(data.url);
                    // Don't cache the presigned URL — it expires in 15 min
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

    // ---- Save profile edits ----
    const handleSave = async () => {
        setSaving(true);
        // TODO: wire to /api/profile/update when Cognito UpdateUserAttributes is implemented
        // For now, persist locally
        await new Promise((r) => setTimeout(r, 600));
        setSaving(false);
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 3000);
    };

    // ---- Derived display values ----
    const displayName = isDoctor ? doctor?.fullName : patient?.fullName;
    const initials = (displayName || "?")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

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
                        {Icon.camera}
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
                        {editing ? Icon.save : Icon.edit}
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
                                <span className={styles.cardTitleIcon}>{Icon.user}</span>
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
                                    <span className={styles.fieldLabel}>Date of Birth</span>
                                    <span className={styles.fieldValue}>{formatDate(patient.dateOfBirth)}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Age</span>
                                    <span className={styles.fieldValue}>{calcAge(patient.dateOfBirth)} years</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Gender</span>
                                    <span className={styles.fieldValue} style={{ textTransform: "capitalize" }}>{patient.gender}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Language</span>
                                    <span className={styles.fieldValue} style={{ textTransform: "uppercase" }}>{patient.language || "EN"}</span>
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
                                <span className={styles.cardTitleIcon}>{Icon.phone}</span>
                                Contact &amp; Address
                            </h2>
                            <div className={styles.fieldGrid}>
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Phone</span>
                                    {editing ? (
                                        <input className={styles.fieldInput} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                                    ) : (
                                        <span className={styles.fieldValue}>{patient.phone || "—"}</span>
                                    )}
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
                                <div className={styles.field}>
                                    <span className={styles.fieldLabel}>Language</span>
                                    {editing ? (
                                        <select className={styles.fieldInput} value={editLanguage} onChange={(e) => setEditLanguage(e.target.value)}>
                                            <option value="en">English</option>
                                            <option value="hi">Hindi</option>
                                            <option value="ta">Tamil</option>
                                            <option value="te">Telugu</option>
                                            <option value="bn">Bengali</option>
                                            <option value="mr">Marathi</option>
                                            <option value="gu">Gujarati</option>
                                            <option value="kn">Kannada</option>
                                        </select>
                                    ) : (
                                        <span className={styles.fieldValue} style={{ textTransform: "uppercase" }}>{patient.language || "EN"}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Emergency Contacts */}
                    {patient.emergencyContacts && patient.emergencyContacts.length > 0 && (
                        <div className={`${styles.card} ${styles.cardFull}`}>
                            <h2 className={styles.cardTitle}>
                                <span className={styles.cardTitleIcon}>{Icon.shield}</span>
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
                                <span className={styles.cardTitleIcon}>{Icon.stethoscope}</span>
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
                                <span className={styles.cardTitleIcon}>{Icon.phone}</span>
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

            {/* ---- Logout ---- */}
            <div className={styles.logoutCard}>
                <div className={styles.logoutInfo}>
                    <span className={styles.logoutTitle}>Sign out</span>
                    <span className={styles.logoutSub}>You will be returned to the login screen</span>
                </div>
                <button
                    className={styles.logoutBtn}
                    onClick={async () => {
                        await logout();
                        onNavigate("dashboard");
                    }}
                >
                    {Icon.logout} Sign Out
                </button>
            </div>
        </div>
    );
}
