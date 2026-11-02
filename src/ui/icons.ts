// The page's line icons, drawn as inline SVG so they take the colour of
// whatever they sit in (currentColor) and never need an extra request.
//
// Every icon is decorative: the text next to it already says what the
// action does, so the icons are hidden from assistive tech.
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Builds an icon from its markup. All the icons share the same frame: a
 * 24-unit square, a two-unit stroke and round ends.
 */
function createIcon(markup: string): SVGSVGElement {
  const element = document.createElementNS(SVG_NS, 'svg');

  element.setAttribute('viewBox', '0 0 24 24');
  element.setAttribute('fill', 'none');
  element.setAttribute('stroke', 'currentColor');
  element.setAttribute('stroke-width', '2');
  element.setAttribute('stroke-linecap', 'round');
  element.setAttribute('stroke-linejoin', 'round');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  element.innerHTML = markup;

  return element;
}

/** Left and right arrows: moving the piece across the board. */
export function moveIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M8 7 L4 12 L8 17" />' +
      '<path d="M4 12 H20" />' +
      '<path d="M16 7 L20 12 L16 17" />',
  );
}

/** An arrow curving to the right: rotating the piece clockwise. */
export function rotateCwIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M20 7 L16 11 L12 7" />' +
      '<path d="M4 17 A8 8 0 0 1 16 11" />',
  );
}

/** An arrow curving to the left: rotating the piece counter-clockwise. */
export function rotateCcwIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M4 7 L8 11 L12 7" />' +
      '<path d="M20 17 A8 8 0 0 0 8 11" />',
  );
}

/** Two downward arrows: dropping the piece straight down. */
export function hardDropIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M12 4 V12" />' +
      '<path d="M7 9 L12 14 L17 9" />' +
      '<path d="M7 18 H17" />',
  );
}

/** An isometric cube with an orbit arrow over it: looking at the piece from outside. */
export function inspectIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M12 9.5 L18 12.5 L18 17.5 L12 20.5 L6 17.5 L6 12.5 Z" />' +
      '<path d="M6 12.5 L12 15.5 L18 12.5" />' +
      '<path d="M12 15.5 V20.5" />' +
      '<path d="M6.5 9.5 A3 3 0 0 1 10.5 7.2" />' +
      '<path d="M7.8 5.8 L10.5 7.2 L8.8 9.5" />',
  );
}

/** A box with a returning arrow: resetting the inspect view to its default. */
export function resetViewIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M7 10 H14.5 A3.5 3.5 0 0 1 14.5 17 H9" />' +
      '<path d="M10 7 L7 10 L10 13" />' +
      '<rect x="5" y="7" width="3" height="6" rx="0.5" />',
  );
}

/** A curved arrow to the top-right: restarting the game. */
export function restartIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M17.5 6.5 A8 8 0 1 0 19 12" />' +
      '<path d="M17 5 L18 7 L16 6.5" />',
  );
}

/** An L with a small box attached: holding the piece for later. */
export function holdIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M6 12 L6 6 L12 6" />' +
      '<rect x="12" y="12" width="6" height="6" rx="0.5" />',
  );
}

/** An arrow that turns back on itself: taking the last drop back. */
export function undoIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M5 10 H14.5 A5 5 0 0 1 14.5 20 H9" />' +
      '<path d="M8.5 6.5 L5 10 L8.5 13.5" />',
  );
}

/** A star, used to separate the words in the marquee bands. */
export function starIcon(): SVGSVGElement {
  return createIcon('<path d="M12 2.5 L14.6 9.4 L21.5 12 L14.6 14.6 L12 21.5 L9.4 14.6 L2.5 12 L9.4 9.4 Z" />');
}

/** An isometric cube with an orbit arrow over it: putting the piece back in view. */
export function viewSnapIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M6.5 4.5 A8 8 0 0 1 17.5 4.5" />' +
      '<path d="M16.8 2.2 L17.5 4.5 L15.2 3.9" />' +
      '<path d="M12 9.5 L18 12.5 L18 17.5 L12 20.5 L6 17.5 L6 12.5 Z" />' +
      '<path d="M6 12.5 L12 15.5 L18 12.5" />' +
      '<path d="M12 15.5 V20.5" />',
  );
}

/** A speaker: the sound toggle. */
export function soundIcon(): SVGSVGElement {
  return createIcon(
    '<path d="M9 18 V5 L7.1 7.9" />' +
      '<path d="M15 5 C15 9.4 12.5 13 9 13.7" />' +
      '<path d="M9.2 17.8 H14.8" />',
  );
}

/** A grid of dots/marks: the colorblind patterns toggle. */
export function patternsIcon(): SVGSVGElement {
  return createIcon(
    '<rect x="6" y="6" width="4" height="4" />' +
      '<rect x="14" y="6" width="4" height="4" />' +
      '<rect x="6" y="14" width="4" height="4" />' +
      '<rect x="14" y="14" width="4" height="4" />',
  );
}
