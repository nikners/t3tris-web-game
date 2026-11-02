import * as THREE from 'three';
import { HEIGHT, WIDTH, merge, clearLines } from '../logic/board';
import { TONE_TOKEN } from '../logic/pieces';
import type { Matrix, TetrominoType } from '../logic/pieces';
import type { GameState } from '../logic/game';
import { BoardView } from './boardView';
import { PieceMesh, type ViewSnap } from './pieceMesh';
import { LandingFx } from './landingFx';
import type { LandingCell } from './landingFx';

export interface ThemeContext {
  boardLine: string;
  boardEdge: string;
  boardBase: string;
  light: string;
  tones: Record<TetrominoType, string>;
  /** Block edge outline color per tone: ink for light tones, a lighter token for dark ones. */
  edges: Record<TetrominoType, string>;
  mark: string;
  markDark: string;
}

export interface Scene {
  sync(state: GameState): void;
  /** Starts the render loop. Deferred so a page-load intro can run first. */
  start(): void;
  refreshTheme(): void;
  setInspecting(on: boolean): void;
  resetView(): void;
  snapView(snap: ViewSnap): void;
  applyTilt(dx: number, dy: number): void;
  applyZoom(delta: number): void;
  isInspecting(): boolean;
  isDropping(): boolean;
  dispose(): void;
}

const TONE_TYPES: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

// Tones too dark for an ink outline — they get a lighter edge from a token.
const DARK_TONE_TYPES: TetrominoType[] = ['T', 'S', 'J'];

const FOCUS_PADDING = 1.28;

// The class that shakes the board canvas after a long drop.
const SHAKE_CLASS = 'board-canvas--shake';

const CAMERA_TILT = 0.31;

const CAMERA_DISTANCE = 120;

function cameraDirection(): THREE.Vector3 {
  return new THREE.Vector3(0, Math.cos(CAMERA_TILT), Math.sin(CAMERA_TILT));
}

export function readThemeTokens(): ThemeContext {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();

  const tones = {} as Record<TetrominoType, string>;
  for (const type of TONE_TYPES) {
    tones[type] = read(TONE_TOKEN[type]);
  }

  const edgeInk = read('--color-ink');
  const edgeLight = read('--color-line');
  const edges = {} as Record<TetrominoType, string>;
  for (const type of TONE_TYPES) {
    edges[type] = DARK_TONE_TYPES.includes(type) ? edgeLight : edgeInk;
  }

  return {
    boardLine: read('--color-line'),
    boardEdge: read('--color-blue'),
    boardBase: read('--color-card'),
    light: read('--color-white'),
    tones,
    edges,
    mark: read('--color-mark'),
    markDark: read('--color-mark-dark'),
  };
}

export function createScene(container: HTMLElement): Scene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.classList.add('board-canvas');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();

  const theme = readThemeTokens();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  camera.position.copy(cameraDirection()).multiplyScalar(CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(theme.light, 2.2);
  const keyLight = new THREE.DirectionalLight(theme.light, 2.6);
  keyLight.position.set(5, 14, 9);
  scene.add(ambient, keyLight);

  let boardView = new BoardView(readThemeTokens());
  let piece = new PieceMesh(readThemeTokens());
  let landingFx = new LandingFx(readThemeTokens(), { onShake: shake });
  scene.add(boardView.group, piece.group, landingFx.group);

  let latest: GameState | null = null;
  let frame = 0;
  let started = false;
  let previousTime = performance.now();

  function size(): { width: number; height: number } {
    return {
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
    };
  }

  function placeCamera(): void {
    const { width, height } = size();
    const aspect = width / height;

    const halfHeight = Math.max((HEIGHT * FOCUS_PADDING) / 2, (WIDTH * FOCUS_PADDING) / 2 / aspect);
    const halfWidth = halfHeight * aspect;

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  function resize(): void {
    const { width, height } = size();

    renderer.setSize(width, height, false);
    placeCamera();
    renderer.render(scene, camera);
  }

  function rebuildViews(): void {
    const previousBoard = boardView;
    const previousPiece = piece;
    const previousLanding = landingFx;

    boardView = new BoardView(readThemeTokens());
    piece = new PieceMesh(readThemeTokens());
    landingFx = new LandingFx(readThemeTokens(), { onShake: shake });

    scene.remove(previousBoard.group, previousPiece.group, previousLanding.group);
    previousBoard.dispose();
    previousPiece.dispose();
    previousLanding.dispose();
    scene.add(boardView.group, piece.group, landingFx.group);

    if (latest) {
      syncToState(latest);
    }
  }

  function syncToState(state: GameState): void {
    boardView.update(state.board);
    piece.setPiece(state.active.type, state.active.shape);
    piece.place(state.active.x, state.active.y, state.ghostY);
  }

  // Line-clear feedback: reconstruct the settled board (pre-lock board + the
  // active piece stamped in) with the logic helpers, find the full rows, and
  // only play the animation if the emitted board matches clearing them — so
  // this stays a read-only render-side diff, never a source of truth.
  function detectClear(state: GameState): void {
    if (!latest || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const settled = merge(latest.board, latest.active.shape, latest.active.x, latest.active.y);
    const cleared = clearLines(settled);

    if (cleared.rows.length === 0) {
      return;
    }

    const matches = cleared.board.every((row, y) =>
      row.every((cell, x) => cell === state.board[y][x]),
    );

    if (!matches) {
      return;
    }

    boardView.playClear(cleared.rows, settled, state.board);
  }

  // Detects a hard drop between consecutive states and runs the render-only
  // slide/squash. A drop means: same piece type and x, active y jumped down,
  // and the landing position matches the previous ghost position exactly.
  function detectDrop(state: GameState): void {
    if (!latest) {
      return;
    }

    const previous = latest;
    const samePiece = previous.active.type === state.active.type;

    if (!samePiece) {
      return;
    }

    if (previous.active.x !== state.active.x) {
      return;
    }

    if (state.active.y === previous.active.y) {
      return;
    }

    if (state.active.y !== previous.ghostY) {
      return;
    }

    const fromZ = previous.active.y + centerYOf(previous.active.shape) - (HEIGHT - 1) / 2;
    const toZ = state.active.y + centerYOf(state.active.shape) - (HEIGHT - 1) / 2;

    if (fromZ === toZ) {
      return;
    }

    piece.startDrop(state.active.type, state.active.shape, state.active.x, state.active.y, fromZ, toZ, () => {});
  }

  // Landing feedback: the logic locked the piece and spawned the next one, so
  // a change of the active piece is the signal that something landed. The
  // landing spot is where the ghost was, and the cells are the ones the piece
  // filled. This only reads the two states — the logic stays untouched.
  function detectLanding(state: GameState): void {
    if (!latest || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const previous = latest;

    // The same piece means nothing was locked.
    if (previous.active.type === state.active.type) {
      return;
    }

    // A reset empties the board and spawns a fresh piece: nothing landed.
    const boardHasBlocks = state.board.some((row) => row.some((cell) => cell !== '.'));
    if (!boardHasBlocks) {
      return;
    }

    const landingY = previous.ghostY;
    const cells: LandingCell[] = [];

    previous.active.shape.forEach((row, sy) => {
      row.forEach((cell, sx) => {
        if (cell === '.') {
          return;
        }
        cells.push({ x: previous.active.x + sx, y: landingY + sy });
      });
    });

    if (cells.length === 0) {
      return;
    }

    landingFx.play(cells, previous.active.type, landingY - previous.active.y);
  }

  // An undo puts the last drop back: the board loses the locked cells and
  // the piece that was on it comes back to where it was. The drop, clear and
  // landing feedback would read that as a fresh drop, so it is skipped. The
  // undo count is the signal for it: it only goes down when a turn is taken
  // back, and a restart fills it up again.
  function isUndo(previous: GameState, state: GameState): boolean {
    return state.undosLeft < previous.undosLeft;
  }

  // The board canvas nudges two pixels and stops. Only the canvas moves, so
  // the page around it never shifts.
  function shake(): void {
    const canvas = renderer.domElement;

    canvas.classList.remove(SHAKE_CLASS);
    // Restart the animation when a shake is already running.
    void canvas.offsetWidth;
    canvas.classList.add(SHAKE_CLASS);
  }

  function centerYOf(shape: Matrix): number {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] !== '.') {
          min = Math.min(min, sy);
          max = Math.max(max, sy);
        }
      }
    }
    return (min + max) / 2;
  }

  function loop(): void {
    frame = requestAnimationFrame(loop);

    const now = performance.now();
    const delta = Math.min((now - previousTime) / 1000, 0.1);
    previousTime = now;

    piece.update(delta);
    boardView.tick(delta);
    landingFx.tick(delta);
    renderer.render(scene, camera);
  }

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);

  // The shake class is only there for the length of the animation.
  const onAnimationEnd = () => renderer.domElement.classList.remove(SHAKE_CLASS);
  renderer.domElement.addEventListener('animationend', onAnimationEnd);

  resize();

  return {
    sync(state) {
      if (!latest || !isUndo(latest, state)) {
        detectDrop(state);
        detectClear(state);
        detectLanding(state);
      }

      latest = state;
      syncToState(state);
      renderer.render(scene, camera);
    },

    start() {
      if (started) {
        return;
      }

      started = true;
      previousTime = performance.now();
      loop();
    },

    refreshTheme() {
      rebuildViews();
      renderer.render(scene, camera);
    },

    setInspecting(on) {
      piece.setInspecting(on);
    },

    resetView() {
      piece.resetView();
    },

    snapView(snap) {
      piece.snapView(snap);
    },

    applyTilt(dx, dy) {
      piece.applyTilt(dx, dy);
    },

    applyZoom(delta) {
      piece.applyZoom(delta);
    },

    isInspecting() {
      return piece.isInspecting();
    },

    isDropping() {
      return piece.isDropping();
    },

    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('animationend', onAnimationEnd);
      boardView.dispose();
      piece.dispose();
      landingFx.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
