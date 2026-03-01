import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePaperMaterial } from '../shared/PaperMaterial';

interface FloatingPaper {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  paperType: 'lined' | 'grid' | 'dotted' | 'music' | 'hex';
  speed: number;
  amplitude: number;
  phase: number;
}

const PAPERS: FloatingPaper[] = [
  {
    position: [-7, 1.5, -5],
    rotation: [0.1, -0.25, -0.24],
    scale: 0.5,
    paperType: 'lined',
    speed: 0.2,
    amplitude: 0.3,
    phase: 0,
  },
  {
    position: [7, 2.0, -4.5],
    rotation: [-0.05, 0.18, 0.17],
    scale: 0.45,
    paperType: 'grid',
    speed: 0.18,
    amplitude: 0.25,
    phase: 1.2,
  },
  {
    position: [-6.5, -1.0, -6],
    rotation: [0.08, -0.1, -0.1],
    scale: 0.4,
    paperType: 'dotted',
    speed: 0.25,
    amplitude: 0.2,
    phase: 2.4,
  },
  {
    position: [6.5, -0.5, -5.5],
    rotation: [-0.1, 0.22, 0.05],
    scale: 0.5,
    paperType: 'music',
    speed: 0.15,
    amplitude: 0.35,
    phase: 3.6,
  },
  {
    position: [-5.5, 3.0, -6],
    rotation: [0.15, -0.05, 0.2],
    scale: 0.4,
    paperType: 'hex',
    speed: 0.22,
    amplitude: 0.15,
    phase: 4.8,
  },
];

/**
 * Single floating paper card with edge curl and drift animation.
 */
function PaperCard({ paper }: { paper: FloatingPaper }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = usePaperMaterial({ paperType: paper.paperType, resolution: 512 });
  const { pointer } = useThree();

  // Create geometry with slight edge curl (reduced subdivisions)
  const geometry = useMemo(() => {
    const w = 1.6;
    const h = 2.0;
    const geo = new THREE.PlaneGeometry(w, h, 8, 8);
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Edge curl - lift corners and edges slightly
      const distFromCenter = Math.sqrt((x / (w / 2)) ** 2 + (y / (h / 2)) ** 2);
      const edgeFactor = Math.max(0, distFromCenter - 0.7) * 0.15;

      // Slight wave across the paper
      const wave = Math.sin(x * 2 + y * 1.5) * 0.02;

      positions.setZ(i, edgeFactor + wave);
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Override material to add transparency
  const transparentMat = useMemo(() => {
    if (!material) return null;
    const mat = material.clone();
    mat.transparent = true;
    mat.opacity = 0.6;
    return mat;
  }, [material]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    // Organic floating drift
    const basePos = paper.position;
    meshRef.current.position.x = basePos[0] + Math.sin(t * paper.speed + paper.phase) * paper.amplitude;
    meshRef.current.position.y = basePos[1] + Math.cos(t * paper.speed * 0.7 + paper.phase) * paper.amplitude * 0.6;
    meshRef.current.position.z = basePos[2] + Math.sin(t * paper.speed * 0.4 + paper.phase * 2) * 0.1;

    // Gentle rotation drift
    meshRef.current.rotation.x = paper.rotation[0] + Math.sin(t * 0.3 + paper.phase) * 0.05;
    meshRef.current.rotation.y = paper.rotation[1] + Math.cos(t * 0.25 + paper.phase) * 0.04;
    meshRef.current.rotation.z = paper.rotation[2] + Math.sin(t * 0.2 + paper.phase) * 0.03;

    // Mouse parallax - papers move slightly opposite to cursor
    meshRef.current.position.x += pointer.x * 0.2 * (paper.position[2] / -3);
    meshRef.current.position.y += pointer.y * 0.15 * (paper.position[2] / -3);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={transparentMat || material}
      scale={paper.scale}
      castShadow
    />
  );
}

/**
 * Collection of floating paper cards around the hero notebook.
 * Replaces the CSS floating-paper divs with real 3D geometry.
 */
export function FloatingPapers() {
  return (
    <group>
      {PAPERS.map((paper, i) => (
        <PaperCard key={i} paper={paper} />
      ))}
    </group>
  );
}
