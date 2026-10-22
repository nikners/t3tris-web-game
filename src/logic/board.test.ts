import {
  clearLines,
  collides,
  createBoard,
  dropY,
  merge,
  moveX,
  rotate,
} from './board';
import type { Board } from './board';
import { baseShape } from './pieces';
import type { Cell, Matrix } from './pieces';
import { describe, expect, it } from 'vitest';

const WALL = 10;
const FLOOR = 20;
const BLOCK: Cell = 'T';

function boardFromRows(rows: Array<{ y: number; from: number; to: number; type?: Cell }>): Board {
  let board = createBoard();

  for (const row of rows) {
    for (let x = row.from; x < row.to; x++) {
      board = merge(board, [[row.type ?? BLOCK]], x, row.y);
    }
  }

  return board;
}

describe('board', () => {
  it('starts empty with a 10x20 grid', () => {
    const board = createBoard();

    expect(board).toHaveLength(FLOOR);
    expect(board.every((row) => row.length === WALL)).toBe(true);
    expect(board.every((row) => row.every((cell) => cell === '.'))).toBe(true);
  });

  it('blocks the left wall', () => {
    const square: Matrix = [
      ['T', 'T'],
      ['T', 'T'],
    ];

    expect(collides(createBoard(), square, -1, 0)).toBe(true);
    expect(collides(createBoard(), square, 0, 0)).toBe(false);
  });

  it('blocks the right wall', () => {
    const square: Matrix = [
      ['T', 'T'],
      ['T', 'T'],
    ];

    expect(collides(createBoard(), square, WALL - 1, 0)).toBe(true);
    expect(collides(createBoard(), square, WALL - 2, 0)).toBe(false);
  });

  it('blocks the floor', () => {
    const single: Matrix = [[BLOCK]];

    expect(collides(createBoard(), single, 0, FLOOR)).toBe(true);
    expect(collides(createBoard(), single, 0, FLOOR - 1)).toBe(false);
  });

  it('leaves the top open so pieces can sit above the board', () => {
    const single: Matrix = [[BLOCK]];

    expect(collides(createBoard(), single, 0, -5)).toBe(false);

    const column: Matrix = [
      ['I'],
      ['I'],
      ['I'],
      ['I'],
    ];

    expect(collides(createBoard(), column, 2, -3)).toBe(false);
  });

  it('detects overlap with placed cells', () => {
    const board = boardFromRows([{ y: 5, from: 5, to: 6 }]);

    expect(collides(board, [[BLOCK]], 5, 5)).toBe(true);
    expect(collides(board, [[BLOCK]], 4, 5)).toBe(false);
  });

  it('writes only the on-board part of a piece that sits above the top', () => {
    const square: Matrix = [
      ['O', 'O'],
      ['O', 'O'],
    ];

    const board = merge(createBoard(), square, 0, -1);

    expect(board).toHaveLength(FLOOR);
    expect(board[0][0]).toBe('O');
    expect(board[0][1]).toBe('O');
    expect(board[1].every((cell) => cell === '.')).toBe(true);
  });

  it('removes a single completed line', () => {
    const board = boardFromRows([{ y: 0, from: 0, to: 10 }, { y: FLOOR - 1, from: 0, to: 10 }]);

    const result = clearLines(board);

    expect(result.rows).toEqual([0, FLOOR - 1]);
    expect(result.board).toHaveLength(FLOOR);
    expect(result.board.every((row) => row.every((cell) => cell === '.'))).toBe(true);
  });

  it('shifts the stack down when a line clears', () => {
    const floor = boardFromRows([{ y: FLOOR - 1, from: 0, to: 10 }]);
    const marked = merge(floor, [['O']], 0, FLOOR - 2);

    const result = clearLines(marked);

    expect(result.rows).toEqual([FLOOR - 1]);
    expect(result.board[FLOOR - 1][0]).toBe('O');
    expect(result.board[FLOOR - 2][0]).toBe('.');
    expect(result.board[0].every((cell) => cell === '.')).toBe(true);
  });

  it('leaves the board untouched when no line is complete', () => {
    const board = boardFromRows([{ y: 3, from: 0, to: 9 }]);

    const result = clearLines(board);

    expect(result.rows).toEqual([]);
    expect(result.board).toEqual(board);
    expect(result.board).not.toBe(board);
  });

  it('moves sideways until a wall stops it', () => {
    const board = createBoard();

    expect(moveX(board, [[BLOCK]], 0, 0, -1)).toBeNull();
    expect(moveX(board, [[BLOCK]], 0, 0, 1)).toBe(1);
  });

  it('lands every piece on the floor of an empty board', () => {
    const board = createBoard();

    expect(dropY(board, baseShape('T'), 3, 0)).toBe(FLOOR - 2);
    expect(dropY(board, baseShape('I'), 3, 0)).toBe(FLOOR - 2);
    expect(dropY(board, baseShape('O'), 4, 0)).toBe(FLOOR - 2);
  });

  it('drops onto the top of a stack', () => {
    const board = boardFromRows([{ y: FLOOR - 1, from: 0, to: WALL }]);

    expect(dropY(board, [[BLOCK]], 0, 0)).toBe(FLOOR - 2);
  });

  it('rotates a wide bar into a tall column in the middle of the board', () => {
    const bar: Matrix = [
      ['T', 'T', 'T', 'T'],
    ];

    const turned = rotate(createBoard(), bar, 3, 0, 1);

    expect(turned).toEqual({
      shape: [
        ['T'],
        ['T'],
        ['T'],
        ['T'],
      ],
      x: 3,
      y: 0,
    });
  });

  it('kicks a tall piece two cells left so it can turn against the right wall', () => {
    const column: Matrix = [
      ['T'],
      ['T'],
      ['T'],
      ['T'],
    ];

    expect(rotate(createBoard(), column, WALL - 1, 16, 1)).toBeNull();

    const turned = rotate(createBoard(), column, WALL - 2, 16, 1);

    expect(turned?.x).toBe(WALL - 4);
    expect(turned?.y).toBe(16);
    expect(turned?.shape).toEqual([
      ['T', 'T', 'T', 'T'],
    ]);
  });

  it('kicks a wide piece up so it can turn on the floor', () => {
    const bar: Matrix = [
      ['T', 'T', 'T', 'T'],
    ];

    const turned = rotate(createBoard(), bar, 0, FLOOR - 3, 1);

    expect(turned?.y).toBe(FLOOR - 4);
    expect(turned?.x).toBe(0);
    expect(turned?.shape).toEqual([
      ['T'],
      ['T'],
      ['T'],
      ['T'],
    ]);
  });

  it('refuses a rotation that still collides after every kick', () => {
    const stack = boardFromRows(
      Array.from({ length: FLOOR - 2 }, (_, y) => ({ y, from: 0, to: WALL })),
    );

    expect(rotate(stack, [['T', 'T', 'T', 'T']], 0, FLOOR - 2, 1)).toBeNull();
  });
});
