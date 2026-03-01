import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCoverMaterial } from './PaperMaterial';

// ─── Constants ────────────────────────────────────────────
const BOOK_WIDTH = 3.2;
const BOOK_HEIGHT = 4.2;
const COVER_THICKNESS = 0.06;
const SPINE_RADIUS = 0.15;
const PAGE_THICKNESS = 0.002;
const PAGE_COUNT_VISUAL = 80; // Visual page stack (not actual pages)

// ─── Types ────────────────────────────────────────────────
interface BookProps {
  /** Cover color (CSS color string) */
  coverColor?: string;
  /** Cover material type */
  coverType?: 'leather' | 'velvet' | 'canvas' | 'linen' | 'kraft';
  /** How far the book is open (0 = closed, 1 = fully open flat) */
  openAmount?: number;
  /** Title text to emboss on cover */
  title?: string;
  /** Whether to show page stack edges */
  showPageEdges?: boolean;
  /** Scale multiplier */
  scale?: number;
  /** Position */
  position?: [number, number, number];
  /** Rotation */
  rotation?: [number, number, number];
}

/**
 * Creates a deformable page mesh with subdivisions for curl/flip animation.
 * The page can bend along its length for realistic page turning.
 */
export function createPageGeometry(
  width: number = BOOK_WIDTH,
  height: number = BOOK_HEIGHT,
  subdivX: number = 20,
  subdivY: number = 20,
): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, height, subdivX, subdivY);
  // Shift origin to left edge (spine side) for rotation
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setX(i, positions.getX(i) + width / 2);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Applies a curl deformation to a page geometry.
 * @param geometry - The page PlaneGeometry
 * @param curlAmount - How much curl (0 = flat, 1 = full curl)
 * @param flipProgress - Page flip progress (0 = right side, 1 = flipped to left)
 */
export function applyPageCurl(
  geometry: THREE.PlaneGeometry,
  curlAmount: number,
  flipProgress: number,
) {
  const positions = geometry.attributes.position;
  const width = BOOK_WIDTH;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const normalizedX = x / width; // 0 at spine, 1 at edge

    // Curl: lift the page edge up in a curve
    const curlZ = Math.sin(normalizedX * Math.PI) * curlAmount * 0.5;

    // Flip rotation: page rotates around the spine
    const flipAngle = flipProgress * Math.PI;
    const flippedX = x * Math.cos(flipAngle);
    const flippedZ = x * Math.sin(flipAngle) * 0.3 + curlZ;

    positions.setX(i, flippedX);
    positions.setZ(i, flippedZ);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Full 3D Book component with covers, spine, page stack, and deformable pages.
 */
export function Book({
  coverColor = '#312e81',
  coverType = 'leather',
  openAmount = 0,
  title = 'My Notebook',
  showPageEdges = true,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: BookProps) {
  const groupRef = useRef<THREE.Group>(null);
  const frontCoverRef = useRef<THREE.Mesh>(null);
  const backCoverRef = useRef<THREE.Mesh>(null);
  const pageStackRef = useRef<THREE.Mesh>(null);

  const coverMaterial = useCoverMaterial(coverType, coverColor);

  // Page edge material (cream colored stack)
  const pageEdgeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#f5f0e8',
      roughness: 0.9,
      metalness: 0,
    }),
    [],
  );

  // Spine material (slightly darker than cover)
  const spineMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: new THREE.Color(coverColor).multiplyScalar(0.7),
      roughness: 0.75,
      metalness: 0.05,
    }),
    [coverColor],
  );

  // Animate open/close
  useFrame(() => {
    if (!frontCoverRef.current || !backCoverRef.current) return;

    // Front cover rotates open
    const targetAngle = -openAmount * Math.PI * 0.55; // Not quite 180, feels more natural
    frontCoverRef.current.rotation.y = THREE.MathUtils.lerp(
      frontCoverRef.current.rotation.y,
      targetAngle,
      0.08,
    );

    // Page stack follows front cover but less
    if (pageStackRef.current) {
      pageStackRef.current.rotation.y = THREE.MathUtils.lerp(
        pageStackRef.current.rotation.y,
        targetAngle * 0.3,
        0.06,
      );
    }
  });

  const halfWidth = BOOK_WIDTH / 2;
  const pageStackThickness = PAGE_THICKNESS * PAGE_COUNT_VISUAL;

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
    >
      {/* Back Cover (stationary base) */}
      <mesh
        ref={backCoverRef}
        position={[halfWidth, 0, -pageStackThickness / 2 - COVER_THICKNESS]}
        castShadow
        receiveShadow
        material={coverMaterial}
      >
        <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS]} />
      </mesh>

      {/* Page Stack (visible from the side) */}
      {showPageEdges && (
        <mesh
          ref={pageStackRef}
          position={[halfWidth, 0, 0]}
          material={pageEdgeMaterial}
        >
          <boxGeometry args={[BOOK_WIDTH - 0.05, BOOK_HEIGHT - 0.05, pageStackThickness]} />
        </mesh>
      )}

      {/* Front Cover (opens) - pivots at spine (x=0) */}
      <group position={[0, 0, 0]}>
        <mesh
          ref={frontCoverRef}
          position={[halfWidth, 0, pageStackThickness / 2 + COVER_THICKNESS]}
          castShadow
          receiveShadow
          material={coverMaterial}
        >
          <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS]} />
        </mesh>
      </group>

      {/* Spine */}
      <mesh
        position={[0, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        material={spineMaterial}
        castShadow
      >
        <cylinderGeometry
          args={[
            SPINE_RADIUS,
            SPINE_RADIUS,
            BOOK_HEIGHT,
            16,
            1,
            false,
            0,
            Math.PI,
          ]}
        />
      </mesh>

      {/* Title text on front cover - using a simple plane with text texture */}
      <TitlePlane
        text={title}
        position={[halfWidth, 0.3, pageStackThickness / 2 + COVER_THICKNESS + 0.001]}
        width={BOOK_WIDTH * 0.7}
        color={coverType === 'leather' ? '#d4a574' : '#ffffff'}
      />
    </group>
  );
}

/**
 * Simple text-on-a-plane for book titles.
 * Uses Canvas2D to render text, then maps it as a texture.
 */
function TitlePlane({
  text,
  position,
  width = 2,
  color = '#d4a574',
}: {
  text: string;
  position: [number, number, number];
  width?: number;
  color?: string;
}) {
  const material = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = color;
    ctx.font = 'bold 48px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;

    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      roughness: 0.3,
      metalness: 0.6, // Slightly metallic for embossed gold look
    });
  }, [text, color]);

  const height = width * 0.25;

  return (
    <mesh position={position} material={material}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}

// ─── Exported Constants ───────────────────────────────────
export const BOOK_DIMENSIONS = {
  width: BOOK_WIDTH,
  height: BOOK_HEIGHT,
  coverThickness: COVER_THICKNESS,
  spineRadius: SPINE_RADIUS,
  pageThickness: PAGE_THICKNESS,
};

export { BOOK_WIDTH, BOOK_HEIGHT };
