// ============================================================
// Date formatting utilities — all display uses DD/MM/YYYY
// Internals (DB, API, <input type="date">) stay ISO YYYY-MM-DD
// ============================================================

/** "03/03/2026" */
export function fmtDate(dateStr: string | Date | null | undefined): string {
    if (!dateStr) return "—";
    try {
        const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
        if (isNaN(d.getTime())) return String(dateStr);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch { return String(dateStr); }
}

/** "03/03" — for compact displays without year */
export function fmtDateShort(dateStr: string | Date | null | undefined): string {
    if (!dateStr) return "—";
    try {
        const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
        if (isNaN(d.getTime())) return String(dateStr);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return `${dd}/${mm}`;
    } catch { return String(dateStr); }
}

/** "Mar 2026" — for month/year group labels */
export function fmtMonthYear(d: Date): string {
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "March 2026" — for full month group labels */
export function fmtMonthYearLong(d: Date): string {
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
