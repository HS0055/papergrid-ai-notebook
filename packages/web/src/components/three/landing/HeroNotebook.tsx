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
  /** Shared ref with normalized cursor position (-1 to 1) */
  cursorRef?: React.RefObject<{ x: number; y: number }>;
}

/**
 * Interactive 3D notebook for the landing hero.
 * Lightweight version - no heavy canvas textures for performance.
 * Book opens as user scrolls, shows paper textures inside.
 */
export function HeroNotebook({ scrollRef, hovered = false, cursorRef }: HeroNotebookProps) {
  const groupRef = useRef<THREE.Group>(null);
  const frontCoverRef = useRef<THREE.Group>(null);
  const targetOpen = useRef(0);
  const currentOpen = useRef(0);
  const currentCursorX = useRef(0);
  const currentCursorY = useRef(0);
  const currentHoverScale = useRef(1);

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

  // Smoothed exit values (avoid per-frame jitter)
  const currentExit = useRef(0);

  // Animation
  useFrame((state, delta) => {
    if (!groupRef.current || !frontCoverRef.current) return;

    // Read scroll from shared ref — no React re-render
    const scrollProgress = scrollRef.current?.progress ?? 0;

    // Map scroll to book open: starts at 5%, fully open by 40%
    // Earlier start + wider range = book opens sooner and more gradually
    const openTarget = THREE.MathUtils.clamp((scrollProgress - 0.05) / 0.35, 0, 1);
    targetOpen.current = openTarget;

    // Fast responsive lerp: ~18% catch-up per frame at 60fps (was ~5%)
    // Math.pow(0.001, delta) at delta=0.016 ≈ 0.89, so factor ≈ 0.11
    const lerpFactor = 1 - Math.pow(0.001, delta);
    currentOpen.current = THREE.MathUtils.lerp(
      currentOpen.current,
      targetOpen.current,
      lerpFactor,
    );

    const open = currentOpen.current;

    // ── Cursor tilt (fades as book opens) ──
    const rawCursorX = cursorRef?.current?.x ?? 0;
    const rawCursorY = cursorRef?.current?.y ?? 0;
    currentCursorX.current = THREE.MathUtils.lerp(currentCursorX.current, rawCursorX, lerpFactor);
    currentCursorY.current = THREE.MathUtils.lerp(currentCursorY.current, rawCursorY, lerpFactor);

    const cursorWeight = Math.max(0, 1 - open * 2); // fades by 50% open
    const cursorTiltX = currentCursorY.current * 0.08 * cursorWeight;
    const cursorTiltY = currentCursorX.current * 0.12 * cursorWeight;

    // Hover scale
    const targetHoverScale = hovered ? 1.03 : 1.0;
    currentHoverScale.current = THREE.MathUtils.lerp(currentHoverScale.current, targetHoverScale, lerpFactor);

    // Front cover rotation — smooth ease-out curve for satisfying open feel
    const openEased = 1 - Math.pow(1 - open, 2.2);
    frontCoverRef.current.rotation.y = -openEased * Math.PI * 0.52;

    // Idle sway — fades out as book opens for cleaner motion
    const idleTime = state.clock.elapsedTime;
    const idleWeight = Math.max(0, 1 - open * 3); // fades by 33% open
    const idleSway = Math.sin(idleTime * 0.15) * 0.04 * idleWeight;

    // Rotation: start angled to show 3D depth, gently rotate toward viewer
    groupRef.current.rotation.y = idleSway + THREE.MathUtils.lerp(0.5, 0.08, openEased) + cursorTiltY;
    groupRef.current.rotation.x = Math.sin(idleTime * 0.1) * 0.015 * idleWeight - 0.15 + openEased * 0.08 + cursorTiltX;

    // ── Exit animation: scale down, drift up, fade out (65%-95%) ──
    const exitRaw = THREE.MathUtils.clamp((scrollProgress - 0.65) / 0.30, 0, 1);
    // Smooth the exit value too (prevents jitter on fast scroll)
    currentExit.current = THREE.MathUtils.lerp(currentExit.current, exitRaw, lerpFactor);
    // Hermite (smoothstep) easing for buttery exit
    const e = currentExit.current;
    const exitEased = e * e * (3 - 2 * e);

    const exitScale = THREE.MathUtils.lerp(1.0, 0.7, exitEased);
    const exitDrift = exitEased * 0.8; // additive drift, not absolute
    const exitOpacity = THREE.MathUtils.lerp(1.0, 0.0, exitEased);

    groupRef.current.scale.setScalar(exitScale * currentHoverScale.current);
    // Add drift to base y offset (don't overwrite Float positioning)
    groupRef.current.position.y = exitDrift;

    // Fade all materials via traverse (only ~8 meshes, lightweight)
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        if (mat && !Array.isArray(mat)) {
          (mat as THREE.MeshStandardMaterial).transparent = true;
          (mat as THREE.MeshStandardMaterial).opacity = exitOpacity;
        }
      }
    });
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
      <group position={[0.5, -0.5, 0]}>
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
