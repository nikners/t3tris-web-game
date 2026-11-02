import { get, set } from './patterns';

export interface PatternsToggle {
  element: HTMLButtonElement;
}

export function createPatternsToggle(): PatternsToggle {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cta';
  const label = document.createElement('span');
  label.textContent = 'PATTERNS';
  button.append(label);

  const state = document.createElement('span');
  state.className = 'undo__count';
  button.append(state);

  function apply(): void {
    const on = get();
    state.textContent = on ? 'ON' : 'OFF';
    button.setAttribute('aria-pressed', String(on));
  }

  button.addEventListener('click', () => {
    set(!get());
    apply();
    button.blur();
  });

  apply();

  return { element: button };
}
