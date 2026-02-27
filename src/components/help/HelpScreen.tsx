// ============================================================
// HelpScreen — FAQ, contact, and support info
// ============================================================

"use client";

import React, { useState } from "react";
import styles from "./HelpScreen.module.css";

interface HelpScreenProps {
    onNavigate: (screen: string) => void;
}

const FAQ_ITEMS = [
    {
        q: "What is the ArogyaSutra Card?",
        a: "The ArogyaSutra Card is a physical card with your unique Patient ID (AS-XXXX-XXXX). It's used as the first layer of authentication and is part of the cryptographic key that protects your health data.",
    },
    {
        q: "How does Zero-Knowledge encryption work?",
        a: "All your health data is encrypted on your device before it reaches our servers. The encryption key is derived from your Card ID and OTP — it's never stored anywhere. Even our team cannot read your data.",
    },
    {
        q: "What happens during an emergency (Break-Glass)?",
        a: "Emergency personnel with verified medical credentials can access your critical info (blood group, allergies, medications, conditions) for a limited 5-minute window. You'll be notified immediately via SMS.",
    },
    {
        q: "Can my doctor see all my records?",
        a: "Only if you grant access. Doctors can view your timeline and add notes (append-only), but they cannot modify or delete your existing records. You can revoke access at any time.",
    },
    {
        q: "How do I scan a medical document?",
        a: "Navigate to \"Scan Document\" from the dashboard. Take a photo of your prescription, lab report, or discharge summary. Our AI (powered by Amazon Textract & Comprehend Medical) will extract the data automatically.",
    },
    {
        q: "Can I use the app offline?",
        a: "Yes! ArogyaSutra is a PWA. Previously loaded timeline entries are cached locally in IndexedDB. You can also capture documents offline — they'll upload automatically when you're back online.",
    },
    {
        q: "How do I export my health data?",
        a: "Go to Settings → Data & Privacy → Export. You can download your records in PDF format (human-readable) or FHIR JSON (machine-readable for other health systems).",
    },
];

export default function HelpScreen({ onNavigate }: HelpScreenProps) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    return (
        <div className={styles.page}>
            {/* ---- Hero ---- */}
            <div className={styles.hero}>
                <div className={styles.heroIcon}>💡</div>
                <h2>Help &amp; Support</h2>
                <p>Find answers to common questions or reach out to our team.</p>
            </div>

            {/* ---- FAQ ---- */}
            <div className={styles.card}>
                <h3 className={styles.cardTitle}><span>❓</span> Frequently Asked Questions</h3>

                {FAQ_ITEMS.map((item, i) => (
                    <div key={i} className={styles.faqItem}>
                        <button
                            className={styles.faqQ}
                            onClick={() => setOpenIdx(openIdx === i ? null : i)}
                        >
                            {item.q}
                            <span className={`${styles.faqChevron} ${openIdx === i ? styles.faqChevronOpen : ""}`}>
                                ▼
                            </span>
                        </button>
                        {openIdx === i && (
                            <p className={styles.faqA}>{item.a}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* ---- Contact ---- */}
            <div className={styles.card}>
                <h3 className={styles.cardTitle}><span>📞</span> Contact Us</h3>

                <div className={styles.contactGrid}>
                    <div className={styles.contactItem}>
                        <div className={styles.contactIcon}>📧</div>
                        <div className={styles.contactInfo}>
                            <span className={styles.contactLabel}>Email</span>
                            <span className={styles.contactValue}>support@arogyasutra.in</span>
                        </div>
                    </div>

                    <div className={styles.contactItem}>
                        <div className={styles.contactIcon}>📱</div>
                        <div className={styles.contactInfo}>
                            <span className={styles.contactLabel}>Phone</span>
                            <span className={styles.contactValue}>1800-123-4567</span>
                        </div>
                    </div>

                    <div className={styles.contactItem}>
                        <div className={styles.contactIcon}>💬</div>
                        <div className={styles.contactInfo}>
                            <span className={styles.contactLabel}>Live Chat</span>
                            <span className={styles.contactValue}>9 AM – 6 PM IST</span>
                        </div>
                    </div>

                    <div className={styles.contactItem}>
                        <div className={styles.contactIcon}>🏢</div>
                        <div className={styles.contactInfo}>
                            <span className={styles.contactLabel}>Office</span>
                            <span className={styles.contactValue}>Bengaluru, India</span>
                        </div>
                    </div>
                </div>
            </div>

            <p className={styles.version}>ArogyaSutra v0.1.0</p>
        </div>
    );
}
