import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import * as THREE from 'three';
import { Lighting } from '../shared/Lighting';
import { PostEffects } from '../shared/PostEffects';

interface LandingCanvasProps {
  children: React.ReactNode;
  /** CSS className for the canvas wrapper */
  className?: string;
  /** Canvas style overrides */
  style?: React.CSSProperties;
  /** Whether to enable shadows */
  shadows?: boolean;
  /** Post-processing preset */
  postPreset?: 'landing' | 'dramatic' | 'subtle';
  /** Lighting preset */
  lightPreset?: 'landing' | 'warm' | 'dramatic';
  /** Camera field of view */
  fov?: number;
  /** Camera position */
  cameraPosition?: [number, number, number];
  /** Whether this canvas overlays DOM content (transparent background) */
  overlay?: boolean;
}

/**
 * Lazy-loadable Canvas wrapper for landing page 3D scenes.
 * Designed to be imported via React.lazy() for code splitting.
 *
 * Usage:
 * ```tsx
 * const LandingCanvas = React.lazy(() => import('./three/canvas/LandingCanvas'));
 *
 * <Suspense fallback={<div>Loading 3D...</div>}>
 *   <LandingCanvas>
 *     <HeroNotebook />
 *   </LandingCanvas>
 * </Suspense>
 * ```
 */
export default function LandingCanvas({
  children,
  className = '',
  style,
  shadows = true,
  postPreset = 'landing',
  lightPreset = 'landing',
  fov = 45,
  cameraPosition = [0, 2, 8],
  overlay = false,
}: LandingCanvasProps) {
  const [dpr, setDpr] = useState(1.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Adjust DPR based on device pixel ratio (cap at 1.5 for performance)
  useEffect(() => {
    const deviceDpr = Math.min(window.devicePixelRatio, 1.5);
    setDpr(deviceDpr);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{
        position: overlay ? 'absolute' : 'relative',
        inset: overlay ? 0 : undefined,
        pointerEvents: overlay ? 'none' : 'auto',
        zIndex: overlay ? 1 : undefined,
        ...style,
      }}
    >
      <Canvas
        dpr={dpr}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          alpha: overlay,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov,
          near: 0.1,
          far: 100,
          position: cameraPosition,
        }}
        shadows={shadows ? { type: THREE.PCFSoftShadowMap } : false}
        style={{
          background: overlay ? 'transparent' : undefined,
          pointerEvents: overlay ? 'none' : 'auto',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, overlay ? 0 : 1);
        }}
      >
        <Suspense fallback={null}>
          {/* Shared lighting */}
          <Lighting preset={lightPreset} />

          {/* Scene content */}
          {children}

          {/* Post-processing */}
          <PostEffects preset={postPreset} />

          {/* Preload all assets */}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
