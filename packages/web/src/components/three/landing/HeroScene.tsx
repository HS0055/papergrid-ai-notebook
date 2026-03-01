import { HeroNotebook } from './HeroNotebook';
import LandingCanvas from '../canvas/LandingCanvas';

interface HeroSceneProps {
  /** Shared ref with scroll progress (read in useFrame, not React state) */
  scrollRef: React.RefObject<{ progress: number }>;
  /** Whether user is hovering the notebook area */
  hovered: boolean;
}

/**
 * Complete 3D hero scene: interactive notebook only (papers removed for perf).
 * Default-exported for React.lazy() code splitting — all Three.js code
 * is in this chunk, keeping the initial bundle lightweight.
 */
export default function HeroScene({ scrollRef, hovered }: HeroSceneProps) {
  return (
    <LandingCanvas
      overlay
      shadows={false}
      postPreset="subtle"
      lightPreset="landing"
      fov={35}
      cameraPosition={[0, 1.5, 6]}
    >
      <HeroNotebook scrollRef={scrollRef} hovered={hovered} />
    </LandingCanvas>
  );
}
