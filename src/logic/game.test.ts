import { createGame, levelForLines, scoreForClear } from './game';
import type { GameState } from './game';
import { collides, createBoard, merge } from './board';
import type { Board } from './board';
import { createBag } from './pieces';
import type { Cell, Matrix } from './pieces';
import { describe, expect, it } from 'vitest';

const WALL = 10;
const FLOOR = 20;
const DROP_CELL_POINTS = 2;

function filledCoords(shape: Matrix): Array<[number, number]> {
  const coords: Array<[number, number]> = [];

  shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell !== '.') {
        coords.push([x, y]);
      }
    });
  });

  return coords;
}

function boardWithCells(cells: Array<{ y: number; from: number; to: number; type?: Cell }>): Board {
  let board = createBoard();

  for (const cell of cells) {
    for (let x = cell.from; x < cell.to; x++) {
      board = merge(board, [[cell.type ?? 'T']], x, cell.y);
    }
  }

  return board;
}

function filledCount(board: Board): number {
  return board.flat().filter((cell) => cell !== '.').length;
}

describe('scoring', () => {
  it('raises a level every ten lines', () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(9)).toBe(1);
    expect(levelForLines(10)).toBe(2);
    expect(levelForLines(25)).toBe(3);
  });

  it('pays the classic line table scaled by level', () => {
    expect(scoreForClear(0, 1)).toBe(0);
    expect(scoreForClear(1, 1)).toBe(100);
    expect(scoreForClear(2, 1)).toBe(300);
    expect(scoreForClear(3, 1)).toBe(500);
    expect(scoreForClear(4, 1)).toBe(800);
    expect(scoreForClear(3, 2)).toBe(1000);
    expect(scoreForClear(4, 3)).toBe(2400);
  });
});

describe('game', () => {
  it('spawns a piece with a ghost landing and a preview queue', () => {
    const order = createBag(() => 0.5);
    const state: GameState = createGame(() => 0.5).getState();

    expect(state.active.type).toBe(order[0]);
    expect(state.next).toEqual(order.slice(1, 4));
    expect(state.ghostY).toBe(FLOOR - 2);
    expect(state.status).toBe('playing');
    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
  });

  it('holds the piece in place with no gravity and no timer', () => {
    const game = createGame(() => 0.5);
    const before = game.getState();

    for (let read = 0; read < 5; read++) {
      const now = game.getState();
      expect(now.active.y).toBe(before.active.y);
      expect(now.active.x).toBe(before.active.x);
      expect(now.board).toEqual(before.board);
    }
  });

  it('stops the piece at both walls', () => {
    const game = createGame(() => 0.5);

    for (let step = 0; step < 12; step++) {
      game.move(-1);
    }
    expect(game.getState().active.x).toBe(0);

    for (let step = 0; step < 12; step++) {
      game.move(1);
    }
    expect(game.getState().active.x).toBe(WALL - 4);
  });

  it('rotates without leaving the well', () => {
    const game = createGame(() => 0.5);

    for (let step = 0; step < 3; step++) {
      game.move(-1);
    }

    game.rotate(1);

    const state = game.getState();
    expect(state.active.x).toBeGreaterThanOrEqual(0);
    expect(collides(state.board, state.active.shape, state.active.x, state.active.y)).toBe(false);
  });

  it('lands a hard drop exactly on the ghost position', () => {
    const game = createGame();
    const before = game.getState();

    game.hardDrop();

    const after = game.getState();

    for (const [sx, sy] of filledCoords(before.active.shape)) {
      expect(after.board[before.ghostY + sy][before.active.x + sx]).toBe(before.active.type);
    }

    expect(filledCount(after.board)).toBe(4);
    expect(after.score).toBe(DROP_CELL_POINTS * (before.ghostY - 0));
  });

  it('clears one line and scores it', () => {
    const order = createBag(() => 0.5);
    const board = boardWithCells([
      { y: FLOOR - 1, from: 0, to: 3 },
      { y: FLOOR - 1, from: 7, to: 10 },
    ]);

    const game = createGame(() => 0.5, board);
    expect(game.getState().status).toBe('playing');

    game.hardDrop();

    const state = game.getState();
    expect(state.lines).toBe(1);
    expect(state.level).toBe(1);
    expect(state.lastClear).toBe(1);
    expect(state.score).toBe(DROP_CELL_POINTS * (FLOOR - 2) + scoreForClear(1, 1));
    expect(filledCount(state.board)).toBe(0);
    expect(state.active.type).toBe(order[1]);
    expect(state.next).toEqual(order.slice(2, 5));
  });

  it('clears four lines at once with a vertical I piece', () => {
    const rows: Array<{ y: number; from: number; to: number; type?: Cell }> = [];

    for (let y = FLOOR - 4; y < FLOOR; y++) {
      rows.push({ y, from: 0, to: 5 });
      rows.push({ y, from: 6, to: 10 });
    }

    const board = boardWithCells(rows);

    const game = createGame(() => 0.5, board);

    expect(game.getState().active.type).toBe('I');

    game.rotate(1);
    game.hardDrop();

    const state = game.getState();
    expect(state.lines).toBe(4);
    expect(state.lastClear).toBe(4);
    expect(state.score).toBe(DROP_CELL_POINTS * (FLOOR - 4) + scoreForClear(4, 1));
    expect(filledCount(state.board)).toBe(0);
  });

  it('ends the game when the first piece cannot spawn', () => {
    const board = boardWithCells([{ y: 1, from: 3, to: 7 }]);

    const state = createGame(() => 0.5, board).getState();

    expect(state.status).toBe('gameover');
  });

  it('ends the game only when the next piece cannot spawn', () => {
    const order = createBag(() => 0);
    const stack = Array.from({ length: FLOOR - 3 }, (_, y) => ({
      y: y + 3,
      from: 3,
      to: 6,
      type: order[0] as Cell,
    }));
    const board = boardWithCells(stack);

    const game = createGame(() => 0, board);
    expect(game.getState().status).toBe('playing');

    game.hardDrop();

    const state = game.getState();
    expect(state.status).toBe('gameover');
    expect(state.lines).toBe(0);
    expect(state.score).toBe(DROP_CELL_POINTS);
  });

  it('ends the game when a piece locks above row 0', () => {
    // The I piece spawns at x=3, y=0. Rotated clockwise it becomes a vertical bar
    // in board column 5 (rows y..y+3). Filling row 3 at columns 3-7 blocks the
    // unkicked spot and every sideways kick (x-2..x+2), so the only kick that fits
    // is "up by one" (y = -1). Hard drop then locks the bar with a cell above row 0.
    const board = boardWithCells([{ y: 3, from: 3, to: 8 }]);
    const game = createGame(() => 0.5, board);
    expect(game.getState().status).toBe('playing');
    expect(game.getState().active.type).toBe('I');

    game.rotate(1);
    expect(game.getState().active.y).toBe(-1);

    game.hardDrop();

    expect(game.getState().status).toBe('gameover');
  });

  it('does not end game when piece lands within board', () => {
    const board = createBoard();
    const game = createGame(() => 0.5, board);
    expect(game.getState().status).toBe('playing');

    game.hardDrop();

    const state = game.getState();
    expect(state.status).toBe('playing');
  });

  it('ignores input once the game is over', () => {
    const board = boardWithCells([{ y: 1, from: 3, to: 7 }]);
    const game = createGame(() => 0.5, board);
    const before = game.getState();

    game.move(-1);
    game.rotate(1);
    game.hardDrop();

    expect(game.getState()).toEqual(before);
  });

  it('resets back to a fresh board', () => {
    const game = createGame(() => 0.5);

    game.hardDrop();
    game.hardDrop();
    expect(game.getState().board.flat().some((cell) => cell !== '.')).toBe(true);

    game.reset();

    const state = game.getState();
    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
    expect(state.level).toBe(1);
    expect(state.status).toBe('playing');
    expect(filledCount(state.board)).toBe(0);
  });

  it('tells subscribers about changes and stops after unsubscribe', () => {
    const game = createGame(() => 0.5);
    const seen: number[] = [];

    const unsubscribe = game.subscribe(() => seen.push(seen.length));

    game.move(-1);
    game.rotate(1);
    expect(seen).toEqual([0, 1]);

    unsubscribe();
    game.move(1);
    expect(seen).toEqual([0, 1]);
  });

  it('hands out a state copy that cannot mutate the game', () => {
    const game = createGame(() => 0.5);
    const state = game.getState();

    state.board[0][0] = 'T';
    state.active.x = 9;

    expect(game.getState().board[0][0]).toBe('.');
    expect(game.getState().active.x).toBe(3);
  });
});
