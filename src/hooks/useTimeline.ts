// ============================================================
// Timeline Hook
// Loads & manages the chronological health timeline
// ============================================================

"use client";

import { useState, useCallback } from "react";
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

    // Use override → effectivePatient (handles guardian-dependent switching) → patient
    const resolvedId = overridePatientId || effectivePatient?.patientId;

    const viewerContext: ViewerContext | undefined =
        userRole === "doctor" && doctor
            ? { viewerType: "DOCTOR", viewerId: doctor.doctorId, viewerName: doctor.fullName }
            : undefined;

    const loadTimeline = useCallback(
        async (filters?: TimelineFilters) => {
            if (!resolvedId) return;
            setIsLoading(true);
            setError(null);

            try {
                const request: TimelineRequest = {
                    patientId: resolvedId,
                    filters: filters || {},
                    options: { page: 1, pageSize: 20, sortOrder: "newest", groupBy: "date" },
                };
                const response = await timelineService.getTimeline(request, null as unknown as CryptoKey, viewerContext);
                setEntries(response.entries);
                setHasMore(response.hasMore);
                setPage(1);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setIsLoading(false);
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
                filters: {},
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
    }, [resolvedId, hasMore, page, viewerContext?.viewerId]);

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
