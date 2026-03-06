// ============================================================
// Input validation utilities
// All functions return null (valid) or an error string
// ============================================================

/** Name: 2–80 chars, only letters/spaces/hyphens/apostrophes */
export function validateName(v: string): string | null {
    const s = v.trim();
    if (!s) return "Name is required.";
    if (s.length < 2) return "Name must be at least 2 characters.";
    if (s.length > 80) return "Name must be at most 80 characters.";
    if (/[0-9]/.test(s)) return "Name must not contain numbers.";
    return null;
}

/** Indian phone: 10 digits, optionally prefixed with +91 or 0 */
export function validatePhone(v: string): string | null {
    if (!v) return null; // optional field
    const digits = v.replace(/[\s\-+()]/g, "").replace(/^91/, "").replace(/^0/, "");
    if (!/^\d{10}$/.test(digits)) return "Enter a valid 10-digit phone number.";
    return null;
}

/** 6-digit Indian pincode */
export function validatePincode(v: string): string | null {
    if (!v) return null; // optional
    if (!/^\d{6}$/.test(v.trim())) return "Pincode must be exactly 6 digits.";
    return null;
}

/** Height in cm: 50–300 */
export function validateHeight(v: string): string | null {
    if (!v) return null; // optional
    const n = Number(v);
    if (isNaN(n) || !Number.isFinite(n)) return "Height must be a number.";
    if (n < 50 || n > 300) return "Height must be between 50 and 300 cm.";
    return null;
}

/** Weight in kg: 1–500 */
export function validateWeight(v: string): string | null {
    if (!v) return null; // optional
    const n = Number(v);
    if (isNaN(n) || !Number.isFinite(n)) return "Weight must be a number.";
    if (n < 1 || n > 500) return "Weight must be between 1 and 500 kg.";
    return null;
}

/** Blood pressure systolic: 50–300 mmHg */
export function validateBpSys(v: string): string | null {
    if (!v) return null;
    const n = Number(v);
    if (isNaN(n) || !Number.isInteger(n)) return "BP must be a whole number.";
    if (n < 50 || n > 300) return "Systolic BP must be between 50 and 300 mmHg.";
    return null;
}

/** Blood pressure diastolic: 30–200 mmHg, must be < systolic */
export function validateBpDia(v: string, sys: string): string | null {
    if (!v) return null;
    const n = Number(v);
    if (isNaN(n) || !Number.isInteger(n)) return "BP must be a whole number.";
    if (n < 30 || n > 200) return "Diastolic BP must be between 30 and 200 mmHg.";
    if (sys && Number(sys) <= n) return "Diastolic must be less than systolic.";
    return null;
}

/** Generic comma-separated list: max `itemMax` chars per item, max `listMax` total chars, max `count` items */
export function validateCommaList(
    v: string,
    label: string,
    { itemMax = 50, listMax = 500, count = 20 } = {}
): string | null {
    if (!v.trim()) return null;
    if (v.length > listMax) return `${label} must not exceed ${listMax} characters total.`;
    const items = v.split(",").map((x) => x.trim()).filter(Boolean);
    if (items.length > count) return `${label}: max ${count} items allowed.`;
    for (const item of items) {
        if (item.length > itemMax) return `Each ${label.toLowerCase()} entry must be under ${itemMax} characters.`;
    }
    return null;
}

/** Short text field: max length */
export function validateMaxLen(v: string, label: string, max: number): string | null {
    if (v.length > max) return `${label} must be at most ${max} characters.`;
    return null;
}

/** Required short text: min 2, max chars */
export function validateRequired(v: string, label: string, max = 120): string | null {
    if (!v.trim()) return `${label} is required.`;
    if (v.trim().length < 2) return `${label} must be at least 2 characters.`;
    if (v.length > max) return `${label} must be at most ${max} characters.`;
    return null;
}

/** Collect first non-null error from a list of validation results */
export function firstError(...results: (string | null)[]): string | null {
    return results.find((r) => r !== null) ?? null;
}
