// ============================================================
// Card ID Utilities
// AS-XXXX-XXXX-XXXX generation and validation
// 12 digits (3 groups of 4) — supports up to 1 trillion unique IDs,
// well beyond India's population of 1.4 billion.
// ============================================================

const CARD_ID_REGEX = /^AS-[0-9]{4}-[0-9]{4}-[0-9]{4}$/;

/**
 * Validates a Card ID matches the AS-XXXX-XXXX-XXXX format.
 */
export function isValidCardId(cardId: string): boolean {
    return CARD_ID_REGEX.test(cardId);
}

/**
 * Generates a new random Card ID in AS-XXXX-XXXX-XXXX format.
 * Uses crypto.getRandomValues for secure randomness.
 */
export function generateCardId(): string {
    const array = new Uint16Array(3);
    crypto.getRandomValues(array);

    const part1 = String(array[0] % 10000).padStart(4, "0");
    const part2 = String(array[1] % 10000).padStart(4, "0");
    const part3 = String(array[2] % 10000).padStart(4, "0");

    return `AS-${part1}-${part2}-${part3}`;
}

/**
 * Masks a Card ID for UI display (shows last 4 digits only).
 * AS-1234-5678-9012 → AS-****-****-9012
 */
export function maskCardId(cardId: string): string {
    if (!isValidCardId(cardId)) return cardId;
    return `AS-****-****-${cardId.slice(-4)}`;
}

/**
 * Normalizes user input into a valid Card ID format.
 * Strips spaces, dashes, and adds the AS- prefix if missing.
 */
export function normalizeCardInput(input: string): string {
    // Remove all non-digits
    const digits = input.replace(/[^0-9]/g, "");

    if (digits.length !== 12) return input;

    return `AS-${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

/**
 * Normalizes the suffix portion of a Card ID (everything after "AS-").
 * Accepts digits and auto-formats to XXXX-XXXX-XXXX as the user types.
 * Also handles pasting full 12-digit strings.
 */
export function normalizeCardSuffix(input: string): string {
    const digits = input.replace(/[^0-9]/g, "").slice(0, 12);
    const g1 = digits.slice(0, 4);
    const g2 = digits.slice(4, 8);
    const g3 = digits.slice(8, 12);
    if (!g2) return g1;
    if (!g3) return `${g1}-${g2}`;
    return `${g1}-${g2}-${g3}`;
}
