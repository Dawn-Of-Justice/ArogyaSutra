// ============================================================
// Auth Context & Hook
// Provides Master Key + auth state to all components
// Supports both Patient (Card ID → DOB → OTP) and Doctor (email/MCI + password) flows
// ============================================================

"use client";

import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
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

    logout: () => Promise<void>;

    error: string | null;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>("UNAUTHENTICATED");
    const [patient, setPatient] = useState<Patient | null>(null);
    const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [session, setSession] = useState<LoginSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const masterKeyRef = useRef<CryptoKey | null>(null);

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
        } catch (e) {
            setError((e as Error).message);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ---- Logout ----
    const logout = useCallback(async () => {
        if (patient) {
            await authService.logout(patient.patientId);
        }
        masterKeyRef.current = null;
        setPatient(null);
        setDoctor(null);
        setUserRole(null);
        setSession(null);
        setState("UNAUTHENTICATED");
        setError(null);
    }, [patient]);

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
                logout,
                error,
                isLoading,
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
