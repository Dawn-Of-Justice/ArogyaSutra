"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import styles from "./ZoomableImage.module.css";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";

interface ZoomableImageProps {
    src: string;
    alt?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_STEP = 0.4;

export default function ZoomableImage({ src, alt = "Document" }: ZoomableImageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);

    // drag state refs (don't need re-render)
    const dragStart = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
    // pinch state refs
    const lastPinchDist = useRef<number | null>(null);
    const lastPinchScale = useRef<number>(1);

    const clampTranslate = useCallback((tx: number, ty: number, s: number) => {
        const container = containerRef.current;
        if (!container) return { x: tx, y: ty };
        const { width, height } = container.getBoundingClientRect();
        const maxX = (width * (s - 1)) / 2;
        const maxY = (height * (s - 1)) / 2;
        return {
            x: Math.max(-maxX, Math.min(maxX, tx)),
            y: Math.max(-maxY, Math.min(maxY, ty)),
        };
    }, []);

    const resetView = useCallback(() => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
    }, []);

    const zoomBy = useCallback((delta: number) => {
        setScale(prev => {
            const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
            if (next === MIN_SCALE) setTranslate({ x: 0, y: 0 });
            return next;
        });
    }, []);

    // ---- Wheel zoom ----
    const onWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        setScale(prev => {
            const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
            if (next === MIN_SCALE) setTranslate({ x: 0, y: 0 });
            return next;
        });
    }, []);

    // ---- Mouse drag ----
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (scale <= 1) return;
        setIsDragging(true);
        dragStart.current = { mx: e.clientX, my: e.clientY, tx: translate.x, ty: translate.y };
    }, [scale, translate]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !dragStart.current) return;
        const dx = e.clientX - dragStart.current.mx;
        const dy = e.clientY - dragStart.current.my;
        const clamped = clampTranslate(dragStart.current.tx + dx, dragStart.current.ty + dy, scale);
        setTranslate(clamped);
    }, [isDragging, scale, clampTranslate]);

    const onMouseUp = useCallback(() => {
        setIsDragging(false);
        dragStart.current = null;
    }, []);

    // ---- Touch pinch / drag ----
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchDist.current = Math.hypot(dx, dy);
            lastPinchScale.current = scale;
        } else if (e.touches.length === 1 && scale > 1) {
            dragStart.current = {
                mx: e.touches[0].clientX,
                my: e.touches[0].clientY,
                tx: translate.x,
                ty: translate.y,
            };
        }
    }, [scale, translate]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 2 && lastPinchDist.current !== null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = dist / lastPinchDist.current;
            const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, lastPinchScale.current * ratio));
            setScale(next);
            if (next === MIN_SCALE) setTranslate({ x: 0, y: 0 });
        } else if (e.touches.length === 1 && dragStart.current) {
            const dx = e.touches[0].clientX - dragStart.current.mx;
            const dy = e.touches[0].clientY - dragStart.current.my;
            const clamped = clampTranslate(dragStart.current.tx + dx, dragStart.current.ty + dy, scale);
            setTranslate(clamped);
        }
    }, [scale, clampTranslate]);

    const onTouchEnd = useCallback(() => {
        lastPinchDist.current = null;
        dragStart.current = null;
    }, []);

    // Reset view when src changes
    useEffect(() => { resetView(); }, [src, resetView]);

    const pct = Math.round(scale * 100);

    return (
        <div className={`${styles.wrapper} ${fullscreen ? styles.fullscreen : ""}`}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <button className={styles.toolBtn} onClick={() => zoomBy(-ZOOM_STEP)} disabled={scale <= MIN_SCALE} title="Zoom out">
                    <ZoomOut size={15} />
                </button>
                <span className={styles.zoomPct}>{pct}%</span>
                <button className={styles.toolBtn} onClick={() => zoomBy(ZOOM_STEP)} disabled={scale >= MAX_SCALE} title="Zoom in">
                    <ZoomIn size={15} />
                </button>
                <button className={styles.toolBtn} onClick={resetView} disabled={scale === 1} title="Reset">
                    <RotateCcw size={13} />
                </button>
                <button className={styles.toolBtn} onClick={() => setFullscreen(v => !v)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                    <Maximize2 size={14} />
                </button>
            </div>

            {/* Image area */}
            <div
                ref={containerRef}
                className={styles.viewport}
                onWheel={onWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
            >
                <img
                    src={src}
                    alt={alt}
                    className={styles.image}
                    style={{
                        transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                    }}
                    draggable={false}
                />
            </div>

            {scale > 1 && (
                <p className={styles.hint}>Scroll or pinch to zoom · Drag to pan</p>
            )}
        </div>
    );
}
