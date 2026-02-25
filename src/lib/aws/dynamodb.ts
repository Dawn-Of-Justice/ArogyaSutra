// ============================================================
// Amazon DynamoDB Integration
// Audit logs, access grants, and session management
// ============================================================

import {
    DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    DeleteCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { AuditLogEntry, StoredAccessGrant, AuditLogQuery } from "../types/audit";
import type { BreakGlassSession, BreakGlassLog } from "../types/emergency";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const client = new DynamoDBClient({ region });
const dynamodb = DynamoDBDocumentClient.from(client);

const AUDIT_TABLE = process.env.DYNAMODB_AUDIT_TABLE || "arogyasutra-audit-logs";
const ACCESS_TABLE = process.env.DYNAMODB_ACCESS_TABLE || "arogyasutra-access-grants";
const SESSION_TABLE = process.env.DYNAMODB_SESSION_TABLE || "arogyasutra-sessions";

// ---- Audit Logs (Immutable — no update/delete) ----

/** Write an audit log entry. Append-only, never modified. */
export async function putAuditLog(entry: AuditLogEntry): Promise<void> {
    await dynamodb.send(
        new PutCommand({
            TableName: AUDIT_TABLE,
            Item: entry,
            ConditionExpression: "attribute_not_exists(logId)", // Immutable
        })
    );
}

/** Query audit logs for a patient. */
export async function queryAuditLogs(
    query: AuditLogQuery
): Promise<{ logs: AuditLogEntry[]; lastKey?: string }> {
    const expressionValues: Record<string, unknown> = {
        ":patientId": query.patientId,
    };
    let filterExpression = "";
    const filterParts: string[] = [];

    if (query.actions && query.actions.length > 0) {
        const actionValues = query.actions.map((a, i) => {
            expressionValues[`:action${i}`] = a;
            return `:action${i}`;
        });
        filterParts.push(`#action IN (${actionValues.join(", ")})`);
    }

    if (query.dateFrom) {
        expressionValues[":dateFrom"] = query.dateFrom;
        filterParts.push("#ts >= :dateFrom");
    }

    if (query.dateTo) {
        expressionValues[":dateTo"] = query.dateTo;
        filterParts.push("#ts <= :dateTo");
    }

    if (filterParts.length > 0) {
        filterExpression = filterParts.join(" AND ");
    }

    const result = await dynamodb.send(
        new QueryCommand({
            TableName: AUDIT_TABLE,
            KeyConditionExpression: "patientId = :patientId",
            ExpressionAttributeValues: expressionValues,
            ExpressionAttributeNames: {
                "#action": "action",
                "#ts": "timestamp",
            },
            ...(filterExpression && { FilterExpression: filterExpression }),
            ScanIndexForward: false, // Newest first
            Limit: query.limit || 50,
            ...(query.lastEvaluatedKey && {
                ExclusiveStartKey: JSON.parse(query.lastEvaluatedKey),
            }),
        })
    );

    return {
        logs: (result.Items || []) as AuditLogEntry[],
        lastKey: result.LastEvaluatedKey
            ? JSON.stringify(result.LastEvaluatedKey)
            : undefined,
    };
}

// ---- Access Grants ----

/** Store a doctor access grant. */
export async function putAccessGrant(
    grant: StoredAccessGrant
): Promise<void> {
    await dynamodb.send(
        new PutCommand({
            TableName: ACCESS_TABLE,
            Item: grant,
        })
    );
}

/** Get an access grant by grant ID. */
export async function getAccessGrant(
    grantId: string
): Promise<StoredAccessGrant | null> {
    const result = await dynamodb.send(
        new GetCommand({
            TableName: ACCESS_TABLE,
            Key: { grantId },
        })
    );
    return (result.Item as StoredAccessGrant) || null;
}

/** List active grants for a patient. */
export async function listPatientGrants(
    patientId: string
): Promise<StoredAccessGrant[]> {
    const result = await dynamodb.send(
        new QueryCommand({
            TableName: ACCESS_TABLE,
            IndexName: "patientId-index",
            KeyConditionExpression: "patientId = :patientId",
            FilterExpression: "isActive = :active",
            ExpressionAttributeValues: {
                ":patientId": patientId,
                ":active": true,
            },
        })
    );
    return (result.Items || []) as StoredAccessGrant[];
}

/** List active grants for a doctor. */
export async function listDoctorGrants(
    doctorId: string
): Promise<StoredAccessGrant[]> {
    const result = await dynamodb.send(
        new QueryCommand({
            TableName: ACCESS_TABLE,
            IndexName: "doctorId-index",
            KeyConditionExpression: "doctorId = :doctorId",
            FilterExpression: "isActive = :active",
            ExpressionAttributeValues: {
                ":doctorId": doctorId,
                ":active": true,
            },
        })
    );
    return (result.Items || []) as StoredAccessGrant[];
}

/** Revoke an access grant. */
export async function revokeAccessGrant(grantId: string): Promise<void> {
    await dynamodb.send(
        new UpdateCommand({
            TableName: ACCESS_TABLE,
            Key: { grantId },
            UpdateExpression:
                "SET isActive = :inactive, revokedAt = :now",
            ExpressionAttributeValues: {
                ":inactive": false,
                ":now": new Date().toISOString(),
            },
        })
    );
}

// ---- Break-Glass Sessions ----

/** Store a Break-Glass session. */
export async function putBreakGlassSession(
    session: BreakGlassSession
): Promise<void> {
    await dynamodb.send(
        new PutCommand({
            TableName: SESSION_TABLE,
            Item: { ...session, ttl: Math.floor(Date.parse(session.expiresAt) / 1000) },
        })
    );
}

/** Get an active Break-Glass session. */
export async function getBreakGlassSession(
    sessionId: string
): Promise<BreakGlassSession | null> {
    const result = await dynamodb.send(
        new GetCommand({
            TableName: SESSION_TABLE,
            Key: { sessionId },
        })
    );
    return (result.Item as BreakGlassSession) || null;
}

/** Expire a Break-Glass session. */
export async function expireBreakGlassSession(
    sessionId: string
): Promise<void> {
    await dynamodb.send(
        new UpdateCommand({
            TableName: SESSION_TABLE,
            Key: { sessionId },
            UpdateExpression: "SET isActive = :inactive",
            ExpressionAttributeValues: { ":inactive": false },
        })
    );
}

/** Store a Break-Glass audit log. */
export async function putBreakGlassLog(log: BreakGlassLog): Promise<void> {
    await dynamodb.send(
        new PutCommand({
            TableName: AUDIT_TABLE,
            Item: { ...log, action: "BREAKGLASS_INITIATE" },
            ConditionExpression: "attribute_not_exists(logId)",
        })
    );
}
