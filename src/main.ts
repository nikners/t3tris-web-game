import { createControls } from './input/controls';
import { createGame } from './logic/game';
import type { Game } from './logic/game';
import { createScene } from './render/scene';
import { createCounters } from './ui/counters';
import { createFaq } from './ui/faq';
import { createFooter } from './ui/footer';
import { createHero } from './ui/hero';
import { createHowToPlay } from './ui/howToPlay';
import { createMarquee } from './ui/marquee';
import { createNav } from './ui/nav';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { createGameOver } from './ui/gameOver';
import { attachScrollFade } from './ui/scrollFade';
import { startPageIntro } from './ui/intro';
import { createPlaySection } from './ui/playSection';
import { prepareTypewriter, startTypewriter } from './ui/typewriter';

declare global {
  interface Window {
    __broccolis?: { game: Game };
  }
}

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

const stage = document.createElement('div');
stage.className = 'phase-stage';

const inspectButton = document.createElement('button');
inspectButton.type = 'button';
inspectButton.className = 'cta';
inspectButton.textContent = 'INSPECT';
inspectButton.setAttribute('aria-pressed', 'false');

const game = createGame(Math.random);
const scene = createScene(stage);
stage.append(createGameOver(game));
const counters = createCounters(game);

game.subscribe((state) => scene.sync(state));
scene.sync(game.getState());

const nav = createNav();
const hero = createHero();
const play = createPlaySection({ stage, inspectButton, counters });
const howToPlay = createHowToPlay();
const marquee = createMarquee();
const faq = createFaq();
const footer = createFooter();

root.append(nav, hero, play.element, marquee, howToPlay, faq, footer);

// The board only owns the keyboard while it is on screen, so the page keeps
// scrolling normally everywhere else.
createControls({
  surface: stage,
  game,
  scene,
  inspectToggle: inspectButton,
  isInView: play.isInView,
});

// The hero copy is typed in after the intro, so the static text is cleared
// and its space is reserved before the first paint.
prepareTypewriter();

// The 3D stage stays hidden until the intro reveals it, so its render loop
// only starts once the reveal is under way — and one frame later, so the
// first (heavier) WebGL frame cannot push the reveal's animations back.
const introReady = startPageIntro()
  .catch(() => undefined)
  .then(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

// The typewriter waits for the intro to finish on its own, so the copy
// lands after the reveal rather than on a timer of its own.
startTypewriter();

void introReady.then(() => scene.start());

attachScrollFade();

// The theme refresh rebuilds the 3D views, so it waits for the intro to get
// out of the way.
void introReady.then(async () => {
  await document.fonts?.ready;
  scene.refreshTheme();
});
