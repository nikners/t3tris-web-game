import { starIcon } from './icons';

const BANDS: Array<['ink' | 'blue', string]> = [
  ['ink', 'MOVE · ROTATE · INSPECT · HARD DROP'],
  ['blue', 'CLASSIC GRID · 3D PIECES'],
];

export function createMarquee(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section--flush stack';

  for (const [tone, text] of BANDS) {
    const marquee = document.createElement('div');
    marquee.className = 'marquee';

    const track = document.createElement('div');
    track.className = 'marquee__track';
    track.append(buildBand(tone, text), buildBand(tone, text));

    marquee.append(track);
    section.append(marquee);
  }

  return section;
}

function buildBand(tone: 'ink' | 'blue', text: string): HTMLElement {
  const band = document.createElement('div');
  band.className = `band band--${tone}`;

  for (let copy = 0; copy < 6; copy++) {
    const label = document.createElement('span');
    label.textContent = text;
    band.append(label, buildStar());
  }

  return band;
}

function buildStar(): SVGSVGElement {
  const star = starIcon();
  star.classList.add('band__star');
  return star;
}
