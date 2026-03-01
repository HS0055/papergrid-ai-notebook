import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { usePaperMaterial, useCoverMaterial } from '../shared/PaperMaterial';
import { BOOK_WIDTH, BOOK_HEIGHT } from '../shared/BookGeometry';

// ─── Constants ────────────────────────────────────────────
const COVER_THICKNESS = 0.08;
const PAGE_STACK_THICKNESS = 0.22;
const SPINE_WIDTH = PAGE_STACK_THICKNESS + COVER_THICKNESS * 2;

interface HeroNotebookProps {
  /** Shared ref with scroll progress (read in useFrame, zero re-renders) */
  scrollRef: React.RefObject<{ progress: number }>;
  /** Whether the user is hovering */
  hovered?: boolean;
}

/**
 * Interactive 3D notebook for the landing hero.
 * Lightweight version - no heavy canvas textures for performance.
 * Book opens as user scrolls, shows paper textures inside.
 */
export function HeroNotebook({ scrollRef, hovered = false }: HeroNotebookProps) {
  const groupRef = useRef<THREE.Group>(null);
  const frontCoverRef = useRef<THREE.Group>(null);
  const targetOpen = useRef(0);
  const currentOpen = useRef(0);

  // Materials
  const coverMaterial = useCoverMaterial('leather', '#1e1b4b');
  const leftPageMaterial = usePaperMaterial({ paperType: 'lined', resolution: 512 });
  const rightPageMaterial = usePaperMaterial({ paperType: 'dotted', resolution: 512 });

  // Page edge material
  const pageEdgeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f5f0e8',
    roughness: 0.92,
    metalness: 0,
  }), []);

  // Spine material (darker indigo)
  const spineMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1650',
    roughness: 0.65,
    metalness: 0.08,
  }), []);

  // Gold emboss material for title & spine lines
  const goldMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d4a574',
    roughness: 0.25,
    metalness: 0.75,
    emissive: '#d4a574',
    emissiveIntensity: 0.05,
  }), []);

  // Title texture for cover (lightweight - just text)
  const titleMat = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 56px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PaperGrid AI', 256, 100);

    ctx.font = '22px "Inter", sans-serif';
    ctx.fillStyle = '#c4956a';
    ctx.fillText('THE NOTEBOOK THAT THINKS WITH YOU', 256, 170);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.2,
      metalness: 0.7,
      emissive: '#d4a574',
      emissiveIntensity: 0.03,
    });
  }, []);

  // Animation
  useFrame((state, delta) => {
    if (!groupRef.current || !frontCoverRef.current) return;

    // Read scroll from shared ref — no React re-render
    const scrollProgress = scrollRef.current?.progress ?? 0;

    // Map scroll progress to book open amount:
    // 0.0-0.20: closed, 0.20-0.60: opening, 0.60+: fully open
    const openTarget = THREE.MathUtils.clamp((scrollProgress - 0.20) / 0.40, 0, 1);
    targetOpen.current = openTarget;
    currentOpen.current = THREE.MathUtils.lerp(
      currentOpen.current,
      targetOpen.current,
      1 - Math.pow(0.05, delta),
    );

    const open = currentOpen.current;

    // Front cover rotation (opens on Y axis around spine)
    frontCoverRef.current.rotation.y = -open * Math.PI * 0.52;

    // Idle rotation — tilted to show 3D depth, sways gently
    const idleTime = state.clock.elapsedTime;
    const idleSway = open < 0.1 ? Math.sin(idleTime * 0.15) * 0.04 : 0;
    // Start angled to show spine, rotate toward viewer as book opens
    groupRef.current.rotation.y = idleSway + THREE.MathUtils.lerp(0.35, open * 0.15, open);
    groupRef.current.rotation.x = Math.sin(idleTime * 0.1) * 0.01 - 0.12 + open * 0.08;
  });

  const hw = BOOK_WIDTH / 2;
  const hh = BOOK_HEIGHT / 2;

  return (
    <Float
      speed={1.2}
      rotationIntensity={0.06}
      floatIntensity={0.2}
      floatingRange={[-0.03, 0.03]}
    >
      <group position={[0, -0.3, 0]}>
      <group ref={groupRef}>
        {/* ─── Back Cover (stationary) ─── */}
        <mesh
          position={[hw, 0, -(PAGE_STACK_THICKNESS / 2 + COVER_THICKNESS / 2)]}
          material={coverMaterial}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[BOOK_WIDTH + 0.05, BOOK_HEIGHT + 0.05, COVER_THICKNESS]} />
        </mesh>

        {/* ─── Page Stack (cream edges - thick enough to see) ─── */}
        <mesh
          position={[hw, 0, 0]}
          material={pageEdgeMat}
        >
          <boxGeometry args={[BOOK_WIDTH - 0.02, BOOK_HEIGHT - 0.03, PAGE_STACK_THICKNESS]} />
        </mesh>

        {/* ─── Left Page (lined - visible when open) ─── */}
        <mesh
          position={[hw, 0, PAGE_STACK_THICKNESS / 2 + 0.002]}
          rotation={[0, Math.PI, 0]}
          material={leftPageMaterial}
        >
          <planeGeometry args={[BOOK_WIDTH - 0.1, BOOK_HEIGHT - 0.1]} />
        </mesh>

        {/* ─── Front Cover (opens) - pivots at x=0 ─── */}
        <group ref={frontCoverRef}>
          <mesh
            position={[hw, 0, PAGE_STACK_THICKNESS / 2 + COVER_THICKNESS / 2]}
            castShadow
            receiveShadow
            material={coverMaterial}
          >
            <boxGeometry args={[BOOK_WIDTH + 0.05, BOOK_HEIGHT + 0.05, COVER_THICKNESS]} />
          </mesh>

          {/* Title on front cover */}
          <mesh
            position={[hw, 0.3, PAGE_STACK_THICKNESS / 2 + COVER_THICKNESS + 0.002]}
            material={titleMat}
          >
            <planeGeometry args={[BOOK_WIDTH * 0.75, BOOK_WIDTH * 0.38]} />
          </mesh>

          {/* Right page (inside front cover - dotted pattern) */}
          <mesh
            position={[hw, 0, PAGE_STACK_THICKNESS / 2 - 0.001]}
            rotation={[0, Math.PI, 0]}
            material={rightPageMaterial}
          >
            <planeGeometry args={[BOOK_WIDTH - 0.1, BOOK_HEIGHT - 0.1]} />
          </mesh>
        </group>

        {/* ─── Spine ─── */}
        <mesh
          position={[-0.02, 0, 0]}
          material={spineMat}
          castShadow
        >
          <boxGeometry args={[0.14, BOOK_HEIGHT + 0.05, SPINE_WIDTH + 0.02]} />
        </mesh>

        {/* ─── Decorative gold spine lines ─── */}
        {[-hh + 0.3, hh - 0.3].map((y, i) => (
          <mesh
            key={i}
            position={[-0.02, y, PAGE_STACK_THICKNESS / 2 + COVER_THICKNESS + 0.002]}
            material={goldMat}
          >
            <boxGeometry args={[0.16, 0.012, 0.012]} />
          </mesh>
        ))}
      </group>
      </group>
    </Float>
  );
}
