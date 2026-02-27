// ============================================================
// SettingsScreen — App preferences & account settings
// ============================================================

"use client";

import React, { useState } from "react";
import styles from "./SettingsScreen.module.css";

interface SettingsScreenProps {
    onNavigate: (screen: string) => void;
}

export default function SettingsScreen({ onNavigate }: SettingsScreenProps) {
    const [notifications, setNotifications] = useState(true);
    const [biometric, setBiometric] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [language, setLanguage] = useState("en");

    return (
        <div className={styles.page}>
            {/* ---- General ---- */}
            <div className={styles.card}>
                <h3 className={styles.cardTitle}><span>🎨</span> Appearance</h3>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Dark Mode</span>
                        <span className={styles.rowDesc}>Use dark theme across the app</span>
                    </div>
                    <button
                        className={`${styles.toggle} ${darkMode ? styles.toggleOn : ""}`}
                        onClick={() => setDarkMode((v) => !v)}
                        aria-label="Toggle dark mode"
                    />
                </div>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Language</span>
                        <span className={styles.rowDesc}>Select your preferred language</span>
                    </div>
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
                </div>
            </div>

            {/* ---- Notifications ---- */}
            <div className={styles.card}>
                <h3 className={styles.cardTitle}><span>🔔</span> Notifications</h3>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Push Notifications</span>
                        <span className={styles.rowDesc}>Receive alerts for emergency access and updates</span>
                    </div>
                    <button
                        className={`${styles.toggle} ${notifications ? styles.toggleOn : ""}`}
                        onClick={() => setNotifications((v) => !v)}
                        aria-label="Toggle notifications"
                    />
                </div>
            </div>

            {/* ---- Security ---- */}
            <div className={styles.card}>
                <h3 className={styles.cardTitle}><span>🔒</span> Security</h3>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Biometric Unlock</span>
                        <span className={styles.rowDesc}>Use fingerprint or face to unlock on this device</span>
                    </div>
                    <button
                        className={`${styles.toggle} ${biometric ? styles.toggleOn : ""}`}
                        onClick={() => setBiometric((v) => !v)}
                        aria-label="Toggle biometric"
                    />
                </div>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Active Sessions</span>
                        <span className={styles.rowDesc}>View and manage your active login sessions</span>
                    </div>
                    <button className={styles.select} style={{ cursor: "pointer" }}>View</button>
                </div>
            </div>

            {/* ---- Data & Privacy ---- */}
            <div className={styles.card}>
                <h3 className={styles.cardTitle}><span>📦</span> Data &amp; Privacy</h3>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Export Health Data</span>
                        <span className={styles.rowDesc}>Download your records as PDF or FHIR JSON</span>
                    </div>
                    <button className={styles.select} style={{ cursor: "pointer" }}>Export</button>
                </div>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Emergency Data</span>
                        <span className={styles.rowDesc}>Configure blood group, allergies, and critical meds</span>
                    </div>
                    <button className={styles.select} style={{ cursor: "pointer" }}>Edit</button>
                </div>
            </div>

            {/* ---- Danger Zone ---- */}
            <div className={styles.dangerCard}>
                <h3 className={styles.cardTitle}><span>⚠️</span> Danger Zone</h3>

                <div className={styles.row}>
                    <div className={styles.rowInfo}>
                        <span className={styles.rowLabel}>Delete Account</span>
                        <span className={styles.rowDesc}>Permanently delete your account and all health data</span>
                    </div>
                    <button className={styles.dangerBtn}>Delete</button>
                </div>
            </div>

            <p className={styles.version}>ArogyaSutra v0.1.0</p>
        </div>
    );
}
