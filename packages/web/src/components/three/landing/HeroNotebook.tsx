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
  /** Mobile mode: lower textures, no cursor tilt, simpler animation */
  isMobile?: boolean;
}

/**
 * Interactive 3D notebook for the landing hero.
 * Lightweight version - no heavy canvas textures for performance.
 * Book opens as user scrolls, shows paper textures inside.
 */
export function HeroNotebook({ scrollRef, hovered = false, cursorRef, isMobile = false }: HeroNotebookProps) {
  const groupRef = useRef<THREE.Group>(null);
  const frontCoverRef = useRef<THREE.Group>(null);
  const titleGlowRef = useRef<THREE.PointLight>(null);
  const targetOpen = useRef(0);
  const currentOpen = useRef(0);
  const currentCursorX = useRef(0);
  const currentCursorY = useRef(0);
  const currentHoverScale = useRef(1);
  const currentLateralShift = useRef(0);
  const currentDepthShift = useRef(0);

  // Materials — both mobile and desktop use higher resolution for visible quality
  const texRes = isMobile ? 512 : 1024;
  const coverMaterial = useCoverMaterial('leather', '#3730a3');
  const leftPageMaterial = usePaperMaterial({ paperType: 'lined', resolution: texRes });
  const rightPageMaterial = usePaperMaterial({ paperType: 'dotted', resolution: texRes });

  // Page edge material
  const pageEdgeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f5f0e8',
    roughness: 0.92,
    metalness: 0,
  }), []);

  // Spine material (darker than cover, but still visible)
  const spineMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#312e81',
    roughness: 0.6,
    metalness: 0.1,
    emissive: '#312e81',
    emissiveIntensity: 0.08,
  }), []);

  // Gold emboss material for title & spine lines — brighter emissive for prominence
  const goldMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d4a574',
    roughness: 0.15,
    metalness: 0.85,
    emissive: '#d4a574',
    emissiveIntensity: 0.35,
  }), []);

  // Title texture for cover — high-res canvas for crisp text on both platforms
  const titleMat = useMemo(() => {
    const canvasWidth = isMobile ? 512 : 1024;
    const canvasHeight = isMobile ? 256 : 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Title text
    ctx.fillStyle = '#d4a574';
    ctx.font = isMobile ? 'bold 56px "Playfair Display", serif' : 'bold 110px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PaperGrid AI', canvasWidth / 2, canvasHeight * 0.38);

    // Subtitle
    ctx.font = isMobile ? '20px "Inter", sans-serif' : '40px "Inter", sans-serif';
    ctx.fillStyle = '#c4956a';
    ctx.fillText('THE NOTEBOOK THAT THINKS WITH YOU', canvasWidth / 2, canvasHeight * 0.65);

    // Decorative line under subtitle
    ctx.strokeStyle = '#c4956a';
    ctx.lineWidth = isMobile ? 1 : 2;
    const lineY = canvasHeight * 0.78;
    const lineHalf = canvasWidth * 0.25;
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2 - lineHalf, lineY);
    ctx.lineTo(canvasWidth / 2 + lineHalf, lineY);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = isMobile ? 4 : 16;
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.12,
      metalness: 0.85,
      emissive: '#d4a574',
      emissiveIntensity: 0.3,
    });
  }, [isMobile]);

  // Smoothed exit values (avoid per-frame jitter)
  const currentExit = useRef(0);
  // Cached materials array — avoids per-frame traverse of scene graph
  const cachedMaterials = useRef<THREE.MeshStandardMaterial[]>([]);
  const materialsCollected = useRef(false);
  const prevOpacity = useRef(1);

  // Animation
  useFrame((state, delta) => {
    if (!groupRef.current || !frontCoverRef.current) return;

    // Read scroll from shared ref — no React re-render
    const scrollProgress = scrollRef.current?.progress ?? 0;

    // Map scroll to book open — both mobile and desktop are now scroll-driven
    // Mobile: opens faster (shorter scroll distance), caps at 60% open
    // Desktop: starts at 5%, fully open by 40%
    const openTarget = isMobile
      ? THREE.MathUtils.clamp(scrollProgress / 0.6, 0, 0.6)
      : THREE.MathUtils.clamp((scrollProgress - 0.05) / 0.35, 0, 1);
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
    const glowStrength = hovered ? Math.max(0, 1 - open * 0.7) : 0;

    // ── Cursor tilt (fades as book opens, disabled on mobile) ──
    let cursorTiltX = 0;
    let cursorTiltY = 0;
    if (!isMobile) {
      const rawCursorX = cursorRef?.current?.x ?? 0;
      const rawCursorY = cursorRef?.current?.y ?? 0;
      currentCursorX.current = THREE.MathUtils.lerp(currentCursorX.current, rawCursorX, lerpFactor);
      currentCursorY.current = THREE.MathUtils.lerp(currentCursorY.current, rawCursorY, lerpFactor);

      const cursorWeight = Math.max(0, 1 - open * 2); // fades by 50% open
      cursorTiltX = currentCursorY.current * 0.08 * cursorWeight;
      cursorTiltY = currentCursorX.current * 0.12 * cursorWeight;
    }

    titleMat.emissiveIntensity = THREE.MathUtils.lerp(
      titleMat.emissiveIntensity,
      0.3 + glowStrength * 0.42,
      lerpFactor,
    );
    goldMat.emissiveIntensity = THREE.MathUtils.lerp(
      goldMat.emissiveIntensity,
      0.35 + glowStrength * 0.28,
      lerpFactor,
    );
    spineMat.emissiveIntensity = THREE.MathUtils.lerp(
      spineMat.emissiveIntensity,
      0.08 + glowStrength * 0.08,
      lerpFactor,
    );

    if (titleGlowRef.current) {
      titleGlowRef.current.intensity = THREE.MathUtils.lerp(
        titleGlowRef.current.intensity,
        0.2 + glowStrength * 1.9,
        lerpFactor,
      );
      titleGlowRef.current.position.x = THREE.MathUtils.lerp(
        titleGlowRef.current.position.x,
        hw + currentCursorX.current * 0.32,
        lerpFactor,
      );
      titleGlowRef.current.position.y = THREE.MathUtils.lerp(
        titleGlowRef.current.position.y,
        0.34 + currentCursorY.current * 0.18,
        lerpFactor,
      );
    }

    // Hover scale
    const targetHoverScale = hovered ? 1.06 : 1.0;
    currentHoverScale.current = THREE.MathUtils.lerp(currentHoverScale.current, targetHoverScale, lerpFactor);

    // Front cover rotation — smooth ease-out curve for satisfying open feel
    const openEased = 1 - Math.pow(1 - open, 2.2);
    const revealProgress = THREE.MathUtils.clamp(scrollProgress / (isMobile ? 0.12 : 0.08), 0, 1);
    const revealEased = 1 - Math.pow(1 - revealProgress, 3);

    // Stronger staged reveal: book starts smaller, pushes forward, then settles.
    const scrollScale = THREE.MathUtils.lerp(0.88, 1.08, Math.min(openEased * 1.8, 1));
    frontCoverRef.current.rotation.y = -openEased * Math.PI * 0.52;

    // Idle sway — fades out as book opens for cleaner motion
    const idleTime = state.clock.elapsedTime;
    const idleWeight = Math.max(0, 1 - open * 3); // fades by 33% open
    const idleSway = Math.sin(idleTime * 0.15) * 0.04 * idleWeight;

    // Rotation: start with a pleasant 3/4 angle, rotate toward viewer as book opens
    groupRef.current.rotation.y =
      idleSway +
      THREE.MathUtils.lerp(0.68, 0.12, openEased) -
      (1 - revealEased) * 0.12 +
      cursorTiltY;
    groupRef.current.rotation.x =
      Math.sin(idleTime * 0.1) * 0.02 * idleWeight -
      0.08 +
      openEased * 0.05 +
      cursorTiltX;

    // Scroll-driven motion path: pull notebook into view, then lift as it opens.
    const targetLateralShift = THREE.MathUtils.lerp(0.78, 0.18, Math.min(openEased * 1.25, 1));
    const targetDepthShift = THREE.MathUtils.lerp(0.82, 0.1, revealEased);
    currentLateralShift.current = THREE.MathUtils.lerp(currentLateralShift.current, targetLateralShift, lerpFactor);
    currentDepthShift.current = THREE.MathUtils.lerp(currentDepthShift.current, targetDepthShift, lerpFactor);
    const scrollDrift = THREE.MathUtils.lerp(-0.15, 0.5, openEased);

    // ── Exit animation: scale down, drift up, fade out (65%-95%) ──
    const exitRaw = THREE.MathUtils.clamp((scrollProgress - 0.65) / 0.30, 0, 1);
    // Smooth the exit value too (prevents jitter on fast scroll)
    currentExit.current = THREE.MathUtils.lerp(currentExit.current, exitRaw, lerpFactor);
    // Hermite (smoothstep) easing for buttery exit
    const e = currentExit.current;
    const exitEased = e * e * (3 - 2 * e);

    const exitScale = THREE.MathUtils.lerp(1.0, 0.65, exitEased);
    const exitDrift = exitEased * 1.2;
    const exitOpacity = THREE.MathUtils.lerp(1.0, 0.0, exitEased);

    groupRef.current.scale.setScalar(exitScale * currentHoverScale.current * scrollScale);
    groupRef.current.position.x = currentLateralShift.current;
    groupRef.current.position.z = currentDepthShift.current;
    // Combine reveal drift + exit drift for smooth continuous motion
    groupRef.current.position.y = scrollDrift + exitDrift;

    // Fade all materials — cached array avoids per-frame scene graph traverse
    // On mobile: skip exit fade (no scroll-driven phases) to save GPU cycles
    if (!isMobile) {
      // Collect materials once on first frame
      if (!materialsCollected.current && groupRef.current) {
        const mats: THREE.MeshStandardMaterial[] = [];
        groupRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material;
            if (mat && !Array.isArray(mat) && (mat as THREE.MeshStandardMaterial).opacity !== undefined) {
              mats.push(mat as THREE.MeshStandardMaterial);
            }
          }
        });
        cachedMaterials.current = mats;
        materialsCollected.current = true;
      }

      // Only update opacity when it actually changes (avoid GPU recompilation)
      const roundedOpacity = Math.round(exitOpacity * 100) / 100;
      if (Math.abs(roundedOpacity - prevOpacity.current) > 0.005) {
        prevOpacity.current = roundedOpacity;
        for (const mat of cachedMaterials.current) {
          mat.transparent = true;
          mat.opacity = roundedOpacity;
        }
      }
    }
  });

  const hw = BOOK_WIDTH / 2;
  const hh = BOOK_HEIGHT / 2;

  // Mobile: compensate for inner hw offset (all meshes sit at x=hw=1.6) to visually center,
  // and push well below CTA buttons so it doesn't overlap text content
  // Desktop: start below hero text, center horizontally (hw offset compensates for spine-origin geometry)
  const bookPosition: [number, number, number] = isMobile ? [-hw, -4.5, 0] : [-hw + 1.7, -2.35, 0];

  const notebookContent = (
    <group position={bookPosition}>
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
          <pointLight
            ref={titleGlowRef}
            color="#f6cf96"
            intensity={0.2}
            distance={3}
            decay={2}
            position={[hw, 0.34, PAGE_STACK_THICKNESS / 2 + COVER_THICKNESS + 0.24]}
          />
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
  );

  if (isMobile) {
    return notebookContent;
  }

  return (
    <Float
      speed={1.2}
      rotationIntensity={0.06}
      floatIntensity={0.2}
      floatingRange={[-0.03, 0.03]}
    >
      {notebookContent}
    </Float>
  );
}
