import { HeroNotebook } from './HeroNotebook';
import LandingCanvas from '../canvas/LandingCanvas';

interface HeroSceneProps {
  /** Shared ref with scroll progress (read in useFrame, not React state) */
  scrollRef: React.RefObject<{ progress: number }>;
  /** Whether user is hovering the notebook area */
  hovered: boolean;
  /** Shared ref with normalized cursor position (-1 to 1) */
  cursorRef?: React.RefObject<{ x: number; y: number }>;
}

/**
 * Complete 3D hero scene: interactive notebook only (papers removed for perf).
 * Default-exported for React.lazy() code splitting — all Three.js code
 * is in this chunk, keeping the initial bundle lightweight.
 */
export default function HeroScene({ scrollRef, hovered, cursorRef }: HeroSceneProps) {
  return (
    <LandingCanvas
      overlay
      shadows={false}
      postPreset="subtle"
      lightPreset="landing"
      fov={40}
      cameraPosition={[0, 0, 7]}
    >
      <HeroNotebook scrollRef={scrollRef} hovered={hovered} cursorRef={cursorRef} />
    </LandingCanvas>
  );
}
