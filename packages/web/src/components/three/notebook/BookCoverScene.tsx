import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, useTexture } from '@react-three/drei';
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
      lightPreset="warm"
      postPreset="subtle"
      fov={45}
      cameraPosition={[1.2, 0.5, 6]}
    >
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

  // Load custom cover texture if URL is provided
  const customTexture = coverImageUrl ? useTexture(coverImageUrl) : null;
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
        color: '#d4a574',
        roughness: 0.25,
        metalness: 0.75,
        emissive: '#d4a574',
        emissiveIntensity: 0.04,
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
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.2,
      metalness: 0.7,
      emissive: '#d4a574',
      emissiveIntensity: 0.03,
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
        1 - Math.pow(0.03, delta),
      );
      frontCoverRef.current.rotation.y = -openRef.current * Math.PI * 0.55;

      // Signal completion at 90%
      if (openRef.current > 0.9 && !doneRef.current) {
        doneRef.current = true;
        onOpenComplete();
      }
    } else {
      // Idle rotation — angled to show spine and depth, gentle sway
      groupRef.current.rotation.y = Math.sin(t * 0.2) * 0.06 + 0.32;
      groupRef.current.rotation.x = -0.1 + Math.sin(t * 0.15) * 0.02;
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

        {/* ─── Shadow catcher ground plane ─── */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[HW, -HH - 0.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[5, 5]} />
          <shadowMaterial transparent opacity={0.15} />
        </mesh>
      </group>
      </group>
    </Float>
  );
}
