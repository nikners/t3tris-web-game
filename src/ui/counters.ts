import type { Game } from '../logic/game';
import type { GameState } from '../logic/game';

export function createCounters(game: Game): HTMLElement {
  const root = document.createElement('div');
  root.className = 'counters';

  const score = item('SCORE');
  const lines = item('LINES');
  const level = item('LEVEL');

  root.append(score.label, score.value, lines.label, lines.value, level.label, level.value);

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
    pop(lines.value, String(state.lines).padStart(2, '0'));
    pop(level.value, String(state.level));
  }

  game.subscribe(render);
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
