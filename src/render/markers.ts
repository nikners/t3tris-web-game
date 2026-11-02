import * as THREE from 'three';
import type { TetrominoType } from '../logic/pieces';
import type { ThemeContext } from './scene';

const SIZE = 64;

const cache = new Map<TetrominoType, THREE.CanvasTexture>();

function drawMarking(
  ctx: CanvasRenderingContext2D,
  type: TetrominoType,
  mark: string,
): void {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Use a light mark on dark tones, dark mark on light tones for contrast.
  // Default to mark (light) unless a specific pattern needs dark.
  const primary = mark;

  ctx.fillStyle = primary;
  ctx.strokeStyle = primary;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const center = SIZE / 2;
  const pad = 12;

  if (type === 'I') {
    // horizontal bar
    ctx.fillRect(pad, center - 4, SIZE - pad * 2, 8);
  } else if (type === 'O') {
    // square outline
    ctx.strokeStyle = primary;
    ctx.lineWidth = 6;
    ctx.strokeRect(pad + 2, pad + 2, SIZE - (pad + 2) * 2, SIZE - (pad + 2) * 2);
  } else if (type === 'T') {
    // triangle
    ctx.beginPath();
    ctx.moveTo(center, pad);
    ctx.lineTo(SIZE - pad, SIZE - pad);
    ctx.lineTo(pad, SIZE - pad);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'S') {
    // diagonal
    ctx.beginPath();
    ctx.moveTo(pad, SIZE - pad);
    ctx.lineTo(SIZE - pad, pad);
    ctx.stroke();
  } else if (type === 'Z') {
    // opposite diagonal
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(SIZE - pad, SIZE - pad);
    ctx.stroke();
  } else if (type === 'J') {
    // one dot
    ctx.beginPath();
    ctx.arc(center, center, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'L') {
    // two dots
    ctx.beginPath();
    ctx.arc(center - 8, center + 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center + 8, center - 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function getPatternTexture(type: TetrominoType, theme: ThemeContext): THREE.CanvasTexture {
  const cached = cache.get(type);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    cache.set(type, texture);
    return texture;
  }

  drawMarking(ctx, type, theme.mark);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(type, texture);
  return texture;
}
