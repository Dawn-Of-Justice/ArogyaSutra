// ============================================================
// Authentication Service
// Triple-layer auth: Card ID → DOB → OTP
// ============================================================

import * as cognito from "../aws/cognito";
import * as sns from "../aws/sns";
import { deriveMasterKey } from "../crypto/keyDerivation";
import { logAccess, patientActor } from "./audit.service";
import type {
    AuthState,
    LoginSession,
    OTPChallenge,
    AuthResult,
    LockStatus,
} from "../types/auth";
import type { Patient } from "../types/patient";

const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MINUTES = 30;

// In-memory session store (client-side only)
let currentSession: LoginSession | null = null;

/**
 * Step 1: Enter Card ID. Validates format and existence.
 */
export async function initiateLogin(
    cardId: string
): Promise<{ session: LoginSession; cognitoSession?: string }> {
    // Check lock status
    if (currentSession?.lockUntil) {
        const lockExpiry = new Date(currentSession.lockUntil);
        if (lockExpiry > new Date()) {
            throw new Error(
                `AUTH_LOCKED: Account locked until ${currentSession.lockUntil}`
            );
        }
    }

    // Step 1a: Initiate auth — Cognito issues Card ID challenge
    const authResult = await cognito.initiatePatientAuth(cardId);

    // Step 1b: Auto-respond to the Card ID challenge with the card ID itself.
    // This advances the Cognito session to step 2 (DOB challenge).
    const step1Response = await cognito.respondToChallenge(
        authResult.Session!,
        "CUSTOM_CHALLENGE",
        { USERNAME: cardId, ANSWER: cardId }
    );

    currentSession = {
        patientId: cardId,
        state: "CARD_ID_ENTERED",
        cognitoSession: step1Response.Session,
        failedAttempts: 0,
        startedAt: new Date().toISOString(),
    };

    return {
        session: currentSession,
        cognitoSession: step1Response.Session,
    };
}

/**
 * Step 2: Verify Date of Birth.
 */
export async function verifyDateOfBirth(
    cardId: string,
    dob: string
): Promise<{ session: LoginSession; cognitoSession?: string; challengeParams?: Record<string, string> }> {
    if (!currentSession || currentSession.patientId !== cardId) {
        throw new Error("AUTH_INVALID_SESSION: No active session for this card ID");
    }

    if (currentSession.state !== "CARD_ID_ENTERED") {
        throw new Error("AUTH_INVALID_STATE: DOB verification not expected");
    }

    try {
        const result = await cognito.respondToChallenge(
            currentSession.cognitoSession!,
            "CUSTOM_CHALLENGE",
            { USERNAME: cardId, ANSWER: dob }
        );

        // Cognito's CreateAuthChallenge Lambda sends OTP as step 3 automatically
        currentSession.state = "OTP_SENT";
        currentSession.cognitoSession = result.Session;

        // Return challenge parameters (maskedPhone, devOtp) from Lambda
        return {
            session: currentSession,
            cognitoSession: result.Session,
            challengeParams: result.ChallengeParameters || {},
        };
    } catch (error) {
        currentSession.failedAttempts++;
        if (currentSession.failedAttempts >= MAX_ATTEMPTS) {
            lockAccount(currentSession);
        }
        throw new Error("AUTH_DOB_MISMATCH: Date of birth does not match");
    }
}

/**
 * Step 3a: Send OTP to registered phone.
 */
export async function sendOTP(cardId: string): Promise<OTPChallenge> {
    if (!currentSession || currentSession.patientId !== cardId) {
        throw new Error("AUTH_INVALID_SESSION");
    }

    if (currentSession.state !== "DOB_VERIFIED") {
        throw new Error("AUTH_INVALID_STATE: DOB must be verified before OTP");
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Get patient phone from Cognito
    const user = await cognito.getPatientUser(cardId);
    const phone =
        user.UserAttributes?.find((a) => a.Name === "phone_number")?.Value || "";

    // Send via SNS
    await sns.sendOtp(phone, otp);

    currentSession.state = "OTP_SENT";

    // Store OTP in session for verification (in production this would be server-side)
    (currentSession as LoginSession & { _otp?: string })._otp = otp;

    return {
        patientId: cardId,
        maskedPhone: maskPhone(phone),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attemptsRemaining: MAX_ATTEMPTS - currentSession.failedAttempts,
    };
}

/**
 * Step 3b: Verify OTP and derive Master Key.
 */
export async function verifyOTP(
    cardId: string,
    otp: string
): Promise<AuthResult> {
    if (!currentSession || currentSession.patientId !== cardId) {
        throw new Error("AUTH_INVALID_SESSION");
    }

    if (currentSession.state !== "OTP_SENT" && currentSession.state !== "DOB_VERIFIED") {
        throw new Error("AUTH_INVALID_STATE: OTP not yet sent");
    }

    try {
        const result = await cognito.respondToChallenge(
            currentSession.cognitoSession!,
            "CUSTOM_CHALLENGE",
            { USERNAME: cardId, ANSWER: otp }
        );

        currentSession.state = "AUTHENTICATED";

        // Derive the ephemeral Master Key (NEVER stored)
        const masterKey = await deriveMasterKey(cardId, otp);

        // Log successful login (non-blocking — may fail client-side)
        try {
            await logAccess(
                cardId,
                "LOGIN",
                patientActor(cardId, cardId),
                { method: "triple-layer" }
            );
        } catch {
            console.warn("Audit log write skipped (expected client-side)");
        }

        // Build patient profile by fetching from our server-side API
        // (AdminGetUser requires admin credentials — cannot be called client-side)
        let patient: Patient;
        try {
            const res = await fetch(`/api/profile/me?userId=${encodeURIComponent(cardId)}&role=patient`);
            if (!res.ok) throw new Error(`profile/me returned ${res.status}`);
            const { profile } = await res.json();
            patient = {
                ...(profile as Patient),
                // Ensure type safety for union fields
                gender: (profile.gender || "other") as "male" | "female" | "other",
                language: (profile.language || "en") as import("../types/patient").Language,
                emergencyContacts: profile.emergencyContacts ?? [],
            };
        } catch (profileErr) {
            // Fallback — profile will be empty until user fills it in via ProfileScreen
            console.warn("Failed to load profile from server:", profileErr);
            patient = {
                patientId: cardId,
                fullName: "",
                dateOfBirth: "",
                phone: "",
                gender: "other",
                address: { line1: "", city: "", state: "", pincode: "", country: "IN" },
                language: "en",
                emergencyContacts: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
        }

        return {
            patient,
            tokens: {
                idToken:
                    result.AuthenticationResult?.IdToken || "",
                accessToken:
                    result.AuthenticationResult?.AccessToken || "",
                refreshToken:
                    result.AuthenticationResult?.RefreshToken || "",
                expiresAt: new Date(
                    Date.now() +
                    (result.AuthenticationResult?.ExpiresIn || 3600) * 1000
                ).toISOString(),
            },
            masterKey, // Ephemeral — stays in memory
            isNewDevice: true,
            biometricAvailable:
                typeof window !== "undefined" &&
                !!window.PublicKeyCredential,
        };
    } catch (error) {
        currentSession.failedAttempts++;
        if (currentSession.failedAttempts >= MAX_ATTEMPTS) {
            lockAccount(currentSession);
        }

        try {
            await logAccess(
                cardId,
                "LOGIN_FAILED",
                patientActor(cardId, cardId),
                { reason: "invalid_otp" }
            );
        } catch {
            // Non-blocking
        }

        throw new Error("AUTH_OTP_INVALID: Incorrect OTP");
    }
}

/**
 * Get current lock status.
 */
export function getLockStatus(): LockStatus {
    if (!currentSession) {
        return { isLocked: false, failedAttempts: 0 };
    }

    return {
        isLocked: !!currentSession.lockUntil &&
            new Date(currentSession.lockUntil) > new Date(),
        failedAttempts: currentSession.failedAttempts,
        lockUntil: currentSession.lockUntil,
        reason: currentSession.failedAttempts >= MAX_ATTEMPTS
            ? "TOO_MANY_ATTEMPTS"
            : undefined,
    };
}

/**
 * Logout — clear session.
 */
export async function logout(cardId: string): Promise<void> {
    await logAccess(
        cardId,
        "LOGOUT",
        patientActor(cardId, cardId)
    );
    currentSession = null;
}

// ---- Internal Helpers ----

function generateOTP(): string {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return String(array[0] % 1000000).padStart(6, "0");
}

function maskPhone(phone: string): string {
    if (phone.length < 6) return phone;
    return phone.slice(0, 3) + "XXXXXX" + phone.slice(-4);
}

function lockAccount(session: LoginSession): void {
    session.lockUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000
    ).toISOString();
    session.state = "LOCKED";
}
