// ============================================================
// Shared notification data — used by AppShell bell and
// NotificationsScreen so both always show the same list.
// ============================================================

import React from "react";
import {
    User, ClipboardList, ShieldCheck, Pill, Hospital,
    FileText, ShieldAlert, Settings,
} from "lucide-react";

export type NotifCategory = "all" | "system" | "security" | "health";

export interface AppNotification {
    id: number;
    icon: React.ReactNode;
    title: string;
    desc: string;
    time: string;
    unread: boolean;
    category: NotifCategory;
}

/** Master notifications list. Both AppShell and NotificationsScreen use this. */
export const ALL_NOTIFICATIONS: AppNotification[] = [
    { id: 1, icon: <User size={16} />, title: "Welcome to ArogyaSutra!", desc: "Your health vault is ready. Start by scanning your first medical document to build your digital timeline.", time: "Just now", unread: true, category: "system" },
    { id: 2, icon: <ClipboardList size={16} />, title: "Timeline synced", desc: "All your health records are up to date. Your encrypted data has been verified against the latest backup.", time: "2 min ago", unread: true, category: "health" },
    { id: 3, icon: <ShieldCheck size={16} />, title: "Security check passed", desc: "Your encryption keys have been verified. Zero-knowledge encryption is active — your data is safe.", time: "5 min ago", unread: false, category: "security" },
    { id: 4, icon: <Pill size={16} />, title: "Medication reminder", desc: "Don't forget to take your prescribed medications today. Check your timeline for dosage details.", time: "1 hour ago", unread: false, category: "health" },
    { id: 5, icon: <Hospital size={16} />, title: "Doctor access granted", desc: "A doctor now has read access to your health timeline. You can revoke access anytime from Settings.", time: "2 hours ago", unread: false, category: "security" },
    { id: 6, icon: <FileText size={16} />, title: "Document processed", desc: "Your lab report has been digitised with 94% confidence. Review the extracted data in your Timeline.", time: "Yesterday", unread: false, category: "health" },
    { id: 7, icon: <ShieldAlert size={16} />, title: "Break-Glass access logged", desc: "Emergency access was attempted for your records. Check your audit log for full details.", time: "2 days ago", unread: false, category: "security" },
    { id: 8, icon: <Settings size={16} />, title: "App updated", desc: "ArogyaSutra has been updated with new features including the AI Clinical Assistant and improved offline support.", time: "3 days ago", unread: false, category: "system" },
];

export function applyReadIds(base: AppNotification[], readIds: number[]): AppNotification[] {
    const set = new Set(readIds);
    return base.map((n) => ({ ...n, unread: !set.has(n.id) }));
}

export function localReadIds(uid: string): number[] {
    try {
        const raw = localStorage.getItem(`notif_read_${uid}`);
        return raw ? (JSON.parse(raw) as number[]) : [];
    } catch { return []; }
}

export function saveLocalReadIds(uid: string, readIds: number[]) {
    try { localStorage.setItem(`notif_read_${uid}`, JSON.stringify(readIds)); } catch { /* ignore */ }
}
