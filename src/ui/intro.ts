// Page-load intro: the nav slides down and fades in, the hero headline
// reveals line by line from a clipped mask, then the lede fades up.
//
// The choreography runs on the Web Animations API and is pinned to the
// document timeline, so a busy main thread (a late webfont, the first WebGL
// frame) cannot stretch the intro past its budget. Every duration comes
// from a design token. The finished page is the default CSS state, so
// reduced-motion users and no-JS environments skip the intro entirely.
import { readDuration, readToken } from './tokens';

const LINE_TOLERANCE = 2;

const FONT_WAIT_TOKEN = '--intro-font-wait';
const LEAD_TOKEN = '--intro-lead';
const NAV_DURATION_TOKEN = '--intro-nav-duration';
const LINE_DURATION_TOKEN = '--intro-line-duration';
const BASE_DELAY_TOKEN = '--intro-line-base-delay';
const STAGGER_TOKEN = '--intro-line-stagger';
const TAIL_DURATION_TOKEN = '--intro-tail-duration';
const EASE_TOKEN = '--ease-soft';
const DISPLAY_FONT_TOKEN = '--font-display';
const BODY_FONT_TOKEN = '--font-body';

interface RevealState {
  headline: HTMLElement;
  words: HTMLElement[];
  groups: number[][];
  /** Document-timeline time the choreography is pinned to. */
  start: number;
  animations: Animation[];
}

// The intro is the page's opening beat, so anything that has to happen
// "after the intro" waits on this rather than on a timer of its own.
let resolveIntroFinished: (() => void) | null = null;
const introFinished = new Promise<void>((resolve) => {
  resolveIntroFinished = resolve;
});

/**
 * Resolves once the intro choreography has played out — the last animation
 * has reached its end, not merely been scheduled. Reduced motion and
 * unsupported environments resolve it immediately.
 */
export function whenIntroFinishes(): Promise<void> {
  return introFinished;
}

function finishIntro(): void {
  const resolve = resolveIntroFinished;
  resolveIntroFinished = null;
  resolve?.();
}

export function startPageIntro(): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishIntro();
    return Promise.resolve();
  }

  const headline = document.querySelector<HTMLElement>('.hero .headline');

  document.documentElement.classList.add('intro-armed');
  headline?.classList.add('headline--pending');

  // Commit the hidden start before the browser paints, so the page never
  // flashes its finished layout.
  void document.documentElement.offsetHeight;

  if (!headline) {
    document.documentElement.classList.remove('intro-armed');
    finishIntro();
    return Promise.resolve();
  }

  return revealHeadline(headline);
}

// Waits for the display font, groups the headline words into the lines they
// actually wrap to, then hands the reveal over to the animations.
async function revealHeadline(headline: HTMLElement): Promise<void> {
  const words = splitIntoWords(headline);
  await fontsReady();

  const state: RevealState = {
    headline,
    words,
    groups: measureLineGroups(headline, words),
    start: timelineNow() + readDuration(LEAD_TOKEN),
    animations: [],
  };

  runReveal(state);
  watchFontSwap(state);
}

// Rebuilds the headline lines and schedules the whole choreography on the
// pinned timeline. Safe to call again — a late webfont can change where the
// headline wraps, and re-running keeps every line in step with the clock.
function runReveal(state: RevealState): void {
  const { headline, words, groups, start } = state;

  for (const animation of state.animations) {
    animation.cancel();
  }
  state.animations = [];

  applyLineGroups(headline, words, groups);

  const inners = Array.from(headline.querySelectorAll<HTMLElement>('.headline__line-inner'));
  const animations = createAnimations(inners);

  for (const animation of animations) {
    animation.startTime = start;
  }

  state.animations = animations;
  headline.classList.remove('headline--pending');
  document.documentElement.classList.remove('intro-armed');

  watchForFinish(animations);
}

// Resolves the intro's finished signal when the last animation lands. A font
// swap can re-run the reveal and cancel the running animations, so the
// replacement set takes over the signal instead of leaving it dangling.
function watchForFinish(animations: Animation[]): void {
  const last = animations[animations.length - 1];

  if (!last) {
    finishIntro();
    return;
  }

  void last.finished.then(finishIntro).catch(() => undefined);
}

// Builds the whole choreography: the nav drops in, the headline lines follow
// one by one, and the lede fades up once the last line has landed. The board
// has its own section, so the scroll reveal introduces it instead.
function createAnimations(inners: HTMLElement[]): Animation[] {
  const easing = readToken(EASE_TOKEN) || 'linear';
  const navDuration = readDuration(NAV_DURATION_TOKEN);
  const lineDuration = readDuration(LINE_DURATION_TOKEN);
  const baseDelay = readDuration(BASE_DELAY_TOKEN);
  const stagger = readDuration(STAGGER_TOKEN);
  const tailDuration = readDuration(TAIL_DURATION_TOKEN);
  const tailDelay = baseDelay + stagger * Math.max(inners.length - 1, 0) + lineDuration;

  const animations: Animation[] = [];

  const nav = document.querySelector<HTMLElement>('.nav');
  if (nav) {
    animations.push(slideIn(nav, navDuration, 0, easing));
  }

  const eyebrow = document.querySelector<HTMLElement>('.hero .eyebrow');
  if (eyebrow) {
    animations.push(slideIn(eyebrow, lineDuration, baseDelay, easing));
  }

  inners.forEach((inner, index) => {
    animations.push(slideIn(inner, lineDuration, baseDelay + stagger * index, easing));
  });

  for (const selector of ['.hero .lede']) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      animations.push(slideIn(element, tailDuration, tailDelay, easing));
    }
  }

  return animations;
}

// Slides an element up from wherever it currently sits and fades it in. The
// start values are read from the live element, so the CSS owns the hidden
// state and the animation owns everything after it.
function slideIn(
  element: HTMLElement,
  duration: number,
  delay: number,
  easing: string,
): Animation {
  const styles = getComputedStyle(element);

  return element.animate(
    [
      { opacity: styles.opacity, transform: styles.transform },
      { opacity: '1', transform: 'translateY(0)' },
    ],
    { duration, delay, easing, fill: 'both' },
  );
}

// Re-measures the headline once the webfonts have settled. A font that
// arrives after the reveal changes where the headline wraps, so the lines are
// regrouped and the reveal is replayed against the same clock.
function watchFontSwap(state: RevealState): void {
  const fonts = document.fonts;

  if (!fonts) {
    return;
  }

  void fonts.ready
    .then(() => {
      const groups = measureLineGroups(state.headline, state.words);

      if (sameGroups(groups, state.groups)) {
        return;
      }

      state.groups = groups;
      runReveal(state);
    })
    .catch(() => undefined);
}

function splitIntoWords(headline: HTMLElement): HTMLElement[] {
  const text = (headline.textContent ?? '').trim();
  const words = text.length > 0 ? text.split(/\s+/) : [];

  headline.textContent = '';

  return words.map((word) => {
    const span = document.createElement('span');
    span.className = 'headline__word';
    span.textContent = word;
    headline.append(span, document.createTextNode(' '));
    return span;
  });
}

// Measures the words on an off-screen copy of the headline, so the live
// headline is never re-flowed while the reveal is running. Returns the word
// indexes that make up each visual line.
function measureLineGroups(headline: HTMLElement, words: HTMLElement[]): number[][] {
  if (words.length === 0) {
    return [];
  }

  const probe = headline.cloneNode(false) as HTMLElement;
  probe.removeAttribute('id');
  probe.classList.remove('headline--pending');
  probe.style.position = 'absolute';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.width = `${headline.getBoundingClientRect().width}px`;
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';

  const clones = words.map((word) => {
    const clone = word.cloneNode(true) as HTMLElement;
    probe.append(clone, document.createTextNode(' '));
    return clone;
  });

  document.body.append(probe);

  const groups: number[][] = [];
  let anchorTop = 0;

  clones.forEach((clone, index) => {
    const top = clone.getBoundingClientRect().top;
    const current = groups[groups.length - 1];

    if (current && Math.abs(anchorTop - top) <= LINE_TOLERANCE) {
      current.push(index);
      return;
    }

    groups.push([index]);
    anchorTop = top;
  });

  probe.remove();

  return groups;
}

// Wraps each visual line of the headline in its own clipping mask.
function applyLineGroups(
  headline: HTMLElement,
  words: HTMLElement[],
  groups: number[][],
): void {
  headline.textContent = '';

  groups.forEach((group, index) => {
    const mask = document.createElement('span');
    mask.className = 'headline__line';

    const inner = document.createElement('span');
    inner.className = 'headline__line-inner';

    group.forEach((wordIndex, position) => {
      inner.append(words[wordIndex]);

      if (position < group.length - 1) {
        inner.append(document.createTextNode(' '));
      }
    });

    mask.append(inner);
    headline.append(mask);

    // Keep a space between lines so the headline still reads as one sentence.
    if (index < groups.length - 1) {
      headline.append(document.createTextNode(' '));
    }
  });
}

function sameGroups(a: number[][], b: number[][]): boolean {
  return a.length === b.length && a.every((group, index) => group.join() === b[index].join());
}

function fontsReady(): Promise<void> {
  const fonts = document.fonts;

  if (!fonts) {
    return Promise.resolve();
  }

  const loaded = Promise.all([
    fonts.load(fontSpec(DISPLAY_FONT_TOKEN)).catch(() => undefined),
    fonts.load(fontSpec(BODY_FONT_TOKEN)).catch(() => undefined),
  ]).then(() => undefined);

  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, readDuration(FONT_WAIT_TOKEN));
  });

  return Promise.race([loaded, timeout]);
}

// Reads the first family of a font stack token as a font shorthand.
function fontSpec(token: string): string {
  const stack = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const family = stack.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? '';

  return family.length > 0 ? `1em "${family}"` : '1em sans-serif';
}

// Current time on the document timeline, which shares the page's time origin.
function timelineNow(): number {
  const current = document.timeline.currentTime;

  return typeof current === 'number' ? current : performance.now();
}
