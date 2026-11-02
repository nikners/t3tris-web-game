// The HOLD card: the piece that has been put aside, drawn with the same
// plain squares the NEXT card uses.
//
// While the hold is locked for the piece on the board, the card is dimmed,
// so the board says at a glance that holding would do nothing right now.
import type { Game, GameState } from '../logic/game';
import { buildMiniPiece } from './miniPiece';
import type { TetrominoType } from '../logic/pieces';

export interface HoldCard {
  element: HTMLElement;
}

export function createHoldCard(game: Game): HoldCard {
  const card = document.createElement('div');
  card.className = 'card hold-card';

  const strip = document.createElement('div');
  strip.className = 'card__strip';

  const label = document.createElement('p');
  label.className = 'card__label';
  label.textContent = 'HOLD';

  strip.append(label);

  const body = document.createElement('div');
  body.className = 'card__body hold-card__body';

  // The slot keeps the card the same size whether a piece is in it or not.
  const slot = document.createElement('div');
  slot.className = 'hold-card__slot hold-card__slot--empty';

  body.append(slot);

  card.append(strip, body);

  // What the card last drew, so a move or a turn does not rebuild it.
  let held: TetrominoType | null = null;
  let locked = false;

  function render(state: GameState): void {
    if (state.held === held && state.holdUsed === locked) {
      return;
    }

    held = state.held;
    locked = state.holdUsed;

    slot.replaceChildren();
    slot.classList.toggle('hold-card__slot--empty', held === null);

    if (held !== null) {
      slot.append(buildMiniPiece(held));
    }

    // A locked hold is dimmed: the piece is there, but it cannot be used
    // until the next piece spawns.
    card.classList.toggle('hold-card--locked', locked);
  }

  game.subscribe(render);
  render(game.getState());

  return { element: card };
}
