import { icon } from './icons';

export function createNav(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'nav container';

  const brand = document.createElement('a');
  brand.className = 'nav__brand';
  brand.href = '#top';

  const mark = icon('logo');
  mark.classList.add('nav__mark');
  const word = document.createElement('span');
  word.className = 'nav__word';
  word.textContent = 'Broccolis';
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

  nav.append(brand, links, cta);
  return nav;
}
