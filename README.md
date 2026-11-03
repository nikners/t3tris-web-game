# T3TRIS

A no-timer block game where every piece is a 3D model you can orbit, tilt and zoom before you place it. Nothing falls on a clock: move and rotate until the ghost outline sits where you want it, hard drop to lock, clear lines, take the next piece.

Built with Vite, TypeScript and Three.js.

## Run it locally

```sh
npm install
npm run dev
```

Then open the local server (default port 5173).

Run the tests with:

```sh
npm test
```

(`npm run typecheck` and `npm run build` are also available.)

## Controls

The board only owns the keys while it is on screen. The same actions are also available as buttons under the board (INSPECT, UNDO, SOUND, PATTERNS).

| Action | Keys | What it does |
| --- | --- | --- |
| Movement | ← / A, → / D | Move the piece left or right |
| Rotation | ↑ / W, ↓ / S | Rotate clockwise / counter-clockwise |
| Hard Drop | Space / Enter | Lock the piece at the ghost position |
| Hold | C / Shift | Put the piece aside; the hold is locked until the next piece spawns |
| Undo | U | Put the last drop back (up to 3 per game) |
| Pause / Restart | — / R | No pause: the game has no timers, so there is nothing to pause. R restarts |
| Inspect | Tab / Esc | Toggle inspect mode: drag to tilt/orbit, scroll to zoom |
| Patterns | P | Toggle the colorblind pattern markings on pieces and locked blocks |
| Sound | M | Toggle sound |
| Snaps 1–4 | 1 / 2 / 3 / 4 | Snap the inspect view: front / top / side / iso (only while inspecting) |

While inspecting, `0` resets the piece view to the default pose.

## Project layout

```
src/
  logic/    Pure game rules: board, pieces, game state, scoring, undo. No DOM.
  render/   Three.js 3D board: scene, board view, piece mesh, pattern markers,
            landing effects.
  ui/       DOM interface: NEXT and HOLD cards, counters, and the toggles
            (sound, patterns, undo), plus the page sections.
  styles/   CSS: design tokens, layout, components.
  input/    Keyboard and pointer controls.
  main.ts   Entry point: wires logic, render and UI together.
```

Tests live next to the logic they cover (`src/logic/*.test.ts`) and run with Vitest.
