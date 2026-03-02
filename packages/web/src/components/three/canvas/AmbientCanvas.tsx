import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

interface AmbientCanvasProps {
  children: React.ReactNode;
  /** CSS className for the canvas wrapper */
  className?: string;
  /** Canvas style overrides */
  style?: React.CSSProperties;
}

/**
 * Lightweight R3F Canvas for ambient 3D content sections (not hero).
 * Minimal lighting, no post-processing, overlay mode.
 * Designed for FloatingPapers and other lightweight ambient elements.
 *
 * Usage:
 * ```tsx
 * const AmbientCanvas = React.lazy(() => import('./three/canvas/AmbientCanvas'));
 *
 * <Suspense fallback={null}>
 *   <AmbientCanvas>
 *     <FloatingPapers scrollProgress={scrollProgress} />
 *   </AmbientCanvas>
 * </Suspense>
 * ```
 */
export default function AmbientCanvas({
  children,
  className = '',
  style,
}: AmbientCanvasProps) {
  const [dpr, setDpr] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cap DPR at 1.0 for performance (this is ambient/secondary content)
  useEffect(() => {
    const deviceDpr = Math.min(window.devicePixelRatio, 1.0);
    setDpr(deviceDpr);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        touchAction: 'auto',
        zIndex: 0,
        ...style,
      }}
    >
      <Canvas
        dpr={dpr}
        gl={{
          antialias: false, // Disabled for performance
          alpha: true,
          powerPreference: 'low-power',
        }}
        camera={{
          fov: 50,
          near: 0.1,
          far: 100,
          position: [0, 0, 10],
        }}
        shadows={false}
        style={{
          background: 'transparent',
          pointerEvents: 'none',
          touchAction: 'auto',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          {/* Minimal lighting - single ambient + directional */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={0.3} />

          {/* Scene content */}
          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
