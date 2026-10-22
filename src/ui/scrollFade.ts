// Scroll fade: the page's top-level sections fade with the scroll.
//
// The section that fills the viewport stays bright (opacity 1, no shift).
// The ones around it dim down and slide towards the edge they left through:
// scrolling down, the page moves up, so the section below slides up into
// place and the one above slides out through the top. Scrolling up does the
// opposite. The state is kept in two custom properties on the section, so
// CSS owns the look and this module only decides when a section is active,
// how far it is shifted and how dim it gets.
//
// Nothing is hidden: the faded sections keep their opacity, their place in
// the tab order and their text, so keyboard focus, Ctrl+F and screen readers
// still reach everything.
//
// Reduced motion skips the whole thing (and switching it on mid-session puts
// the sections back), so every section stays fully visible and unshifted.
import { readToken } from './tokens';

const ACTIVE_RATIO = 0.5;
// A section taller than the viewport is active once it covers this much of
// the screen.
const TALL_SECTION_TOLERANCE = 0.9;
// The observer reports at every step of the way, so a section that is only
// just big enough to be active is caught at the right moment.
const OBSERVER_THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
const SHIFT_TOKEN = '--fade-shift';
const DIM_TOKEN = '--fade-dim';
const PLAY_DIM_TOKEN = '--fade-dim-play';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Fired on a section when it takes the spotlight. */
export const SECTION_ACTIVE_EVENT = 'broccolis:section-active';
/** Fired on a section when it hands the spotlight over. */
export const SECTION_INACTIVE_EVENT = 'broccolis:section-inactive';

type Direction = 'down' | 'up';

interface FadeTarget {
  element: HTMLElement;
  /** The opacity the section drops to while it is out of the spotlight. */
  dimOpacity: number;
  /** The last known visible ratio, used to tell entering from leaving. */
  ratio: number;
  /** True while the section is the active one. */
  active: boolean;
  /** The share of the section that has to be on screen to call it active. */
  threshold: number;
}

/**
 * Fades the top-level sections in and out with the scroll.
 */
export function attachScrollFade(container: ParentNode = document): void {
  if (typeof IntersectionObserver === 'undefined') {
    return;
  }

  const app = container instanceof HTMLElement ? container : document.querySelector('#app');

  if (!app) {
    return;
  }

  // The top-level sections are the bands the page reads as: the hero, the
  // game, the marquee, how to play, the FAQ and the footer. The nav is not
  // one of them, it floats over the page.
  const elements = Array.from(app.querySelectorAll<HTMLElement>(':scope > section, :scope > footer'));

  if (elements.length === 0) {
    return;
  }

  const shift = readNumber(SHIFT_TOKEN, 24);
  const dim = readNumber(DIM_TOKEN, 0.15);
  const playDim = readNumber(PLAY_DIM_TOKEN, 0.6);

  const targets: FadeTarget[] = elements.map((element) => ({
    element,
    // The board has to stay readable, so its section never fades below the
    // playable floor.
    dimOpacity: element.id === 'play' ? playDim : dim,
    ratio: 0,
    active: false,
    threshold: ACTIVE_RATIO,
  }));

  let direction: Direction = 'down';
  let lastScrollY = window.scrollY;
  let observer: IntersectionObserver | null = null;

  // The direction only decides which way a section slides, so a plain
  // passive listener is enough — the wheel is never touched.
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;

      if (y > lastScrollY) {
        direction = 'down';
      } else if (y < lastScrollY) {
        direction = 'up';
      }

      lastScrollY = y;
    },
    { passive: true },
  );

  // A section enters from the side it comes in from and leaves towards the
  // side it goes out through.
  function enteringShift(): number {
    return direction === 'down' ? shift : -shift;
  }

  function leavingShift(): number {
    return direction === 'down' ? -shift : shift;
  }

  // Writes the state onto the section. With `instant` the change is committed
  // without animating, which is how the start of a transition is set up.
  function paint(target: FadeTarget, opacity: number, offset: number, instant: boolean): void {
    const element = target.element;
    element.classList.add('section-fade');

    if (instant) {
      element.style.transition = 'none';
    }

    element.style.setProperty('--fade-opacity', String(opacity));
    element.style.setProperty('--fade-shift', `${offset}px`);

    if (instant) {
      // Flush the new state, so the browser starts the next transition here.
      void element.offsetHeight;
      element.style.transition = '';
    }
  }

  function clear(target: FadeTarget): void {
    target.element.classList.remove('section-fade');
    target.element.style.removeProperty('--fade-opacity');
    target.element.style.removeProperty('--fade-shift');
    target.element.style.removeProperty('transition');
  }

  // The state of every section, computed from where it sits right now. It
  // runs before the first paint, so a section that starts out of the
  // spotlight never flashes its bright state.
  function applyCurrentState(instant: boolean): void {
    for (const target of targets) {
      const rect = target.element.getBoundingClientRect();
      const ratio = visibleRatio(rect, window.innerHeight);
      target.threshold = activeThreshold(rect.height);
      target.ratio = ratio;

      const active = ratio >= target.threshold;

      if (active !== target.active) {
        target.active = active;
        announce(target, active);
      }

      const offset = target.active ? 0 : rect.top >= 0 ? enteringShift() : leavingShift();
      paint(target, target.active ? 1 : target.dimOpacity, offset, instant);
    }
  }

  function handleEntries(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const target = targets.find((candidate) => candidate.element === entry.target);

      if (!target) {
        continue;
      }

      const ratio = entry.intersectionRatio;
      const rising = ratio > target.ratio;
      target.ratio = ratio;

      const active = ratio >= target.threshold;

      if (active === target.active) {
        if (!active && rising) {
          // It is on its way in but not the active one yet: hold it on the
          // side it enters from.
          paint(target, target.dimOpacity, enteringShift(), false);
        }

        continue;
      }

      target.active = active;
      announce(target, active);

      if (active) {
        // It takes over: start on the side it enters from, then fade in.
        paint(target, target.dimOpacity, enteringShift(), true);
        paint(target, 1, 0, false);
      } else {
        // It hands over: dim down and slide towards the edge it leaves by.
        paint(target, target.dimOpacity, leavingShift(), false);
      }
    }
  }

  // Tells the section that it took the spotlight or gave it up, so anything
  // that plays along with the scroll (the typewriters) can follow.
  function announce(target: FadeTarget, active: boolean): void {
    target.element.dispatchEvent(
      new CustomEvent(active ? SECTION_ACTIVE_EVENT : SECTION_INACTIVE_EVENT),
    );
  }

  function start(): void {
    if (observer) {
      return;
    }

    observer = new IntersectionObserver(handleEntries, { threshold: OBSERVER_THRESHOLDS });

    for (const target of targets) {
      observer.observe(target.element);
    }

    applyCurrentState(true);
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;

    for (const target of targets) {
      clear(target);
    }
  }

  // A resize changes how much of a section fits on screen, so the thresholds
  // and the state are worked out again.
  window.addEventListener(
    'resize',
    () => {
      if (observer) {
        applyCurrentState(false);
      }
    },
    { passive: true },
  );

  // A user can turn reduced motion on mid-session, so the fades have to go
  // with it.
  const motionPreference = window.matchMedia(REDUCED_MOTION_QUERY);

  motionPreference.addEventListener('change', (event) => {
    if (event.matches) {
      stop();
    } else {
      start();
    }
  });

  if (!motionPreference.matches) {
    start();
  }
}

// How much of a section is on screen, the same way the observer measures it.
function visibleRatio(rect: DOMRect, viewportHeight: number): number {
  const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);

  return Math.max(0, visible) / Math.max(rect.height, 1);
}

// How much of a section has to be on screen before it counts as the active
// one. A section taller than the viewport can never be fully in view, so it
// counts as active once it covers most of the screen.
function activeThreshold(height: number): number {
  if (height <= 0) {
    return ACTIVE_RATIO;
  }

  return Math.min(ACTIVE_RATIO, (window.innerHeight / height) * TALL_SECTION_TOLERANCE);
}

function readNumber(token: string, fallback: number): number {
  const value = Number.parseFloat(readToken(token));

  return Number.isFinite(value) ? value : fallback;
}
