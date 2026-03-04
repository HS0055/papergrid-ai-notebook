import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, useTexture, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import NotebookCanvas from '../canvas/NotebookCanvas';
import { useCoverMaterial } from '../shared/PaperMaterial';
import { BOOK_WIDTH, BOOK_HEIGHT } from '../shared/BookGeometry';
import { coverColorToHex } from '../../../utils/coverColors';

// ─── Constants ────────────────────────────────────────────
const CT = 0.08; // cover thickness
const PS = 0.25; // page stack thickness (increased for visible depth)
const HW = BOOK_WIDTH / 2;
const HH = BOOK_HEIGHT / 2;

interface BookCoverSceneProps {
  coverColorClass: string;
  coverImageUrl?: string;
  title: string;
  pageCount: number;
  isOpening: boolean;
  onOpenComplete: () => void;
}

/**
 * Lazy-loadable 3D book cover for the Dashboard.
 * Shows a leather-bound notebook with spine, page edges, and idle animation.
 * Camera is angled to show perspective depth (not flat/head-on).
 * When `isOpening` is true, the front cover swings open and fires `onOpenComplete`.
 */
export default function BookCoverScene(props: BookCoverSceneProps) {
  return (
    <NotebookCanvas
      lightPreset="studio"
      postPreset="subtle"
      fov={40}
      cameraPosition={[0, 0, 7.5]}
    >
      <Environment preset="city" environmentIntensity={0.6} />
      <CoverBook {...props} />
    </NotebookCanvas>
  );
}

function CoverBook({
  coverColorClass,
  coverImageUrl,
  title,
  pageCount,
  isOpening,
  onOpenComplete,
}: BookCoverSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const frontCoverRef = useRef<THREE.Group>(null);
  const openRef = useRef(0);
  const doneRef = useRef(false);

  // Always call useTexture (Rules of Hooks) — use a 1x1 transparent placeholder when no cover
  const PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==';
  const loadedTexture = useTexture(coverImageUrl || PLACEHOLDER);
  const customTexture = coverImageUrl ? loadedTexture : null;
  if (customTexture) {
    customTexture.colorSpace = THREE.SRGBColorSpace;
    customTexture.anisotropy = 8;
  }

  // Reset open state when isOpening transitions to true
  useEffect(() => {
    if (isOpening) {
      openRef.current = 0;
      doneRef.current = false;
    }
  }, [isOpening]);

  const coverHex = coverColorToHex(coverColorClass);
  const leatherMat = useCoverMaterial('leather', coverHex);

  // Use custom texture if available, otherwise use leather material
  const coverMat = useMemo(() => {
    if (customTexture) {
      return new THREE.MeshStandardMaterial({
        map: customTexture,
        roughness: 0.8,
        metalness: 0.1,
      });
    }
    return leatherMat;
  }, [customTexture, leatherMat]);

  const pageMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f5f0e8', roughness: 0.92, metalness: 0 }),
    [],
  );

  const spineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(coverHex).multiplyScalar(0.65),
        roughness: 0.7,
        metalness: 0.05,
      }),
    [coverHex],
  );

  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffc87c', // Warmer gold
        roughness: 0.15,
        metalness: 1.0,   // Full metal for reflections
        emissive: '#4a3010',
        emissiveIntensity: 0.1,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
      }),
    [],
  );

  // Gold embossed title + page count texture
  const titleMat = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 44px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Truncate title to fit within texture
    let displayTitle = title || 'Untitled';
    while (ctx.measureText(displayTitle).width > 440 && displayTitle.length > 3) {
      displayTitle = displayTitle.slice(0, -2) + '\u2026';
    }
    ctx.fillText(displayTitle, 256, 100);

    ctx.font = '20px "Inter", sans-serif';
    ctx.fillStyle = '#c4956a';
    ctx.fillText(`${pageCount} Spreads`, 256, 168);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    // Fix orientation for mapping onto the book cover
    texture.center.set(0.5, 0.5);

    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.15,
      metalness: 0.9,
      emissive: '#2a1a08',
      emissiveIntensity: 0.2, // Boosted to make text pop against dark journals
    });
  }, [title, pageCount]);

  useFrame((state, delta) => {
    if (!groupRef.current || !frontCoverRef.current) return;
    const t = state.clock.elapsedTime;

    if (isOpening) {
      // Smooth open interpolation
      openRef.current = THREE.MathUtils.lerp(
        openRef.current,
        1,
        1 - Math.pow(0.01, delta),
      );
      frontCoverRef.current.rotation.y = -openRef.current * Math.PI * 0.6; // Open slightly wider

      // Signal completion at 90%
      if (openRef.current > 0.9 && !doneRef.current) {
        doneRef.current = true;
        onOpenComplete();
      }
    } else {
      // Idle rotation + mouse parallax effect
      const targetRotationY = Math.sin(t * 0.2) * 0.08 + 0.35 + (state.pointer.x * 0.1);
      const targetRotationX = -0.05 + Math.sin(t * 0.15) * 0.02 + (-state.pointer.y * 0.1);

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotationY, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotationX, 0.05);
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.15} floatingRange={[-0.03, 0.03]}>
      <group position={[-HW * 0.3, -0.1, 0]}>
        <group ref={groupRef}>
          {/* ─── Back Cover ─── */}
          <mesh
            position={[HW, 0, -(PS / 2 + CT / 2)]}
            material={coverMat}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[BOOK_WIDTH + 0.04, BOOK_HEIGHT + 0.04, CT]} />
          </mesh>

          {/* ─── Page Stack (cream edges - visible depth) ─── */}
          <mesh position={[HW, 0, 0]} material={pageMat}>
            <boxGeometry args={[BOOK_WIDTH - 0.02, BOOK_HEIGHT - 0.03, PS]} />
          </mesh>

          {/* ─── Front Cover (opens around spine at x=0) ─── */}
          <group ref={frontCoverRef}>
            <mesh
              position={[HW, 0, PS / 2 + CT / 2]}
              material={coverMat}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[BOOK_WIDTH + 0.04, BOOK_HEIGHT + 0.04, CT]} />
            </mesh>

            {/* Title on front cover — shifted toward spine to avoid clip on rotation */}
            <mesh
              position={[HW * 0.85, 0.15, PS / 2 + CT + 0.002]}
              material={titleMat}
            >
              <planeGeometry args={[BOOK_WIDTH * 0.55, BOOK_WIDTH * 0.28]} />
            </mesh>
          </group>

          {/* ─── Spine ─── */}
          <mesh position={[-0.02, 0, 0]} material={spineMat} castShadow>
            <boxGeometry args={[0.12, BOOK_HEIGHT + 0.04, PS + CT * 2 + 0.02]} />
          </mesh>

          {/* ─── Gold spine accent lines ─── */}
          {[-HH + 0.3, HH - 0.3].map((y, i) => (
            <mesh key={i} position={[-0.02, y, PS / 2 + CT + 0.002]} material={goldMat}>
              <boxGeometry args={[0.14, 0.01, 0.01]} />
            </mesh>
          ))}

          {/* ─── Premium Contact Shadows ─── */}
          <ContactShadows
            position={[0, -HH - 0.1, 0]}
            opacity={0.65}
            scale={10}
            blur={1.5}
            far={1.5}
            resolution={512}
            color="#000000"
          />
        </group>
      </group>
    </Float>
  );
}
