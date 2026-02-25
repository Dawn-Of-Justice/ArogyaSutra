// ============================================================
// Authentication Type Definitions
// ============================================================

/** Current authentication state */
export type AuthState =
    | "UNAUTHENTICATED"
    | "CARD_ID_ENTERED"
    | "DOB_VERIFIED"
    | "OTP_SENT"
    | "AUTHENTICATED"
    | "LOCKED";

/** Login session tracking */
export interface LoginSession {
    patientId: string;
    state: AuthState;
    cognitoSession?: string; // Cognito session token for multi-step auth
    failedAttempts: number;
    lockUntil?: string; // ISO 8601 — set after 3 failures
    startedAt: string;
}

/** OTP challenge from SNS */
export interface OTPChallenge {
    patientId: string;
    maskedPhone: string; // e.g., "+91XXXXXX1234"
    expiresAt: string;
    attemptsRemaining: number;
}

/** Cognito auth tokens (stored in memory only) */
export interface AuthTokens {
    idToken: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

/** Biometric credential reference (WebAuthn) */
export interface BiometricCredential {
    credentialId: string;
    publicKey: string;
    deviceName: string;
    enrolledAt: string;
    lastUsedAt?: string;
}

/** Account lock status */
export interface LockStatus {
    isLocked: boolean;
    failedAttempts: number;
    lockUntil?: string;
    reason?: "TOO_MANY_ATTEMPTS" | "ADMIN_LOCK" | "SECURITY_CONCERN";
}

/** Authentication result on success */
export interface AuthResult {
    patient: import("./patient").Patient;
    tokens: AuthTokens;
    masterKey: CryptoKey; // Ephemeral — NEVER stored
    isNewDevice: boolean;
    biometricAvailable: boolean;
}

/** Doctor authentication result */
export interface DoctorAuthResult {
    doctor: import("./doctor").Doctor;
    tokens: AuthTokens;
    accessiblePatients: string[]; // Patient IDs with active grants
}
