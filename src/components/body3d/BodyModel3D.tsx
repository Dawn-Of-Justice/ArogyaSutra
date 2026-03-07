// ============================================================
// 3D Body Model — Interactive anatomical human model
// Loads JSON models from JustLikeIcarus/3DHumans repo
// Uses @react-three/fiber + @react-three/drei
// ============================================================

"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import styles from "./BodyModel3D.module.css";

// ---- Types ----
export interface BodyAnnotation {
    bodyPart: string;
    title: string;
    date: string;
}

/** A simplified medical record passed into the body map for display */
export interface MedicalRecord {
    entryId: string;
    title: string;
    date: string;
    documentType: string;
    summary?: string;
    sourceInstitution?: string;
    bodyPart?: string;
}

/** A single interactive body zone on the overlay */
interface BodyZone {
    key: string;
    label: string;
    cx: number; // center x as % of container
    cy: number; // center y as % of container
    rx: number; // half-width %
    ry: number; // half-height %
}

/**
 * Body region hotspots — percentages calibrated against Three.js camera
 * position [0, 0.5, 5] fov=38, model 3 units tall centered at y=0.
 * Left/Right follow anatomical convention: patient's left = viewer's right.
 * Model is in T-pose: arms extend horizontally, hands at tips.
 * Updated 2026-03-07
 */
const BODY_ZONES: BodyZone[] = [
    { key: "Head",        label: "Head / Brain",           cx: 50, cy: 11, rx:  7, ry:  7 },
    { key: "Chest",       label: "Chest / Lungs / Heart",  cx: 50, cy: 29, rx: 11, ry:  7 },
    { key: "Abdomen",     label: "Abdomen",                cx: 50, cy: 42, rx: 10, ry:  5 },
    { key: "Pelvis",      label: "Pelvis / Hip",           cx: 50, cy: 52, rx: 10, ry:  5 },
    { key: "Left Arm",    label: "Left Arm / Shoulder",   cx: 73, cy: 23, rx:  9, ry:  5 },
    { key: "Right Arm",   label: "Right Arm / Shoulder",  cx: 27, cy: 23, rx:  9, ry:  5 },
    { key: "Left Hand",   label: "Left Hand / Wrist",     cx: 88, cy: 24, rx:  5, ry:  4 },
    { key: "Right Hand",  label: "Right Hand / Wrist",    cx: 12, cy: 24, rx:  5, ry:  4 },
    { key: "Left Leg",    label: "Left Leg / Knee",       cx: 55, cy: 73, rx:  5, ry: 13 },
    { key: "Right Leg",   label: "Right Leg / Knee",      cx: 45, cy: 73, rx:  5, ry: 13 },
];

/** Keywords used to fuzzy-match records to body zones */
const BODY_PART_KEYWORDS: Record<string, string[]> = {
    "Head":      ["head", "brain", "skull", "cranial", "neuro", "migraine", "headache", "eye", "ear", "nose", "throat", "ent", "dental", "jaw", "facial", "sinus", "ophthalmol"],
    "Chest":     ["chest", "lung", "pulmonary", "respiratory", "cardiac", "heart", "ecg", "ekg", "echo", "bronch", "pleural", "thorax", "thoracic", "rib", "pericardial"],
    "Abdomen":   ["abdomen", "abdominal", "liver", "kidney", "renal", "spleen", "pancreas", "gallbladder", "intestine", "bowel", "colon", "stomach", "gastro", "usg", "ultrasound"],
    "Pelvis":    ["pelvis", "pelvic", "hip joint", "uterus", "ovary", "prostate", "bladder", "urinary"],
    "Left Arm":   ["left arm", "left elbow", "left shoulder", "left forearm", "left humerus", "left radius", "left ulna"],
    "Right Arm":  ["right arm", "right elbow", "right shoulder", "right forearm", "right humerus", "right radius", "right ulna"],
    "Left Hand":  ["left hand", "left wrist", "left finger", "left thumb", "left palm", "left carpal", "left metacarpal"],
    "Right Hand": ["right hand", "right wrist", "right finger", "right thumb", "right palm", "right carpal", "right metacarpal"],
    "Left Leg":   ["left leg", "left knee", "left ankle", "left foot", "left femur", "left tibia", "left fibula", "left toe"],
    "Right Leg":  ["right leg", "right knee", "right ankle", "right foot", "right femur", "right tibia", "right fibula", "right toe"],
};

/** Return which body zones a record matches (can match more than one) */
function getZonesForRecord(record: MedicalRecord): string[] {
    const matches = new Set<string>();
    const haystack = [record.title, record.bodyPart, record.summary]
        .filter(Boolean).join(" ").toLowerCase();

    for (const [zone, keywords] of Object.entries(BODY_PART_KEYWORDS)) {
        if (keywords.some((kw) => haystack.includes(kw))) matches.add(zone);
    }

    // Direct bodyPart field — try prefix/contains match against zone keys
    if (record.bodyPart) {
        const bp = record.bodyPart.toLowerCase();
        for (const zone of Object.keys(BODY_PART_KEYWORDS)) {
            if (bp.includes(zone.toLowerCase()) || zone.toLowerCase().includes(bp)) {
                matches.add(zone);
            }
        }
    }

    return Array.from(matches);
}

interface BodyModel3DProps {
    gender?: "male" | "female";
    annotations?: BodyAnnotation[];
    onPartClick?: (part: string, records: MedicalRecord[]) => void;
    selectedPart?: string | null;
    records?: MedicalRecord[];
}

// ---- Three.js JSON v3 format types ----
interface ThreeJSONv3 {
    metadata: { formatVersion: number };
    vertices: number[];
    normals?: number[];
    faces: number[];
    materials?: Array<{
        colorDiffuse?: [number, number, number];
        colorSpecular?: [number, number, number];
    }>;
}

/**
 * Parse old Three.js JSON format v3 into a BufferGeometry.
 * The face array encodes a bitmask per face:
 *   bit 0: is quad (0=triangle,1=quad)
 *   bit 1: has material index
 *   bit 3: has face vertex normals
 *   bit 5: has face vertex UVs
 */
function parseThreeJSONv3(json: ThreeJSONv3): THREE.BufferGeometry {
    const verts = json.vertices;
    const norms = json.normals || [];
    const facesArr = json.faces;

    const positions: number[] = [];
    const normals: number[] = [];

    let i = 0;
    while (i < facesArr.length) {
        const type = facesArr[i++];
        const isQuad = (type & 1) !== 0;
        const hasMaterial = (type & 2) !== 0;
        const hasFaceVertexUv = (type & 8) !== 0;
        const hasFaceNormal = (type & 16) !== 0;
        const hasFaceVertexNormal = (type & 32) !== 0;
        const hasFaceColor = (type & 64) !== 0;
        const hasFaceVertexColor = (type & 128) !== 0;

        const nVertices = isQuad ? 4 : 3;

        // Vertex indices
        const vi: number[] = [];
        for (let j = 0; j < nVertices; j++) {
            vi.push(facesArr[i++]);
        }

        // Skip material index
        if (hasMaterial) i++;

        // Skip face UV
        if (hasFaceVertexUv) {
            i += isQuad ? 4 : 3;
        }

        // Skip face normal
        if (hasFaceNormal) i++;

        // Face vertex normals
        const ni: number[] = [];
        if (hasFaceVertexNormal) {
            for (let j = 0; j < nVertices; j++) {
                ni.push(facesArr[i++]);
            }
        }

        // Skip face color
        if (hasFaceColor) i++;
        // Skip face vertex colors
        if (hasFaceVertexColor) i += nVertices;

        // Emit triangle(s)
        const tris = isQuad
            ? [[0, 1, 2], [0, 2, 3]]
            : [[0, 1, 2]];

        for (const [a, b, c] of tris) {
            for (const idx of [a, b, c]) {
                const vertIdx = vi[idx];
                positions.push(
                    verts[vertIdx * 3],
                    verts[vertIdx * 3 + 1],
                    verts[vertIdx * 3 + 2]
                );
                if (ni.length > 0 && norms.length > 0) {
                    const normIdx = ni[idx];
                    normals.push(
                        norms[normIdx * 3],
                        norms[normIdx * 3 + 1],
                        norms[normIdx * 3 + 2]
                    );
                }
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
    );
    if (normals.length > 0) {
        geometry.setAttribute(
            "normal",
            new THREE.Float32BufferAttribute(normals, 3)
        );
    } else {
        geometry.computeVertexNormals();
    }

    return geometry;
}

// ---- Human Model Mesh ----
function HumanModel({ url }: { url: string }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

    useEffect(() => {
        fetch(url)
            .then((r) => r.json())
            .then((json: ThreeJSONv3) => {
                const geo = parseThreeJSONv3(json);
                // Center and scale
                geo.computeBoundingBox();
                const box = geo.boundingBox!;
                const center = new THREE.Vector3();
                box.getCenter(center);
                geo.translate(-center.x, -center.y, -center.z);

                // Scale to fit ~3 units tall
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 3 / maxDim;
                geo.scale(scale, scale, scale);

                setGeometry(geo);
            })
            .catch((err) => console.error("Failed to load 3D model:", err));
    }, [url]);

    // Gentle idle rotation
    useFrame(({ clock }) => {
        if (meshRef.current) {
            meshRef.current.rotation.y =
                Math.sin(clock.elapsedTime * 0.15) * 0.25;
        }
    });

    const material = useMemo(
        () =>
            new THREE.MeshPhysicalMaterial({
                color: 0xe8c4a0, // warm skin tone
                roughness: 0.55,
                metalness: 0.02,
                clearcoat: 0.1,
                clearcoatRoughness: 0.4,
                side: THREE.DoubleSide,
            }),
        []
    );

    if (!geometry) return null;

    return (
        <mesh ref={meshRef} geometry={geometry} material={material} castShadow />
    );
}

// ---- Platform Base (Shadow Disc) ----
function Platform() {
    return (
        <group position={[0, -1.55, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.3, 1.2, 48]} />
                <meshStandardMaterial
                    color={0xdde4ee}
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

// ---- Scene ----
function Scene({ gender }: { gender: "male" | "female" }) {
    const modelUrl = gender === "female" ? "/models/female.json" : "/models/male.json";

    return (
        <>
            {/* Lighting -- bright, clean, medical */}
            <ambientLight intensity={0.6} />
            <directionalLight
                position={[4, 6, 5]}
                intensity={0.9}
                color={0xffffff}
                castShadow
            />
            <directionalLight
                position={[-3, 3, -4]}
                intensity={0.35}
                color={0xc5d5f0}
            />
            <pointLight position={[0, -1, 3]} intensity={0.15} color={0x4a90d9} />

            <HumanModel url={modelUrl} />
            <Platform />

            <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={2.5}
                maxDistance={7}
                minPolarAngle={Math.PI * 0.15}
                maxPolarAngle={Math.PI * 0.85}
                autoRotate={false}
            />
        </>
    );
}

// ---- Main Component ----
export default function BodyModel3D({
    gender = "male",
    annotations = [],
    onPartClick,
    selectedPart = null,
    records = [],
}: BodyModel3DProps) {
    const [hoveredZone, setHoveredZone] = useState<string | null>(null);

    // Map each zone key → list of matching records
    const zoneRecords = useMemo(() => {
        const map: Record<string, MedicalRecord[]> = {};
        for (const r of records) {
            for (const z of getZonesForRecord(r)) {
                if (!map[z]) map[z] = [];
                map[z].push(r);
            }
        }
        return map;
    }, [records]);

    const hoveredDef = BODY_ZONES.find((z) => z.key === hoveredZone) ?? null;

    // Position tooltip: right of zone if zone is in left half, left if in right half
    const tooltipStyle = hoveredDef
        ? hoveredDef.cx < 50
            ? { left: `${hoveredDef.cx + hoveredDef.rx + 2}%`, top: `${hoveredDef.cy - hoveredDef.ry}%` }
            : { right: `${100 - hoveredDef.cx + hoveredDef.rx + 2}%`, top: `${hoveredDef.cy - hoveredDef.ry}%` }
        : {};

    return (
        <div className={styles.container}>
            <Canvas
                camera={{ position: [0, 0.5, 5], fov: 38 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: "transparent" }}
            >
                <Scene gender={gender} />
            </Canvas>

            {/* Interactive body part overlay */}
            <div className={styles.bodyOverlay}>
                {BODY_ZONES.map((zone) => {
                    const recs = zoneRecords[zone.key] ?? [];
                    const hasRecords = recs.length > 0;
                    const isHovered = hoveredZone === zone.key;
                    const isSelected = selectedPart === zone.key;
                    return (
                        <div
                            key={zone.key}
                            title={zone.label}
                            className={[
                                styles.hotspot,
                                hasRecords ? styles.hotspotHasRecords : "",
                                isHovered ? styles.hotspotHovered : "",
                                isSelected ? styles.hotspotSelected : "",
                            ].filter(Boolean).join(" ")}
                            style={{
                                left:   `${zone.cx - zone.rx}%`,
                                top:    `${zone.cy - zone.ry}%`,
                                width:  `${zone.rx * 2}%`,
                                height: `${zone.ry * 2}%`,
                            }}
                            onMouseEnter={() => setHoveredZone(zone.key)}
                            onMouseLeave={() => setHoveredZone(null)}
                            onClick={() => onPartClick?.(zone.key, recs)}
                        >
                            {hasRecords && (
                                <span className={styles.hotspotBadge}>{recs.length}</span>
                            )}
                        </div>
                    );
                })}

                {/* Hover tooltip */}
                {hoveredZone && hoveredDef && (
                    <div
                        className={styles.bodyTooltip}
                        style={tooltipStyle}
                        onMouseEnter={() => setHoveredZone(hoveredZone)}
                        onMouseLeave={() => setHoveredZone(null)}
                    >
                        <span className={styles.bodyTooltipTitle}>{hoveredDef.label}</span>
                        {(zoneRecords[hoveredZone] ?? []).length === 0 ? (
                            <span className={styles.bodyTooltipEmpty}>No records</span>
                        ) : (
                            <>
                                {(zoneRecords[hoveredZone]).slice(0, 3).map((r) => (
                                    <div key={r.entryId} className={styles.bodyTooltipRecord}>
                                        <span className={styles.bodyTooltipDocType}>{r.documentType}</span>
                                        <span className={styles.bodyTooltipRecordTitle}>{r.title}</span>
                                        <span className={styles.bodyTooltipDate}>{r.date}</span>
                                    </div>
                                ))}
                                {(zoneRecords[hoveredZone]).length > 3 && (
                                    <span className={styles.bodyTooltipMore}>
                                        +{(zoneRecords[hoveredZone]).length - 3} more — click to view all
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
