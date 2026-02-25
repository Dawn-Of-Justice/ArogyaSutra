// ============================================================
// Card ID Utilities
// AS-XXXX-XXXX generation and validation
// ============================================================

const CARD_ID_REGEX = /^AS-[0-9]{4}-[0-9]{4}$/;

/**
 * Validates a Card ID matches the AS-XXXX-XXXX format.
 */
export function isValidCardId(cardId: string): boolean {
    return CARD_ID_REGEX.test(cardId);
}

/**
 * Generates a new random Card ID in AS-XXXX-XXXX format.
 * Uses crypto.getRandomValues for secure randomness.
 */
export function generateCardId(): string {
    const array = new Uint16Array(2);
    crypto.getRandomValues(array);

    const part1 = String(array[0] % 10000).padStart(4, "0");
    const part2 = String(array[1] % 10000).padStart(4, "0");

    return `AS-${part1}-${part2}`;
}

/**
 * Masks a Card ID for UI display (shows last 4 digits only).
 * AS-1234-5678 → AS-****-5678
 */
export function maskCardId(cardId: string): string {
    if (!isValidCardId(cardId)) return cardId;
    return `AS-****-${cardId.slice(-4)}`;
}

/**
 * Normalizes user input into a valid Card ID format.
 * Strips spaces, dashes, and adds the AS- prefix if missing.
 */
export function normalizeCardInput(input: string): string {
    // Remove all non-digits
    const digits = input.replace(/[^0-9]/g, "");

    if (digits.length !== 8) return input;

    return `AS-${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
}
