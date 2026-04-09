import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import NotebookCanvas from '../canvas/NotebookCanvas';
import { useCoverMaterial } from '../shared/PaperMaterial';
import { BOOK_WIDTH, BOOK_HEIGHT } from '../shared/BookGeometry';
import { coverColorToHex } from '../../../utils/coverColors';
import { triggerHaptic } from '../../../utils/haptics';

/** Debounce a value — only updates after `delay` ms of inactivity. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
  /**
   * Fired once the 3D scene has finished mounting and its first frame
   * is on screen. The Dashboard uses this to delay the DOM overlay
   * (title input, color picker, template tiles) so the overlay can
   * never render on an empty white background while the scene is
   * still initialising — which was a visible 1–2s flicker on first
   * open.
   */
  onReady?: () => void;
}

/**
 * Lazy-loadable 3D book cover for the Dashboard.
 * Shows a leather-bound notebook with spine, page edges, and idle animation.
 * Camera is angled to show perspective depth (not flat/head-on).
 * When `isOpening` is true, the front cover swings open and fires `onOpenComplete`.
 */
export default function BookCoverScene(props: BookCoverSceneProps) {
  // Fire the onReady callback on the next tick after the scene mounts.
  // The Canvas contents are already queued by the time the wrapping
  // component renders, and r3f guarantees at least one frame is drawn
  // by the time a microtask following `useEffect` runs.
  useEffect(() => {
    if (!props.onReady) return;
    // Two rAFs — first lets r3f commit the scene, second guarantees
    // the paint has actually happened so the overlay doesn't flash
    // against an empty canvas.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        props.onReady?.();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NotebookCanvas
      lightPreset="notebook"
      postPreset="subtle"
      fov={40}
      cameraPosition={[0, 0, 7.5]}
    >
      <CoverBook {...props} />
    </NotebookCanvas>
  );
}

/** Load a texture without Suspense — returns null while loading or on error. */
function useSafeTexture(url: string | undefined): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const urlRef = useRef(url);

  useEffect(() => {
    urlRef.current = url;
    if (!url) { setTexture(null); return; }

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        if (urlRef.current !== url) { tex.dispose(); return; } // stale
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        setTexture(tex);
      },
      undefined,
      () => {
        // Loading failed — silently fall back to no custom texture
        if (urlRef.current === url) setTexture(null);
      },
    );

    return () => { urlRef.current = undefined; };
  }, [url]);

  return texture;
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

  // Load custom cover texture safely (no Suspense, no crash on failure)
  const customTexture = useSafeTexture(coverImageUrl);

  // Reset open state when isOpening transitions to true
  useEffect(() => {
    if (isOpening) {
      openRef.current = 0;
      doneRef.current = false;
      triggerHaptic.impact();
    }
  }, [isOpening]);

  const coverHex = coverColorToHex(coverColorClass);
  const leatherMat = useCoverMaterial('leather', coverHex);

  // Use custom texture if available, otherwise use leather material
  const coverMat = useMemo(() => {
    if (customTexture) {
      return new THREE.MeshPhysicalMaterial({
        map: customTexture,
        roughness: 0.72,
        metalness: 0.08,
        clearcoat: 0.14,
        clearcoatRoughness: 0.8,
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

  // Debounce title to avoid recreating the CanvasTexture on every keystroke
  const debouncedTitle = useDebouncedValue(title, 300);

  // Gold embossed title + page count texture
  const titleMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const titleMat = useMemo(() => {
    // Dispose previous material & texture to prevent GPU memory leak
    if (titleMatRef.current) {
      titleMatRef.current.map?.dispose();
      titleMatRef.current.dispose();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 44px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let displayTitle = debouncedTitle || 'Untitled';
    while (ctx.measureText(displayTitle).width > 440 && displayTitle.length > 3) {
      displayTitle = displayTitle.slice(0, -2) + '\u2026';
    }
    ctx.fillText(displayTitle, 256, 100);

    ctx.font = '20px "Inter", sans-serif';
    ctx.fillStyle = '#c4956a';
    ctx.fillText(`${pageCount} Spreads`, 256, 168);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.center.set(0.5, 0.5);

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.35,
      metalness: 0.4,
      emissive: '#c4956a',
      emissiveIntensity: 0.45,
    });
    titleMatRef.current = mat;
    return mat;
  }, [debouncedTitle, pageCount]);

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

            {/* Title on front cover — only shown when no custom cover image
                (custom covers use the DOM overlay title instead to avoid double-text) */}
            {!customTexture && (
              <mesh
                position={[HW * 0.85, 0.15, PS / 2 + CT + 0.002]}
                material={titleMat}
              >
                <planeGeometry args={[BOOK_WIDTH * 0.55, BOOK_WIDTH * 0.28]} />
              </mesh>
            )}
          </group>

          {/* ─── Spine ─── */}
          <mesh position={[-0.02, 0, 0]} material={spineMat} castShadow>
            <boxGeometry args={[0.12, BOOK_HEIGHT + 0.04, PS + CT * 2 + 0.02]} />
          </mesh>

          {/* NOTE: previously two "gold spine accent" meshes were
              rendered here near the top and bottom of the book. No matter
              how they were positioned they showed up as bright gold
              specks on the closed cover. Removed entirely — the leather
              cover is now a single clean colour with no corner marks. */}

          {/* Shadow plane (lightweight replacement for ContactShadows) */}
          <mesh position={[HW * 0.5, -HH - 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[6, 4]} />
            <meshStandardMaterial color="#000000" transparent opacity={0.18} />
          </mesh>
        </group>
      </group>
    </Float>
  );
}
