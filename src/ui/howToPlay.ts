import {
  hardDropIcon,
  holdIcon,
  inspectIcon,
  moveIcon,
  resetViewIcon,
  restartIcon,
  rotateCcwIcon,
  rotateCwIcon,
  undoIcon,
  soundIcon,
  viewSnapIcon,
  patternsIcon,
} from './icons';
import { createSectionTypewriter } from './typewriter';

const EYEBROW = 'HOW TO PLAY';
const HEADLINE = 'No timers, just placement';

interface Binding {
  /** The key label, shown as a keycap. */
  key: string;
  /** What the key does. */
  action: string;
  /** The icon that stands for the action. */
  icon: () => SVGSVGElement;
}

const BINDINGS: Binding[] = [
  { key: '← / A', action: 'Move left', icon: moveIcon },
  { key: '→ / D', action: 'Move right', icon: moveIcon },
  { key: '↑ / W', action: 'Rotate clockwise', icon: rotateCwIcon },
  { key: '↓ / S', action: 'Rotate counter-clockwise', icon: rotateCcwIcon },
  { key: 'Space / Enter', action: 'Hard drop', icon: hardDropIcon },
  { key: 'C / Shift', action: 'Hold piece', icon: holdIcon },
  { key: 'U', action: 'Undo last drop', icon: undoIcon },
  { key: 'R', action: 'Restart game', icon: restartIcon },
  { key: 'Tab / Esc', action: 'Toggle inspect mode', icon: inspectIcon },
  { key: '0', action: 'Reset piece view', icon: resetViewIcon },
  {
    key: '1 / 2 / 3 / 4',
    action: 'Snap view: front / top / side / iso',
    icon: viewSnapIcon,
  },
  { key: 'P', action: 'Toggle patterns', icon: patternsIcon },
  { key: 'M', action: 'Toggle sound', icon: soundIcon },
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
    'In T3TRIS, spawn a piece, then take your time. Nothing falls on a clock. Move and rotate until the ghost outline sits where you want it, hard drop to lock, then clear lines and take the next piece.';

  const list = document.createElement('ol');
  list.className = 'steps';

  for (const binding of BINDINGS) {
    const item = document.createElement('li');
    item.className = 'steps__item';

    // The key itself, as a keycap next to the action.
    const keyEl = document.createElement('span');
    keyEl.className = 'keycap';
    keyEl.textContent = binding.key;

    const text = document.createElement('p');
    text.className = 'steps__action';
    text.textContent = binding.action;

    // The icon sits at the far end of the row.
    const box = document.createElement('span');
    box.className = 'icon-box';
    box.append(binding.icon());

    item.append(keyEl, text, box);
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
