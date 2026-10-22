import { EYEBROW_TEXT, LEDE_LINES } from './typewriter';

export function createHero(): HTMLElement {
  const hero = document.createElement('section');
  hero.className = 'section hero container';
  hero.id = 'top';

  const copy = document.createElement('div');
  copy.className = 'stack';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  // The eyebrow is typed in character by character, so the finished words
  // live in the label and the typed text is hidden from assistive tech.
  eyebrow.setAttribute('aria-label', EYEBROW_TEXT);

  const eyebrowText = document.createElement('span');
  eyebrowText.className = 'eyebrow__text';
  eyebrowText.setAttribute('aria-hidden', 'true');
  eyebrowText.textContent = EYEBROW_TEXT;

  const caret = document.createElement('span');
  caret.className = 'eyebrow__caret';
  caret.setAttribute('aria-hidden', 'true');

  eyebrow.append(eyebrowText, caret);

  const headline = document.createElement('h1');
  headline.className = 'headline';
  headline.textContent = 'Inspect every piece before it lands';

  const lede = document.createElement('p');
  lede.className = 'lede';

  // The lede cycles through three lines, so only the first one is exposed to
  // assistive tech; the typing area itself is hidden.
  const ledeLabel = document.createElement('span');
  ledeLabel.className = 'visually-hidden';
  ledeLabel.textContent = LEDE_LINES[0];

  const ledeText = document.createElement('span');
  ledeText.className = 'lede__text';
  ledeText.setAttribute('aria-hidden', 'true');
  ledeText.textContent = LEDE_LINES[0];

  lede.append(ledeLabel, ledeText);

  // The board lives in its own section, so the hero's call to action is a
  // link that takes the player there.
  const playLink = document.createElement('a');
  playLink.className = 'cta';
  playLink.href = '#play';
  playLink.textContent = 'PLAY NOW';

  copy.append(eyebrow, headline, lede, playLink);

  hero.append(copy);
  return hero;
}
