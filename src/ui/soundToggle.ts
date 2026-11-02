import { soundIcon } from './icons';
import { play, setMuted } from './sound';

const STORAGE_KEY = 't3tris.sound';

export interface SoundToggle {
  element: HTMLButtonElement;
  on: () => boolean;
}

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeStored(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    // Storage blocked: the toggle still works, it just won't survive a reload.
  }
}

export function createSoundToggle(): SoundToggle {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toggle sound-toggle';
  button.append(soundIcon());

  const label = document.createElement('span');
  label.textContent = 'SOUND';
  button.append(label);

  const state = document.createElement('span');
  state.className = 'toggle__state';
  button.append(state);

  let enabled = readStored();

  function apply(): void {
    setMuted(!enabled);
    state.textContent = enabled ? 'ON' : 'OFF';
    button.setAttribute('aria-pressed', String(enabled));
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    writeStored(enabled);
    apply();
    button.blur();

    if (enabled) {
      // Small confirmation blip once the audio context is running.
      window.setTimeout(() => play('hold'), 120);
    }
  });

  apply();

  return { element: button, on: () => enabled };
}