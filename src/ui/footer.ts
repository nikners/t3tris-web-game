import { createSectionTypewriter } from './typewriter';

const BRAND = 'Broccolis';
const NOTE = 'Original art and text. No gravity, no timer, no well.';

export function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'footer container';

  const brand = document.createElement('div');
  brand.className = 'footer__brand';
  brand.textContent = BRAND;

  const note = document.createElement('p');
  note.className = 'footer__note';
  note.textContent = NOTE;

  footer.append(brand, note);

  // The footer types itself in whenever it takes the spotlight.
  createSectionTypewriter(footer, [
    { element: brand, text: BRAND, expose: 'copy' },
    { element: note, text: NOTE, expose: 'copy' },
  ]);

  return footer;
}
