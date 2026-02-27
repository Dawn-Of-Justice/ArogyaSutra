// ============================================================
// Auth Context & Hook
// Provides Master Key + auth state to all components
// Supports both Patient (Card ID → DOB → OTP) and Doctor (email/MCI + password) flows
// ============================================================

"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import * as authService from "../lib/services/auth.service";
import type { AuthState, LoginSession, AuthResult, OTPChallenge, LockStatus } from "../lib/types/auth";
import type { Patient } from "../lib/types/patient";

export type UserRole = "patient" | "doctor";

export interface DoctorProfile {
    doctorId: string;
    fullName: string;
    email: string;
    phone: string;
    mciNumber: string;
    institution: string;
    designation: string;
}

interface AuthContextType {
    state: AuthState;
    patient: Patient | null;
    doctor: DoctorProfile | null;
    userRole: UserRole | null;
    masterKey: CryptoKey | null;
    session: LoginSession | null;
    lockStatus: LockStatus;

    // Patient auth
    initiateLogin: (cardId: string) => Promise<void>;
    verifyDob: (cardId: string, dob: string) => Promise<Record<string, string>>;
    sendOtp: (cardId: string) => Promise<OTPChallenge>;
    verifyOtp: (cardId: string, otp: string) => Promise<AuthResult>;

    // Doctor auth
    doctorLogin: (username: string, password: string) => Promise<void>;

    // Profile updates (merges partial data into auth context + sessionStorage)
    updatePatient: (partial: Partial<Patient>) => void;
    updateDoctor: (partial: Partial<DoctorProfile>) => void;

    logout: () => Promise<void>;

    error: string | null;
    isLoading: boolean;
    hydrated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "arogyasutra_session";

interface PersistedSession {
    state: AuthState;
    userRole: UserRole;
    patient: Patient | null;
    doctor: DoctorProfile | null;
}

function loadSession(): PersistedSession | null {
    // Guard: sessionStorage doesn't exist on the server (SSR)
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as PersistedSession) : null;
    } catch {
        return null;
    }
}

function saveSession(s: PersistedSession) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch { /* ignore quota errors */ }
}

function clearSession() {
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    // Start with safe defaults so SSR and first client render match.
    // Session is restored from sessionStorage in a one-time useEffect below.
    const [state, setState] = useState<AuthState>("UNAUTHENTICATED");
    const [patient, setPatient] = useState<Patient | null>(null);
    const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [session, setSession] = useState<LoginSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const masterKeyRef = useRef<CryptoKey | null>(null);

    // Restore persisted session after first client-side mount (avoids hydration mismatch).
    useEffect(() => {
        const s = loadSession();
        if (s) {
            setState(s.state);
            setPatient(s.patient);
            setDoctor(s.doctor);
            setUserRole(s.userRole);
        }
        setHydrated(true);
    }, []);

    // Auto-sync session to sessionStorage whenever auth state changes.
    // This is the primary persistence mechanism — belt-and-suspenders over the inline saveSession calls.
    useEffect(() => {
        if (!hydrated) return; // skip until session is restored
        if (state === "AUTHENTICATED" && (patient || doctor)) {
            saveSession({ state, userRole: userRole!, patient: patient ?? null, doctor: doctor ?? null });
        } else if (state === "UNAUTHENTICATED") {
            clearSession();
        }
    }, [state, patient, doctor, userRole]);

    // ---- Patient Auth ----
    const initiateLogin = useCallback(async (cardId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await authService.initiateLogin(cardId);
            setSession(result.session);
            setState("CARD_ID_ENTERED");
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const verifyDob = useCallback(async (cardId: string, dob: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await authService.verifyDateOfBirth(cardId, dob);
            setSession(result.session);
            setState("OTP_SENT");
            return result.challengeParams || {};
        } catch (e) {
            setError((e as Error).message);
            return {};
        } finally {
            setIsLoading(false);
        }
    }, []);

    const sendOtp = useCallback(async (cardId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const challenge = await authService.sendOTP(cardId);
            setState("OTP_SENT");
            return challenge;
        } catch (e) {
            setError((e as Error).message);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const verifyOtp = useCallback(async (cardId: string, otp: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await authService.verifyOTP(cardId, otp);
            masterKeyRef.current = result.masterKey;
            setPatient(result.patient);
            setUserRole("patient");
            setState("AUTHENTICATED");
            // Persist so new/refreshed tabs restore state automatically
            saveSession({ state: "AUTHENTICATED", userRole: "patient", patient: result.patient, doctor: null });
            return result;
        } catch (e) {
            setError((e as Error).message);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ---- Doctor Auth ----
    const doctorLogin = useCallback(async (username: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/auth/doctor-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Doctor login failed");
            }

            setDoctor(data.doctor);
            setUserRole("doctor");
            setState("AUTHENTICATED");
            // Persist so new/refreshed tabs restore state automatically
            saveSession({ state: "AUTHENTICATED", userRole: "doctor", patient: null, doctor: data.doctor });
        } catch (e) {
            setError((e as Error).message);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ---- Logout ----
    const logout = useCallback(async () => {
        // Try to notify server, but ALWAYS clear local state even if it fails
        try {
            if (patient) await authService.logout(patient.patientId);
        } catch {
            console.warn("Server-side logout failed — clearing local session anyway");
        }
        masterKeyRef.current = null;
        setPatient(null);
        setDoctor(null);
        setUserRole(null);
        setSession(null);
        setState("UNAUTHENTICATED");
        setError(null);
        clearSession(); // Wipe persisted session
    }, [patient]);

    // ---- Profile updates (merge partial → context + sessionStorage) ----
    const updatePatient = useCallback((partial: Partial<Patient>) => {
        setPatient((prev) => {
            const updated = prev ? { ...prev, ...partial } : null;
            if (updated) saveSession({ state: "AUTHENTICATED", userRole: "patient", patient: updated, doctor: null });
            return updated;
        });
    }, []);

    const updateDoctor = useCallback((partial: Partial<DoctorProfile>) => {
        setDoctor((prev) => {
            const updated = prev ? { ...prev, ...partial } : null;
            if (updated) saveSession({ state: "AUTHENTICATED", userRole: "doctor", patient: null, doctor: updated });
            return updated;
        });
    }, []);

    return (
        <AuthContext.Provider
            value={{
                state,
                patient,
                doctor,
                userRole,
                masterKey: masterKeyRef.current,
                session,
                lockStatus: authService.getLockStatus(),
                initiateLogin,
                verifyDob,
                sendOtp,
                verifyOtp,
                doctorLogin,
                updatePatient,
                updateDoctor,
                logout,
                error,
                isLoading,
                hydrated,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
