// Hero typewriter: the eyebrow types itself out once, then the lede cycles
// through three lines forever.
//
// Both start when the page intro has finished, so the copy lands after the
// page has settled instead of racing the reveal. Every delay comes from a
// design token, and the timers stop counting while the tab is hidden.
//
// The same machinery types the section headings: a section's copy comes in
// when the section takes the spotlight and is wiped when it leaves again, so
// scrolling back and forth replays it.
//
// Reduced motion and no-JS environments never reach the typing code: the
// markup already holds the finished copy, and the accessible text (an
// aria-label for a heading, a visually hidden line for a paragraph) is in the
// markup too, so assistive tech never reads half-typed characters.
import { whenIntroFinishes } from './intro';
import { SECTION_ACTIVE_EVENT, SECTION_INACTIVE_EVENT } from './scrollFade';
import { readDuration, readToken } from './tokens';

const TYPE_TOKEN = '--type-type';
const DELETE_TOKEN = '--type-delete';
const PAUSE_TOKEN = '--type-pause';
const CARET_FADE_TOKEN = '--type-caret-fade';
const SECTION_TYPE_TOKEN = '--type-section-type';
const EASE_TOKEN = '--ease-soft';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const EYEBROW_TEXT = 'NO TIMER · NO GRAVITY';

export const LEDE_LINES = [
  'Take your time. Place it right.',
  'Tilt it. Zoom in. Then drop it.',
  'No clock. No rush.',
];

interface TypewriterParts {
  eyebrow: HTMLElement;
  eyebrowText: HTMLElement;
  caret: HTMLElement;
  lede: HTMLElement;
  ledeText: HTMLElement;
}

let parts: TypewriterParts | null = null;
let stopped = false;
/** Every pending delay, so a hidden tab can suspend them all. */
const delays = new Set<VisibleDelay>();
/** The delays the hero owns, so the hero can be stopped on its own. */
const heroDelays = new Set<VisibleDelay>();
/** The section typewriters, so reduced motion can stop them all. */
const sectionTypewriters = new Set<SectionTypewriter>();

/**
 * Prepares the hero for typing: clears the static copy, reserves the space
 * the longest lede line needs, and wires the visibility pause. Runs before
 * the first paint, so the copy is never seen half-typed.
 */
export function prepareTypewriter(): void {
  const found = findParts();

  if (!found || prefersReducedMotion()) {
    return;
  }

  parts = found;
  found.eyebrowText.textContent = '';
  found.ledeText.textContent = '';
  reserveLedeSpace(found);

  document.addEventListener('visibilitychange', handleVisibility);

  // The webfont can change how the longest line wraps, so the reserved space
  // is measured again once the fonts have settled.
  void document.fonts?.ready
    .then(() => {
      if (!stopped) {
        reserveLedeSpace(found);
      }
    })
    .catch(() => undefined);
}

/**
 * Starts the typing once the page intro has finished.
 */
export function startTypewriter(): void {
  if (!parts) {
    prepareTypewriter();
  }

  const found = parts;

  if (!found || prefersReducedMotion()) {
    return;
  }

  void whenIntroFinishes()
    .then(() => {
      if (stopped) {
        return;
      }

      found.eyebrow.classList.add('eyebrow--typing');
      void typeEyebrow(found);
      void cycleLede(found);
    })
    .catch(() => undefined);
}

/** A block of text that a section types in. */
export interface TypeBlock {
  /** The element the text is typed into. */
  element: HTMLElement;
  /** The text to type out. */
  text: string;
  /**
   * How the finished text reaches assistive tech: 'label' gives the element
   * an aria-label (for headings), 'copy' leaves a visually hidden copy of the
   * text next to it (for paragraphs).
   */
  expose: 'label' | 'copy';
}

export interface SectionTypewriter {
  /** Stops the typing and leaves the finished copy in place. */
  stop(): void;
}

interface PreparedBlock {
  element: HTMLElement;
  text: string;
  typed: HTMLElement;
  caret: HTMLElement;
  /** The caret's fade-out, so the next run can start from a visible caret. */
  fade: Animation | null;
}

/**
 * Types a section's headings in whenever the section takes the spotlight, and
 * wipes the half-typed text when it leaves again. Re-entering the section
 * starts the copy from empty.
 *
 * The finished text is always in the markup for assistive tech, so a screen
 * reader never follows the characters as they land.
 */
export function createSectionTypewriter(
  section: HTMLElement,
  blocks: TypeBlock[],
): SectionTypewriter {
  const prepared = blocks.map(prepareBlock);
  const delay = new VisibleDelay();
  const speed = readDuration(SECTION_TYPE_TOKEN);

  delays.add(delay);

  let run = 0;
  let typing: PreparedBlock | null = null;

  async function typeAll(currentRun: number): Promise<void> {
    for (const block of prepared) {
      if (currentRun !== run) {
        return;
      }

      typing = block;
      block.caret.classList.add('type-caret--on');

      const finished = await typeCharacters(block.text, block.typed, {
        delay,
        speed,
        isCancelled: () => currentRun !== run,
      });

      if (!finished) {
        return;
      }

      typing = null;
      block.fade = fadeOutCaret(block.caret, 'type-caret--done');
    }
  }

  function handleActive(): void {
    if (prefersReducedMotion()) {
      return;
    }

    run += 1;
    const currentRun = run;

    for (const block of prepared) {
      reserveBlockSpace(block);
      resetBlock(block);
    }

    void typeAll(currentRun);
  }

  function handleInactive(): void {
    run += 1;

    // The copy that already landed stays; the half-typed one is wiped, so
    // the next visit starts from empty.
    if (typing) {
      typing.typed.textContent = '';
      typing.caret.classList.remove('type-caret--on');
      typing = null;
    }
  }

  const typewriter: SectionTypewriter = {
    stop(): void {
      run += 1;
      delay.cancel();
      delays.delete(delay);

      for (const block of prepared) {
        restoreBlock(block);
      }
    },
  };

  section.addEventListener(SECTION_ACTIVE_EVENT, handleActive);
  section.addEventListener(SECTION_INACTIVE_EVENT, handleInactive);
  sectionTypewriters.add(typewriter);

  // The space is reserved on the next frame, once the section is in the
  // document and can be measured. The first paint therefore already has the
  // final height, so nothing jumps when the copy comes in.
  requestAnimationFrame(reserveAll);

  // The webfont changes how the text wraps, so the reserved space is
  // measured again once the font is in the layout. The swap lands a frame
  // after the fonts report back, hence the extra frame.
  void document.fonts?.ready
    .then(() => {
      requestAnimationFrame(reserveAll);
    })
    .catch(() => undefined);

  document.fonts?.addEventListener('loadingdone', reserveAll);

  function reserveAll(): void {
    for (const block of prepared) {
      reserveBlockSpace(block);
    }
  }

  return typewriter;
}

// Turns a block into its typed form: the text to type into, the caret, and
// the accessible copy of the finished words.
function prepareBlock(block: TypeBlock): PreparedBlock {
  const element = block.element;

  element.textContent = '';

  if (block.expose === 'label') {
    element.setAttribute('aria-label', block.text);
  } else {
    const copy = document.createElement('span');
    copy.className = 'visually-hidden';
    copy.textContent = block.text;
    element.append(copy);
  }

  const typed = document.createElement('span');
  typed.className = 'type-text';
  typed.setAttribute('aria-hidden', 'true');
  typed.textContent = block.text;

  const caret = document.createElement('span');
  caret.className = 'type-caret';
  caret.setAttribute('aria-hidden', 'true');

  element.append(typed, caret);

  const prepared: PreparedBlock = { element, text: block.text, typed, caret, fade: null };

  reserveBlockSpace(prepared);

  if (!prefersReducedMotion()) {
    // The copy stays in the markup for reduced motion, where it is the
    // finished text rather than the start of a typing run.
    typed.textContent = '';
  }

  return prepared;
}

// Reserves the height the finished text needs, so nothing jumps while the
// characters come in.
function reserveBlockSpace(block: PreparedBlock): void {
  const element = block.element;
  const previousText = block.typed.textContent;
  const previousMinHeight = element.style.minHeight;

  element.style.minHeight = '';
  block.typed.textContent = block.text;

  const height = element.getBoundingClientRect().height;

  block.typed.textContent = previousText;
  element.style.minHeight = height > 0 ? `${height}px` : previousMinHeight;
}

// Empties a block and puts its caret away, ready for the next run.
function resetBlock(block: PreparedBlock): void {
  block.fade?.cancel();
  block.fade = null;
  block.typed.textContent = '';
  block.caret.classList.remove('type-caret--on', 'type-caret--done');
}

// Puts the finished words back, used when reduced motion is switched on
// while the page is open.
function restoreBlock(block: PreparedBlock): void {
  block.fade?.cancel();
  block.fade = null;
  block.typed.textContent = block.text;
  block.caret.classList.remove('type-caret--on', 'type-caret--done');
}

// Types the eyebrow once, then fades its caret out.
async function typeEyebrow(found: TypewriterParts): Promise<void> {
  const delay = createDelay();
  const typeMs = readDuration(TYPE_TOKEN);

  const finished = await typeCharacters(EYEBROW_TEXT, found.eyebrowText, {
    delay,
    speed: typeMs,
    isCancelled: () => stopped,
  });

  if (finished) {
    fadeOutCaret(found.caret, 'eyebrow__caret--done');
  }
}

// Cycles the lede forever: type a line, rest on it, delete it, type the next.
async function cycleLede(found: TypewriterParts): Promise<void> {
  const delay = createDelay();
  const typeMs = readDuration(TYPE_TOKEN);
  const deleteMs = readDuration(DELETE_TOKEN);
  const pauseMs = readDuration(PAUSE_TOKEN);

  let index = 0;

  for (;;) {
    if (stopped) {
      return;
    }

    const line = LEDE_LINES[index % LEDE_LINES.length];
    const typeOrigin = performance.now();
    const typePausedAt = delay.paused;

    for (let position = 0; position < line.length; position += 1) {
      if (stopped) {
        return;
      }

      await waitForStep(delay, typeOrigin, position, typeMs, typePausedAt);

      if (stopped) {
        return;
      }

      found.ledeText.textContent += line[position];
    }

    await delay.wait(pauseMs);

    const deleteOrigin = performance.now();
    const deletePausedAt = delay.paused;
    let deleted = 0;

    while (found.ledeText.textContent.length > 0) {
      if (stopped) {
        return;
      }

      await waitForStep(delay, deleteOrigin, deleted, deleteMs, deletePausedAt);

      if (stopped) {
        return;
      }

      found.ledeText.textContent = found.ledeText.textContent.slice(0, -1);
      deleted += 1;
    }

    index += 1;
  }
}

// Types a string one character at a time. Returns false when the run was
// cancelled half way through.
async function typeCharacters(
  text: string,
  target: HTMLElement,
  options: { delay: VisibleDelay; speed: number; isCancelled: () => boolean },
): Promise<boolean> {
  const { delay, speed, isCancelled } = options;
  const origin = performance.now();
  const pausedAtStart = delay.paused;

  for (let index = 0; index < text.length; index += 1) {
    if (isCancelled()) {
      return false;
    }

    await waitForStep(delay, origin, index, speed, pausedAtStart);

    if (isCancelled()) {
      return false;
    }

    target.textContent += text[index];
  }

  return true;
}

// Waits until a step of a fixed-rate sequence is due. The schedule is
// anchored to a start time, so a late callback is caught up on the next step
// instead of stretching the whole sequence. The time the tab spent hidden is
// added to the target, so the copy keeps its rhythm instead of bursting
// through the backlog when the tab comes back.
async function waitForStep(
  delay: VisibleDelay,
  origin: number,
  index: number,
  stepMs: number,
  pausedAtStart: number,
): Promise<void> {
  const target = origin + index * stepMs + (delay.paused - pausedAtStart);
  const remaining = target - performance.now();

  if (remaining > 0) {
    await delay.wait(remaining);
  }
}

// Reserves the height of the longest lede line, so the hero never jumps
// while the text is being typed and deleted.
function reserveLedeSpace(found: TypewriterParts): void {
  const longest = LEDE_LINES.reduce((a, b) => (b.length > a.length ? b : a), '');
  const previousText = found.ledeText.textContent ?? '';
  const previousMinHeight = found.lede.style.minHeight;

  found.lede.style.minHeight = '';
  found.ledeText.textContent = longest;

  const height = found.lede.getBoundingClientRect().height;

  found.ledeText.textContent = previousText;
  found.lede.style.minHeight = height > 0 ? `${height}px` : previousMinHeight;
}

// Fades the caret out once the text is finished. The blink animation is
// dropped first, so the fade always starts from a visible caret.
function fadeOutCaret(caret: HTMLElement, doneClass: string): Animation {
  const duration = readDuration(CARET_FADE_TOKEN);
  const easing = readToken(EASE_TOKEN) || 'ease-out';

  caret.classList.add(doneClass);
  return caret.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: 'forwards' });
}

// Stops the typing and puts the finished copy back, used when the user
// turns reduced motion on while the page is open.
function stop(): void {
  stopped = true;

  for (const delay of heroDelays) {
    delay.cancel();
  }

  heroDelays.clear();
  document.removeEventListener('visibilitychange', handleVisibility);

  if (!parts) {
    return;
  }

  parts.eyebrow.classList.remove('eyebrow--typing');
  parts.eyebrowText.textContent = EYEBROW_TEXT;
  parts.ledeText.textContent = LEDE_LINES[0];
  parts.lede.style.minHeight = '';
}

// Suspends every pending step while the tab is hidden, and picks them back
// up with the time they had left when the tab comes back.
function handleVisibility(): void {
  const hidden = document.visibilityState === 'hidden';

  for (const delay of delays) {
    if (hidden) {
      delay.pause();
    } else {
      delay.resume();
    }
  }
}

function createDelay(): VisibleDelay {
  const delay = new VisibleDelay();
  delays.add(delay);
  heroDelays.add(delay);
  return delay;
}

function findParts(): TypewriterParts | null {
  const eyebrow = document.querySelector<HTMLElement>('.hero .eyebrow');
  const eyebrowText = eyebrow?.querySelector<HTMLElement>('.eyebrow__text') ?? null;
  const caret = eyebrow?.querySelector<HTMLElement>('.eyebrow__caret') ?? null;
  const lede = document.querySelector<HTMLElement>('.hero .lede');
  const ledeText = lede?.querySelector<HTMLElement>('.lede__text') ?? null;

  if (!eyebrow || !eyebrowText || !caret || !lede || !ledeText) {
    return null;
  }

  return { eyebrow, eyebrowText, caret, lede, ledeText };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// A sleep that only counts down while the tab is visible.
class VisibleDelay {
  private handle: number | null = null;
  private remaining = 0;
  private startedAt = 0;
  private pausedMs = 0;
  private pausedAt: number | null = null;
  private waiter: (() => void) | null = null;

  /** How long this delay has spent suspended because the tab was hidden. */
  get paused(): number {
    return this.pausedMs;
  }

  wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waiter = resolve;
      this.remaining = ms;
      this.start();
    });
  }

  // Ends the wait without spending the remaining time.
  cancel(): void {
    if (this.handle !== null) {
      window.clearTimeout(this.handle);
      this.handle = null;
    }

    const waiter = this.waiter;
    this.waiter = null;
    waiter?.();
  }

  // Suspends the wait. How long the tab stays hidden is only known when it
  // comes back, so the schedule is shifted then.
  pause(): void {
    if (this.pausedAt === null) {
      this.pausedAt = performance.now();
    }

    if (this.handle === null) {
      return;
    }

    window.clearTimeout(this.handle);
    this.handle = null;

    const elapsed = performance.now() - this.startedAt;
    this.remaining = Math.max(0, this.remaining - elapsed);
  }

  resume(): void {
    if (this.pausedAt !== null) {
      this.pausedMs += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }

    if (this.handle !== null || this.waiter === null) {
      return;
    }

    this.start();
  }

  private start(): void {
    this.startedAt = performance.now();
    this.handle = window.setTimeout(() => this.complete(), this.remaining);
  }

  private complete(): void {
    this.handle = null;

    const waiter = this.waiter;
    this.waiter = null;
    waiter?.();
  }
}

// A user can switch reduced motion on mid-session; the typing stops and the
// static copy takes over.
const motionPreference = window.matchMedia(REDUCED_MOTION_QUERY);

motionPreference.addEventListener('change', (event) => {
  if (event.matches) {
    stop();

    for (const typewriter of sectionTypewriters) {
      typewriter.stop();
    }
  }
});
