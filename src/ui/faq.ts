import { createSectionTypewriter } from './typewriter';

const EYEBROW = 'FAQ';
const HEADLINE = 'Questions, answered';

const QUESTIONS: Array<[string, string]> = [
  [
    'Is there a time limit?',
    'No. There is no timer and no gravity — a piece spawns, hangs in place, and stays there until you move it, tilt it in inspect mode and then hard-drop it to lock.',
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
    'Which keys control the piece?',
    'Arrows or A/D move, W or Up rotates clockwise, S or Down rotates counter-clockwise, Space or Enter hard-drops, R restarts, Tab or Escape toggles inspect mode, and 0 resets the piece view.',
  ],
  [
    'How are lines cleared?',
    'Fill a row completely and it vanishes, scoring points. Multiple lines at once score more.',
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
