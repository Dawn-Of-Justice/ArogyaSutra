// ============================================================
// Audit Log Type Definitions
// ============================================================

/** Actions that are logged */
export type AuditAction =
    | "LOGIN"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "DOCUMENT_UPLOAD"
    | "DOCUMENT_VIEW"
    | "DOCUMENT_DOWNLOAD"
    | "TIMELINE_VIEW"
    | "TIMELINE_SEARCH"
    | "AI_EXTRACTION"
    | "AI_QUERY"
    | "DOCTOR_GRANT_ACCESS"
    | "DOCTOR_REVOKE_ACCESS"
    | "DOCTOR_VIEW_TIMELINE"
    | "DOCTOR_APPEND_ENTRY"
    | "BREAKGLASS_INITIATE"
    | "BREAKGLASS_VIEW"
    | "BREAKGLASS_EXPIRE"
    | "EMERGENCY_DATA_UPDATE"
    | "SETTINGS_UPDATE"
    | "DATA_EXPORT"
    | "ACCOUNT_DELETE";

/** Single audit log entry stored in DynamoDB */
export interface AuditLogEntry {
    logId: string;
    patientId: string;
    action: AuditAction;
    performedBy: AuditActor;
    timestamp: string; // ISO 8601
    ipAddress?: string;
    userAgent?: string;
    geoLocation?: {
        latitude: number;
        longitude: number;
    };
    details: Record<string, string>; // Action-specific metadata
    resourceId?: string; // ID of the affected resource (entry, session, etc.)
}

/** Who performed the action */
export interface AuditActor {
    type: "PATIENT" | "DOCTOR" | "EMERGENCY_PERSONNEL" | "SYSTEM";
    userId: string;
    name: string;
    mciNumber?: string; // Present for doctors and emergency personnel
}

/** Access grant stored in DynamoDB */
export interface StoredAccessGrant {
    grantId: string;
    patientId: string;
    doctorId: string;
    doctorName: string;
    doctorMci: string;
    accessLevel: "READ" | "READ_APPEND";
    encryptedAccessKey: string; // Base64 RSA-encrypted key
    grantedAt: string;
    expiresAt?: string;
    revokedAt?: string;
    isActive: boolean;
}

/** Audit log query parameters */
export interface AuditLogQuery {
    patientId: string;
    actions?: AuditAction[];
    dateFrom?: string;
    dateTo?: string;
    performedByType?: AuditActor["type"];
    limit?: number;
    lastEvaluatedKey?: string; // DynamoDB pagination
}

/** Audit log query response */
export interface AuditLogResponse {
    logs: AuditLogEntry[];
    count: number;
    lastEvaluatedKey?: string;
    hasMore: boolean;
}
