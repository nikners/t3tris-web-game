import { createGame, levelForLines, scoreForClear } from './game';
import type { GameState } from './game';
import { collides, createBoard, merge } from './board';
import type { Board } from './board';
import { createBag, baseShape } from './pieces';
import type { Cell, Matrix, TetrominoType } from './pieces';
import { describe, expect, it } from 'vitest';

const WALL = 10;
const FLOOR = 20;
const DROP_CELL_POINTS = 2;
const PREVIEW_COUNT = 3;

/** A small repeatable generator, so the piece order can be predicted. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

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

/** The cells a piece covers on the board the moment it spawns. */
function spawnCells(type: TetrominoType): Array<[number, number]> {
  const shape = baseShape(type);
  const x = Math.floor((WALL - shape[0].length) / 2);

  return filledCoords(shape).map(([sx, sy]) => [sx + x, sy] as [number, number]);
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

describe('preview', () => {
  it('shows the three pieces that are coming next', () => {
    const game = createGame(seededRng(7));

    for (let drop = 0; drop < 6; drop++) {
      const before = game.getState();
      expect(before.next).toHaveLength(PREVIEW_COUNT);

      game.hardDrop();

      const after = game.getState();
      // The piece that spawned was the first one on the preview.
      expect(after.active.type).toBe(before.next[0]);
      // The preview slides along: the first piece is gone and a new one joins.
      expect(after.next[0]).toBe(before.next[1]);
      expect(after.next[1]).toBe(before.next[2]);
    }
  });

  it('does not change the preview just by reading it', () => {
    const game = createGame(seededRng(11));
    const before = game.getState().next;

    for (let read = 0; read < 10; read++) {
      expect(game.getState().next).toEqual(before);
    }

    // Moving and turning the piece leave the queue alone.
    game.move(-1);
    game.rotate(1);
    expect(game.getState().next).toEqual(before);

    // The copy in the state cannot be used to change the queue either.
    const state = game.getState();
    state.next[0] = 'Z';
    state.next.push('Z');
    expect(game.getState().next).toEqual(before);
  });

  it('keeps the preview right across a bag boundary', () => {
    // A constant generator makes every bag the same shuffle, so the spawn
    // order is that bag repeated.
    const rng = () => 0.25;
    const bag = createBag(rng);
    const game = createGame(rng);

    const expected: TetrominoType[] = [];
    for (let round = 0; round < 3; round++) {
      expected.push(...bag);
    }

    // Eight drops run past the seventh piece, into the next bag.
    for (let drop = 0; drop < 8; drop++) {
      const state = game.getState();

      expect(state.status).toBe('playing');
      expect(state.next).toEqual(expected.slice(drop + 1, drop + 1 + PREVIEW_COUNT));

      game.hardDrop();

      expect(game.getState().active.type).toBe(expected[drop + 1]);
    }
  });

  it('is the same order for the same seed', () => {
    const first = createGame(seededRng(99));
    const second = createGame(seededRng(99));

    expect(first.getState().active.type).toBe(second.getState().active.type);
    expect(first.getState().next).toEqual(second.getState().next);

    for (let drop = 0; drop < 4; drop++) {
      first.hardDrop();
      second.hardDrop();

      expect(first.getState().active.type).toBe(second.getState().active.type);
      expect(first.getState().next).toEqual(second.getState().next);
    }
  });
});

describe('hold', () => {
  it('stores the piece aside and spawns the next one', () => {
    const order = createBag(() => 0.5);
    const game = createGame(() => 0.5);
    const before = game.getState();

    game.hold();

    const after = game.getState();
    expect(after.held).toBe(before.active.type);
    expect(after.active.type).toBe(order[1]);
    // The preview slides along, so it still shows the order the pieces
    // really come in.
    expect(after.next).toEqual(order.slice(2, 5));
    expect(after.holdUsed).toBe(true);
  });

  it('does nothing the second time in the same turn', () => {
    const game = createGame(() => 0.5);

    game.hold();
    const after = game.getState();

    game.hold();

    expect(game.getState()).toEqual(after);
  });

  it('works again once the next piece has spawned', () => {
    const order = createBag(() => 0.5);
    const game = createGame(() => 0.5);

    game.hold();
    expect(game.getState().held).toBe(order[0]);

    game.hardDrop();
    expect(game.getState().holdUsed).toBe(false);

    game.hold();

    const state = game.getState();
    // The piece that was held comes back, and the piece that was playing
    // goes aside instead.
    expect(state.active.type).toBe(order[0]);
    expect(state.held).toBe(order[2]);
    expect(state.holdUsed).toBe(true);
  });

  it('swaps the held piece back in at its spawn rotation', () => {
    const order = createBag(() => 0.5);
    const game = createGame(() => 0.5);

    game.hold();
    game.hardDrop();
    game.hold();

    const state = game.getState();
    const shape = baseShape(order[0]);

    expect(state.active.type).toBe(order[0]);
    // The piece comes back in its default rotation, at the spawn spot.
    expect(state.active.shape).toEqual(shape);
    expect(state.active.x).toBe(Math.floor((WALL - shape[0].length) / 2));
    expect(state.active.y).toBe(0);
  });

  it('leaves the order in the preview alone', () => {
    const order = createBag(() => 0.5);
    const game = createGame(() => 0.5);

    game.hold();
    game.hardDrop();

    const before = game.getState().next;

    game.hold();

    // The swap takes nothing out of the queue, so the preview does not move.
    expect(game.getState().next).toEqual(before);
    expect(game.getState().active.type).toBe(order[0]);
  });

  it('ends the game when a piece cannot spawn after a hold', () => {
    const order = createBag(() => 0.5);
    const first = spawnCells(order[0]);
    const second = spawnCells(order[1]);
    // A cell in the way of the second piece, but not of the first one, so
    // the game starts and only the held spawn is blocked.
    const blocker = second.find(([x, y]) => !first.some(([sx, sy]) => sx === x && sy === y));

    expect(blocker).toBeDefined();

    const board = boardWithCells([{ y: blocker![1], from: blocker![0], to: blocker![0] + 1 }]);
    const game = createGame(() => 0.5, board);

    expect(game.getState().status).toBe('playing');

    game.hold();

    expect(game.getState().status).toBe('gameover');
  });

  it('is ignored once the game is over', () => {
    const board = boardWithCells([{ y: 1, from: 3, to: 7 }]);
    const game = createGame(() => 0.5, board);
    const before = game.getState();

    expect(before.status).toBe('gameover');

    game.hold();

    expect(game.getState()).toEqual(before);
  });

  it('reset clears the held piece and the lock', () => {
    const game = createGame(() => 0.5);

    game.hold();
    expect(game.getState().held).not.toBeNull();

    game.reset();

    const state = game.getState();
    expect(state.held).toBeNull();
    expect(state.holdUsed).toBe(false);
  });
});

describe('undo', () => {
  it('puts the piece back where it was and keeps the order', () => {
    const game = createGame(() => 0.5);

    game.move(-1);
    const before = game.getState();

    game.hardDrop();
    const dropped = game.getState();
    expect(dropped.board).not.toEqual(before.board);

    game.undo();

    const after = game.getState();
    expect(after.board).toEqual(before.board);
    expect(after.active.type).toBe(before.active.type);
    expect(after.active.shape).toEqual(before.active.shape);
    expect(after.active.x).toBe(before.active.x);
    expect(after.active.y).toBe(before.active.y);
    expect(after.next).toEqual(before.next);
    expect(after.score).toBe(before.score);
    expect(after.lines).toBe(before.lines);
    expect(after.level).toBe(before.level);
    expect(after.status).toBe('playing');

    // The pieces come in in the same order again.
    game.hardDrop();
    expect(game.getState().active.type).toBe(dropped.active.type);
  });

  it('restores the lines a clear took away', () => {
    const board = boardWithCells([
      { y: FLOOR - 1, from: 0, to: 3 },
      { y: FLOOR - 1, from: 7, to: 10 },
    ]);

    const game = createGame(() => 0.5, board);
    const before = game.getState();

    game.hardDrop();

    const cleared = game.getState();
    expect(cleared.lines).toBe(1);
    expect(filledCount(cleared.board)).toBe(0);

    game.undo();

    const after = game.getState();
    expect(after.lines).toBe(0);
    expect(after.lastClear).toBe(0);
    expect(after.board).toEqual(before.board);
    expect(after.score).toBe(before.score);
    expect(after.level).toBe(before.level);
  });

  it('gives the game back when the drop that ended it is taken back', () => {
    const order = createBag(() => 0);
    const stack = Array.from({ length: FLOOR - 3 }, (_, y) => ({
      y: y + 3,
      from: 3,
      to: 6,
      type: order[0] as Cell,
    }));
    const board = boardWithCells(stack);

    const game = createGame(() => 0, board);
    const before = game.getState();
    expect(before.status).toBe('playing');

    game.hardDrop();
    expect(game.getState().status).toBe('gameover');

    game.undo();

    const after = game.getState();
    expect(after.status).toBe('playing');
    expect(after.board).toEqual(before.board);
    expect(after.score).toBe(before.score);
    // Taking the game back costs an undo.
    expect(after.undosLeft).toBe(2);
  });

  it('counts down to three undos and then stops', () => {
    const game = createGame(() => 0.5);
    expect(game.getState().undosLeft).toBe(3);

    for (let drop = 0; drop < 4; drop++) {
      game.hardDrop();
    }

    // Dropping does not use an undo, so all three are still there.
    expect(game.getState().undosLeft).toBe(3);

    game.undo();
    game.undo();
    game.undo();
    expect(game.getState().undosLeft).toBe(0);

    const after = game.getState();
    game.undo();

    expect(game.getState()).toEqual(after);
    expect(game.getState().undosLeft).toBe(0);
  });

  it('does nothing when there is nothing to undo', () => {
    const game = createGame(() => 0.5);
    const before = game.getState();

    expect(before.canUndo).toBe(false);

    game.undo();

    expect(game.getState()).toEqual(before);
    expect(game.getState().undosLeft).toBe(3);
  });

  it('puts the held piece and the hold lock back', () => {
    const game = createGame(() => 0.5);

    game.hold();
    const held = game.getState();
    expect(held.held).not.toBeNull();
    expect(held.holdUsed).toBe(true);

    game.hardDrop();
    game.undo();

    const after = game.getState();
    expect(after.held).toBe(held.held);
    expect(after.holdUsed).toBe(held.holdUsed);
  });

  it('goes back two drops in a row', () => {
    const game = createGame(() => 0.5);
    const start = game.getState();

    game.hardDrop();
    const first = game.getState();

    game.hardDrop();
    game.undo();

    expect(game.getState().board).toEqual(first.board);
    expect(game.getState().next).toEqual(first.next);

    game.undo();

    const after = game.getState();
    expect(after.board).toEqual(start.board);
    expect(after.next).toEqual(start.next);
    expect(after.active.type).toBe(start.active.type);
    expect(after.undosLeft).toBe(1);
  });

  it('reset clears the stack and fills the undos up again', () => {
    const game = createGame(() => 0.5);

    game.hardDrop();
    game.undo();
    expect(game.getState().undosLeft).toBe(2);

    game.reset();

    const after = game.getState();
    expect(after.undosLeft).toBe(3);
    expect(after.canUndo).toBe(false);

    game.undo();
    expect(game.getState().undosLeft).toBe(3);
  });

  it('keeps the board of the turn it restores to itself', () => {
    const game = createGame(() => 0.5);

    game.hardDrop();
    game.undo();
    game.hardDrop();

    // The piece that was taken back is on the board once, not twice.
    expect(filledCount(game.getState().board)).toBe(4);
  });
});
