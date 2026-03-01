import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePaperMaterial } from '../shared/PaperMaterial';
import { usePerformanceMonitor } from '../../../hooks/usePerformanceMonitor';

interface FloatingPaper {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  paperType: 'lined' | 'grid' | 'dotted' | 'music';
  speed: number;
  amplitude: number;
  phase: number;
}

// Only 4 papers for performance (reduced from 5)
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
];

/**
 * Single floating paper card with LOD and edge curl animation.
 * High-detail version has paper texture and curved geometry.
 * Low-detail version is a simple flat plane with solid color.
 */
function PaperCard({ paper, scrollProgress = 0 }: { paper: FloatingPaper; scrollProgress?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, pointer } = useThree();
  const [useHighDetail, setUseHighDetail] = useState(true);

  // High-detail: textured paper material
  const detailedMaterial = usePaperMaterial({ paperType: paper.paperType, resolution: 512 });

  // Low-detail: simple solid color material
  const simpleMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: '#f5f0e8',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    return mat;
  }, []);

  // High-detail geometry with edge curl
  const detailedGeometry = useMemo(() => {
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

  // Low-detail geometry - simple flat plane
  const simpleGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(1.6, 2.0, 1, 1);
  }, []);

  // Override detailed material to add transparency
  const transparentDetailedMat = useMemo(() => {
    if (!detailedMaterial) return null;
    const mat = detailedMaterial.clone();
    mat.transparent = true;
    mat.opacity = 0.6;
    mat.side = THREE.DoubleSide;
    return mat;
  }, [detailedMaterial]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // LOD: switch based on camera distance
    const distance = groupRef.current.position.distanceTo(camera.position);
    setUseHighDetail(distance < 8);

    // Organic floating drift
    const basePos = paper.position;
    groupRef.current.position.x = basePos[0] + Math.sin(t * paper.speed + paper.phase) * paper.amplitude;
    groupRef.current.position.y = basePos[1] + Math.cos(t * paper.speed * 0.7 + paper.phase) * paper.amplitude * 0.6;
    groupRef.current.position.z = basePos[2] + Math.sin(t * paper.speed * 0.4 + paper.phase * 2) * 0.1;

    // Gentle rotation drift
    groupRef.current.rotation.x = paper.rotation[0] + Math.sin(t * 0.3 + paper.phase) * 0.05;
    groupRef.current.rotation.y = paper.rotation[1] + Math.cos(t * 0.25 + paper.phase) * 0.04;
    groupRef.current.rotation.z = paper.rotation[2] + Math.sin(t * 0.2 + paper.phase) * 0.03;

    // Mouse parallax - papers move slightly opposite to cursor
    groupRef.current.position.x += pointer.x * 0.2 * (paper.position[2] / -3);
    groupRef.current.position.y += pointer.y * 0.15 * (paper.position[2] / -3);

    // Scroll parallax - papers drift slightly with scroll
    groupRef.current.position.y -= scrollProgress * 0.5;
  });

  return (
    <group ref={groupRef} scale={paper.scale}>
      {useHighDetail ? (
        <mesh
          geometry={detailedGeometry}
          material={transparentDetailedMat || detailedMaterial}
          castShadow
        />
      ) : (
        <mesh
          geometry={simpleGeometry}
          material={simpleMaterial}
        />
      )}
    </group>
  );
}

/**
 * Collection of floating paper cards with LOD and performance monitoring.
 * Auto-hides when performance tier is medium or low.
 */
export function FloatingPapers({ scrollProgress = 0 }: { scrollProgress?: number }) {
  const { tier } = usePerformanceMonitor();

  // Don't render if performance tier is medium or low
  if (tier === 'medium' || tier === 'low') {
    return null;
  }

  return (
    <group>
      {PAPERS.map((paper, i) => (
        <PaperCard key={i} paper={paper} scrollProgress={scrollProgress} />
      ))}
    </group>
  );
}
