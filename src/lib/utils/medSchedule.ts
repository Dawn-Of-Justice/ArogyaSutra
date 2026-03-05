// ============================================================
// Smart Medication Schedule Utility
// Parses frequency strings extracted from prescriptions
// and maps them to named time slots.
// ============================================================

import type { MedicationDetail } from "../types/timeline";
import type { HealthEntry } from "../types/timeline";

export type TimeSlot = "Morning" | "Afternoon" | "Evening" | "Night";

export interface ScheduledMed {
    name: string;
    dosage?: string;
    instructions?: string;
    slots: TimeSlot[];
    duration?: string;
    sourceEntryId: string;
    sourceTitle: string;
    prescribedDate: string; // ISO date of the prescription
}

// Map frequency text → time slots
const FREQ_SLOT_MAP: Array<{ pattern: RegExp; slots: TimeSlot[] }> = [
    // Once daily variations
    { pattern: /\b(od|once\s*daily|1[x\/]d|once\s*a\s*day|morning\s*only|am\s*dose)\b/i, slots: ["Morning"] },
    // Twice daily
    { pattern: /\b(bd|bid|twice\s*daily|2[x\/]d|twice\s*a\s*day|b\.d\.)\b/i, slots: ["Morning", "Evening"] },
    // Three times daily
    { pattern: /\b(tds|tid|three\s*times\s*daily|3[x\/]d|t\.d\.s\.|ter\s*die)\b/i, slots: ["Morning", "Afternoon", "Night"] },
    // Four times daily
    { pattern: /\b(qid|qds|four\s*times\s*daily|4[x\/]d|q\.i\.d\.)\b/i, slots: ["Morning", "Afternoon", "Evening", "Night"] },
    // Every 6 hours (≈ 4x daily)
    { pattern: /\b(q6h|every\s*6\s*(hour|hr)s?)\b/i, slots: ["Morning", "Afternoon", "Evening", "Night"] },
    // Every 8 hours (≈ 3x daily)
    { pattern: /\b(q8h|every\s*8\s*(hour|hr)s?)\b/i, slots: ["Morning", "Afternoon", "Night"] },
    // Every 12 hours (≈ 2x daily)
    { pattern: /\b(q12h|every\s*12\s*(hour|hr)s?)\b/i, slots: ["Morning", "Evening"] },
    // Bedtime / night
    { pattern: /\b(hs|hs|\bhs\b|at\s*bedtime|bedtime|night|nocte|at\s*night|night\s*only)\b/i, slots: ["Night"] },
    // Morning only
    { pattern: /\bmorning\b/i, slots: ["Morning"] },
    // After food (3x daily by default)
    { pattern: /\bafter\s*(meals?|food|eating)\b/i, slots: ["Morning", "Afternoon", "Night"] },
    // Before food (3x daily by default)
    { pattern: /\bbefore\s*(meals?|food)\b/i, slots: ["Morning", "Afternoon", "Night"] },
    // With food
    { pattern: /\bwith\s*(meals?|food)\b/i, slots: ["Morning", "Afternoon", "Night"] },
    // SOS / as needed (don't schedule, patient-discretion)
    { pattern: /\b(sos|prn|as\s*required|as\s*needed|when\s*required)\b/i, slots: [] },
];

/** Parse a frequency string into named time slots */
export function parseFrequencySlots(frequency?: string): TimeSlot[] {
    if (!frequency) return ["Morning"]; // default: once daily if unspecified
    const text = frequency.trim();
    for (const { pattern, slots } of FREQ_SLOT_MAP) {
        if (pattern.test(text)) return [...slots];
    }
    // Unknown — default once daily
    return ["Morning"];
}

/** How many days back to look for active prescriptions */
const ACTIVE_DAYS = 30;

/**
 * Derives today's medication schedule from the patient's recent RX timeline entries.
 * Returns schedule items grouped by time slot.
 */
export function buildTodaySchedule(entries: HealthEntry[]): Map<TimeSlot, ScheduledMed[]> {
    const cutoff = Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000;

    const bySlot = new Map<TimeSlot, ScheduledMed[]>([
        ["Morning", []],
        ["Afternoon", []],
        ["Evening", []],
        ["Night", []],
    ]);

    const rxEntries = entries.filter(
        (e) => e.documentType === "RX" && new Date(e.date).getTime() >= cutoff
    );

    for (const entry of rxEntries) {
        const meds: MedicationDetail[] = entry.metadata?.medications ?? [];
        for (const med of meds) {
            if (!med.name) continue;
            const slots = parseFrequencySlots(med.frequency);
            if (slots.length === 0) continue; // SOS / PRN — skip
            const item: ScheduledMed = {
                name: med.name,
                dosage: med.dosage,
                instructions: med.instructions,
                slots,
                duration: med.duration,
                sourceEntryId: entry.entryId,
                sourceTitle: entry.title,
                prescribedDate: entry.date,
            };
            for (const slot of slots) {
                bySlot.get(slot)!.push(item);
            }
        }
    }

    // Deduplicate by medication name within each slot (latest prescription wins)
    for (const [slot, items] of bySlot) {
        const seen = new Set<string>();
        const unique: ScheduledMed[] = [];
        for (const item of items) {
            const key = item.name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }
        bySlot.set(slot, unique);
    }

    return bySlot;
}

/** LocalStorage key for today's taken-status */
export function todayTakenKey(patientId: string): string {
    const d = new Date();
    return `medTaken_${patientId}_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Unique key for a single dose (slot + med name) */
export function doseKey(slot: TimeSlot, medName: string): string {
    return `${slot}::${medName.toLowerCase()}`;
}
