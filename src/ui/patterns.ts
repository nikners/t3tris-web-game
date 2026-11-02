const STORAGE_KEY = 't3tris.patterns';

type Listener = (enabled: boolean) => void;

const listeners = new Set<Listener>();

let enabled = false;

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

// Initialize from storage
enabled = readStored();

export function get(): boolean {
  return enabled;
}

export function set(value: boolean): void {
  if (enabled === value) {
    return;
  }
  enabled = value;
  writeStored(enabled);
  for (const listener of listeners) {
    listener(enabled);
  }
}

export function toggle(): boolean {
  set(!enabled);
  return enabled;
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
