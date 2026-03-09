// ============================================================
// Timeline Hook
// Loads & manages the chronological health timeline
// ============================================================

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as timelineService from "../lib/services/timeline.service";
import type { ViewerContext } from "../lib/services/timeline.service";
import type {
    HealthEntry,
    TimelineRequest,
    TimelineFilters,
} from "../lib/types/timeline";
import { useAuth } from "./useAuth";

export function useTimeline(overridePatientId?: string) {
    const { patient, doctor, userRole, effectivePatient } = useAuth();
    const [entries, setEntries] = useState<HealthEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);
    const [currentFilters, setCurrentFilters] = useState<TimelineFilters>({});

    // Monotonically increasing request counter — prevents stale async results
    // from overwriting the entries set by a newer request.
    const requestIdRef = useRef(0);

    // Use override → effectivePatient (handles guardian-dependent switching) → patient
    const resolvedId = overridePatientId || effectivePatient?.patientId;

    // Clear stale entries when the resolved patient changes
    // (e.g. switching from guardian to dependent or vice-versa)
    const prevResolvedIdRef = useRef(resolvedId);
    useEffect(() => {
        if (prevResolvedIdRef.current !== resolvedId) {
            prevResolvedIdRef.current = resolvedId;
            setEntries([]);
            setHasMore(false);
            setPage(1);
            setCurrentFilters({});
            setError(null);
        }
    }, [resolvedId]);

    const viewerContext: ViewerContext | undefined =
        userRole === "doctor" && doctor
            ? { viewerType: "DOCTOR", viewerId: doctor.doctorId, viewerName: doctor.fullName }
            : undefined;

    const loadTimeline = useCallback(
        async (filters?: TimelineFilters) => {
            if (!resolvedId) return;

            // Bump request counter — any in-flight request with an older id
            // will discard its result when it finally resolves.
            const thisRequestId = ++requestIdRef.current;

            setIsLoading(true);
            setError(null);

            try {
                const appliedFilters = filters || {};
                const request: TimelineRequest = {
                    patientId: resolvedId,
                    filters: appliedFilters,
                    options: { page: 1, pageSize: 20, sortOrder: "newest", groupBy: "date" },
                };
                const response = await timelineService.getTimeline(request, null as unknown as CryptoKey, viewerContext);

                // Only apply result if this is still the latest request
                if (thisRequestId !== requestIdRef.current) return;

                setEntries(response.entries);
                setHasMore(response.hasMore);
                setPage(1);
                setCurrentFilters(appliedFilters);
            } catch (e) {
                if (thisRequestId !== requestIdRef.current) return;
                setError((e as Error).message);
            } finally {
                if (thisRequestId === requestIdRef.current) {
                    setIsLoading(false);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [resolvedId, viewerContext?.viewerId]
    );

    const loadMore = useCallback(async () => {
        if (!resolvedId || !hasMore) return;
        setIsLoading(true);

        try {
            const request: TimelineRequest = {
                patientId: resolvedId,
                filters: currentFilters,
                options: { page: page + 1, pageSize: 20, sortOrder: "newest", groupBy: "date" },
            };
            const response = await timelineService.getTimeline(request, null as unknown as CryptoKey, viewerContext);
            setEntries((prev) => [...prev, ...response.entries]);
            setHasMore(response.hasMore);
            setPage((p) => p + 1);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [resolvedId, hasMore, page, currentFilters, viewerContext?.viewerId]);

    const updateEntry = useCallback((entryId: string, changes: Partial<HealthEntry>) => {
        setEntries(prev => prev.map(e => e.entryId === entryId ? { ...e, ...changes } : e));
    }, []);

    return {
        entries,
        isLoading,
        error,
        hasMore,
        loadTimeline,
        loadMore,
        updateEntry,
    };
}
