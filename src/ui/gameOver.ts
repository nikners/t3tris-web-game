import type { Game, GameState } from '../logic/game';

export function createGameOver(game: Game): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'game-over';
  overlay.hidden = true;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-labelledby', 'game-over-title');

  // Keep clicks on the overlay from reaching the stage's pointer-drag handler.
  overlay.addEventListener('pointerdown', (event) => event.stopPropagation());

  const panel = document.createElement('div');
  panel.className = 'game-over__panel';

  const title = document.createElement('h2');
  title.id = 'game-over-title';
  title.className = 'game-over__title';
  title.textContent = 'Game over';

  const score = document.createElement('p');
  score.className = 'game-over__score';

  const restart = document.createElement('button');
  restart.type = 'button';
  restart.className = 'cta';
  restart.textContent = 'Restart';
  restart.addEventListener('click', () => game.reset());

  const hint = document.createElement('p');
  hint.className = 'game-over__hint';
  hint.textContent = 'or press R';

  panel.append(title, score, restart, hint);
  overlay.append(panel);

  function update(state: GameState): void {
    const over = state.status === 'gameover';
    overlay.hidden = !over;
    overlay.classList.toggle('game-over--shown', over);

    if (over) {
      score.textContent = `Final score ${state.score}`;
    }
  }

  game.subscribe(update);
  update(game.getState());

  return overlay;
}