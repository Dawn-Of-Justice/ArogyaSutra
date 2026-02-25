// ============================================================
// 3D Body Model — Interactive anatomical visualization
// Uses Three.js via @react-three/fiber + @react-three/drei
// ============================================================

"use client";

import React, { useState, useRef, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Line } from "@react-three/drei";
import * as THREE from "three";
import styles from "./BodyModel3D.module.css";

// ---- Types ----
export interface BodyAnnotation {
    bodyPart: string;
    title: string;
    date: string;
    icon: string;
}

interface BodyModel3DProps {
    annotations?: BodyAnnotation[];
    onPartClick?: (part: string) => void;
    selectedPart?: string | null;
}

// ---- Body Part Definitions ----
const MUSCLE_COLOR = new THREE.Color(0xc94040); // reddish muscle
const MUSCLE_HOVER = new THREE.Color(0xff5555);
const HIGHLIGHT_COLOR = new THREE.Color(0x10b981); // accent green

interface BodyPartDef {
    id: string;
    position: [number, number, number];
    scale: [number, number, number];
    rotation?: [number, number, number];
    shape: "sphere" | "cylinder" | "capsule";
    label: string;
}

const BODY_PARTS: BodyPartDef[] = [
    // Head
    { id: "head", position: [0, 2.85, 0], scale: [0.35, 0.42, 0.38], shape: "sphere", label: "Head" },
    // Neck
    { id: "neck", position: [0, 2.42, 0], scale: [0.15, 0.15, 0.15], shape: "cylinder", label: "Neck" },
    // Torso (upper)
    { id: "chest", position: [0, 1.9, 0], scale: [0.55, 0.45, 0.3], shape: "capsule", label: "Chest" },
    // Torso (lower)
    { id: "abdomen", position: [0, 1.3, 0], scale: [0.48, 0.35, 0.28], shape: "capsule", label: "Abdomen" },
    // Pelvis
    { id: "pelvis", position: [0, 0.85, 0], scale: [0.5, 0.2, 0.28], shape: "capsule", label: "Pelvis" },

    // Left arm
    { id: "left-shoulder", position: [-0.65, 2.15, 0], scale: [0.18, 0.15, 0.15], shape: "sphere", label: "L. Shoulder" },
    { id: "left-upper-arm", position: [-0.75, 1.7, 0], scale: [0.12, 0.3, 0.12], rotation: [0, 0, 0.15], shape: "cylinder", label: "L. Upper Arm" },
    { id: "left-elbow", position: [-0.82, 1.35, 0], scale: [0.1, 0.1, 0.1], shape: "sphere", label: "L. Elbow" },
    { id: "left-forearm", position: [-0.88, 0.95, 0], scale: [0.1, 0.28, 0.1], rotation: [0, 0, 0.1], shape: "cylinder", label: "L. Forearm" },
    { id: "left-hand", position: [-0.92, 0.6, 0], scale: [0.1, 0.12, 0.06], shape: "sphere", label: "L. Hand" },

    // Right arm
    { id: "right-shoulder", position: [0.65, 2.15, 0], scale: [0.18, 0.15, 0.15], shape: "sphere", label: "R. Shoulder" },
    { id: "right-upper-arm", position: [0.75, 1.7, 0], scale: [0.12, 0.3, 0.12], rotation: [0, 0, -0.15], shape: "cylinder", label: "R. Upper Arm" },
    { id: "right-elbow", position: [0.82, 1.35, 0], scale: [0.1, 0.1, 0.1], shape: "sphere", label: "R. Elbow" },
    { id: "right-forearm", position: [0.88, 0.95, 0], scale: [0.1, 0.28, 0.1], rotation: [0, 0, -0.1], shape: "cylinder", label: "R. Forearm" },
    { id: "right-hand", position: [0.92, 0.6, 0], scale: [0.1, 0.12, 0.06], shape: "sphere", label: "R. Hand" },

    // Left leg
    { id: "left-thigh", position: [-0.22, 0.45, 0], scale: [0.15, 0.35, 0.15], shape: "cylinder", label: "L. Thigh" },
    { id: "left-knee", position: [-0.22, 0.05, 0], scale: [0.12, 0.1, 0.12], shape: "sphere", label: "L. Knee" },
    { id: "left-shin", position: [-0.22, -0.42, 0], scale: [0.11, 0.35, 0.11], shape: "cylinder", label: "L. Shin" },
    { id: "left-foot", position: [-0.22, -0.82, 0.06], scale: [0.1, 0.06, 0.18], shape: "capsule", label: "L. Foot" },

    // Right leg
    { id: "right-thigh", position: [0.22, 0.45, 0], scale: [0.15, 0.35, 0.15], shape: "cylinder", label: "R. Thigh" },
    { id: "right-knee", position: [0.22, 0.05, 0], scale: [0.12, 0.1, 0.12], shape: "sphere", label: "R. Knee" },
    { id: "right-shin", position: [0.22, -0.42, 0], scale: [0.11, 0.35, 0.11], shape: "cylinder", label: "R. Shin" },
    { id: "right-foot", position: [0.22, -0.82, 0.06], scale: [0.1, 0.06, 0.18], shape: "capsule", label: "R. Foot" },
];

// ---- Muscle detail lines (decorative) ----
function MuscleLines() {
    const lines: [number, number, number][][] = [
        // Chest division line
        [[0, 2.1, 0.31], [0, 1.7, 0.31]],
        // Abs lines
        [[0, 1.55, 0.29], [0, 1.05, 0.29]],
        [[-0.15, 1.55, 0.28], [-0.15, 1.1, 0.28]],
        [[0.15, 1.55, 0.28], [0.15, 1.1, 0.28]],
    ];

    return (
        <group>
            {lines.map((pts, i) => (
                <Line
                    key={i}
                    points={pts}
                    color="#d98888"
                    lineWidth={1}
                    transparent
                    opacity={0.4}
                />
            ))}
        </group>
    );
}

// ---- Individual Body Part Mesh ----
function BodyPart({
    part,
    isSelected,
    isAnnotated,
    onClick,
}: {
    part: BodyPartDef;
    isSelected: boolean;
    isAnnotated: boolean;
    onClick: () => void;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    useFrame(() => {
        if (!meshRef.current) return;
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        const targetColor = isSelected
            ? HIGHLIGHT_COLOR
            : hovered
                ? MUSCLE_HOVER
                : isAnnotated
                    ? new THREE.Color(0xd06060)
                    : MUSCLE_COLOR;
        mat.color.lerp(targetColor, 0.1);

        // Subtle pulse for annotated parts
        if (isAnnotated && !isSelected) {
            const pulse = Math.sin(Date.now() * 0.003) * 0.03 + 1;
            meshRef.current.scale.setScalar(pulse);
            meshRef.current.scale.x *= part.scale[0];
            meshRef.current.scale.y *= part.scale[1];
            meshRef.current.scale.z *= part.scale[2];
        }
    });

    const geometry = (() => {
        switch (part.shape) {
            case "sphere":
                return <sphereGeometry args={[1, 16, 16]} />;
            case "cylinder":
                return <cylinderGeometry args={[0.8, 1, 2, 12]} />;
            case "capsule":
                return <capsuleGeometry args={[0.8, 0.8, 8, 16]} />;
        }
    })();

    return (
        <mesh
            ref={meshRef}
            position={part.position}
            scale={part.scale}
            rotation={part.rotation || [0, 0, 0]}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
                setHovered(false);
                document.body.style.cursor = "default";
            }}
        >
            {geometry}
            <meshStandardMaterial
                color={MUSCLE_COLOR}
                roughness={0.6}
                metalness={0.15}
                transparent
                opacity={0.92}
            />
        </mesh>
    );
}

// ---- Rotating Platform ----
function Platform() {
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (ringRef.current) {
            ringRef.current.rotation.y = clock.elapsedTime * 0.3;
        }
    });

    return (
        <group position={[0, -0.95, 0]}>
            {/* Base disc */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.3, 0.9, 48]} />
                <meshStandardMaterial
                    color={0x1a1a24}
                    transparent
                    opacity={0.8}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Glowing ring */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[0.85, 0.9, 48]} />
                <meshBasicMaterial
                    color={0x10b981}
                    transparent
                    opacity={0.35}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

// ---- Auto-Rotate Group ----
function AutoRotateBody({
    children,
    autoRotate,
}: {
    children: React.ReactNode;
    autoRotate: boolean;
}) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (groupRef.current && autoRotate) {
            groupRef.current.rotation.y =
                Math.sin(clock.elapsedTime * 0.2) * 0.3;
        }
    });

    return <group ref={groupRef}>{children}</group>;
}

// ---- Main Scene Content ----
function Scene({
    annotations,
    selectedPart,
    onPartClick,
    autoRotate,
}: {
    annotations: BodyAnnotation[];
    selectedPart: string | null;
    onPartClick: (id: string) => void;
    autoRotate: boolean;
}) {
    const annotatedParts = new Set(annotations.map((a) => a.bodyPart));

    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight position={[3, 5, 5]} intensity={0.8} color={0xffeedd} />
            <directionalLight position={[-3, 3, -3]} intensity={0.3} color={0xaabbff} />
            <pointLight position={[0, -1, 2]} intensity={0.2} color={0x10b981} />

            <AutoRotateBody autoRotate={autoRotate}>
                <group position={[0, -1, 0]}>
                    {BODY_PARTS.map((part) => (
                        <BodyPart
                            key={part.id}
                            part={part}
                            isSelected={selectedPart === part.id}
                            isAnnotated={annotatedParts.has(part.id)}
                            onClick={() => onPartClick(part.id)}
                        />
                    ))}
                    <MuscleLines />
                </group>
                <Platform />
            </AutoRotateBody>

            <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={3}
                maxDistance={8}
                minPolarAngle={Math.PI * 0.2}
                maxPolarAngle={Math.PI * 0.8}
                autoRotate={false}
            />
            <Environment preset="city" />
        </>
    );
}

// ---- Main Component ----
export default function BodyModel3D({
    annotations = [],
    onPartClick,
    selectedPart = null,
}: BodyModel3DProps) {
    const [selected, setSelected] = useState<string | null>(selectedPart);
    const [autoRotate, setAutoRotate] = useState(true);

    const handlePartClick = useCallback(
        (id: string) => {
            setSelected((prev) => (prev === id ? null : id));
            onPartClick?.(id);
        },
        [onPartClick]
    );

    const activeAnnotation = annotations.find((a) => a.bodyPart === selected);

    return (
        <div className={styles.container}>
            <Canvas
                camera={{ position: [0, 1, 5], fov: 40 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: "transparent" }}
            >
                <Scene
                    annotations={annotations}
                    selectedPart={selected}
                    onPartClick={handlePartClick}
                    autoRotate={autoRotate}
                />
            </Canvas>

            {/* Controls */}
            <div className={styles.controls}>
                <button
                    className={`${styles.controlBtn} ${autoRotate ? styles.controlBtnActive : ""}`}
                    onClick={() => setAutoRotate(!autoRotate)}
                    title="Auto-rotate"
                >
                    🔄
                </button>
                <button
                    className={styles.controlBtn}
                    onClick={() => setSelected(null)}
                    title="Reset view"
                >
                    🎯
                </button>
                <button className={styles.controlBtn} title="Zoom in">🔍</button>
                <button className={styles.controlBtn} title="Fullscreen">⛶</button>
            </div>

            {/* Annotation tooltip */}
            {activeAnnotation && (
                <div className={styles.annotation}>
                    <div className={styles.annotationImage}>
                        {activeAnnotation.icon}
                    </div>
                    <div className={styles.annotationInfo}>
                        <span className={styles.annotationTitle}>
                            {activeAnnotation.title}
                        </span>
                        <span className={styles.annotationDate}>
                            {activeAnnotation.date}
                        </span>
                    </div>
                </div>
            )}

            {/* Platform glow effect */}
            <div className={styles.platformGlow} />
        </div>
    );
}
