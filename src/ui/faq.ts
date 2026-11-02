import { createSectionTypewriter } from './typewriter';

const EYEBROW = 'FAQ';
const HEADLINE = 'Questions, answered';

const QUESTIONS: Array<[string, string]> = [
  [
    'Is there a time limit?',
    'No. T3TRIS has no timer and no gravity — a piece spawns, hangs in place, and stays there until you move it, tilt it in inspect mode and then hard-drop it to lock.',
  ],
  [
    'When does the game end?',
    'Only when a new piece cannot spawn at the top of the well because the stack already blocks it.',
  ],
  [
    'What does inspecting do?',
    'It lets you orbit, tilt and zoom the active 3D model. The tilt is visual only — placement still happens on the classic 2D grid.',
  ],
  [
    'What does holding do?',
    'Pressing C or Shift puts the piece you are holding aside and brings the next one in. You can swap the two once per piece, and the held piece comes back in its default rotation at the top of the well.',
  ],
  [
    'Can I take a drop back?',
    'Yes — press U (or use the UNDO button under the board) and the piece you just dropped comes back to where it was, with the board and the pieces that are coming exactly as they were. You get three undos per game, and a drop that ended the game can be taken back too.',
  ],
  [
    'How are lines cleared?',
    'Fill a row completely and it vanishes, scoring points. Multiple lines at once score more.',
  ],
  [
    'Can I snap the view to a preset angle while inspecting?',
    'Yes — while inspecting, press 1 for front, 2 for top, 3 for side, or 4 for iso. The view eases to that angle, and you can still drag and zoom after a snap. Press 0 to reset to the default front view.',
  ],
  [
    'Can I turn the sound on or off?',
    'Yes — press M or use the SOUND button under the board to toggle the sound on and off. The setting is saved between visits. When it is off, nothing is played.',
  ],
  [
    'What are colorblind patterns?',
    'Press P or use the PATTERNS button under the board to add simple markings to each piece and locked block. The setting is saved between visits.',
  ],
  [
    'Which keys control the piece?',
    'Arrows or A/D move, W or Up rotates clockwise, S or Down rotates counter-clockwise, Space or Enter hard-drops, C or Shift holds the piece, U undoes the last drop, R restarts, Tab or Escape toggles inspect mode, 0 resets the piece view, 1/2/3/4 snap the inspect view, P toggles patterns, and M toggles sound.',
  ],
];

export function createFaq(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section container stack';
  section.id = 'faq';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = EYEBROW;

  const headline = document.createElement('h2');
  headline.className = 'headline';
  headline.textContent = HEADLINE;

  const list = document.createElement('div');
  list.className = 'faq';

  for (const [question, answer] of QUESTIONS) {
    const item = document.createElement('details');
    item.className = 'faq__item';

    const trigger = document.createElement('summary');
    trigger.className = 'faq__trigger';
    trigger.textContent = question;

    const answerEl = document.createElement('p');
    answerEl.className = 'faq__answer';
    answerEl.textContent = answer;

    item.append(trigger, answerEl);
    list.append(item);
  }

  section.append(eyebrow, headline, list);

  // The heading types itself in whenever the section takes the spotlight.
  // The questions and their answers stay as they are.
  createSectionTypewriter(section, [
    { element: eyebrow, text: EYEBROW, expose: 'copy' },
    { element: headline, text: HEADLINE, expose: 'label' },
  ]);

  return section;
}
