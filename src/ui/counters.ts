import type { Game } from '../logic/game';
import type { GameState } from '../logic/game';
import type { BestScore } from './bestScore';

export function createCounters(game: Game, best: BestScore): HTMLElement {
  const root = document.createElement('div');
  root.className = 'counters';

  const score = item('SCORE');
  const record = item('BEST');
  const lines = item('LINES');
  const level = item('LEVEL');

  // The four items are appended by item() below, each one holding its label
  // above its value.

  function pop(value: HTMLSpanElement, text: string): void {
    if (value.textContent === text) {
      return;
    }

    value.textContent = text;

    // Re-trigger the pop animation even when the value changes back-to-back.
    value.classList.remove('counters__value--pop');
    void value.offsetWidth;
    value.classList.add('counters__value--pop');
  }

  function render(state: GameState): void {
    pop(score.value, String(state.score).padStart(6, '0'));
    pop(record.value, String(best.value()).padStart(6, '0'));
    pop(lines.value, String(state.lines).padStart(2, '0'));
    pop(level.value, String(state.level));
  }

  game.subscribe(render);
  // A finished game can change the best, which the counter shows too.
  best.subscribe(() => render(game.getState()));
  render(game.getState());
  return root;

  function item(label: string): { label: HTMLSpanElement; value: HTMLSpanElement } {
    const container = document.createElement('div');
    container.className = 'counters__item';

    const labelEl = document.createElement('span');
    labelEl.className = 'counters__label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'counters__value';
    valueEl.textContent = '0';

    container.append(labelEl, valueEl);
    root.append(container);

    return { label: labelEl, value: valueEl };
  }
}
