// ============================================================
// Timeline Screen — Visual timeline with hover-to-reveal periods
// ============================================================

"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTimeline } from "../../hooks/useTimeline";
import type { DocumentTypeTag, TimelineFilters } from "../../lib/types/timeline";
import styles from "./TimelineScreen.module.css";
import {
    ClipboardList, Pill, FlaskConical, Building2, Stethoscope,
    Camera, FileCheck2, Search, X, Share2, Plus, ChevronLeft,
    ChevronRight, Calendar,
} from "lucide-react";
import ScanModal from "../scan/ScanModal";
import DocThumbnail from "../scan/DocThumbnail";
import EntryDetailModal from "./EntryDetailModal";
import type { HealthEntry } from "../../lib/types/timeline";

const DOC_TYPES: { value: DocumentTypeTag | "ALL"; label: string; icon: React.ReactNode }[] = [
    { value: "ALL", label: "All", icon: <ClipboardList size={14} /> },
    { value: "RX", label: "Prescriptions", icon: <Pill size={14} /> },
    { value: "Lab", label: "Lab Reports", icon: <FlaskConical size={14} /> },
    { value: "H", label: "Hospital", icon: <Building2 size={14} /> },
    { value: "Consult", label: "Consultations", icon: <Stethoscope size={14} /> },
    { value: "Imaging", label: "Imaging", icon: <Camera size={14} /> },
    { value: "Insurance", label: "Insurance", icon: <FileCheck2 size={14} /> },
];

const TAG_COLORS: Record<string, string> = {
    RX: "#10b981",
    Lab: "#6366f1",
    H: "#ef4444",
    Consult: "#f59e0b",
    Imaging: "#8b5cf6",
    Insurance: "#0ea5e9",
    Other: "#94a3b8",
};

const TYPE_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    RX: { label: "Prescription", icon: <Pill size={18} />, color: "#10b981" },
    Lab: { label: "Lab Report", icon: <FlaskConical size={18} />, color: "#6366f1" },
    H: { label: "Hospital", icon: <Building2 size={18} />, color: "#ef4444" },
    Consult: { label: "Consultation", icon: <Stethoscope size={18} />, color: "#f59e0b" },
    Imaging: { label: "Imaging", icon: <Camera size={18} />, color: "#8b5cf6" },
    Insurance: { label: "Insurance", icon: <FileCheck2 size={18} />, color: "#0ea5e9" },
    Other: { label: "Document", icon: <ClipboardList size={18} />, color: "#94a3b8" },
};

interface TimelineScreenProps {
    onNavigate: (screen: string) => void;
}

interface MonthBucket {
    key: string;       // "2026-02"
    label: string;     // "Feb 2026"
    year: number;
    month: number;
    entries: ReturnType<typeof useTimeline>["entries"];
}

type Entry = ReturnType<typeof useTimeline>["entries"][number];

export default function TimelineScreen({ onNavigate }: TimelineScreenProps) {
    const { entries, isLoading, loadTimeline, loadMore, hasMore } = useTimeline();
    const [activeFilter, setActiveFilter] = useState<DocumentTypeTag | "ALL">("ALL");
    const [searchText, setSearchText] = useState("");
    const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
    const [scanOpen, setScanOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HealthEntry | null>(null);
    const scrubberRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        const filters: TimelineFilters = {};
        if (activeFilter !== "ALL") filters.documentTypes = [activeFilter];
        loadTimeline(filters);
    }, [activeFilter, loadTimeline]);

    // Build month buckets from all entries
    const monthBuckets = useMemo<MonthBucket[]>(() => {
        const map = new Map<string, MonthBucket>();
        for (const entry of entries) {
            const d = new Date(entry.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    entries: [],
                });
            }
            map.get(key)!.entries.push(entry);
        }
        return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
    }, [entries]);

    const maxBucketCount = useMemo(
        () => Math.max(1, ...monthBuckets.map((b) => b.entries.length)),
        [monthBuckets]
    );

    const filteredEntries = useMemo(() => {
        let list = entries;
        if (selectedMonth) {
            list = monthBuckets.find((b) => b.key === selectedMonth)?.entries ?? [];
        }
        if (searchText) {
            const q = searchText.toLowerCase();
            list = list.filter(
                (e) =>
                    e.title.toLowerCase().includes(q) ||
                    e.doctorName?.toLowerCase().includes(q) ||
                    e.sourceInstitution?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [entries, selectedMonth, searchText, monthBuckets]);

    // Group filtered entries by month key for the list view
    const groupedEntries = useMemo(() => {
        const map = new Map<string, { label: string; entries: Entry[] }>();
        for (const entry of filteredEntries) {
            const d = new Date(entry.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
            if (!map.has(key)) map.set(key, { label, entries: [] });
            map.get(key)!.entries.push(entry);
        }
        return Array.from(map.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([key, val]) => ({ key, ...val }));
    }, [filteredEntries]);

    // Popover: close on outside click
    useEffect(() => {
        if (!hoveredMonth) return;
        const handler = (e: MouseEvent) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                scrubberRef.current && !scrubberRef.current.contains(e.target as Node)
            ) {
                setHoveredMonth(null);
                setPopoverPos(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [hoveredMonth]);

    const handleDotHover = (e: React.MouseEvent<HTMLButtonElement>, key: string) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredMonth(key);
        setPopoverPos({ x: rect.left + rect.width / 2, y: rect.top });
    };

    const handleDotClick = (key: string) => {
        setSelectedMonth((prev) => (prev === key ? null : key));
        setHoveredMonth(null);
        // Scroll list to that month section
        setTimeout(() => {
            sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
    };

    const hoveredBucket = hoveredMonth ? monthBuckets.find((b) => b.key === hoveredMonth) : null;

    // Group scrubber months by year
    const yearGroups = useMemo(() => {
        const map = new Map<number, MonthBucket[]>();
        for (const b of monthBuckets) {
            if (!map.has(b.year)) map.set(b.year, []);
            map.get(b.year)!.push(b);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a - b);
    }, [monthBuckets]);

    return (
        <>
            <div className={styles.container}>
                {/* ---- Header ---- */}
                <header className={styles.header}>
                    <button className={styles.backButton} onClick={() => onNavigate("dashboard")}>
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className={styles.title}>Health Timeline</h1>
                    <button className={styles.exportButton} onClick={() => onNavigate("export")}>
                        <Share2 size={18} />
                    </button>
                </header>

                {/* ---- Visual Timeline Scrubber ---- */}
                {monthBuckets.length > 0 && (
                    <div className={styles.scrubberWrap} ref={scrubberRef}>
                        <div className={styles.scrubberTrack} />
                        <div className={styles.scrubberContent}>
                            {yearGroups.map(([year, months]) => (
                                <div key={year} className={styles.yearGroup}>
                                    <span className={styles.yearLabel}>{year}</span>
                                    <div className={styles.monthDots}>
                                        {months.map((bucket) => {
                                            const ratio = bucket.entries.length / maxBucketCount;
                                            const dotSize = 10 + Math.round(ratio * 14);
                                            const isActive = selectedMonth === bucket.key;
                                            const isHovered = hoveredMonth === bucket.key;
                                            return (
                                                <button
                                                    key={bucket.key}
                                                    className={`${styles.dotBtn} ${isActive ? styles.dotActive : ""} ${isHovered ? styles.dotHovered : ""}`}
                                                    style={{ "--dot-size": `${dotSize}px` } as React.CSSProperties}
                                                    onMouseEnter={(e) => handleDotHover(e, bucket.key)}
                                                    onMouseLeave={() => {
                                                        // delay to let pointer move to popover
                                                        setTimeout(() => {
                                                            setHoveredMonth((prev) =>
                                                                prev === bucket.key ? null : prev
                                                            );
                                                        }, 120);
                                                    }}
                                                    onClick={() => handleDotClick(bucket.key)}
                                                    title={bucket.label}
                                                >
                                                    <span className={styles.dotInner} />
                                                    <span className={styles.dotMonthLabel}>
                                                        {bucket.label.split(" ")[0]}
                                                    </span>
                                                    <span className={styles.dotCount}>{bucket.entries.length}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {selectedMonth && (
                            <button
                                className={styles.clearPeriod}
                                onClick={() => setSelectedMonth(null)}
                                title="Show all"
                            >
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>
                )}

                {/* ---- Hover Popover ---- */}
                {hoveredBucket && popoverPos && (
                    <div
                        ref={popoverRef}
                        className={styles.periodPopover}
                        style={{ left: popoverPos.x, top: popoverPos.y }}
                        onMouseEnter={() => setHoveredMonth(hoveredBucket.key)}
                        onMouseLeave={() => {
                            setHoveredMonth(null);
                            setPopoverPos(null);
                        }}
                    >
                        <div className={styles.popoverHeader}>
                            <Calendar size={13} />
                            <strong>{hoveredBucket.label}</strong>
                            <span className={styles.popoverCount}>{hoveredBucket.entries.length} event{hoveredBucket.entries.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className={styles.popoverList}>
                            {hoveredBucket.entries.slice(0, 6).map((e) => (
                                <button
                                    key={e.entryId}
                                    className={styles.popoverItem}
                                    onClick={() => { setHoveredMonth(null); onNavigate(`entry/${e.entryId}`); }}
                                >
                                    <span
                                        className={styles.popoverDot}
                                        style={{ background: TAG_COLORS[e.documentType] ?? TAG_COLORS.Other }}
                                    />
                                    <span className={styles.popoverTitle}>{e.title}</span>
                                    <span className={styles.popoverTag}>{e.documentType}</span>
                                </button>
                            ))}
                            {hoveredBucket.entries.length > 6 && (
                                <p className={styles.popoverMore}>+{hoveredBucket.entries.length - 6} more — click to filter</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ---- Search ---- */}
                <div className={styles.searchBar}>
                    <span className={styles.searchIcon}><Search size={15} /></span>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder={selectedMonth ? `Search in ${monthBuckets.find(b => b.key === selectedMonth)?.label ?? "period"}…` : "Search all records…"}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    {searchText && (
                        <button className={styles.clearSearch} onClick={() => setSearchText("")}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* ---- Filter tabs ---- */}
                <div className={styles.filters}>
                    {DOC_TYPES.map((type) => (
                        <button
                            key={type.value}
                            className={`${styles.filterTab} ${activeFilter === type.value ? styles.filterActive : ""}`}
                            onClick={() => setActiveFilter(type.value)}
                        >
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                        </button>
                    ))}
                </div>

                {/* ---- Grouped Timeline List ---- */}
                <div className={styles.timeline}>
                    {isLoading && entries.length === 0 ? (
                        <div className={styles.loadingState}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className={styles.skeletonCard}>
                                    <div className={styles.skeletonLine} style={{ width: "60%" }} />
                                    <div className={styles.skeletonLine} style={{ width: "80%" }} />
                                    <div className={styles.skeletonLine} style={{ width: "40%" }} />
                                </div>
                            ))}
                        </div>
                    ) : groupedEntries.length === 0 ? (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyIcon}><ClipboardList size={40} /></span>
                            <h3>No Records Found</h3>
                            <p>{searchText ? "Try a different search term" : selectedMonth ? "No records in this period" : "Scan your first document to get started"}</p>
                            {!searchText && !selectedMonth && (
                                <button className={styles.uploadButton} onClick={() => setScanOpen(true)}>
                                    <Camera size={15} style={{ marginRight: 6, verticalAlign: "middle" }} /> Scan Document
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {groupedEntries.map(({ key, label, entries: groupEntries }) => (
                                <div
                                    key={key}
                                    ref={(el) => { sectionRefs.current[key] = el; }}
                                    className={`${styles.monthSection} ${selectedMonth === key ? styles.monthSectionActive : ""}`}
                                >
                                    <div className={styles.monthHeader}>
                                        <span className={styles.monthHeaderDot} />
                                        <span className={styles.monthHeaderLabel}>{label}</span>
                                        <span className={styles.monthHeaderCount}>{groupEntries.length}</span>
                                    </div>
                                    {groupEntries.map((entry, index) => {
                                        const typeInfo = TYPE_INFO[entry.documentType] ?? TYPE_INFO.Other;
                                        const subline = [entry.doctorName ? `Dr. ${entry.doctorName}` : null, entry.sourceInstitution].filter(Boolean).join(" · ");
                                        return (
                                            <div
                                                key={entry.entryId}
                                                className={styles.entryCard}
                                                onClick={() => setSelectedEntry(entry)}
                                                style={{ animationDelay: `${index * 0.05}s` }}
                                            >
                                                {/* Color accent bar */}
                                                <div className={styles.entryAccentBar} style={{ background: typeInfo.color }} />

                                                <div className={styles.entryInner}>
                                                    {/* Type icon */}
                                                    <div className={styles.entryIcon} style={{ background: typeInfo.color + "20", color: typeInfo.color }}>
                                                        {typeInfo.icon}
                                                    </div>

                                                    {/* Text body */}
                                                    <div className={styles.entryBody}>
                                                        <div className={styles.entryMeta}>
                                                            <span className={styles.entryTypeLabel} style={{ color: typeInfo.color }}>{typeInfo.label}</span>
                                                            <span className={styles.entryDate}>
                                                                {new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                            </span>
                                                        </div>
                                                        <h4 className={styles.entryTitle}>{entry.title}</h4>
                                                        {subline && <p className={styles.entrySubline}>{subline}</p>}
                                                        {entry.statusFlags?.length > 0 && (
                                                            <div className={styles.entryFlags}>
                                                                {entry.statusFlags.map((flag) => (
                                                                    <span key={flag} className={styles.flagBadge}>{flag}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Thumbnail */}
                                                    {entry.encryptedBlobKey && (
                                                        <div className={styles.entryThumb}>
                                                            <DocThumbnail
                                                                s3Key={entry.encryptedBlobKey}
                                                                alt={entry.title}
                                                                style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }}
                                                            />
                                                        </div>
                                                    )}

                                                    <ChevronRight size={14} className={styles.entryChevron} />
                                                </div>
                                            </div>
                                        );
                                    })}

                                </div>
                            ))}
                            {hasMore && !selectedMonth && (
                                <button className={styles.loadMoreButton} onClick={loadMore} disabled={isLoading}>
                                    {isLoading ? "Loading..." : "Load More"}
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* FAB */}
                <button className={styles.fab} onClick={() => setScanOpen(true)}>
                    <Plus size={22} />
                </button>
            </div>
            {scanOpen && (
                <ScanModal
                    onClose={() => setScanOpen(false)}
                    onSaved={() => { setScanOpen(false); loadTimeline(); }}
                />
            )}
            {selectedEntry && (
                <EntryDetailModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                    onDeleted={() => { setSelectedEntry(null); loadTimeline(); }}
                    onUpdated={(updated) => setSelectedEntry(prev => prev ? { ...prev, ...updated } : prev)}
                />
            )}
        </>
    );
}
