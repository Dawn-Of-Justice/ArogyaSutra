// ============================================================
// Admin Dashboard — Login + User Registration
// ============================================================

"use client";

import React, { useState, FormEvent } from "react";
import s from "./AdminDashboard.module.css";

type UserType = "patient" | "doctor";

interface CreatedUser {
    userType: string;
    cardId?: string;
    username: string;
    name: string;
    phone: string;
    dob?: string;
    email?: string;
    mciNumber?: string;
}

// ---- Admin Login Gate ----
function AdminLogin({ onLogin }: { onLogin: (secret: string) => void }) {
    const [secret, setSecret] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!secret.trim()) {
            setError("Enter the admin secret");
            return;
        }
        setError("");
        onLogin(secret.trim());
    };

    return (
        <div className={s.loginContainer}>
            <div className={s.loginCard}>
                <div style={{ textAlign: "center", fontSize: 48, marginBottom: 16 }}>
                    🔐
                </div>
                <h1 className={s.loginTitle}>Admin Access</h1>
                <p className={s.loginSubtitle}>
                    ArogyaSutra Administration Panel
                </p>
                <form className={s.loginForm} onSubmit={handleSubmit}>
                    {error && <div className={s.loginError}>{error}</div>}
                    <input
                        type="password"
                        className={s.loginInput}
                        placeholder="Enter admin secret"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className={s.loginButton}>
                        Authenticate
                    </button>
                </form>
            </div>
        </div>
    );
}

// ---- Patient Form ----
function PatientForm({
    adminSecret,
    onSuccess,
    onError,
    loading,
    setLoading,
}: {
    adminSecret: string;
    onSuccess: (user: CreatedUser) => void;
    onError: (msg: string) => void;
    loading: boolean;
    setLoading: (v: boolean) => void;
}) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [dob, setDob] = useState("");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        onError("");

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminSecret,
                    userType: "patient",
                    name,
                    phone,
                    dob,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                onError(data.error || "Failed to create patient");
            } else {
                onSuccess(data);
                setName("");
                setPhone("");
                setDob("");
            }
        } catch {
            onError("Network error — check if the server is running");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={s.formCard}>
            <h2 className={s.formTitle}>👤 New Patient</h2>
            <form className={s.form} onSubmit={handleSubmit}>
                <div className={s.fieldGroup}>
                    <label className={s.label}>Full Name</label>
                    <input
                        className={s.input}
                        placeholder="e.g. Rajesh Kumar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className={s.row}>
                    <div className={s.fieldGroup}>
                        <label className={s.label}>Phone</label>
                        <input
                            className={s.input}
                            type="tel"
                            placeholder="+919876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                    </div>
                    <div className={s.fieldGroup}>
                        <label className={s.label}>Date of Birth</label>
                        <input
                            className={s.input}
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className={s.submitButton}
                    disabled={loading}
                >
                    {loading ? "Creating..." : "Create Patient"}
                </button>
            </form>
        </div>
    );
}

// ---- Doctor Form ----
function DoctorForm({
    adminSecret,
    onSuccess,
    onError,
    loading,
    setLoading,
}: {
    adminSecret: string;
    onSuccess: (user: CreatedUser) => void;
    onError: (msg: string) => void;
    loading: boolean;
    setLoading: (v: boolean) => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [mciNumber, setMciNumber] = useState("");
    const [institution, setInstitution] = useState("");
    const [designation, setDesignation] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        onError("");

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminSecret,
                    userType: "doctor",
                    name,
                    email,
                    phone,
                    mciNumber,
                    institution: institution || undefined,
                    designation: designation || undefined,
                    password,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                onError(data.error || "Failed to create doctor");
            } else {
                onSuccess(data);
                setName("");
                setEmail("");
                setPhone("");
                setMciNumber("");
                setInstitution("");
                setDesignation("");
                setPassword("");
            }
        } catch {
            onError("Network error — check if the server is running");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={s.formCard}>
            <h2 className={s.formTitle}>🩺 New Doctor</h2>
            <form className={s.form} onSubmit={handleSubmit}>
                <div className={s.fieldGroup}>
                    <label className={s.label}>Full Name</label>
                    <input
                        className={s.input}
                        placeholder="e.g. Dr. Ananya Sharma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className={s.row}>
                    <div className={s.fieldGroup}>
                        <label className={s.label}>Email</label>
                        <input
                            className={s.input}
                            type="email"
                            placeholder="doctor@hospital.in"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className={s.fieldGroup}>
                        <label className={s.label}>Phone</label>
                        <input
                            className={s.input}
                            type="tel"
                            placeholder="+919876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className={s.row}>
                    <div className={s.fieldGroup}>
                        <label className={s.label}>MCI Number</label>
                        <input
                            className={s.input}
                            placeholder="MCI-12345"
                            value={mciNumber}
                            onChange={(e) => setMciNumber(e.target.value)}
                            required
                        />
                    </div>
                    <div className={s.fieldGroup}>
                        <label className={s.label}>Designation</label>
                        <input
                            className={s.input}
                            placeholder="e.g. Cardiologist"
                            value={designation}
                            onChange={(e) => setDesignation(e.target.value)}
                        />
                    </div>
                </div>

                <div className={s.fieldGroup}>
                    <label className={s.label}>Institution</label>
                    <input
                        className={s.input}
                        placeholder="e.g. AIIMS Delhi"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                    />
                </div>

                <div className={s.fieldGroup}>
                    <label className={s.label}>Password</label>
                    <input
                        className={s.input}
                        type="password"
                        placeholder="Min 12 chars, uppercase, number, symbol"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={12}
                    />
                </div>

                <button
                    type="submit"
                    className={s.submitButton}
                    disabled={loading}
                >
                    {loading ? "Creating..." : "Create Doctor"}
                </button>
            </form>
        </div>
    );
}

// ---- Main Admin Component ----
export default function AdminDashboard() {
    const [adminSecret, setAdminSecret] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<UserType>("patient");
    const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Login gate
    if (!adminSecret) {
        return <AdminLogin onLogin={(s) => setAdminSecret(s)} />;
    }

    const handleSuccess = (user: CreatedUser) => {
        setCreatedUser(user);
        setError("");
    };

    const handleError = (msg: string) => {
        setError(msg);
        if (msg === "Unauthorized — invalid admin secret") {
            setAdminSecret(null);
        }
    };

    return (
        <div className={s.container}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
                {/* Header */}
                <div className={s.header}>
                    <div>
                        <h1 className={s.headerTitle}>🛡️ Admin Panel</h1>
                        <p className={s.headerSub}>
                            ArogyaSutra User Management
                        </p>
                    </div>
                    <button
                        className={s.logoutButton}
                        onClick={() => setAdminSecret(null)}
                    >
                        Logout
                    </button>
                </div>

                {/* Tabs */}
                <div className={s.tabs}>
                    <button
                        className={`${s.tab} ${activeTab === "patient" ? s.tabActive : ""}`}
                        onClick={() => {
                            setActiveTab("patient");
                            setCreatedUser(null);
                            setError("");
                        }}
                    >
                        👤 Patient
                    </button>
                    <button
                        className={`${s.tab} ${activeTab === "doctor" ? s.tabActive : ""}`}
                        onClick={() => {
                            setActiveTab("doctor");
                            setCreatedUser(null);
                            setError("");
                        }}
                    >
                        🩺 Doctor
                    </button>
                </div>

                {/* Error */}
                {error && <div className={s.error}>{error}</div>}

                {/* Forms */}
                {activeTab === "patient" ? (
                    <PatientForm
                        adminSecret={adminSecret}
                        onSuccess={handleSuccess}
                        onError={handleError}
                        loading={loading}
                        setLoading={setLoading}
                    />
                ) : (
                    <DoctorForm
                        adminSecret={adminSecret}
                        onSuccess={handleSuccess}
                        onError={handleError}
                        loading={loading}
                        setLoading={setLoading}
                    />
                )}

                {/* Success Card */}
                {createdUser && (
                    <div className={s.successCard}>
                        <p className={s.successTitle}>
                            ✅ {createdUser.userType === "patient" ? "Patient" : "Doctor"} Created Successfully
                        </p>

                        {createdUser.cardId && (
                            <div className={s.successRow}>
                                <span className={s.successLabel}>Card ID</span>
                                <span className={s.cardIdHighlight}>
                                    {createdUser.cardId}
                                </span>
                            </div>
                        )}

                        <div className={s.successRow}>
                            <span className={s.successLabel}>Name</span>
                            <span className={s.successValue}>
                                {createdUser.name}
                            </span>
                        </div>

                        <div className={s.successRow}>
                            <span className={s.successLabel}>Username</span>
                            <span className={s.successValue}>
                                {createdUser.username}
                            </span>
                        </div>

                        <div className={s.successRow}>
                            <span className={s.successLabel}>Phone</span>
                            <span className={s.successValue}>
                                {createdUser.phone}
                            </span>
                        </div>

                        {createdUser.email && (
                            <div className={s.successRow}>
                                <span className={s.successLabel}>Email</span>
                                <span className={s.successValue}>
                                    {createdUser.email}
                                </span>
                            </div>
                        )}

                        {createdUser.mciNumber && (
                            <div className={s.successRow}>
                                <span className={s.successLabel}>
                                    MCI Number
                                </span>
                                <span className={s.successValue}>
                                    {createdUser.mciNumber}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
