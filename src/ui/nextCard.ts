// The NEXT card: the three pieces that are coming, drawn with plain DOM
// squares so the board keeps its single WebGL canvas.
//
// The card reads the preview from the game state, so the pieces it shows are
// exactly the ones that spawn next.
import type { Game, GameState } from '../logic/game';
import { buildMiniPiece } from './miniPiece';
import type { TetrominoType } from '../logic/pieces';

const PREVIEW_COUNT = 3;

export interface NextCard {
  element: HTMLElement;
}

export function createNextCard(game: Game): NextCard {
  const card = document.createElement('div');
  card.className = 'card next-card';

  const strip = document.createElement('div');
  strip.className = 'card__strip';

  const label = document.createElement('p');
  label.className = 'card__label';
  label.textContent = 'NEXT';

  strip.append(label);

  const body = document.createElement('div');
  body.className = 'card__body next-card__body';

  // One slot per previewed piece: the first one is the piece that spawns
  // next, so it gets the big one.
  const slots: HTMLElement[] = [];

  for (let index = 0; index < PREVIEW_COUNT; index++) {
    const slot = document.createElement('div');
    slot.className = index === 0 ? 'next-card__slot next-card__slot--first' : 'next-card__slot';
    slots.push(slot);
    body.append(slot);
  }

  card.append(strip, body);

  // The last preview that was drawn, so a move or a turn does not rebuild
  // the card.
  let drawn: TetrominoType[] = [];

  function render(state: GameState): void {
    if (state.next.length === drawn.length && state.next.every((type, i) => type === drawn[i])) {
      return;
    }

    drawn = [...state.next];

    slots.forEach((slot, index) => {
      const type = drawn[index];
      slot.replaceChildren();

      if (!type) {
        return;
      }

      slot.append(buildMiniPiece(type));
    });
  }

  game.subscribe(render);
  render(game.getState());

  return { element: card };
}
