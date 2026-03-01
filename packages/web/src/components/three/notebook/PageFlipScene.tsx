import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import NotebookCanvas from '../canvas/NotebookCanvas';
import { usePaperMaterial } from '../shared/PaperMaterial';
import { createPageGeometry, applyPageCurl, BOOK_WIDTH, BOOK_HEIGHT } from '../shared/BookGeometry';

interface PageFlipSceneProps {
  /** 'right' = page turns forward (right→left), 'left' = page turns back (left→right) */
  direction: 'left' | 'right';
  /** Paper texture to display on the flipping page */
  paperType?: 'lined' | 'grid' | 'dotted' | 'blank';
  /** Called when the flip animation finishes */
  onComplete: () => void;
}

/**
 * Lazy-loadable 3D page flip overlay.
 * Renders a transparent-background canvas with a single page
 * curling and flipping in the given direction.
 * Designed to overlay the DOM NotebookView during page transitions.
 */
export default function PageFlipScene(props: PageFlipSceneProps) {
  return (
    <NotebookCanvas
      overlay
      lightPreset="notebook"
      postPreset="subtle"
      fov={35}
      cameraPosition={[0, 2, 5]}
    >
      <PageFlip {...props} />
    </NotebookCanvas>
  );
}

function PageFlip({ direction, paperType = 'lined', onComplete }: PageFlipSceneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progress = useRef(0);
  const completed = useRef(false);

  const material = usePaperMaterial({ paperType, resolution: 512 });

  // Base geometry to clone from (origin at spine, extends right)
  const baseGeometry = useMemo(
    () => createPageGeometry(BOOK_WIDTH, BOOK_HEIGHT, 24, 16),
    [],
  );

  // Working copy for per-frame deformation
  const workGeometry = useMemo(() => {
    const geo = baseGeometry.clone() as THREE.PlaneGeometry;
    return geo;
  }, [baseGeometry]);

  // Back-face material (slightly off-white)
  const backMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f0ebe0',
        roughness: 0.95,
        metalness: 0,
        side: THREE.BackSide,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      workGeometry.dispose();
    };
  }, [workGeometry]);

  useFrame((_, delta) => {
    if (!meshRef.current || completed.current) return;

    // Advance progress (complete in ~0.6s)
    progress.current = Math.min(1, progress.current + delta * 1.8);
    const t = progress.current;

    // Reset vertex positions from base
    const basePos = baseGeometry.attributes.position;
    const workPos = workGeometry.attributes.position;
    for (let i = 0; i < workPos.count; i++) {
      workPos.setX(i, basePos.getX(i));
      workPos.setY(i, basePos.getY(i));
      workPos.setZ(i, basePos.getZ(i));
    }

    // Compute curl + flip
    // Curl peaks at midpoint, creating the arched page shape
    const curlAmount = Math.sin(t * Math.PI) * 1.0;
    // Forward: flip 0→1; Backward: flip 1→0
    const flipProgress = direction === 'right' ? t : 1 - t;

    applyPageCurl(workGeometry, curlAmount, flipProgress);
    workPos.needsUpdate = true;
    workGeometry.computeVertexNormals();

    // Signal completion
    if (t >= 1 && !completed.current) {
      completed.current = true;
      onComplete();
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Front face (paper texture) */}
      <mesh
        ref={meshRef}
        geometry={workGeometry}
        material={material}
        position={[-BOOK_WIDTH / 2, 0, 0.01]}
        castShadow
      />
      {/* Back face (plain off-white) */}
      <mesh
        geometry={workGeometry}
        material={backMat}
        position={[-BOOK_WIDTH / 2, 0, 0.01]}
      />
    </group>
  );
}
