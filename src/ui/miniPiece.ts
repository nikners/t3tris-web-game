// The little pieces in the HOLD and NEXT cards: the same tetrominoes the
// board uses, drawn with plain squares instead of a second canvas.
//
// The squares take their colour from the tone tokens, and their edge from the
// same ink the board draws, so a mini piece reads like the real one.
import { baseShape, trimShape } from '../logic/pieces';
import type { TetrominoType } from '../logic/pieces';

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

  return piece;
}
