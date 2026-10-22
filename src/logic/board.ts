import { rotateMatrix } from './pieces';
import type { Cell, Matrix } from './pieces';

export const WIDTH = 10;

export const HEIGHT = 20;

export type Board = Matrix;

export function createBoard(): Board {
  const board: Board = [];

  for (let y = 0; y < HEIGHT; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < WIDTH; x++) {
      row.push('.');
    }
    board.push(row);
  }

  return board;
}

export function collides(board: Board, shape: Matrix, x: number, y: number): boolean {
  for (let sy = 0; sy < shape.length; sy++) {
    for (let sx = 0; sx < shape[sy].length; sx++) {
      if (shape[sy][sx] === '.') {
        continue;
      }

      const cx = x + sx;
      const cy = y + sy;

      if (cx < 0 || cx >= WIDTH || cy >= HEIGHT) {
        return true;
      }

      if (cy < 0) {
        continue;
      }

      if (board[cy][cx] !== '.') {
        return true;
      }
    }
  }

  return false;
}

export function merge(board: Board, shape: Matrix, x: number, y: number): Board {
  const next = board.map((row) => [...row]);

  for (let sy = 0; sy < shape.length; sy++) {
    for (let sx = 0; sx < shape[sy].length; sx++) {
      if (shape[sy][sx] === '.') {
        continue;
      }

      const cx = x + sx;
      const cy = y + sy;

      if (cy < 0 || cy >= HEIGHT || cx < 0 || cx >= WIDTH) {
        continue;
      }

      next[cy][cx] = shape[sy][sx];
    }
  }

  return next;
}

export function clearLines(board: Board): { board: Board; rows: number[] } {
  const rows: number[] = [];

  for (let y = 0; y < HEIGHT; y++) {
    if (board[y].every((cell) => cell !== '.')) {
      rows.push(y);
    }
  }

  if (rows.length === 0) {
    return { board: board.map((row) => [...row]), rows };
  }

  const missing = board.filter((_, y) => !rows.includes(y));
  const fresh: Board = [];

  for (let y = 0; y < rows.length; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < WIDTH; x++) {
      row.push('.');
    }
    fresh.push(row);
  }

  return { board: fresh.concat(missing).map((row) => [...row]), rows };
}

export function moveX(board: Board, shape: Matrix, x: number, y: number, dx: number): number | null {
  const target = x + dx;
  return collides(board, shape, target, y) ? null : target;
}

const WALL_KICKS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
  [0, -2],
];

export function rotate(
  board: Board,
  shape: Matrix,
  x: number,
  y: number,
  dir: 1 | -1,
): { shape: Matrix; x: number; y: number } | null {
  const rotated = rotateMatrix(shape, dir);

  for (const [offsetX, offsetY] of WALL_KICKS) {
    if (!collides(board, rotated, x + offsetX, y + offsetY)) {
      return { shape: rotated, x: x + offsetX, y: y + offsetY };
    }
  }

  return null;
}

export function dropY(board: Board, shape: Matrix, x: number, y: number): number {
  let landing = y;

  while (!collides(board, shape, x, landing + 1)) {
    landing++;
  }

  return landing;
}
