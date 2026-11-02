// The T3TRIS mark: four square blocks in a T — three across the top, one
// below the middle. The crossbar is the brand blue and the stem is the
// accent orange, so the mark reads as a tetromino at any size.
//
// The colours come from the design tokens, so the mark follows the theme
// like the rest of the page.
const SVG_NS = 'http://www.w3.org/2000/svg';

// The cells of the T, on a 24-unit square. Each block is inset a little so
// the four of them read as separate blocks.
const BLOCKS: ReadonlyArray<{ x: number; y: number; tone: 'blue' | 'orange' }> = [
  { x: 0.5, y: 4.5, tone: 'blue' },
  { x: 8.5, y: 4.5, tone: 'blue' },
  { x: 16.5, y: 4.5, tone: 'blue' },
  { x: 8.5, y: 12.5, tone: 'orange' },
];

export function createLogoMark(): SVGSVGElement {
  const element = document.createElementNS(SVG_NS, 'svg');

  element.setAttribute('viewBox', '0 0 24 24');
  // The mark is decorative: it always sits next to the wordmark, which
  // already names the game.
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  element.classList.add('logo');

  for (const block of BLOCKS) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(block.x));
    rect.setAttribute('y', String(block.y));
    rect.setAttribute('width', '7');
    rect.setAttribute('height', '7');
    rect.setAttribute('rx', '0.75');
    rect.classList.add('logo__block', `logo__block--${block.tone}`);
    element.append(rect);
  }

  return element;
}
