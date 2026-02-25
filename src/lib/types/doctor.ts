// ============================================================
// Doctor Type Definitions
// ============================================================

/** Medical Council of India credentials */
export interface MciCredentials {
    registrationNumber: string; // e.g., "KA-28411"
    council: string; // e.g., "Karnataka Medical Council"
    specialty: string;
    institution: string;
    verifiedAt?: string; // ISO 8601 datetime
    isVerified: boolean;
}

/** Doctor profile stored in Cognito Doctor Pool */
export interface Doctor {
    doctorId: string;
    fullName: string;
    phone: string;
    email?: string;
    mci: MciCredentials;
    createdAt: string;
    updatedAt: string;
}

/** Doctor registration payload */
export interface DoctorRegistration {
    fullName: string;
    phone: string;
    email?: string;
    mciRegistrationNumber: string;
    council: string;
    specialty: string;
    institution: string;
}

/** Doctor's append-only entry */
export interface DoctorAppendEntry {
    entryId: string;
    patientId: string;
    doctorId: string;
    doctorName: string;
    mciNumber: string;
    noteType: "consultation" | "prescription" | "lab_order" | "referral" | "note";
    content: string;
    attachments?: string[]; // S3 keys for any uploaded docs
    timestamp: string;
}
