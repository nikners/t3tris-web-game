import { createControls } from './input/controls';
import { createGame } from './logic/game';
import type { Game } from './logic/game';
import { createScene } from './render/scene';
import { createBestScore } from './ui/bestScore';
import { createCounters } from './ui/counters';
import { createFaq } from './ui/faq';
import { createFooter } from './ui/footer';
import { createHero } from './ui/hero';
import { createHoldCard } from './ui/holdCard';
import { createHowToPlay } from './ui/howToPlay';
import { inspectIcon } from './ui/icons';
import { createMarquee } from './ui/marquee';
import { createNav } from './ui/nav';
import { createNextCard } from './ui/nextCard';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { createGameOver } from './ui/gameOver';
import { attachScrollFade } from './ui/scrollFade';
import { startPageIntro } from './ui/intro';
import { createPlaySection } from './ui/playSection';
import { prepareTypewriter, startTypewriter } from './ui/typewriter';
import { createUndoButton } from './ui/undoButton';
import { createSoundToggle } from './ui/soundToggle';
import { createSoundEvents } from './ui/soundEvents';
import { createSnapButtons } from './ui/snapButtons';
import { createPatternsToggle } from './ui/patternsToggle';


declare global {
  interface Window {
    __t3tris?: { game: Game };
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
inspectButton.append(inspectIcon());
const inspectLabel = document.createElement('span');
inspectLabel.textContent = 'INSPECT';
inspectButton.append(inspectLabel);
inspectButton.setAttribute('aria-pressed', 'false');

const soundToggle = createSoundToggle();
const patternsToggle = createPatternsToggle();

const game = createGame(Math.random);
// The game is open on the window, so the page (and a test) can look at the
// state it is in.
window.__t3tris = { game };
const scene = createScene(stage);
// The best score is kept between visits, so it is read once and shared by
// the counter and the game-over panel.
const best = createBestScore();
createSoundEvents(game, best);
stage.append(createGameOver(game, best));
const counters = createCounters(game, best);
const undoButton = createUndoButton(game).element;
const holdCard = createHoldCard(game).element;
const nextCard = createNextCard(game).element;

// The view-snap buttons sit next to the INSPECT button and only show up
// while inspect mode is on; controls.ts reports that through onInspectChange.
const snapButtons = createSnapButtons({
  game,
  onSnap: (snap) => scene.snapView(snap),
});

game.subscribe((state) => scene.sync(state));
scene.sync(game.getState());

const nav = createNav();
const hero = createHero();
const play = createPlaySection({
  stage,
  holdCard,
  nextCard,
  inspectButton,
  snapRow: snapButtons.element,
  undoButton,
  counters,
  soundToggle: soundToggle.element,
  patternsToggle: patternsToggle.element,
});
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
  soundToggle,
  isInView: play.isInView,
  onInspectChange: (on) => snapButtons.setInspecting(on),
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
// out of the way. It also waits for the webfonts: a settled font layout means
// the stylesheet has applied, so the theme tokens are read as their real
// values instead of empty strings.
void introReady.then(async () => {
  await document.fonts?.ready;
  scene.refreshTheme();
});
