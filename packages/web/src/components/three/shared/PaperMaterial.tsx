import { useMemo } from 'react';
import * as THREE from 'three';

type PaperType = 'lined' | 'grid' | 'dotted' | 'blank' | 'music' | 'rows' | 'isometric' | 'hex' | 'legal' | 'crumpled';

interface PaperMaterialOptions {
  paperType: PaperType;
  /** Texture resolution (default 1024) */
  resolution?: number;
  /** Paper color override */
  color?: string;
  /** Whether to generate normal map for surface depth */
  withNormalMap?: boolean;
  /** Normal map strength */
  normalStrength?: number;
}

// Colors
const PAPER_COLOR = '#fdfbf7';
const LEGAL_COLOR = '#fbf0d9';
const LINE_COLOR = '#cbd5e1';
const LINE_STRONG = '#94a3b8';

/**
 * Generates a Canvas-based texture for any of the 10 paper types.
 * Returns both color map and optional normal map for 3D depth.
 */
function generatePaperTexture(
  paperType: PaperType,
  resolution: number,
): { colorCanvas: HTMLCanvasElement; normalCanvas: HTMLCanvasElement | null } {
  const size = resolution;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  // Normal map canvas
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d')!;

  // Base: neutral normal (128, 128, 255)
  nCtx.fillStyle = '#8080ff';
  nCtx.fillRect(0, 0, size, size);

  // Paper fiber noise on normal map
  const imageData = nCtx.getImageData(0, 0, size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    imageData.data[i] = Math.max(0, Math.min(255, 128 + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, 128 + noise));
    // Keep blue high for normal maps
    imageData.data[i + 2] = Math.max(200, Math.min(255, 255 + (Math.random() - 0.5) * 10));
  }
  nCtx.putImageData(imageData, 0, 0);

  const bgColor = paperType === 'legal' ? LEGAL_COLOR : PAPER_COLOR;

  // Base fill
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // Add subtle paper grain
  for (let i = 0; i < size * 2; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = Math.random() * 0.03;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const lineSpacing = size / 32; // 32 lines per tile

  switch (paperType) {
    case 'lined': {
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 1;
      for (let y = lineSpacing; y < size; y += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();

        // Normal map: groove for each line
        nCtx.strokeStyle = 'rgba(120, 120, 255, 0.5)';
        nCtx.lineWidth = 2;
        nCtx.beginPath();
        nCtx.moveTo(0, y);
        nCtx.lineTo(size, y);
        nCtx.stroke();
      }
      break;
    }

    case 'grid': {
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 0.8;
      for (let i = 0; i <= size; i += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }

      // Normal: grid channels
      nCtx.strokeStyle = 'rgba(120, 120, 255, 0.3)';
      nCtx.lineWidth = 1.5;
      for (let i = 0; i <= size; i += lineSpacing) {
        nCtx.beginPath();
        nCtx.moveTo(i, 0);
        nCtx.lineTo(i, size);
        nCtx.stroke();
        nCtx.beginPath();
        nCtx.moveTo(0, i);
        nCtx.lineTo(size, i);
        nCtx.stroke();
      }
      break;
    }

    case 'dotted': {
      ctx.fillStyle = LINE_STRONG;
      for (let x = lineSpacing / 2; x < size; x += lineSpacing) {
        for (let y = lineSpacing / 2; y < size; y += lineSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Normal: bump for each dot
          nCtx.fillStyle = 'rgba(140, 140, 255, 0.8)';
          nCtx.beginPath();
          nCtx.arc(x, y, 3, 0, Math.PI * 2);
          nCtx.fill();
        }
      }
      break;
    }

    case 'music': {
      // 5-line staff groups
      const staffLineSpacing = lineSpacing * 0.3;
      const staffGroupSpacing = lineSpacing * 4;
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 0.8;
      for (let groupY = staffGroupSpacing; groupY < size; groupY += staffGroupSpacing) {
        for (let l = 0; l < 5; l++) {
          const y = groupY + l * staffLineSpacing;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
      }
      break;
    }

    case 'rows': {
      // Alternating shaded rows
      for (let y = 0; y < size; y += lineSpacing * 2) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, y + lineSpacing, size, lineSpacing);

        ctx.strokeStyle = LINE_COLOR;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, y + lineSpacing);
        ctx.lineTo(size, y + lineSpacing);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, y + lineSpacing * 2);
        ctx.lineTo(size, y + lineSpacing * 2);
        ctx.stroke();
      }
      break;
    }

    case 'isometric': {
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 0.6;
      const isoSpacing = lineSpacing * 2;
      // Diagonal lines going both ways + verticals
      for (let x = -size; x < size * 2; x += isoSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + size, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + size, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      for (let x = 0; x < size; x += isoSpacing / 2) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      break;
    }

    case 'hex': {
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 0.7;
      const hexSize = lineSpacing * 1.5;
      const hexH = hexSize * Math.sqrt(3) / 2;

      for (let row = 0; row < size / hexH + 1; row++) {
        for (let col = 0; col < size / hexSize + 1; col++) {
          const x = col * hexSize * 1.5;
          const y = row * hexH * 2 + (col % 2 === 1 ? hexH : 0);

          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const px = x + hexSize * 0.5 * Math.cos(angle);
            const py = y + hexSize * 0.5 * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }

    case 'legal': {
      // Yellow background already set
      // Red margin line
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(size * 0.08, 0);
      ctx.lineTo(size * 0.08, size);
      ctx.stroke();

      // Normal: raised margin line
      nCtx.strokeStyle = 'rgba(140, 120, 255, 0.6)';
      nCtx.lineWidth = 3;
      nCtx.beginPath();
      nCtx.moveTo(size * 0.08, 0);
      nCtx.lineTo(size * 0.08, size);
      nCtx.stroke();

      // Horizontal lines
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 0.8;
      for (let y = lineSpacing; y < size; y += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      break;
    }

    case 'crumpled': {
      // Perlin-like wrinkle effect
      const nData = nCtx.getImageData(0, 0, size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          // Larger scale noise for wrinkles
          const nx = Math.sin(x * 0.02) * Math.cos(y * 0.03) * 30;
          const ny = Math.cos(x * 0.025) * Math.sin(y * 0.02) * 30;
          nData.data[idx] = Math.max(0, Math.min(255, 128 + nx));
          nData.data[idx + 1] = Math.max(0, Math.min(255, 128 + ny));
          nData.data[idx + 2] = 220;
        }
      }
      nCtx.putImageData(nData, 0, 0);

      // Color: add some shadow variation
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * size * 0.15;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.03)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      }
      break;
    }

    case 'blank':
    default:
      // Just the base paper color + grain, no pattern
      break;
  }

  return { colorCanvas, normalCanvas };
}

/**
 * Hook that creates a MeshStandardMaterial with procedural paper textures.
 * Memoized by paper type and resolution.
 */
export function usePaperMaterial(options: PaperMaterialOptions) {
  const {
    paperType,
    resolution = 1024,
    withNormalMap = true,
    normalStrength = 0.3,
  } = options;

  const material = useMemo(() => {
    const { colorCanvas, normalCanvas } = generatePaperTexture(paperType, resolution);

    const colorTexture = new THREE.CanvasTexture(colorCanvas);
    colorTexture.wrapS = THREE.RepeatWrapping;
    colorTexture.wrapT = THREE.RepeatWrapping;
    colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
    colorTexture.magFilter = THREE.LinearFilter;
    colorTexture.anisotropy = 16;

    const mat = new THREE.MeshStandardMaterial({
      map: colorTexture,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    if (withNormalMap && normalCanvas) {
      const normalTexture = new THREE.CanvasTexture(normalCanvas);
      normalTexture.wrapS = THREE.RepeatWrapping;
      normalTexture.wrapT = THREE.RepeatWrapping;
      normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
      mat.normalMap = normalTexture;
      mat.normalScale = new THREE.Vector2(normalStrength, normalStrength);
    }

    return mat;
  }, [paperType, resolution, withNormalMap, normalStrength]);

  return material;
}

/**
 * Creates a cover material for notebook covers.
 */
export function useCoverMaterial(coverType: 'leather' | 'velvet' | 'canvas' | 'linen' | 'kraft', color: string) {
  const material = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);

    // Normal map
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size;
    normalCanvas.height = size;
    const nCtx = normalCanvas.getContext('2d')!;
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);

    switch (coverType) {
      case 'leather': {
        // Leather grain texture
        for (let i = 0; i < size * 10; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const a = Math.random() * 0.08;
          ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
          ctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 1 + 0.5);
        }
        // Leather normal bumps
        const nData = nCtx.getImageData(0, 0, size, size);
        for (let i = 0; i < nData.data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 20;
          nData.data[i] = Math.max(0, Math.min(255, 128 + noise));
          nData.data[i + 1] = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * 20));
        }
        nCtx.putImageData(nData, 0, 0);
        break;
      }
      case 'velvet': {
        // Soft directional fibers
        for (let i = 0; i < size * 5; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.04})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.random() * 4, y + Math.random() * 8);
          ctx.stroke();
        }
        break;
      }
      case 'canvas': {
        // Canvas weave pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < size; x += 4) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, size);
          ctx.stroke();
        }
        for (let y = 0; y < size; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
        break;
      }
      case 'linen': {
        // Linen crosshatch
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.04)';
        ctx.lineWidth = 0.5;
        for (let i = -size; i < size * 2; i += 3) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + size * 0.3, size);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(i + size * 0.3, 0);
          ctx.lineTo(i, size);
          ctx.stroke();
        }
        break;
      }
      case 'kraft': {
        // Kraft paper - rough, warm
        for (let i = 0; i < size * 15; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const shade = Math.random() > 0.5 ? 'rgba(0,0,0,' : 'rgba(255,255,255,';
          ctx.fillStyle = `${shade}${Math.random() * 0.05})`;
          ctx.fillRect(x, y, Math.random() * 2, Math.random() * 2);
        }
        break;
      }
    }

    const colorTexture = new THREE.CanvasTexture(canvas);
    colorTexture.wrapS = THREE.RepeatWrapping;
    colorTexture.wrapT = THREE.RepeatWrapping;
    colorTexture.anisotropy = 8;

    const normalTexture = new THREE.CanvasTexture(normalCanvas);
    normalTexture.wrapS = THREE.RepeatWrapping;
    normalTexture.wrapT = THREE.RepeatWrapping;

    const roughnessMap: Record<string, number> = {
      leather: 0.7,
      velvet: 0.95,
      canvas: 0.8,
      linen: 0.75,
      kraft: 0.9,
    };

    return new THREE.MeshStandardMaterial({
      map: colorTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: roughnessMap[coverType] ?? 0.8,
      metalness: coverType === 'leather' ? 0.05 : 0.0,
    });
  }, [coverType, color]);

  return material;
}
