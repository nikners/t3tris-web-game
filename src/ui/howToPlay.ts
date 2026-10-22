import type { IconName } from './icons';
import { icon } from './icons';
import { createSectionTypewriter } from './typewriter';

const EYEBROW = 'HOW TO PLAY';
const HEADLINE = 'No timers, just placement';

const BINDINGS: Array<{ key: string; action: string }> = [
  { key: '← / A', action: 'Move left' },
  { key: '→ / D', action: 'Move right' },
  { key: '↑ / W', action: 'Rotate clockwise' },
  { key: '↓ / S', action: 'Rotate counter-clockwise' },
  { key: 'Space / Enter', action: 'Hard drop' },
  { key: 'R', action: 'Restart game' },
  { key: 'Tab / Esc', action: 'Toggle inspect mode' },
  { key: '0', action: 'Reset piece view' },
];

export function createHowToPlay(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section container stack';
  section.id = 'how-to-play';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = EYEBROW;

  const headline = document.createElement('h2');
  headline.className = 'headline';
  headline.textContent = HEADLINE;

  const intro = document.createElement('p');
  intro.className = 'lede';
  intro.textContent =
    'Spawn a piece, then take your time. Nothing falls on a clock. Move and rotate until the ghost outline sits where you want it, hard drop to lock, then clear lines and take the next piece.';

  const list = document.createElement('ol');
  list.className = 'steps';

  for (const binding of BINDINGS) {
    const item = document.createElement('li');
    item.className = 'steps__item';

    const keyEl = document.createElement('span');
    keyEl.className = 'steps__key';
    keyEl.textContent = binding.key;

    const text = document.createElement('p');
    text.textContent = binding.action;

    item.append(buildIconBox(keyIcon(binding.key)), keyEl, text);
    list.append(item);
  }

  section.append(eyebrow, headline, intro, list);

  // The heading types itself in whenever the section takes the spotlight.
  // The long intro and the key list stay as they are.
  createSectionTypewriter(section, [
    { element: eyebrow, text: EYEBROW, expose: 'copy' },
    { element: headline, text: HEADLINE, expose: 'label' },
  ]);

  return section;
}

function keyIcon(key: string): IconName {
  if (key === 'Space / Enter') return 'drop';
  if (key === 'R') return 'drop';
  if (key === 'Tab / Esc') return 'inspect';
  if (key === '0') return 'rotate';
  if (key === '↑ / W' || key === '↓ / S') return 'rotate';
  return 'move';
}

function buildIconBox(glyph: IconName): HTMLElement {
  const box = document.createElement('span');
  box.className = 'icon-box icon-box--ink';
  box.append(icon(glyph));
  return box;
}
