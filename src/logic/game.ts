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
  /** The piece put aside, or null while nothing is held. */
  held: TetrominoType | null;
  /** True once hold has been used for the piece that is on the board. */
  holdUsed: boolean;
  score: number;
  lines: number;
  level: number;
  status: Status;
  lastClear: number;
  /** Undos that are left in this game. */
  undosLeft: number;
  /** True while there is a turn that can be taken back. */
  canUndo: boolean;
}

export interface Game {
  getState(): GameState;
  subscribe(listener: (state: GameState) => void): () => void;
  move(dx: number): void;
  rotate(dir: Direction): void;
  hardDrop(): void;
  hold(): void;
  /** Puts the last drop back on the board. */
  undo(): void;
  reset(): void;
}

/** Everything a turn needs, so it can be put back the way it was. */
interface UndoSnapshot {
  board: Board;
  active: ActivePiece;
  queue: TetrominoType[];
  bag: TetrominoType[];
  held: TetrominoType | null;
  holdUsed: boolean;
  score: number;
  lines: number;
  level: number;
  status: Status;
}

export const LINE_SCORES: readonly number[] = [0, 100, 300, 500, 800];

const DROP_CELL_POINTS = 2;

const PREVIEW_COUNT = 3;

/** How many drops can be taken back in one game. */
export const UNDO_LIMIT = 3;

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
  let held: TetrominoType | null = null;
  let holdUsed = false;
  let score = 0;
  let lines = 0;
  let level = 1;
  let status: Status = 'playing';
  let lastClear = 0;
  let undosLeft = UNDO_LIMIT;
  const undoStack: UndoSnapshot[] = [];
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

  /** Puts a piece on the board in its default rotation, at the spawn spot. */
  function place(type: TetrominoType): void {
    const shape = baseShape(type);
    const x = Math.floor((WIDTH - shape[0].length) / 2);

    active = { type, shape, x, y: 0 };

    if (collides(board, shape, x, 0)) {
      status = 'gameover';
    }
  }

  function spawn(): void {
    fillQueue();

    const type = queue.shift() as TetrominoType;
    place(type);

    fillQueue();

    // The hold is unlocked again, so the next piece can be put aside.
    holdUsed = false;
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
      held,
      holdUsed,
      score,
      lines,
      level,
      status,
      lastClear,
      undosLeft,
      canUndo: undosLeft > 0 && undoStack.length > 0,
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

  /**
   * Keeps the turn as it is right now, so an undo can put it back: the
   * board, the score, the piece on it and the order the pieces come in.
   */
  function rememberTurn(): void {
    if (undosLeft <= 0) {
      return;
    }

    // Only the last few turns are kept, so a long game does not pile up
    // copies of the board.
    if (undoStack.length >= UNDO_LIMIT) {
      undoStack.shift();
    }

    undoStack.push({
      board: board.map((row) => [...row]),
      active: {
        type: active.type,
        shape: active.shape.map((row) => [...row]),
        x: active.x,
        y: active.y,
      },
      queue: [...queue],
      bag: [...bag],
      held,
      holdUsed,
      score,
      lines,
      level,
      status,
    });
  }

  function hardDrop(): void {
    if (status !== 'playing') {
      return;
    }

    // The turn is remembered before the piece locks, so the undo brings
    // that piece back instead of the one that came after it.
    rememberTurn();

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
      level = levelForLines(lines);
      lastClear = cleared.rows.length;
      score += scoreForClear(cleared.rows.length, level);
    } else {
      lastClear = 0;
    }

    board = settled;
    spawn();
    emit();
  }

  function hold(): void {
    if (status !== 'playing' || holdUsed) {
      return;
    }

    if (held === null) {
      // Nothing is held yet, so the piece goes aside and the next piece from
      // the queue takes its place. The queue holds the real order, so the
      // preview keeps showing the pieces that will actually spawn.
      held = active.type;
      spawn();
    } else {
      // The held piece comes back in, in its default rotation and at the
      // spawn spot, and the piece on the board goes aside instead.
      const incoming = held;
      held = active.type;
      place(incoming);
    }

    // The hold is locked until the next piece spawns.
    holdUsed = true;
    emit();
  }

  function undo(): void {
    if (undosLeft <= 0) {
      return;
    }

    const turn = undoStack.pop();

    if (!turn) {
      return;
    }

    board = turn.board.map((row) => [...row]);
    active = {
      type: turn.active.type,
      shape: turn.active.shape.map((row) => [...row]),
      x: turn.active.x,
      y: turn.active.y,
    };
    queue = [...turn.queue];
    bag = [...turn.bag];
    held = turn.held;
    holdUsed = turn.holdUsed;
    score = turn.score;
    lines = turn.lines;
    level = turn.level;
    status = turn.status;
    // No lines are on their way out any more: the clear is taken back with
    // the rest of the turn.
    lastClear = 0;
    undosLeft -= 1;
    emit();
  }

  function reset(): void {
    board = createBoard();
    bag = [];
    queue = [];
    held = null;
    holdUsed = false;
    score = 0;
    lines = 0;
    level = 1;
    lastClear = 0;
    status = 'playing';
    undoStack.length = 0;
    undosLeft = UNDO_LIMIT;
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
    hold,
    undo,
    reset,
  };
}
