"use client";

import React, { useEffect, useState } from "react";

interface DocThumbnailProps {
    s3Key: string;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Lazy-loads a document image from S3 via a presigned URL.
 * Renders nothing if s3Key is empty.
 */
export default function DocThumbnail({ s3Key, alt = "Document", className, style }: DocThumbnailProps) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!s3Key) return;
        let cancelled = false;

        fetch(`/api/timeline/document-url?s3Key=${encodeURIComponent(s3Key)}`)
            .then((r) => r.json())
            .then((data) => {
                if (!cancelled && data.url) setUrl(data.url);
            })
            .catch(() => { if (!cancelled) setError(true); });

        return () => { cancelled = true; };
    }, [s3Key]);

    if (!s3Key || error || !url) return null;

    return (
        <img
            src={url}
            alt={alt}
            className={className}
            style={{
                objectFit: "cover",
                borderRadius: "var(--radius-lg, 8px)",
                border: "1px solid var(--color-border)",
                ...style,
            }}
            onError={() => setError(true)}
        />
    );
}
