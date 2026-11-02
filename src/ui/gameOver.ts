import type { Game, GameState } from '../logic/game';
import type { BestScore } from './bestScore';
import { restartIcon } from './icons';

export function createGameOver(game: Game, best: BestScore): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'game-over';
  overlay.hidden = true;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-labelledby', 'game-over-title');

  // Keep clicks on the overlay from reaching the stage's pointer-drag handler.
  overlay.addEventListener('pointerdown', (event) => event.stopPropagation());

  const panel = document.createElement('div');
  panel.className = 'game-over__panel';

  // A small tag for a game that beat the best score.
  const badge = document.createElement('span');
  badge.className = 'game-over__badge';
  badge.textContent = 'NEW BEST';
  badge.hidden = true;

  const title = document.createElement('h2');
  title.id = 'game-over-title';
  title.className = 'game-over__title';
  title.textContent = 'Game over';

  const score = document.createElement('p');
  score.className = 'game-over__score';

  const restart = document.createElement('button');
  restart.type = 'button';
  restart.className = 'cta';
  restart.append(restartIcon());
  const restartLabel = document.createElement('span');
  restartLabel.textContent = 'Restart';
  restart.append(restartLabel);
  restart.addEventListener('click', () => {
    game.reset();

    // The focus goes back to the page, so the next Space press is a hard
    // drop instead of another restart.
    restart.blur();
  });

  const hint = document.createElement('p');
  hint.className = 'game-over__hint';
  hint.append('or press ');
  const hintKey = document.createElement('span');
  hintKey.className = 'keycap';
  hintKey.textContent = 'R';
  hint.append(hintKey);

  panel.append(badge, title, score, restart, hint);
  overlay.append(panel);

  // The status the panel last saw, so the best is only recorded once per
  // finished game and a later update cannot take the tag away again.
  let lastStatus: GameState['status'] = 'playing';
  // The score of the game that just ended, when it was a new best, so the
  // record can be given back if the game over is taken back.
  let recordedScore: number | null = null;

  // Puts the best score back when the game over it came from is undone: the
  // game was not really over, so its score does not count.
  function takeBack(): void {
    if (recordedScore === null) {
      return;
    }

    best.revert(recordedScore);
    recordedScore = null;
  }

  function update(state: GameState): void {
    const over = state.status === 'gameover';
    const wasOver = lastStatus === 'gameover';

    overlay.hidden = !over;
    overlay.classList.toggle('game-over--shown', over);

    if (wasOver && !over) {
      // The game is playing again: the drop that ended it was taken back,
      // so the score it ended with is not final.
      takeBack();
    }

    if (!over) {
      badge.hidden = true;
      lastStatus = state.status;

      return;
    }

    score.textContent = `Final score ${state.score}`;

    // The score of the game that just ended is kept when it is the best.
    if (!wasOver) {
      recordedScore = best.record(state.score) ? state.score : null;
      badge.hidden = recordedScore === null;
    }

    lastStatus = state.status;
  }

  game.subscribe(update);
  update(game.getState());

  return overlay;
}