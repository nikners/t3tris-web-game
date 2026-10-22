export type IconName = 'logo' | 'inspect' | 'move' | 'rotate' | 'drop' | 'star';

const SVG_NS = 'http://www.w3.org/2000/svg';

const GLYPHS: Record<IconName, string> = {
  logo:
    '<rect x="3.5" y="3.5" width="9" height="9" />' +
    '<rect x="11.5" y="11.5" width="9" height="9" />' +
    '<path d="M7.5 3.5 V12.5 H3.5" />',

  inspect:
    '<path d="M12 3 L20.5 7.8 L20.5 16.2 L12 21 L3.5 16.2 L3.5 7.8 Z" />' +
    '<path d="M3.5 7.8 L12 12.6 L20.5 7.8" />' +
    '<path d="M12 12.6 V21" />',

  move:
    '<path d="M3.5 12 H20.5" />' +
    '<path d="M7.5 7.5 L3 12 L7.5 16.5" />' +
    '<path d="M16.5 7.5 L21 12 L16.5 16.5" />',

  rotate:
    '<path d="M12 4 A8 8 0 1 1 4.2 12.4" />' +
    '<path d="M7.6 8.4 L4.2 12.4 L8.2 16" />',

  drop:
    '<path d="M12 3.5 V14.5" />' +
    '<path d="M7 9.5 L12 14.5 L17 9.5" />' +
    '<path d="M4 19.5 H20" />',

  star: '<path d="M12 2.5 L14.6 9.4 L21.5 12 L14.6 14.6 L12 21.5 L9.4 14.6 L2.5 12 L9.4 9.4 Z" />',
};

export function icon(name: IconName): SVGSVGElement {
  const element = document.createElementNS(SVG_NS, 'svg');

  element.setAttribute('viewBox', '0 0 24 24');
  element.setAttribute('fill', 'none');
  element.setAttribute('stroke', 'currentColor');
  element.setAttribute('stroke-width', '2');
  element.setAttribute('stroke-linecap', 'square');
  element.setAttribute('stroke-linejoin', 'miter');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  element.innerHTML = GLYPHS[name];

  return element;
}
