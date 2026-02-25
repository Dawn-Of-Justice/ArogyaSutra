// ============================================================
// Emergency & Break-Glass Type Definitions
// ============================================================

/** Emergency data configured by the patient (Requirement 11) */
export interface EmergencyData {
    patientId: string;
    bloodGroup: string; // e.g., "O+", "AB-"
    allergies: string[];
    criticalMedications: string[];
    activeConditions: string[];
    emergencyContacts: EmergencyContactInfo[];
    organDonor?: boolean;
    advanceDirectives?: string;
    updatedAt: string;
}

/** Emergency contact with notification preference */
export interface EmergencyContactInfo {
    name: string;
    relationship: string;
    phone: string;
    notifyOnBreakGlass: boolean;
}

/** Geolocation captured during Break-Glass access */
export interface GeoLocation {
    latitude: number;
    longitude: number;
    accuracy: number; // meters
    timestamp: string;
}

/** Emergency personnel credentials for Break-Glass */
export interface EmergencyCredentials {
    mciRegistrationNumber: string;
    personnelName: string;
    institution: string;
    designation: string;
}

/** Active Break-Glass session */
export interface BreakGlassSession {
    sessionId: string;
    patientId: string;
    personnelCredentials: EmergencyCredentials;
    geoLocation: GeoLocation;
    startedAt: string;
    expiresAt: string; // Timed countdown (minutes)
    durationMinutes: number;
    isActive: boolean;
    accessedData: string[]; // List of data fields accessed
}

/** Break-Glass initiation request */
export interface BreakGlassRequest {
    patientId: string;
    credentials: EmergencyCredentials;
    geoLocation: GeoLocation;
    reason: string;
}

/** Break-Glass initiation response */
export interface BreakGlassResponse {
    sessionId: string;
    emergencyData: EmergencyData;
    expiresAt: string;
    durationMinutes: number;
    countdownStartedAt: string;
}

/** Stored Break-Glass log in DynamoDB */
export interface BreakGlassLog {
    logId: string;
    sessionId: string;
    patientId: string;
    personnelMci: string;
    personnelName: string;
    institution: string;
    geoLocation: GeoLocation;
    reason: string;
    startedAt: string;
    endedAt?: string;
    durationMinutes: number;
    dataAccessed: string[];
    patientNotified: boolean;
    emergencyContactsNotified: boolean;
}
