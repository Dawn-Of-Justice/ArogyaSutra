// ============================================================
// Sliding-window rate limiter — in-process (no Redis required)
//
// Limits per window are enforced per Lambda instance. At scale
// replace the Map with Redis INCR + EXPIRE for cross-instance
// enforcement (one-day migration when needed).
//
// Limits (chosen to be fair to real users, punish abuse):
//   Patient RAG:  20 req / hour  +  5 req / 60 s  (burst)
//   Doctor RAG:   60 req / hour  +  10 req / 60 s (burst)
//   General LLM:  40 req / hour  +  8 req / 60 s  (burst)
// ============================================================

export type RateLimitRole = "PATIENT" | "DOCTOR";
export type RateLimitEndpoint = "rag" | "general";

interface WindowEntry {
    timestamps: number[]; // epoch ms of each request inside the window
}

// Two separate stores: hourly window and burst (per-minute) window
const _hourly = new Map<string, WindowEntry>();
const _burst  = new Map<string, WindowEntry>();

// Max entries to keep in memory (prevents unbounded growth on long-running instances)
const MAX_KEYS = 50_000;

const LIMITS: Record<
    RateLimitEndpoint,
    Record<RateLimitRole, { hourly: number; burst: number }>
> = {
    rag: {
        PATIENT: { hourly: 20, burst: 5  },
        DOCTOR:  { hourly: 60, burst: 10 },
    },
    general: {
        PATIENT: { hourly: 20, burst: 5  }, // patients don't call /general normally
        DOCTOR:  { hourly: 40, burst: 8  },
    },
};

/**
 * Check and record a request. Returns the limit result synchronously.
 * Call this at the top of each API route handler.
 */
export function checkRateLimit(
    userId: string,
    role: RateLimitRole,
    endpoint: RateLimitEndpoint
): {
    allowed: boolean;
    reason?: string;
    retryAfterSeconds?: number;
} {
    const now = Date.now();
    const limits = LIMITS[endpoint][role];
    const key = `${endpoint}:${userId}`;

    // --- Burst window: 60 seconds ---
    const burstResult = _slideWindow(_burst, key, now, 60_000, limits.burst);
    if (!burstResult.allowed) {
        return {
            allowed: false,
            reason: `Too many requests. Please wait before sending another message.`,
            retryAfterSeconds: Math.ceil((burstResult.oldestTs + 60_000 - now) / 1000),
        };
    }

    // --- Hourly window: 3600 seconds ---
    const hourlyResult = _slideWindow(_hourly, key, now, 3_600_000, limits.hourly);
    if (!hourlyResult.allowed) {
        const resetInMs = hourlyResult.oldestTs + 3_600_000 - now;
        return {
            allowed: false,
            reason: `You've reached your hourly query limit (${limits.hourly} queries/hour). Limit resets in ${Math.ceil(resetInMs / 60_000)} minutes.`,
            retryAfterSeconds: Math.ceil(resetInMs / 1000),
        };
    }

    return { allowed: true };
}

/**
 * Returns current usage counts for a user (useful for debug/admin endpoints).
 */
export function getRateLimitStatus(
    userId: string,
    endpoint: RateLimitEndpoint
): { burstUsed: number; hourlyUsed: number } {
    const now = Date.now();
    const key = `${endpoint}:${userId}`;
    const burst  = _burst.get(key);
    const hourly = _hourly.get(key);
    return {
        burstUsed:  burst  ? burst.timestamps.filter(t => now - t < 60_000).length     : 0,
        hourlyUsed: hourly ? hourly.timestamps.filter(t => now - t < 3_600_000).length : 0,
    };
}

// --------------- Internal ---------------

function _slideWindow(
    store: Map<string, WindowEntry>,
    key: string,
    now: number,
    windowMs: number,
    limit: number
): { allowed: boolean; oldestTs: number } {
    // Evict oldest key if store is getting too large
    if (!store.has(key) && store.size >= MAX_KEYS) {
        store.delete(store.keys().next().value!);
    }

    const entry = store.get(key) ?? { timestamps: [] };

    // Drop timestamps outside the window
    const cutoff = now - windowMs;
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);

    const oldestTs = entry.timestamps[0] ?? now;

    if (entry.timestamps.length >= limit) {
        store.set(key, entry);
        return { allowed: false, oldestTs };
    }

    entry.timestamps.push(now);
    store.set(key, entry);
    return { allowed: true, oldestTs };
}
