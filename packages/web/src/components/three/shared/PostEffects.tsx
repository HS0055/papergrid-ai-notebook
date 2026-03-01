import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

interface PostEffectsProps {
  /** Effect preset */
  preset?: 'landing' | 'notebook' | 'dramatic' | 'subtle';
  /** Auto-disable effects if FPS drops below threshold */
  fpsThreshold?: number;
  /** Force disable all effects */
  disabled?: boolean;
}

/**
 * Post-processing effects for PaperGrid 3D scenes.
 * Auto-degrades quality if FPS drops too low.
 */
export function PostEffects({ preset = 'landing', fpsThreshold = 30, disabled = false }: PostEffectsProps) {
  const [quality, setQuality] = useState<'high' | 'low' | 'off'>('high');
  const fpsRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());

  // FPS monitoring via useFrame (single animation loop)
  useFrame(() => {
    if (disabled) return;

    const now = performance.now();
    const fps = 1000 / (now - lastTimeRef.current);
    lastTimeRef.current = now;

    fpsRef.current.push(fps);
    if (fpsRef.current.length > 60) fpsRef.current.shift();

    // Check average FPS every 2 seconds
    if (fpsRef.current.length === 60) {
      const avg = fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length;
      if (avg < fpsThreshold && quality === 'high') {
        setQuality('low');
      } else if (avg < fpsThreshold * 0.6 && quality === 'low') {
        setQuality('off');
      }
    }
  });

  if (disabled || quality === 'off') return null;

  const presets = {
    landing: {
      bloomIntensity: 0.3,
      bloomThreshold: 0.9,
      bloomRadius: 0.7,
      vignetteOffset: 0.3,
      vignetteDarkness: 0.3,
      noiseOpacity: 0.015,
    },
    notebook: {
      bloomIntensity: 0.15,
      bloomThreshold: 0.9,
      bloomRadius: 0.5,
      vignetteOffset: 0.35,
      vignetteDarkness: 0.5,
      noiseOpacity: 0.02,
    },
    dramatic: {
      bloomIntensity: 1.0,
      bloomThreshold: 0.6,
      bloomRadius: 0.9,
      vignetteOffset: 0.2,
      vignetteDarkness: 0.8,
      noiseOpacity: 0.04,
    },
    subtle: {
      bloomIntensity: 0.12,
      bloomThreshold: 0.95,
      bloomRadius: 0.2,
      vignetteOffset: 0.45,
      vignetteDarkness: 0.25,
      noiseOpacity: 0.01,
    },
  };

  const p = presets[preset];

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={p.bloomIntensity}
        luminanceThreshold={p.bloomThreshold}
        luminanceSmoothing={0.9}
        kernelSize={quality === 'high' ? KernelSize.LARGE : KernelSize.SMALL}
        mipmapBlur
      />
      <Vignette offset={p.vignetteOffset} darkness={p.vignetteDarkness} blendFunction={BlendFunction.NORMAL} />
      <Noise opacity={p.noiseOpacity} blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  );
}
