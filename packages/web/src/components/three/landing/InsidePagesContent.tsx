import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface InsidePagesContentProps {
  /** Mutable ref tracking currentOpen (0=closed, 1=fully open) */
  openRef: React.MutableRefObject<number>;
  isMobile: boolean;
}

/** Thin rect outline using a LineLoop mesh — no <line> JSX ambiguity */
function RectOutline({ w, h, material }: { w: number; h: number; material: THREE.LineBasicMaterial }) {
  const geo = useMemo(() => {
    const r = Math.min(0.03, w * 0.06, h * 0.1);
    const steps = 6;
    const pts: THREE.Vector3[] = [];
    const corners: [number, number, number, number][] = [
      [-w / 2 + r, h / 2 - r, Math.PI / 2, Math.PI],
      [w / 2 - r, h / 2 - r, 0, Math.PI / 2],
      [w / 2 - r, -h / 2 + r, -Math.PI / 2, 0],
      [-w / 2 + r, -h / 2 + r, Math.PI, -Math.PI / 2],
    ];
    for (const [cx, cy, a0, a1] of corners) {
      for (let s = 0; s <= steps; s++) {
        const a = a0 + (s / steps) * (a1 - a0);
        pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
      }
    }
    pts.push(pts[0].clone());
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [w, h]);

  return <primitive object={new THREE.LineLoop(geo, material)} />;
}

/**
 * Glowing wireframe notebook content that reveals itself as the 3D book opens.
 * Uses only primitive geometries (no font loading) for performance & reliability.
 */
export function InsidePagesContent({ openRef, isMobile }: InsidePagesContentProps) {
  const groupRef = useRef<THREE.Group>(null);

  const fillMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#818cf8', transparent: true, opacity: 0, depthWrite: false,
  }), []);
  const accentMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#4f46e5', transparent: true, opacity: 0, depthWrite: false,
  }), []);
  const goldMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#d4a574', transparent: true, opacity: 0, depthWrite: false,
  }), []);
  const outlineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: '#818cf8', transparent: true, opacity: 0, depthWrite: false,
  }), []);
  const goldOutlineMat = useMemo(() => new THREE.LineBasicMaterial({
    color: '#d4a574', transparent: true, opacity: 0, depthWrite: false,
  }), []);

  useFrame(() => {
    if (!groupRef.current) return;
    const open = openRef.current;
    // Reveal from 50% open to 90%
    const reveal = THREE.MathUtils.clamp((open - 0.5) / 0.4, 0, 1);
    const e = reveal * reveal * (3 - 2 * reveal); // smoothstep

    groupRef.current.position.y = THREE.MathUtils.lerp(-0.15, 0, e);

    const o = e * 0.92;
    fillMat.opacity = o * 0.18;
    accentMat.opacity = o * 0.88;
    goldMat.opacity = o * 0.92;
    outlineMat.opacity = o * 0.5;
    goldOutlineMat.opacity = o * 0.7;
  });

  if (isMobile) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0.003]}>

      {/* ── Title bar ── */}
      <RectOutline w={1.18} h={0.14} material={goldOutlineMat} />
      <group position={[0, 0, 0]}>
        <mesh material={fillMat} position={[0, 0, -0.001]}>
          <planeGeometry args={[1.18, 0.14]} />
        </mesh>
        {/* "Weekly Planner" text bars */}
        <mesh material={goldMat} position={[-0.2, 0.01, 0.001]}>
          <planeGeometry args={[0.52, 0.032]} />
        </mesh>
        <mesh material={accentMat} position={[0.26, 0.01, 0.001]}>
          <planeGeometry args={[0.22, 0.025]} />
        </mesh>
      </group>

      {/* ── Main content block ── */}
      <group position={[0, -0.42, 0]}>
        <RectOutline w={1.18} h={0.52} material={outlineMat} />
        <mesh material={fillMat} position={[0, 0, -0.001]}>
          <planeGeometry args={[1.18, 0.52]} />
        </mesh>
        {/* Lined text rows */}
        {[0.18, 0.08, -0.02, -0.12, -0.2].map((y, i) => (
          <mesh key={i} material={i < 2 ? accentMat : outlineMat as unknown as THREE.MeshBasicMaterial} position={[-0.03 + i * 0.01, y, 0.001]}>
            <planeGeometry args={[Math.max(0.3, 0.84 - i * 0.065), 0.013]} />
          </mesh>
        ))}
        {/* Checkboxes */}
        {[0.18, 0.08, -0.02].map((y, i) => (
          <mesh key={`cb${i}`} material={i === 0 ? accentMat : outlineMat as unknown as THREE.MeshBasicMaterial} position={[-0.5, y, 0.001]}>
            <planeGeometry args={[0.033, 0.033]} />
          </mesh>
        ))}
      </group>

      {/* ── Two cards row ── */}
      {/* Left card */}
      <group position={[-0.31, -0.84, 0]}>
        <RectOutline w={0.56} h={0.28} material={outlineMat} />
        <mesh material={fillMat} position={[0, 0, -0.001]}>
          <planeGeometry args={[0.56, 0.28]} />
        </mesh>
        {[0.07, -0.01, -0.09].map((y, i) => (
          <mesh key={i} material={accentMat} position={[0.01, y, 0.001]}>
            <planeGeometry args={[0.36 - i * 0.05, 0.012]} />
          </mesh>
        ))}
        {/* Gold pill at bottom */}
        <mesh material={goldMat} position={[0, -0.1, 0.001]}>
          <planeGeometry args={[0.26, 0.025]} />
        </mesh>
      </group>

      {/* Right card */}
      <group position={[0.31, -0.84, 0]}>
        <RectOutline w={0.56} h={0.28} material={outlineMat} />
        <mesh material={fillMat} position={[0, 0, -0.001]}>
          <planeGeometry args={[0.56, 0.28]} />
        </mesh>
        {/* Dot grid */}
        {[-1, 0, 1].flatMap(col =>
          [-1, 0, 1].map(row => (
            <mesh key={`dot${col}${row}`} material={accentMat} position={[col * 0.1, row * 0.075, 0.001]}>
              <circleGeometry args={[0.012, 8]} />
            </mesh>
          ))
        )}
        <mesh material={goldMat} position={[0, -0.105, 0.001]}>
          <planeGeometry args={[0.34, 0.025]} />
        </mesh>
      </group>

      {/* ── AI badge (bottom) ── */}
      <group position={[0, -1.14, 0]}>
        <RectOutline w={0.44} h={0.1} material={goldOutlineMat} />
        <mesh material={fillMat} position={[0, 0, -0.001]}>
          <planeGeometry args={[0.44, 0.1]} />
        </mesh>
        <mesh material={goldMat} position={[-0.05, 0, 0.001]}>
          <planeGeometry args={[0.22, 0.024]} />
        </mesh>
        {/* Spark dots */}
        {[0, 1, 2].map(i => (
          <mesh key={i} material={i === 1 ? goldMat : accentMat} position={[0.12 + i * 0.075, 0, 0.001]}>
            <circleGeometry args={[i === 1 ? 0.017 : 0.011, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
