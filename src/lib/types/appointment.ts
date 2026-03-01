// ============================================================
// Appointment Type Definitions
// ============================================================

/** Status of an appointment */
export type AppointmentStatus = "scheduled" | "attended" | "cancelled";

/** A patient appointment stored in DynamoDB */
export interface Appointment {
    patientId: string;           // PK
    appointmentId: string;       // SK — UUID v4
    appointmentDate: string;     // ISO 8601 date (YYYY-MM-DD) — used by GSI
    time?: string;               // Display time e.g. "10:30 AM"
    doctorName: string;
    specialty?: string;
    location?: string;
    notes?: string;
    status: AppointmentStatus;
    sourceEntryId?: string;      // HealthEntry that auto-created this appointment
    createdAt: string;           // ISO 8601 timestamp
    updatedAt: string;           // ISO 8601 timestamp
}

/** Payload for creating an appointment */
export type CreateAppointmentInput = Omit<Appointment, "appointmentId" | "createdAt" | "updatedAt">;

/** Payload for updating an appointment */
export type UpdateAppointmentInput = Partial<Omit<Appointment, "patientId" | "appointmentId" | "createdAt">>;
