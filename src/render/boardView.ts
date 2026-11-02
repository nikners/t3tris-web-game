import * as THREE from 'three';
import { HEIGHT, WIDTH } from '../logic/board';
import type { Board } from '../logic/board';
import type { ThemeContext } from './scene';
import type { TetrominoType } from '../logic/pieces';
import { getPatternTexture } from './markers';
import * as patterns from '../ui/patterns';

// Line-clear feedback (render-only). Rows flash white→blue and fade over
// CLEAR_FLASH_SECONDS, then the rows above the clears slide down, finishing
// within CLEAR_TOTAL_SECONDS (~0.28s total, under the 0.3s budget).
const CLEAR_FLASH_SECONDS = 0.18;

const CLEAR_TOTAL_SECONDS = 0.28;

const EMPTY_TONE = '.';

export class BoardView {
  readonly group = new THREE.Group();

  private readonly cellGeometry = new THREE.PlaneGeometry(1, 1);

  private readonly cellEdgesGeometry = new THREE.EdgesGeometry(this.cellGeometry);

  private readonly gridMaterial: THREE.LineBasicMaterial;

  private readonly frameMaterial: THREE.LineBasicMaterial;

  private readonly baseMaterial: THREE.MeshBasicMaterial;

  private readonly base: THREE.Mesh;

  private readonly grid: THREE.LineSegments;

  private readonly frame: THREE.LineSegments;

  private readonly cells: THREE.Mesh[] = [];

  private readonly toneMaterials = new Map<string, THREE.MeshBasicMaterial>();

  private readonly outlineMaterials = new Map<string, THREE.LineBasicMaterial>();

  private clearAnimation: {
    rows: number[];
    settled: Board;
    finalBoard: Board;
    sourceOfFinalRow: Array<number | null>;
    age: number;
    overlays: THREE.Mesh[];
    overlayMaterials: THREE.MeshBasicMaterial[];
    whitePulse: THREE.Color;
    bluePulse: THREE.Color;
  } | null = null;

  private readonly theme: ThemeContext;

  private stopPatterns?: () => void;

  constructor(theme: ThemeContext) {
    this.theme = theme;

    this.gridMaterial = new THREE.LineBasicMaterial({ color: theme.boardLine });
    this.frameMaterial = new THREE.LineBasicMaterial({ color: theme.boardEdge });
    this.baseMaterial = new THREE.MeshBasicMaterial({ color: theme.boardBase });

    this.base = new THREE.Mesh(this.cellGeometry, this.baseMaterial);
    this.base.scale.set(WIDTH, HEIGHT, 1);
    this.base.rotation.x = -Math.PI / 2;
    this.base.position.y = -0.02;

    this.grid = new THREE.LineSegments(buildGridGeometry(), this.gridMaterial);
    this.frame = new THREE.LineSegments(buildFrameGeometry(), this.frameMaterial);

    this.group.add(this.base, this.grid, this.frame);

    for (let row = 0; row < HEIGHT; row++) {
      for (let column = 0; column < WIDTH; column++) {
        const cell = new THREE.Mesh(this.cellGeometry, this.toneFor(EMPTY_TONE));
        cell.add(new THREE.LineSegments(this.cellEdgesGeometry, this.outlineFor(EMPTY_TONE)));
        cell.rotation.x = -Math.PI / 2;
        cell.position.set(columnToWorldX(column), 0.01, rowToWorldZ(row));
        cell.visible = false;
        this.cells.push(cell);
        this.group.add(cell);
      }
    }

    this.stopPatterns = patterns.subscribe(() => {
      this.refreshPatterns();
    });
  }

  private refreshPatterns(): void {
    // Re-apply materials for all visible cells
    for (let row = 0; row < HEIGHT; row++) {
      for (let column = 0; column < WIDTH; column++) {
        const cell = this.cells[row * WIDTH + column];
        if (cell.visible) {
          const material = this.toneFor((cell.userData?.value as string) || '.');
          cell.material = material;
          if (cell.children[0]) {
            const outline = this.outlineFor((cell.userData?.value as string) || '.');
            (cell.children[0] as THREE.LineSegments).material = outline;
          }
        }
      }
    }
  }

  update(board: Board): void {
    for (let row = 0; row < HEIGHT; row++) {
      for (let column = 0; column < WIDTH; column++) {
        const cell = this.cells[row * WIDTH + column];
        const value = board[row][column];

        cell.userData.value = value;
        cell.visible = value !== '.';
        cell.material = this.toneFor(value);
        cell.children[0].visible = cell.visible;

        if (cell.visible) {
          (cell.children[0] as THREE.LineSegments).material = this.outlineFor(value);
        }
      }
    }
  }

  // Render-only line clear: freeze copies of the cleared rows (from the settled
  // pre-clear board), flash them white→blue while fading, then slide the rows
  // above down one row per cleared line. Logic already replaced the board; the
  // locked cells hide under the flash overlays until the slide finishes.
  // Render-only line clear. Logic already collapsed the board; we show the
  // cleared rows as bright overlays that pulse white→blue and fade, while the
  // surviving rows visually slide down from their original positions. Done
  // state restores the exact final board.
  playClear(rows: number[], settled: Board, finalBoard: Board): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // logic already replaced the board; nothing to animate
    }

    this.clearClear();

    // Which original row feeds each final row (final rows start empty at top).
    const clearedSet = new Set(rows);
    const sourceOfFinalRow: Array<number | null> = [];
    for (let y = 0; y < HEIGHT; y++) {
      sourceOfFinalRow.push(y < rows.length ? null : null);
    }
    let nextFinal = rows.length;
    for (let y = 0; y < HEIGHT; y++) {
      if (!clearedSet.has(y)) {
        sourceOfFinalRow[nextFinal] = y;
        nextFinal++;
      }
    }

    const overlays: THREE.Mesh[] = [];
    const overlayMaterials: THREE.MeshBasicMaterial[] = [];

    for (const row of rows) {
      for (let column = 0; column < WIDTH; column++) {
        const value = settled[row][column];
        if (value === '.') {
          continue;
        }

        const material = new THREE.MeshBasicMaterial({
          color: this.theme.tones[value as keyof ThemeContext['tones']] ?? this.theme.boardEdge,
          transparent: true,
          opacity: 1,
          depthWrite: false,
        });
        if (patterns.get()) {
          material.map = getPatternTexture(value as TetrominoType, this.theme);
        }
        const overlay = new THREE.Mesh(this.cellGeometry, material);
        overlay.rotation.x = -Math.PI / 2;
        overlay.position.set(columnToWorldX(column), 0.03, rowToWorldZ(row));
        overlayMaterials.push(material);
        overlays.push(overlay);
        this.group.add(overlay);
      }
    }

    this.clearAnimation = {
      rows,
      settled,
      finalBoard: finalBoard.map((r) => [...r]),
      sourceOfFinalRow,
      age: 0,
      overlays,
      overlayMaterials,
      whitePulse: new THREE.Color('#ffffff'),
      bluePulse: new THREE.Color(this.theme.boardEdge),
    };
  }

  private clearClear(): void {
    if (!this.clearAnimation) {
      return;
    }

    this.clearAnimation.overlayMaterials.forEach((material) => material.dispose());
    this.clearAnimation.overlays.forEach((overlay) => this.group.remove(overlay));
    this.clearAnimation = null;
    this.resetCellPositions();
  }

  // Restores every cell to its canonical grid slot (position is state set by
  // the constructor; the slide animation mutates it).
  private resetCellPositions(): void {
    for (let row = 0; row < HEIGHT; row++) {
      for (let column = 0; column < WIDTH; column++) {
        this.cells[row * WIDTH + column].position.z = rowToWorldZ(row);
      }
    }
  }

  tick(delta: number): void {
    const state = this.clearAnimation;
    if (!state) {
      return;
    }

    const done = state.age + delta >= CLEAR_TOTAL_SECONDS;
    state.age = Math.min(state.age + delta, CLEAR_TOTAL_SECONDS);

    const flashT = Math.min(state.age / CLEAR_FLASH_SECONDS, 1);
    const slideT = Math.max(0, Math.min((state.age - CLEAR_FLASH_SECONDS) / (CLEAR_TOTAL_SECONDS - CLEAR_FLASH_SECONDS), 1));
    const eased = 1 - (1 - slideT) * (1 - slideT); // ease-out slide

    // Cleared rows: pulse white→blue while fading out.
    const pulse = state.whitePulse.clone().lerp(state.bluePulse, flashT);

    for (const material of state.overlayMaterials) {
      material.color.copy(pulse);
      material.opacity = 1 - flashT;
    }

    // Surviving rows: show their pre-clear content sliding to final slots.
    for (let y = 0; y < HEIGHT; y++) {
      const source = state.sourceOfFinalRow[y];

      for (let column = 0; column < WIDTH; column++) {
        const cell = this.cells[y * WIDTH + column];

        if (source === null) {
          cell.visible = false;
          continue;
        }

        const value = state.settled[source][column];
        cell.userData.value = value;
        cell.visible = value !== '.';

        if (value !== '.') {
          cell.material = this.toneFor(value);
          (cell.children[0] as THREE.LineSegments).material = this.outlineFor(value);
        }

        cell.position.z = rowToWorldZ(source) + (rowToWorldZ(y) - rowToWorldZ(source)) * eased;
      }
    }

    if (done) {
      this.clearClear();
      this.update(state.finalBoard);
    }
  }

  private outlineFor(value: string): THREE.LineBasicMaterial {
    const tone = this.theme.edges[value as keyof ThemeContext['edges']];
    const color = tone ?? this.theme.boardLine;

    let material = this.outlineMaterials.get(color);

    if (!material) {
      material = new THREE.LineBasicMaterial({ color });
      this.outlineMaterials.set(color, material);
    }

    return material;
  }

  private toneFor(value: string): THREE.MeshBasicMaterial {
    const tone = this.theme.tones[value as keyof ThemeContext['tones']];
    const color = tone ?? (value === EMPTY_TONE ? this.theme.boardBase : this.theme.boardLine);

    const key = `${value}|${patterns.get() ? 'p' : 'n'}`;
    let material = this.toneMaterials.get(key);

    if (!material) {
      material = new THREE.MeshBasicMaterial({ color });
      if (patterns.get() && value !== EMPTY_TONE && value !== '.') {
        material.map = getPatternTexture(value as TetrominoType, this.theme);
      }
      this.toneMaterials.set(key, material);
    } else if (patterns.get() && value !== EMPTY_TONE && value !== '.' && !material.map) {
      material.map = getPatternTexture(value as TetrominoType, this.theme);
      material.needsUpdate = true;
    } else if (!patterns.get() && material.map) {
      material.map = null;
      material.needsUpdate = true;
    }

    return material;
  }

  dispose(): void {
    this.stopPatterns?.();
    this.cellGeometry.dispose();
    this.grid.geometry.dispose();
    this.frame.geometry.dispose();
    this.gridMaterial.dispose();
    this.frameMaterial.dispose();
    this.baseMaterial.dispose();
    this.toneMaterials.forEach((material) => material.dispose());
    this.toneMaterials.clear();
    this.outlineMaterials.forEach((material) => material.dispose());
    this.outlineMaterials.clear();
    this.cellEdgesGeometry.dispose();
    this.group.clear();
  }
}

export function columnToWorldX(column: number): number {
  return column - (WIDTH - 1) / 2;
}

export function rowToWorldZ(row: number): number {
  return row - (HEIGHT - 1) / 2;
}

function buildGridGeometry(): THREE.BufferGeometry {
  const points: number[] = [];

  for (let column = 0; column <= WIDTH; column++) {
    const x = column - WIDTH / 2;
    points.push(x, 0, -HEIGHT / 2, x, 0, HEIGHT / 2);
  }

  for (let row = 0; row <= HEIGHT; row++) {
    const z = row - HEIGHT / 2;
    points.push(-WIDTH / 2, 0, z, WIDTH / 2, 0, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

  return geometry;
}

function buildFrameGeometry(): THREE.BufferGeometry {
  const left = -WIDTH / 2;
  const right = WIDTH / 2;
  const near = -HEIGHT / 2;
  const far = HEIGHT / 2;
  const y = 0.005;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        left, y, near, right, y, near,
        right, y, near, right, y, far,
        right, y, far, left, y, far,
        left, y, far, left, y, near,
      ],
      3,
    ),
  );

  return geometry;
}
