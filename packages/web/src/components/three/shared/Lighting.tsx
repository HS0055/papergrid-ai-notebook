import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LightingProps {
  /** Preset lighting mood */
  preset?: 'landing' | 'notebook' | 'warm' | 'dramatic';
  /** Whether rim light follows cursor */
  followCursor?: boolean;
  /** Overall intensity multiplier */
  intensity?: number;
  /** Skip cursor tracking on mobile to save GPU cycles */
  isMobile?: boolean;
}

/**
 * Shared 3-point lighting rig for all PaperGrid 3D scenes.
 * Key (directional) + Fill (ambient) + Rim (point).
 */
export function Lighting({ preset = 'landing', followCursor = false, intensity = 1, isMobile = false }: LightingProps) {
  const rimRef = useRef<THREE.PointLight>(null);

  // Cursor-following rim light — disabled on mobile (no pointer, saves GPU)
  useFrame(({ pointer }) => {
    if (followCursor && !isMobile && rimRef.current) {
      rimRef.current.position.x = THREE.MathUtils.lerp(rimRef.current.position.x, pointer.x * 4, 0.05);
      rimRef.current.position.y = THREE.MathUtils.lerp(rimRef.current.position.y, pointer.y * 3 + 2, 0.05);
    }
  });

  const presets = {
    landing: {
      keyColor: '#f8fafc',
      keyIntensity: 2.4,
      keyPosition: [4, 8, 6] as [number, number, number],
      fillIntensity: 0.5,
      rimColor: '#d4a574',
      rimIntensity: 1.0,
      rimPosition: [-4, 3, -3] as [number, number, number],
      shadowMapSize: 1024,
    },
    notebook: {
      keyColor: '#fef3c7',
      keyIntensity: 1.6,
      keyPosition: [3, 6, 4] as [number, number, number],
      fillIntensity: 0.5,
      rimColor: '#818cf8',
      rimIntensity: 0.6,
      rimPosition: [-4, 2, -3] as [number, number, number],
      shadowMapSize: 1024,
    },
    warm: {
      keyColor: '#fde68a',
      keyIntensity: 2.2,
      keyPosition: [4, 7, 5] as [number, number, number],
      fillIntensity: 0.35,
      rimColor: '#f59e0b',
      rimIntensity: 1.0,
      rimPosition: [-4, 4, -5] as [number, number, number],
      shadowMapSize: 1024,
    },
    dramatic: {
      keyColor: '#e2e8f0',
      keyIntensity: 2.5,
      keyPosition: [6, 10, 4] as [number, number, number],
      fillIntensity: 0.15,
      rimColor: '#4f46e5',
      rimIntensity: 1.2,
      rimPosition: [-5, 3, -5] as [number, number, number],
      shadowMapSize: 1024,
    },
  };

  const p = presets[preset] ?? presets.landing;

  return (
    <>
      {/* Key Light - main directional */}
      <directionalLight
        color={p.keyColor}
        intensity={p.keyIntensity * intensity}
        position={p.keyPosition}
        castShadow
        shadow-mapSize-width={p.shadowMapSize}
        shadow-mapSize-height={p.shadowMapSize}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
      />

      {/* Fill Light - ambient */}
      <ambientLight intensity={p.fillIntensity * intensity} color="#e2e8f0" />

      {/* Rim / Accent Light - point */}
      <pointLight
        ref={rimRef}
        color={p.rimColor}
        intensity={p.rimIntensity * intensity}
        position={p.rimPosition}
        distance={15}
        decay={2}
      />

      {/* Subtle hemisphere for ground bounce */}
      <hemisphereLight
        color="#f8fafc"
        groundColor="#d4a574"
        intensity={0.15 * intensity}
      />
    </>
  );
}
