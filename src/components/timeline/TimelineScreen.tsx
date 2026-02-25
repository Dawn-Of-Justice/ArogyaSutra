// ============================================================
// Timeline Screen — Chronological health records list
// ============================================================

"use client";

import React, { useEffect, useState } from "react";
import { useTimeline } from "../../hooks/useTimeline";
import type { DocumentTypeTag, TimelineFilters } from "../../lib/types/timeline";
import styles from "./TimelineScreen.module.css";

const DOC_TYPES: { value: DocumentTypeTag | "ALL"; label: string; emoji: string }[] = [
    { value: "ALL", label: "All", emoji: "📋" },
    { value: "RX", label: "Prescriptions", emoji: "💊" },
    { value: "Lab", label: "Lab Reports", emoji: "🧪" },
    { value: "H", label: "Hospital", emoji: "🏥" },
    { value: "Consult", label: "Consultations", emoji: "🩺" },
    { value: "Imaging", label: "Imaging", emoji: "📷" },
    { value: "Insurance", label: "Insurance", emoji: "📑" },
];

interface TimelineScreenProps {
    onNavigate: (screen: string) => void;
}

export default function TimelineScreen({ onNavigate }: TimelineScreenProps) {
    const { entries, isLoading, loadTimeline, loadMore, hasMore } = useTimeline();
    const [activeFilter, setActiveFilter] = useState<DocumentTypeTag | "ALL">("ALL");
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        const filters: TimelineFilters = {};
        if (activeFilter !== "ALL") {
            filters.documentTypes = [activeFilter];
        }
        loadTimeline(filters);
    }, [activeFilter, loadTimeline]);

    const filteredEntries = searchText
        ? entries.filter(
            (e) =>
                e.title.toLowerCase().includes(searchText.toLowerCase()) ||
                e.doctorName?.toLowerCase().includes(searchText.toLowerCase()) ||
                e.sourceInstitution?.toLowerCase().includes(searchText.toLowerCase())
        )
        : entries;

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <button className={styles.backButton} onClick={() => onNavigate("dashboard")}>
                    ←
                </button>
                <h1 className={styles.title}>Health Timeline</h1>
                <button className={styles.exportButton} onClick={() => onNavigate("export")}>
                    📤
                </button>
            </header>

            {/* Search */}
            <div className={styles.searchBar}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search records..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText && (
                    <button className={styles.clearSearch} onClick={() => setSearchText("")}>
                        ✕
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            <div className={styles.filters}>
                {DOC_TYPES.map((type) => (
                    <button
                        key={type.value}
                        className={`${styles.filterTab} ${activeFilter === type.value ? styles.filterActive : ""}`}
                        onClick={() => setActiveFilter(type.value)}
                    >
                        <span>{type.emoji}</span>
                        <span>{type.label}</span>
                    </button>
                ))}
            </div>

            {/* Timeline */}
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
                ) : filteredEntries.length === 0 ? (
                    <div className={styles.emptyState}>
                        <span className={styles.emptyIcon}>📋</span>
                        <h3>No Records Found</h3>
                        <p>
                            {searchText
                                ? "Try a different search term"
                                : "Scan your first document to get started"}
                        </p>
                        {!searchText && (
                            <button className={styles.uploadButton} onClick={() => onNavigate("upload")}>
                                📷 Scan Document
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {filteredEntries.map((entry, index) => {
                            // Show date separator when the date changes
                            const prevDate = index > 0
                                ? new Date(filteredEntries[index - 1].date).toDateString()
                                : null;
                            const currDate = new Date(entry.date).toDateString();
                            const showDateSeparator = currDate !== prevDate;

                            return (
                                <React.Fragment key={entry.entryId}>
                                    {showDateSeparator && (
                                        <div className={styles.dateSeparator}>
                                            <span>{formatDateLabel(entry.date)}</span>
                                        </div>
                                    )}
                                    <div
                                        className={styles.entryCard}
                                        onClick={() => onNavigate(`entry/${entry.entryId}`)}
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        <div className={styles.timelineDot} />
                                        <div className={styles.entryContent}>
                                            <div className={styles.entryHeader}>
                                                <span className={`${styles.docTag} ${styles[`tag${entry.documentType}`]}`}>
                                                    {entry.documentType}
                                                </span>
                                                {entry.confidenceScore && (
                                                    <span className={styles.confidence}>
                                                        {entry.confidenceScore}% AI
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className={styles.entryTitle}>{entry.title}</h4>
                                            {entry.doctorName && (
                                                <p className={styles.entryDoctor}>Dr. {entry.doctorName}</p>
                                            )}
                                            {entry.sourceInstitution && (
                                                <p className={styles.entryInstitution}>{entry.sourceInstitution}</p>
                                            )}
                                            <div className={styles.entryFlags}>
                                                {entry.statusFlags.map((flag) => (
                                                    <span key={flag} className={styles.flagBadge}>
                                                        {flag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        {hasMore && (
                            <button
                                className={styles.loadMoreButton}
                                onClick={loadMore}
                                disabled={isLoading}
                            >
                                {isLoading ? "Loading..." : "Load More"}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* FAB */}
            <button className={styles.fab} onClick={() => onNavigate("upload")}>
                <span>+</span>
            </button>
        </div>
    );
}

function formatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
