import { UNDO_LIMIT } from '../logic/game';
import type { Game, GameState } from '../logic/game';
import type { BestScore } from './bestScore';
import { play } from './sound';

function shapeKey(state: GameState): string {
  return state.active.shape.map((row) => row.join('')).join('/');
}

function sameQueue(a: GameState, b: GameState): boolean {
  return a.next.length === b.next.length && a.next.every((type, i) => type === b.next[i]);
}

// Sounds come from comparing the previous and new game state, so a blocked
// move (state unchanged) never makes a sound.
function react(prev: GameState, next: GameState): void {
  const queueChanged = !sameQueue(prev, next);

  // A restart: a fresh game with all undos and nothing to take back.
  if (!next.canUndo && next.undosLeft === UNDO_LIMIT && queueChanged) {
    return;
  }

  if (next.undosLeft < prev.undosLeft) {
    play('undo');
    return;
  }

  // A hard drop spawns the next piece (the queue shifts and hold unlocks).
  // Holding also shifts the queue, but it leaves hold locked.
  const locked = queueChanged && !next.holdUsed;

  if (locked) {
    play('hardDrop', Math.max(0, prev.ghostY - prev.active.y));

    if (next.lastClear > 0) {
      play('lineClear', next.lastClear);
    }
  }

  if (prev.status === 'playing' && next.status === 'gameover') {
    play('gameOver');
    return;
  }

  if (locked) {
    return;
  }

  if (!prev.holdUsed && next.holdUsed) {
    play('hold');
    return;
  }

  if (next.status !== 'playing') {
    return;
  }

  if (next.active.type === prev.active.type) {
    if (shapeKey(prev) !== shapeKey(next)) {
      play('rotate');
      return;
    }

    if (prev.active.x !== next.active.x) {
      play('move');
    }
  }
}

export function createSoundEvents(game: Game, best: BestScore): () => void {
  let prev = game.getState();
  let lastBest = best.value();

  const stopGame = game.subscribe((state) => {
    react(prev, state);
    prev = state;
  });

  const stopBest = best.subscribe((value) => {
    if (value > lastBest) {
      play('newBest');
    }

    lastBest = value;
  });

  return () => {
    stopGame();
    stopBest();
  };
}