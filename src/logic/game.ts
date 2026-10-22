import {
  collides,
  createBoard,
  dropY,
  merge,
  moveX,
  rotate as rotateWithKicks,
  clearLines,
} from './board';
import type { Board } from './board';
import { baseShape, createBag } from './pieces';
import type { Matrix, TetrominoType } from './pieces';
import { WIDTH } from './board';

export type Direction = 1 | -1;

export type Status = 'playing' | 'gameover';

export interface ActivePiece {
  type: TetrominoType;
  shape: Matrix;
  x: number;
  y: number;
}

export interface GameState {
  board: Board;
  active: ActivePiece;
  ghostY: number;
  next: TetrominoType[];
  score: number;
  lines: number;
  level: number;
  status: Status;
  lastClear: number;
}

export interface Game {
  getState(): GameState;
  subscribe(listener: (state: GameState) => void): () => void;
  move(dx: number): void;
  rotate(dir: Direction): void;
  hardDrop(): void;
  reset(): void;
}

export const LINE_SCORES: readonly number[] = [0, 100, 300, 500, 800];

const DROP_CELL_POINTS = 2;

const PREVIEW_COUNT = 3;

export function levelForLines(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

export function scoreForClear(count: number, level: number): number {
  return (LINE_SCORES[count] ?? 0) * level;
}

export function createGame(rng: () => number = Math.random, initialBoard?: Board): Game {
  let board: Board = initialBoard ? initialBoard.map((row) => [...row]) : createBoard();
  let bag: TetrominoType[] = [];
  let queue: TetrominoType[] = [];
  let active!: ActivePiece;
  let score = 0;
  let lines = 0;
  let status: Status = 'playing';
  let lastClear = 0;
  const listeners = new Set<(state: GameState) => void>();

  function draw(): TetrominoType {
    if (bag.length === 0) {
      bag = createBag(rng);
    }
    return bag.shift() as TetrominoType;
  }

  function fillQueue(): void {
    while (queue.length < PREVIEW_COUNT) {
      queue.push(draw());
    }
  }

  function spawn(): void {
    fillQueue();

    const type = queue.shift() as TetrominoType;
    const shape = baseShape(type);
    const x = Math.floor((WIDTH - shape[0].length) / 2);

    active = { type, shape, x, y: 0 };

    fillQueue();

    if (collides(board, shape, x, 0)) {
      status = 'gameover';
    }
  }

  function snapshot(): GameState {
    return {
      board: board.map((row) => [...row]),
      active: {
        type: active.type,
        shape: active.shape.map((row) => [...row]),
        x: active.x,
        y: active.y,
      },
      ghostY: dropY(board, active.shape, active.x, active.y),
      next: [...queue],
      score,
      lines,
      level: levelForLines(lines),
      status,
      lastClear,
    };
  }

  function emit(): void {
    const state = snapshot();
    listeners.forEach((listener) => listener(state));
  }

  function move(dx: number): void {
    if (status !== 'playing') {
      return;
    }

    const target = moveX(board, active.shape, active.x, active.y, dx);

    if (target !== null) {
      active.x = target;
    }

    emit();
  }

  function rotate(dir: Direction): void {
    if (status !== 'playing') {
      return;
    }

    const turned = rotateWithKicks(board, active.shape, active.x, active.y, dir);

    if (turned) {
      active.shape = turned.shape;
      active.x = turned.x;
      active.y = turned.y;
    }

    emit();
  }

  function hardDrop(): void {
    if (status !== 'playing') {
      return;
    }

    const startY = active.y;
    const landing = dropY(board, active.shape, active.x, active.y);
    active.y = landing;

    // If any cell locks above row 0, the game is over
    for (let sy = 0; sy < active.shape.length; sy++) {
      for (let sx = 0; sx < active.shape[sy].length; sx++) {
        if (active.shape[sy][sx] !== '.' && landing + sy < 0) {
          status = 'gameover';
          emit();
          return;
        }
      }
    }

    score += DROP_CELL_POINTS * (landing - startY);

    let settled = merge(board, active.shape, active.x, landing);
    const cleared = clearLines(settled);
    settled = cleared.board;

    if (cleared.rows.length > 0) {
      lines += cleared.rows.length;
      lastClear = cleared.rows.length;
      score += scoreForClear(cleared.rows.length, levelForLines(lines));
    } else {
      lastClear = 0;
    }

    board = settled;
    spawn();
    emit();
  }

  function reset(): void {
    board = createBoard();
    bag = [];
    queue = [];
    score = 0;
    lines = 0;
    lastClear = 0;
    status = 'playing';
    spawn();
    emit();
  }

  spawn();

  return {
    getState: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    move,
    rotate,
    hardDrop,
    reset,
  };
}
