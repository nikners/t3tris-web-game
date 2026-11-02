import {
  baseShape,
  createBag,
  filledCellCount,
  PIECE_TYPES,
  rotateMatrix,
  TONE_TOKEN,
  trimShape,
} from './pieces';
import type { Cell } from './pieces';
import { describe, expect, it } from 'vitest';

function filledCells(shape: Cell[][]): string[] {
  const cells: string[] = [];

  shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell !== '.') {
        cells.push(`${x}:${y}`);
      }
    });
  });

  return cells.sort();
}

describe('pieces', () => {
  it('gives every tetromino exactly four cells', () => {
    for (const type of PIECE_TYPES) {
      expect(filledCellCount(baseShape(type))).toBe(4);
    }
  });

  it('names a tone token for each tetromino', () => {
    for (const type of PIECE_TYPES) {
      expect(TONE_TOKEN[type]).toMatch(/^--tone-[ijlostonz]$/);
    }
  });

  it('rotates a labelled matrix clockwise', () => {
    const shape: Cell[][] = [
      ['T', 'O'],
      ['J', 'L'],
    ];

    expect(rotateMatrix(shape, 1)).toEqual([
      ['J', 'T'],
      ['L', 'O'],
    ]);
  });

  it('rotates a labelled matrix counter-clockwise', () => {
    const shape: Cell[][] = [
      ['T', 'O'],
      ['J', 'L'],
    ];

    expect(rotateMatrix(shape, -1)).toEqual([
      ['O', 'L'],
      ['T', 'J'],
    ]);
  });

  it('turns the I piece from horizontal to vertical and back', () => {
    const horizontal = baseShape('I');
    const vertical = rotateMatrix(horizontal, 1);

    expect(filledCells(horizontal)).toEqual(['0:1', '1:1', '2:1', '3:1']);
    expect(filledCells(vertical)).toEqual(['2:0', '2:1', '2:2', '2:3']);
    expect(filledCells(rotateMatrix(vertical, -1))).toEqual(filledCells(horizontal));
  });

  it('keeps the O piece identical under rotation', () => {
    const square = baseShape('O');
    expect(filledCells(rotateMatrix(square, 1))).toEqual(filledCells(square));
  });

  it('returns every tetromino to its start after four turns', () => {
    for (const type of PIECE_TYPES) {
      let shape = baseShape(type);
      for (let turn = 0; turn < 4; turn++) {
        shape = rotateMatrix(shape, 1);
      }
      expect(filledCells(shape)).toEqual(filledCells(baseShape(type)));
    }
  });

  it('hands out each of the seven pieces once per bag', () => {
    const sources = [() => 0, () => 0.5, () => 0.99, () => 0.123456789];

    for (const rng of sources) {
      const bag = createBag(rng);

      expect([...bag].sort()).toEqual([...PIECE_TYPES].sort());
    }
  });

  it('shuffles differently for different randomness', () => {
    expect(createBag(() => 0)).not.toEqual(createBag(() => 0.5));
  });

  it('cuts the empty rows and columns off a shape', () => {
    expect(trimShape(baseShape('I'))).toEqual([['I', 'I', 'I', 'I']]);
    expect(trimShape(baseShape('T'))).toEqual([
      ['.', 'T', '.'],
      ['T', 'T', 'T'],
    ]);
    expect(trimShape(baseShape('O'))).toEqual([
      ['O', 'O'],
      ['O', 'O'],
    ]);
  });

  it('keeps every filled cell when trimming', () => {
    for (const type of PIECE_TYPES) {
      const shape = baseShape(type);
      const trimmed = trimShape(shape);

      expect(filledCellCount(trimmed)).toBe(filledCellCount(shape));
      expect(trimmed.flat().filter((cell) => cell !== '.')).toContain(type);
    }
  });

  it('trims an empty shape to nothing', () => {
    expect(trimShape([['.', '.'], ['.', '.']])).toEqual([]);
  });
});
