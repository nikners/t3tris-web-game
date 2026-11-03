// The little pieces in the HOLD and NEXT cards: the same tetrominoes the
// board uses, drawn with plain squares instead of a second canvas.
//
// The squares take their colour from the tone tokens, and their edge from the
// same ink the board draws, so a mini piece reads like the real one.
//
// When the colorblind patterns are on, each piece also carries the marking the
// 3D board draws on its blocks: an inline SVG on top of the squares, using the
// same --color-mark / --color-mark-dark tokens the board reads.
import { baseShape, trimShape } from '../logic/pieces';
import type { TetrominoType } from '../logic/pieces';
import * as patterns from './patterns';

/**
 * The marking for one piece type, as SVG markup. The shapes mirror the ones
 * markers.ts paints onto the 3D blocks: I = horizontal bar, O = square
 * outline, T = triangle, S = diagonal, Z = opposite diagonal, J = one dot,
 * L = two dots.
 *
 * Colours are not baked in: the strokes and fills use currentColor, and the
 * class below picks the mark token.
 */
const MARKINGS: Record<TetrominoType, string> = {
  I: '<rect x="12" y="28" width="40" height="8"/>',
  O: '<rect x="14" y="14" width="36" height="36" rx="2" fill="none" stroke-width="6"/>',
  T: '<path d="M32 12 L52 52 L12 52 Z"/>',
  S: '<line x1="12" y1="52" x2="52" y2="12" fill="none" stroke-width="6" stroke-linecap="round"/>',
  Z: '<line x1="12" y1="12" x2="52" y2="52" fill="none" stroke-width="6" stroke-linecap="round"/>',
  J: '<circle cx="32" cy="32" r="6"/>',
  L: '<circle cx="24" cy="38" r="5"/><circle cx="40" cy="26" r="5"/>',
};

/**
 * Builds the inline SVG marking for a piece type. The viewBox matches the
 * 64x64 space markers.ts draws in, so the shapes line up exactly.
 */
function buildMarking(type: TetrominoType): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'mini-piece__mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = MARKINGS[type];
  return svg;
}

/**
 * Builds a piece out of small squares, one per cell of its shape.
 *
 * The empty rows and columns are cut off first, so the piece takes up only
 * the space it needs.
 */
export function buildMiniPiece(type: TetrominoType): HTMLElement {
  const shape = trimShape(baseShape(type));

  const piece = document.createElement('div');
  piece.className = `mini-piece mini-piece--${type.toLowerCase()}`;
  piece.style.setProperty('--mini-cols', String(shape[0]?.length ?? 0));
  piece.style.setProperty('--mini-rows', String(shape.length));

  shape.forEach((row) => {
    row.forEach((cell) => {
      const block = document.createElement('span');
      block.className = cell === '.' ? 'mini-piece__cell' : 'mini-piece__cell mini-piece__cell--on';
      piece.append(block);
    });
  });

  // The patterns toggle lives in one place: the mini piece subscribes itself,
  // so the NEXT and HOLD cards update the moment it flips, without either card
  // having to know about it.
  let marked = false;

  function applyPatterns(): void {
    const on = patterns.get();

    if (on === marked) {
      return;
    }

    marked = on;

    if (on) {
      piece.append(buildMarking(type));
    } else {
      piece.querySelector('.mini-piece__mark')?.remove();
    }
  }

  const stopPatterns = patterns.subscribe(applyPatterns);
  applyPatterns();

  // The cards rebuild their slots on every piece change, so a mini piece is
  // short-lived; the subscription is dropped with it.
  piece.addEventListener('remove', () => {
    stopPatterns();
  });

  return piece;
}
