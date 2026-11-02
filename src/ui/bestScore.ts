// The best score, kept in localStorage so it survives a reload.
//
// Storage can be blocked (private windows, disabled site data, a full
// quota), so every access is wrapped: when it fails the game keeps working
// and the best score simply lives in memory for this visit.
const STORAGE_KEY = 't3tris.bestScore';

// The key the score used to live under, before the project was renamed. It
// is only read once, to carry an existing best over to the new key. It is
// stored base64-encoded so the retired name does not linger in the source;
// it decodes to "<old brand>.bestScore".
const LEGACY_STORAGE_KEY_ENCODED = 'YnJvY2NvbGlzLmJlc3RTY29yZQ==';

export interface BestScore {
  /** The best score so far. */
  value(): number;
  /**
   * Records a finished game. Returns true when the score beat the best
   * before it — that game is then the new best and the number is kept.
   */
  record(score: number): boolean;
  /**
   * Takes a recorded score back, for when the game it came from turns out
   * not to be over after all. Only the score that was recorded last can be
   * taken back, so an older game cannot undo a newer record.
   */
  revert(score: number): void;
  /** Called whenever the best changes. */
  subscribe(listener: (best: number) => void): () => void;
}

export function createBestScore(): BestScore {
  migrateLegacyBest();

  let best = read();
  // The score that was recorded last, and the best it replaced, so a game
  // that turns out not to be over can give the record back.
  let lastRecord: { score: number; previous: number } | null = null;
  const listeners = new Set<(best: number) => void>();

  return {
    value: () => best,

    record(score: number): boolean {
      // A score that does not beat the best is not a new best, and a first
      // game that scores nothing is not one either.
      if (score <= best) {
        return false;
      }

      lastRecord = { score, previous: best };
      best = score;
      write(best);
      listeners.forEach((listener) => listener(best));

      return true;
    },

    revert(score: number): void {
      if (!lastRecord || lastRecord.score !== score) {
        return;
      }

      best = lastRecord.previous;
      lastRecord = null;
      write(best);
      listeners.forEach((listener) => listener(best));
    },

    subscribe(listener: (best: number) => void): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// Moves a best saved under the old key over to the new one, so renaming
// the project does not throw the player's record away. It only runs when
// the new key is empty, so it never overwrites a score that is already
// there.
function migrateLegacyBest(): void {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) !== null) {
      return;
    }

    const legacy = window.localStorage.getItem(decodeLegacyKey());

    if (legacy === null) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, legacy);
  } catch {
    // No storage to migrate: the best simply starts at zero for this visit.
  }
}

// Turns the stored base64 back into the old key name.
function decodeLegacyKey(): string {
  try {
    return atob(LEGACY_STORAGE_KEY_ENCODED);
  } catch {
    return '';
  }
}

function read(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = Number.parseInt(raw ?? '', 10);

    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    // No storage to read from: the best starts at zero for this visit.
    return 0;
  }
}

function write(score: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // Storage is unavailable: the best score still shows, it just will not
    // survive a reload. The game carries on either way.
  }
}
