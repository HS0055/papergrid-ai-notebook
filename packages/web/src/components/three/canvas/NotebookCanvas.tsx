import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import * as THREE from 'three';
import { Lighting } from '../shared/Lighting';
import { PostEffects } from '../shared/PostEffects';

interface NotebookCanvasProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Whether to overlay on top of DOM content */
  overlay?: boolean;
  /** Lighting mood */
  lightPreset?: 'notebook' | 'warm' | 'dramatic';
  /** Post-processing preset */
  postPreset?: 'notebook' | 'subtle';
  /** Camera field of view */
  fov?: number;
  /** Camera position */
  cameraPosition?: [number, number, number];
  /** Cap device pixel ratio for this canvas */
  maxDpr?: number;
  /** Whether the rim light should follow cursor movement */
  followCursorLight?: boolean;
  /** Disable post-processing for lighter scenes */
  disableEffects?: boolean;
}

/**
 * Canvas wrapper for the notebook app 3D scenes (dashboard book cover, etc).
 * Non-overlay mode: renders with a dark gradient background.
 * Overlay mode: transparent background.
 */
export default function NotebookCanvas({
  children,
  className = '',
  style,
  overlay = false,
  lightPreset = 'notebook',
  postPreset = 'notebook',
  fov = 40,
  cameraPosition = [0, 1.5, 6],
  maxDpr = 1.5,
  followCursorLight,
  disableEffects = false,
}: NotebookCanvasProps) {
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    const deviceDpr = Math.min(window.devicePixelRatio, maxDpr);
    setDpr(deviceDpr);
  }, [maxDpr]);

  return (
    <div
      className={`w-full h-full ${className}`}
      style={{
        position: overlay ? 'absolute' : 'relative',
        inset: overlay ? 0 : undefined,
        pointerEvents: overlay ? 'none' : 'auto',
        zIndex: overlay ? 10 : undefined,
        overflow: 'hidden',
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
          far: 50,
          position: cameraPosition,
        }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        style={{
          pointerEvents: overlay ? 'none' : 'auto',
        }}
        onCreated={({ gl }) => {
          if (!overlay) {
            // Dark indigo background for dashboard book scenes
            gl.setClearColor(0x0f0f14, 1);
          } else {
            gl.setClearColor(0x000000, 0);
          }
        }}
      >
        <Lighting preset={lightPreset} followCursor={followCursorLight ?? !overlay} />
        {children}
        <PostEffects preset={postPreset} disabled={disableEffects} />
        <Preload all />
      </Canvas>
    </div>
  );
}
