// The game gets a section of its own: a full-height band with the board in
// it, so the board always has a screen to itself and never has to scroll
// inside the page.
//
// The section also reports whether the board is on screen. The game keys only
// own the keyboard while the board is visible, so the page keeps scrolling
// normally everywhere else.
import { createSectionTypewriter } from './typewriter';

const PLAY_LABEL = 'START GAME';

export interface PlaySection {
  element: HTMLElement;
  /** True while the board is on screen. */
  isInView(): boolean;
}
export interface PlaySectionOptions {
  stage: HTMLElement;
  holdCard: HTMLElement;
  nextCard: HTMLElement;
  inspectButton: HTMLElement;
  /** The view-snap row: shown only while inspect mode is on. */
  snapRow: HTMLElement;
  undoButton: HTMLElement;
  counters: HTMLElement;
  soundToggle: HTMLElement;
  patternsToggle?: HTMLElement;
}

/** How much of the board has to be on screen before it owns the keyboard. */
const HALF_VISIBLE = 0.5;

/** The keys that drive the board, shown as a row of keycaps. */
const KEY_HINTS: Array<[string, string]> = [
  ['← →', 'Move'],
  ['↑ ↓', 'Rotate'],
  ['Space', 'Drop'],
  ['C', 'Hold'],
  ['U', 'Undo'],
  ['1-4', 'Snap view'],
  ['P', 'Patterns'],
  ['M', 'Sound'],
];

export function createPlaySection({
  stage,
  holdCard,
  nextCard,
  inspectButton,
  snapRow,
  undoButton,
  counters,
  soundToggle,
  patternsToggle,
}: PlaySectionOptions): PlaySection {
  const section = document.createElement('section');
  section.className = 'section play container';
  section.id = 'play';

  const label = document.createElement('h2');
  label.className = 'play__label';
  label.textContent = PLAY_LABEL;

  const bar = document.createElement('div');
  bar.className = 'play__bar';
  if (patternsToggle) {
    bar.append(inspectButton, snapRow, undoButton, counters, soundToggle, patternsToggle);
  } else {
    bar.append(inspectButton, snapRow, undoButton, counters, soundToggle);
  }

  // The hold and next cards stand together next to the board.
  const cards = document.createElement('div');
  cards.className = 'play__cards';
  cards.append(holdCard, nextCard);

  // The board and the cards share a row. On a phone the cards move above
  // the board.
  const board = document.createElement('div');
  board.className = 'play__board';
  board.append(stage, cards);

  section.append(label, board, createKeyHints(), bar);

  // The label types itself in whenever the board takes the spotlight.
  createSectionTypewriter(section, [{ element: label, text: PLAY_LABEL, expose: 'label' }]);

  let inView = false;

  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // The board counts as on screen once half of it is visible, so the
          // keys are only taken while the player can actually see the game.
          inView = entry.intersectionRatio >= HALF_VISIBLE;
        }
      },
      { threshold: HALF_VISIBLE },
    );

    observer.observe(stage);
  }

  return {
    element: section,
    isInView: () => inView,
  };
}

/** A row of keycaps, so the keys are known without reading the page. */
function createKeyHints(): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'play__keys';
  list.setAttribute('aria-label', 'Keyboard controls');

  for (const [key, action] of KEY_HINTS) {
    const item = document.createElement('li');
    item.className = 'play__key';

    const keyEl = document.createElement('span');
    keyEl.className = 'keycap';
    keyEl.textContent = key;

    const actionEl = document.createElement('span');
    actionEl.className = 'play__key-action';
    actionEl.textContent = action;

    item.append(keyEl, actionEl);
    list.append(item);
  }

  return list;
}
