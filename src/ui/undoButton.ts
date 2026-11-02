import type { Game, GameState } from '../logic/game';
import { undoIcon } from './icons';

export interface UndoButton {
  element: HTMLButtonElement;
}

/**
 * The undo button under the board. It shows how many undos are left and
 * sits out when there is nothing to take back.
 */
export function createUndoButton(game: Game): UndoButton {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cta';
  button.append(undoIcon());

  const label = document.createElement('span');
  label.textContent = 'UNDO';
  button.append(label);

  // The number of undos that are left.
  const count = document.createElement('span');
  count.className = 'undo__count';
  button.append(count);

  button.addEventListener('click', () => {
    game.undo();

    // The focus goes back to the page, so the next Space press is a hard
    // drop instead of another undo.
    button.blur();
  });

  function update(state: GameState): void {
    const left = state.undosLeft;

    count.textContent = String(left);
    // No undos left, or no turn to take back: the button sits out.
    button.disabled = left === 0 || !state.canUndo;
    button.setAttribute('aria-label', `Undo the last drop, ${left} left`);
  }

  game.subscribe(update);
  update(game.getState());

  return { element: button };
}
