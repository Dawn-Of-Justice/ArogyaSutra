// ============================================================
// GET /api/access-log?patientId=AS-XXXX&limit=50&cursor=<token>
// Returns the patient's chronological audit trail from DynamoDB
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { queryAuditLogs } from "../../../lib/aws/dynamodb";
import type { AuditLogEntry, AuditAction } from "../../../lib/types/audit";

// Human-readable labels for every audit action
const ACTION_LABELS: Record<AuditAction, string> = {
    LOGIN: "Signed in",
    LOGIN_FAILED: "Failed sign-in attempt",
    LOGOUT: "Signed out",
    DOCUMENT_UPLOAD: "Uploaded a document",
    DOCUMENT_VIEW: "Viewed a document",
    DOCUMENT_DOWNLOAD: "Downloaded a document",
    TIMELINE_VIEW: "Viewed health timeline",
    TIMELINE_SEARCH: "Searched health records",
    AI_EXTRACTION: "AI extracted record data",
    AI_QUERY: "Asked the AI assistant",
    DOCTOR_GRANT_ACCESS: "Granted doctor access",
    DOCTOR_REVOKE_ACCESS: "Revoked doctor access",
    DOCTOR_VIEW_TIMELINE: "Viewed your health timeline",
    DOCTOR_APPEND_ENTRY: "Added a note to your timeline",
    BREAKGLASS_INITIATE: "Initiated break-glass emergency access",
    BREAKGLASS_VIEW: "Accessed emergency records via Break-Glass",
    BREAKGLASS_EXPIRE: "Emergency session expired",
    EMERGENCY_DATA_UPDATE: "Updated emergency info",
    SETTINGS_UPDATE: "Updated account settings",
    DATA_EXPORT: "Exported health data",
    ACCOUNT_DELETE: "Deleted account",
};

// Actions too noisy or irrelevant to surface to the patient
const HIDDEN_ACTIONS = new Set<AuditAction>([
    "AI_QUERY",
    "AI_EXTRACTION",
    "TIMELINE_VIEW",
    "TIMELINE_SEARCH",
    "DOCUMENT_VIEW",
]);

function mapActorType(entry: AuditLogEntry): "self" | "doctor" | "emergency" {
    switch (entry.performedBy.type) {
        case "DOCTOR": return "doctor";
        case "EMERGENCY_PERSONNEL": return "emergency";
        default: return "self";
    }
}

/** Best-effort user-agent → readable device string */
function parseUA(ua: string): string {
    if (/android/i.test(ua)) return /chrome/i.test(ua) ? "Chrome on Android" : "Android Browser";
    if (/iphone/i.test(ua)) return /crios/i.test(ua) ? "Chrome on iOS" : "Safari on iPhone";
    if (/ipad/i.test(ua)) return "Safari on iPad";
    if (/windows/i.test(ua)) return /chrome/i.test(ua) ? "Chrome on Windows" : "Windows Browser";
    if (/macintosh|mac os/i.test(ua)) return /chrome/i.test(ua) ? "Chrome on Mac" : "Safari on Mac";
    if (/linux/i.test(ua)) return "Linux Browser";
    return "Browser";
}

/** Format geo coordinates into a readable string (reverse-geocoding would need an external API) */
function formatGeo(lat: number, lng: number): string {
    return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const cursor = searchParams.get("cursor") ?? undefined;

    if (!patientId) {
        return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    try {
        const { logs, lastKey } = await queryAuditLogs({
            patientId,
            limit,
            lastEvaluatedKey: cursor,
        });

        const events = logs
            .filter((log: AuditLogEntry) => !HIDDEN_ACTIONS.has(log.action))
            .map((log: AuditLogEntry) => ({
            id: log.logId,
            type: mapActorType(log),
            actorName: log.performedBy.name,
            actorRole: log.performedBy.mciNumber
                ? `MCI: ${log.performedBy.mciNumber}`
                : undefined,
            action: ACTION_LABELS[log.action] ?? log.action,
            record: log.details?.documentTitle ?? log.details?.entryTitle ?? undefined,
            timestamp: log.timestamp,
            location: log.geoLocation
                ? formatGeo(log.geoLocation.latitude, log.geoLocation.longitude)
                : undefined,
            device: log.userAgent ? parseUA(log.userAgent) : undefined,
        }));

        return NextResponse.json({
            events,
            nextCursor: lastKey ?? null,
        });
    } catch (err) {
        const msg = (err as Error).message ?? "Unknown error";
        console.error("[/api/access-log]", msg);
        const isDev = process.env.NODE_ENV === "development";
        return NextResponse.json(
            { error: isDev ? msg : "Failed to load access log." },
            { status: 500 }
        );
    }
}
