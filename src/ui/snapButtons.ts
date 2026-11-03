// The row of view-snap buttons for inspect mode: four small buttons (keys
// 1-4) that ease the active piece to a preset pose, plus a live label that
// names the piece being inspected.
//
// The row only exists on screen while inspect mode is on; controls.ts reports
// that through onInspectChange, and this module just shows or hides itself.
import type { Game } from '../logic/game';
import type { ViewSnap } from '../render/pieceMesh';

export interface SnapButtonsOptions {
  game: Game;
  /** Snaps the scene to the chosen preset. */
  onSnap: (snap: ViewSnap) => void;
}

export interface SnapButtons {
  element: HTMLElement;
  /** Shows the row while inspect mode is on, hides it when it is off. */
  setInspecting(on: boolean): void;
}

const SNAPS: Array<{ key: string; snap: ViewSnap; name: string }> = [
  { key: '1', snap: 'FRONT', name: 'front' },
  { key: '2', snap: 'TOP', name: 'top' },
  { key: '3', snap: 'SIDE', name: 'side' },
  { key: '4', snap: 'ISO', name: 'iso' },
];

export function createSnapButtons({ game, onSnap }: SnapButtonsOptions): SnapButtons {
  const row = document.createElement('div');
  row.className = 'snap-row';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Snap the inspect view');
  row.hidden = true;

  for (const { key, snap, name } of SNAPS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'snap-row__btn';
    button.textContent = key;
    button.setAttribute('aria-label', `View: ${name} (key ${key})`);
    button.addEventListener('click', () => {
      onSnap(snap);
      button.blur();
    });
    row.append(button);
  }

  // The name of the piece under the lens, announced politely whenever it
  // changes (the piece under inspection can still move while inspecting).
  const piece = document.createElement('span');
  piece.className = 'snap-row__piece';
  piece.setAttribute('aria-live', 'polite');
  row.append(piece);

  const syncPiece = (): void => {
    const label = `${game.getState().active.type}-PIECE`;

    // The piece only changes when a new one spawns, so the label is rewritten
    // only then — not on every move and turn.
    if (piece.textContent !== label) {
      piece.textContent = label;
    }
  };
  syncPiece();
  game.subscribe(syncPiece);

  return {
    element: row,
    setInspecting(on) {
      row.hidden = !on;
    },
  };
}
