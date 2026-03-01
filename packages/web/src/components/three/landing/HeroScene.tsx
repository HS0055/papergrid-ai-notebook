import { HeroNotebook } from './HeroNotebook';
import LandingCanvas from '../canvas/LandingCanvas';

interface HeroSceneProps {
  /** Shared ref with scroll progress (read in useFrame, not React state) */
  scrollRef: React.RefObject<{ progress: number }>;
  /** Whether user is hovering the notebook area */
  hovered: boolean;
  /** Shared ref with normalized cursor position (-1 to 1) */
  cursorRef?: React.RefObject<{ x: number; y: number }>;
  /** Mobile mode: lower quality, no post-processing */
  isMobile?: boolean;
}

/**
 * Complete 3D hero scene: interactive notebook only (papers removed for perf).
 * Default-exported for React.lazy() code splitting — all Three.js code
 * is in this chunk, keeping the initial bundle lightweight.
 *
 * Mobile: disables post-processing, lowers DPR, uses simpler lighting.
 */
export default function HeroScene({ scrollRef, hovered, cursorRef, isMobile = false }: HeroSceneProps) {
  return (
    <LandingCanvas
      overlay
      shadows={false}
      postPreset={isMobile ? undefined : 'subtle'}
      lightPreset="landing"
      fov={isMobile ? 45 : 40}
      cameraPosition={isMobile ? [0, 0, 8] : [0, 0, 7]}
      mobileLowPower={isMobile}
    >
      <HeroNotebook scrollRef={scrollRef} hovered={hovered} cursorRef={cursorRef} isMobile={isMobile} />
    </LandingCanvas>
  );
}
