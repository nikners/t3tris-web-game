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
  inspectButton: HTMLElement;
  counters: HTMLElement;
}

/** How much of the board has to be on screen before it owns the keyboard. */
const HALF_VISIBLE = 0.5;

export function createPlaySection({ stage, inspectButton, counters }: PlaySectionOptions): PlaySection {
  const section = document.createElement('section');
  section.className = 'section play container';
  section.id = 'play';

  const label = document.createElement('h2');
  label.className = 'play__label';
  label.textContent = PLAY_LABEL;

  const bar = document.createElement('div');
  bar.className = 'play__bar';
  bar.append(inspectButton, counters);

  section.append(label, stage, bar);

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
