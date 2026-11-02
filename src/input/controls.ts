import type { Scene } from '../render/scene';
import type { ViewSnap } from '../render/pieceMesh';
import type { Game } from '../logic/game';
import type { SoundToggle } from '../ui/soundToggle';
import * as patterns from '../ui/patterns';

export interface ControlsOptions {
  surface: HTMLElement;
  game: Game;
  scene: Scene;
  owner?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  inspectToggle?: HTMLElement;
  soundToggle?: SoundToggle;
  /**
   * Whether the board is on screen. While it is not, the page keeps its own
   * keyboard behaviour and scrolls normally.
   */
  isInView?: () => boolean;
  /**
   * Reports inspect mode changes, so the UI around the board (the view-snap
   * buttons) can show itself only while inspecting.
   */
  onInspectChange?: (on: boolean) => void;
}
export interface Controls {
  dispose(): void;
  isInspecting(): boolean;
}

const MOVE_LEFT = new Set(['ArrowLeft', 'KeyA']);

const MOVE_RIGHT = new Set(['ArrowRight', 'KeyD']);

const ROTATE_CW = new Set(['ArrowUp', 'KeyW']);

const ROTATE_CCW = new Set(['ArrowDown', 'KeyS']);

const HARD_DROP = new Set(['Space', 'Enter']);

const HOLD = new Set(['KeyC', 'ShiftLeft', 'ShiftRight']);

const UNDO = new Set(['KeyU']);

const SOUND = new Set(['KeyM']);

const PATTERNS = new Set(['KeyP']);

const RESET_GAME = new Set(['KeyR']);

const TOGGLE_INSPECT = new Set(['Tab', 'Escape']);

const RESET_VIEW = new Set(['Digit0', 'Numpad0']);

// The inspect view snaps: keys 1-4 while inspect mode is on. Outside
// inspect mode the digits are not ours, so they are looked up but ignored.
const VIEW_SNAPS: Record<string, ViewSnap> = {
  Digit1: 'FRONT',
  Digit2: 'TOP',
  Digit3: 'SIDE',
  Digit4: 'ISO',
  Numpad1: 'FRONT',
  Numpad2: 'TOP',
  Numpad3: 'SIDE',
  Numpad4: 'ISO',
};

const INTERACTIVE_TAGS = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY'];

const TEXT_ENTRY_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && INTERACTIVE_TAGS.includes(target.tagName);
}

// A text field keeps every key for itself, so typing never drives the board.
function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && TEXT_ENTRY_TAGS.includes(target.tagName);
}

export function createControls(options: ControlsOptions): Controls {
  const { surface, game, scene, owner = window, inspectToggle, soundToggle } = options;
  const isInView = options.isInView ?? (() => true);

  let inspecting = false;
  let dragging: { x: number; y: number } | null = null;

  function setInspecting(next: boolean): void {
    inspecting = next;
    scene.setInspecting(next);
    inspectToggle?.setAttribute('aria-pressed', String(next));
    options.onInspectChange?.(next);
  }

  function toggleInspect(): void {
    setInspecting(!inspecting);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!inspecting) {
      return;
    }

    surface.setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) {
      return;
    }

    scene.applyTilt(event.clientX - dragging.x, event.clientY - dragging.y);
    dragging = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent): void {
    if (!dragging) {
      return;
    }

    dragging = null;

    if (surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }
  }

  function onWheel(event: WheelEvent): void {
    if (!inspecting || event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    scene.applyZoom(-Math.sign(event.deltaY));
  }

  function onKeyDown(event: KeyboardEvent): void {
    const code = event.code;

    if (isInteractive(event.target) && (code === 'Space' || code === 'Enter')) {
      return;
    }

    // A text field owns its keys.
    if (isTextEntry(event.target)) {
      return;
    }

    // The board is off screen, so the page keeps scrolling with the game
    // keys instead of the game swallowing them.
    if (!isInView()) {
      return;
    }

    // Inspect toggles stay available during the drop animation; only piece
    // actions are frozen until the slide/squash finishes.
    if (scene.isDropping() && !HARD_DROP.has(code) && !TOGGLE_INSPECT.has(code) && !RESET_VIEW.has(code) && !SOUND.has(code) && !PATTERNS.has(code)) {
      return;
    }

    // Every piece action waits for the hard-drop animation to end so keys
    // pressed mid-slide do not move the newly spawned piece. Hard drop itself
    // may still be pressed (logic treats it as instant, animation restarts).
    if (scene.isDropping() && !HARD_DROP.has(code)) {
      return;
    }

    if (MOVE_LEFT.has(code)) {
      event.preventDefault();
      game.move(-1);
      return;
    }

    if (MOVE_RIGHT.has(code)) {
      event.preventDefault();
      game.move(1);
      return;
    }

    if (ROTATE_CW.has(code)) {
      event.preventDefault();
      game.rotate(1);
      return;
    }

    if (ROTATE_CCW.has(code)) {
      event.preventDefault();
      game.rotate(-1);
      return;
    }

    if (HARD_DROP.has(code)) {
      event.preventDefault();
      game.hardDrop();
      return;
    }

    // Holding puts the piece aside. It is a piece action, so it waits for
    // the drop animation just like the other ones. Only the letter key is
    // prevented: Shift on its own scrolls nothing, and it must not take
    // Shift+Tab away from the focus.
    if (HOLD.has(code)) {
      if (code === 'KeyC') {
        event.preventDefault();
      }

      game.hold();
      return;
    }

    // Undo takes the last drop back. It is a piece action, so it waits for
    // the drop animation just like the other ones. The key scrolls nothing,
    // but it is held down all the same.
    if (UNDO.has(code)) {
      event.preventDefault();
      game.undo();
      return;
    }

    if (SOUND.has(code)) {
      event.preventDefault();
      soundToggle?.element.click();
      return;
    }

    if (PATTERNS.has(code)) {
      event.preventDefault();
      patterns.toggle();
      return;
    }

    if (RESET_GAME.has(code)) {
      event.preventDefault();
      game.reset();
      return;
    }

    if (TOGGLE_INSPECT.has(code)) {
      event.preventDefault();
      toggleInspect();
      return;
    }

    if (RESET_VIEW.has(code)) {
      event.preventDefault();
      scene.resetView();
      return;
    }

    // The view snaps only apply while inspecting; outside inspect mode the
    // digit keys are left entirely alone (no preventDefault, no effect).
    const snap = VIEW_SNAPS[code];

    if (snap !== undefined && inspecting) {
      event.preventDefault();
      scene.snapView(snap);
    }
  }

  function onToggleClick(): void {
    toggleInspect();
  }

  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointercancel', onPointerUp);
  surface.addEventListener('wheel', onWheel, { passive: false });
  owner.addEventListener('keydown', onKeyDown);
  inspectToggle?.addEventListener('click', onToggleClick);
  soundToggle?.element.addEventListener('click', () => {
    soundToggle?.element.blur();
  });

  function dispose(): void {
    surface.removeEventListener('pointerdown', onPointerDown);
    surface.removeEventListener('pointermove', onPointerMove);
    surface.removeEventListener('pointerup', onPointerUp);
    surface.removeEventListener('pointercancel', onPointerUp);
    surface.removeEventListener('wheel', onWheel);
    owner.removeEventListener('keydown', onKeyDown);
    inspectToggle?.removeEventListener('click', onToggleClick);
    soundToggle?.element.removeEventListener('click', () => {});
    dragging = null;
  }

  return {
    dispose,
    isInspecting: () => inspecting,
  };
}
