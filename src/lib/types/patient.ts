// ============================================================
// Patient Type Definitions
// ============================================================

/** Supported UI languages */
export type Language =
    | "en"
    | "hi"
    | "ta"
    | "te"
    | "bn"
    | "mr"
    | "gu"
    | "kn";

/** Patient address */
export interface Address {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: "IN";
}

/** Emergency contact for notifications */
export interface EmergencyContact {
    name: string;
    relationship: string;
    phone: string;
}

/** Patient profile stored in Cognito + DynamoDB */
export interface Patient {
    patientId: string; // AS-XXXX-XXXX
    fullName: string;
    dateOfBirth: string; // ISO 8601 date only (YYYY-MM-DD)
    phone: string; // +91XXXXXXXXXX
    gender: "male" | "female" | "other";
    address: Address;
    language: Language;
    emergencyContacts: EmergencyContact[];
    height?: string;   // cm — patient-editable
    weight?: string;   // kg — patient-editable
    bloodGroup?: string;
    bpSystolic?: string;    // mmHg — doctor-only
    bpDiastolic?: string;   // mmHg — doctor-only
    temperature?: string;   // °F   — doctor-only
    createdAt: string; // ISO 8601 datetime
    updatedAt: string;
}

/** Registration payload (before ID generation) */
export interface PatientRegistration {
    fullName: string;
    dateOfBirth: string;
    phone: string;
    gender: "male" | "female" | "other";
    address: Address;
    language: Language;
    emergencyContacts: EmergencyContact[];
}
