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

interface BodyModel3DProps {
    gender?: "male" | "female";
    annotations?: BodyAnnotation[];
    onPartClick?: (part: string) => void;
    selectedPart?: string | null;
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
}: BodyModel3DProps) {
    return (
        <div className={styles.container}>
            <Canvas
                camera={{ position: [0, 0.5, 5], fov: 38 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: "transparent" }}
            >
                <Scene gender={gender} />
            </Canvas>
        </div>
    );
}
