export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export type Cell = '.' | TetrominoType;

export type Matrix = Cell[][];

export const PIECE_TYPES: readonly TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

export const TONE_TOKEN: Record<TetrominoType, string> = {
  I: '--tone-i',
  J: '--tone-j',
  L: '--tone-l',
  O: '--tone-o',
  S: '--tone-s',
  T: '--tone-t',
  Z: '--tone-z',
};

const BASE_SHAPES: Record<TetrominoType, Matrix> = {
  I: [
    ['.', '.', '.', '.'],
    ['I', 'I', 'I', 'I'],
    ['.', '.', '.', '.'],
    ['.', '.', '.', '.'],
  ],
  J: [
    ['J', '.', '.'],
    ['J', 'J', 'J'],
    ['.', '.', '.'],
  ],
  L: [
    ['.', '.', 'L'],
    ['L', 'L', 'L'],
    ['.', '.', '.'],
  ],
  O: [
    ['O', 'O'],
    ['O', 'O'],
  ],
  S: [
    ['.', 'S', 'S'],
    ['S', 'S', '.'],
    ['.', '.', '.'],
  ],
  T: [
    ['.', 'T', '.'],
    ['T', 'T', 'T'],
    ['.', '.', '.'],
  ],
  Z: [
    ['Z', 'Z', '.'],
    ['.', 'Z', 'Z'],
    ['.', '.', '.'],
  ],
};

export function baseShape(type: TetrominoType): Matrix {
  return BASE_SHAPES[type].map((row) => [...row]);
}

export function rotateMatrix(shape: Matrix, dir: 1 | -1): Matrix {
  const height = shape.length;
  const width = shape[0].length;
  const rotated: Matrix = [];

  for (let y = 0; y < width; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < height; x++) {
      row.push(dir === 1 ? shape[height - 1 - x][y] : shape[x][width - 1 - y]);
    }
    rotated.push(row);
  }

  return rotated;
}

/**
 * Cuts the empty rows and columns off a shape, so a piece can be drawn in
 * the space it actually takes up.
 */
export function trimShape(shape: Matrix): Matrix {
  let top = shape.length;
  let bottom = -1;
  let left = shape[0].length;
  let right = -1;

  shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === '.') {
        return;
      }

      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    });
  });

  // An empty shape stays empty.
  if (bottom === -1) {
    return [];
  }

  const trimmed: Matrix = [];

  for (let y = top; y <= bottom; y++) {
    trimmed.push(shape[y].slice(left, right + 1));
  }

  return trimmed;
}

export function filledCellCount(shape: Matrix): number {
  let count = 0;

  for (const row of shape) {
    for (const cell of row) {
      if (cell !== '.') {
        count++;
      }
    }
  }

  return count;
}

export function createBag(rng: () => number): TetrominoType[] {
  const bag: TetrominoType[] = [...PIECE_TYPES];

  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = bag[i];
    bag[i] = bag[j];
    bag[j] = swap;
  }

  return bag;
}
