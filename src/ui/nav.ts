import { createLogoMark } from './logo';

export function createNav(): HTMLElement {
  // The bar spans the full viewport width; the inner row keeps the brand, the
  // links and the call to action on the page's content column.
  const nav = document.createElement('nav');
  nav.className = 'nav';

  const row = document.createElement('div');
  row.className = 'nav__inner container';

  const brand = document.createElement('a');
  brand.className = 'nav__brand';
  brand.href = '#top';
  brand.setAttribute('aria-label', 'T3TRIS home');

  const mark = createLogoMark();
  mark.classList.add('nav__mark');
  const word = document.createElement('span');
  word.className = 'nav__word';
  word.textContent = 'T3TRIS';
  brand.append(mark, word);

  const links = document.createElement('div');
  links.className = 'nav__links';
  for (const [label, target] of [
    ['HOW TO PLAY', '#how-to-play'],
    ['GAME', '#play'],
    ['FAQ', '#faq'],
  ]) {
    const link = document.createElement('a');
    link.className = 'nav__link';
    link.href = target;
    link.textContent = label;
    links.append(link);
  }

  const cta = document.createElement('a');
  cta.className = 'cta';
  cta.href = '#play';
  cta.textContent = 'START GAME';

  row.append(brand, links, cta);
  nav.append(row);

  return nav;
}
