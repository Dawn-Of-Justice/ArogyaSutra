// ============================================================
// Audit Service
// Immutable audit logging to DynamoDB
// ============================================================

import { putAuditLog, queryAuditLogs } from "../aws/dynamodb";
import type {
    AuditLogEntry,
    AuditAction,
    AuditActor,
    AuditLogQuery,
    AuditLogResponse,
} from "../types/audit";
import { v4 as uuidv4 } from "uuid";

/**
 * Logs an access event. Entries are immutable — no update or delete.
 */
export async function logAccess(
    patientId: string,
    action: AuditAction,
    performedBy: AuditActor,
    details: Record<string, string> = {},
    resourceId?: string
): Promise<string> {
    const logId = uuidv4();

    const entry: AuditLogEntry = {
        logId,
        patientId,
        action,
        performedBy,
        timestamp: new Date().toISOString(),
        details,
        resourceId,
    };

    await putAuditLog(entry);
    return logId;
}

/**
 * Queries audit logs for a patient with optional filters.
 */
export async function getAuditLogs(
    query: AuditLogQuery
): Promise<AuditLogResponse> {
    const result = await queryAuditLogs(query);

    return {
        logs: result.logs,
        count: result.logs.length,
        lastEvaluatedKey: result.lastKey,
        hasMore: !!result.lastKey,
    };
}

/**
 * Creates the audit actor for a patient action.
 */
export function patientActor(
    patientId: string,
    name: string
): AuditActor {
    return { type: "PATIENT", userId: patientId, name };
}

/**
 * Creates the audit actor for a doctor action.
 */
export function doctorActor(
    doctorId: string,
    name: string,
    mciNumber: string
): AuditActor {
    return { type: "DOCTOR", userId: doctorId, name, mciNumber };
}

/**
 * Creates the audit actor for emergency personnel.
 */
export function emergencyActor(
    mciNumber: string,
    name: string
): AuditActor {
    return {
        type: "EMERGENCY_PERSONNEL",
        userId: mciNumber,
        name,
        mciNumber,
    };
}
