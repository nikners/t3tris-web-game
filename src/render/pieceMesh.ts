import * as THREE from 'three';
import { HEIGHT, WIDTH } from '../logic/board';
import type { Matrix } from '../logic/pieces';
import type { TetrominoType } from '../logic/pieces';
import type { ThemeContext } from './scene';

// Hard-drop animation: quick slide down to the landing spot, then a squash.
// Render-only: logic has already locked the piece; this shows the motion.
const DROP_SLIDE_SECONDS = 0.08;

const DROP_SQUASH_SECONDS = 0.06;

const DROP_SQUASH_AMOUNT = 0.92;

export interface InspectPose {
  tiltX: number;
  tiltY: number;
  zoom: number;
}

// Full cell footprint so the resting piece's edges sit on the grid lines.
// 0.002 inset keeps adjacent block side-faces from z-fighting.
const BLOCK_SIZE = 0.998;

// y of locked cell planes in boardView.ts — keep in sync.
const CELL_PLANE_Y = 0.01;

const REST_HEIGHT = CELL_PLANE_Y + BLOCK_SIZE / 2;

const HOVER_HEIGHT = 1.05;

const GHOST_LIFT = 0.04;

const DEFAULT_POSE: InspectPose = { tiltX: 0, tiltY: 0, zoom: 1 };

const MAX_TILT = Math.PI / 3;

const MIN_ZOOM = 0.5;

const MAX_ZOOM = 2.4;

const TILT_PER_PIXEL = 0.0062;

const ZOOM_PER_STEP = 0.16;

const EASE_RATE = 8;

const INSTANT_RATE = 400;

const BLOCK_COUNT = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Edge direction maps: neighbor offset → the two endpoints of the shared
// cell boundary, in local units (cell = 1x1, origin at the piece center).
const EDGE_ENDPOINTS: Record<Direction, [[number, number], [number, number]]> = {
  up: [[-0.5, -0.5], [0.5, -0.5]],
  down: [[-0.5, 0.5], [0.5, 0.5]],
  left: [[-0.5, -0.5], [-0.5, 0.5]],
  right: [[0.5, -0.5], [0.5, 0.5]],
};

type Direction = 'up' | 'down' | 'left' | 'right';

type Cell = [number, number];

interface DropAnimation {
  phase: 'slide' | 'squash';
  age: number;
  fromZ: number;
  toZ: number;
  onDone: () => void;
  done: boolean;
}

// Dashed ghost outline: small dash/gap so it reads as a dotted silhouette.
const GHOST_DASH = 0.09;

const GHOST_GAP = 0.07;

const GHOST_FILL_OPACITY = 0.06;

// Marching ants: the dashed ghost outline slowly crawls along its perimeter.
const GHOST_DASH_SPEED = 0.55; // world units per second

// Spawn animation: new pieces fade and scale in over this duration.
const SPAWN_SECONDS = 0.15;

// Blocks use MeshLambertMaterial (lit) — animate opacity via transparent flag.
const SPAWN_START_SCALE = 0.6;

// Builds the piece silhouette outline: every edge between a filled cell and an
// empty neighbor (or the shape boundary). Interior edges are skipped.
function buildSilhouette(cells: Cell[]): THREE.BufferGeometry {
  const occupied = new Set(cells.map(([sx, sy]) => `${sx},${sy}`));
  const points: number[] = [];

  for (const [sx, sy] of cells) {
    const borders: Array<[Direction, Cell]> = [
      ['up', [sx, sy - 1]],
      ['down', [sx, sy + 1]],
      ['left', [sx - 1, sy]],
      ['right', [sx + 1, sy]],
    ];

    for (const [direction, [nx, ny]] of borders) {
      if (occupied.has(`${nx},${ny}`)) {
        continue;
      }

      const [[ax, az], [bx, bz]] = EDGE_ENDPOINTS[direction];
      points.push(sx + ax, 0, sy + az, sx + bx, 0, sy + bz);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

  return geometry;
}

// Faint fill of the silhouette: one flat quad per filled cell.
function buildSilhouetteFill(cells: Cell[]): THREE.BufferGeometry {
  const points: number[] = [];

  for (const [sx, sy] of cells) {
    points.push(
      sx - 0.5, 0, sy - 0.5,
      sx - 0.5, 0, sy + 0.5,
      sx + 0.5, 0, sy + 0.5,
      sx - 0.5, 0, sy - 0.5,
      sx + 0.5, 0, sy + 0.5,
      sx + 0.5, 0, sy - 0.5,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

  return geometry;
}

export class PieceMesh {
  readonly group = new THREE.Group();

  private readonly theme: ThemeContext;

  private readonly blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

  private readonly blockEdgesGeometry = new THREE.EdgesGeometry(this.blockGeometry);

  private readonly phantomRoot = new THREE.Group();

  private readonly phantomEdge: THREE.LineSegments;

  private readonly phantomFill: THREE.Mesh;

  private readonly phantomEdgeMaterial: THREE.LineDashedMaterial;

  private readonly phantomFillMaterial: THREE.MeshBasicMaterial;

  private phantomDashOffset = 0;

  private baselineDistances: Float32Array = new Float32Array(0);

  private spawnAge = SPAWN_SECONDS; // seconds since the current piece spawned

  private readonly materials = new Map<string, THREE.MeshLambertMaterial>();

  private readonly outlineMaterials = new Map<string, THREE.LineBasicMaterial>();

  private readonly pieceRoot = new THREE.Group();

  private readonly pivot = new THREE.Group();

  private readonly blocks: THREE.Mesh[] = [];

  private type: TetrominoType | null = null;

  private cells: Array<[number, number]> = [];

  private center: [number, number] = [0, 0];

  private pose: InspectPose = { ...DEFAULT_POSE };

  private targetPose: InspectPose = { ...DEFAULT_POSE };

  private hoverY = REST_HEIGHT;

  private inspecting = false;

  private dropAnimation: DropAnimation | null = null;

  private readonly dropRoot = new THREE.Group();

  constructor(theme: ThemeContext) {
    this.theme = theme;

    this.phantomEdgeMaterial = new THREE.LineDashedMaterial({
      color: theme.boardEdge,
      dashSize: GHOST_DASH,
      gapSize: GHOST_GAP,
    });
    this.phantomDashOffset = 0;
    this.phantomFillMaterial = new THREE.MeshBasicMaterial({
      color: theme.boardEdge,
      transparent: true,
      opacity: GHOST_FILL_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.phantomEdge = new THREE.LineSegments(buildSilhouette([]), this.phantomEdgeMaterial);
    this.phantomFill = new THREE.Mesh(buildSilhouetteFill([]), this.phantomFillMaterial);
    this.phantomRoot.add(this.phantomFill, this.phantomEdge);

    this.pieceRoot.position.y = this.hoverY;

    this.pieceRoot.add(this.pivot);

    for (let index = 0; index < BLOCK_COUNT; index++) {
      const block = new THREE.Mesh(this.blockGeometry, this.materialFor('.'));
      block.visible = false;
      block.add(new THREE.LineSegments(this.blockEdgesGeometry, this.outlineFor('.')));
      this.blocks.push(block);
      this.pivot.add(block);
    }

    this.group.add(this.pieceRoot, this.phantomRoot, this.dropRoot);
  }

  // Plays the render-only hard-drop: copy of the piece slides from its prev
  // position down to the landing row, then squashes. Calls onDone at the end
  // (immediately when reduced-motion is on) so input can unlock.
  startDrop(type: TetrominoType, shape: Matrix, x: number, y: number, fromZ: number, toZ: number, onDone: () => void): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone();
      return;
    }

    this.clearDrop();

    const material = this.materialFor(type);
    const outline = this.outlineFor(type);

    shape.forEach((row, sy) => {
      row.forEach((cell, sx) => {
        if (cell === '.') {
          return;
        }

        const block = new THREE.Mesh(this.blockGeometry, material);
        block.add(new THREE.LineSegments(this.blockEdgesGeometry, outline));
        block.position.set(sx - x, 0, sy - y);
        this.dropRoot.add(block);
      });
    });

    const centerX = (shape[0].length - 1) / 2;
    const centerY = (shape.length - 1) / 2;
    this.dropRoot.position.set(0, REST_HEIGHT, 0);
    this.dropRoot.children.forEach((child) => {
      child.position.x -= centerX;
      child.position.z -= centerY;
    });

    this.dropRoot.position.z = fromZ;
    this.dropAnimation = {
      phase: 'slide',
      age: 0,
      fromZ,
      toZ,
      onDone,
      done: false,
    };
  }

  private clearDrop(): void {
    this.dropRoot.clear();
    this.dropAnimation = null;
  }

  isDropping(): boolean {
    return this.dropAnimation !== null;
  }

  setPiece(type: TetrominoType, shape: Matrix): void {
    // A change of piece type is a spawn: restart the fade/scale-in.
    if (this.type !== type) {
      const isNewPiece = this.type !== null;
      this.type = type;
      const material = this.materialFor(type);
      const outline = this.outlineFor(type);
      this.blocks.forEach((block) => {
        block.material = material;
        (block.children[0] as THREE.LineSegments).material = outline;
      });

      if (isNewPiece) {
        this.spawnAge = 0;
      }
    }

    this.applyShape(shape);
    this.applySpawnAge();
    this.refreshPhantom();
  }

  place(x: number, y: number, ghostY: number): void {
    const [centerX, centerY] = this.center;

    this.pieceRoot.position.set(
      x + centerX - (WIDTH - 1) / 2,
      this.hoverY,
      y + centerY - (HEIGHT - 1) / 2,
    );

    // The phantom silhouette shares the piece's centering, so its local cell
    // coordinates line up exactly with the landing cells.
    this.phantomRoot.position.set(
      x + centerX - (WIDTH - 1) / 2,
      GHOST_LIFT,
      ghostY + centerY - (HEIGHT - 1) / 2,
    );
  }

  setInspecting(on: boolean): void {
    this.inspecting = on;

    if (!on) {
      this.targetPose = { ...DEFAULT_POSE };
    }
  }

  isInspecting(): boolean {
    return this.inspecting;
  }

  resetView(): void {
    this.targetPose = { ...DEFAULT_POSE };
  }

  applyTilt(dx: number, dy: number): void {
    if (!this.inspecting) {
      return;
    }

    this.targetPose.tiltY = clamp(this.targetPose.tiltY + dx * TILT_PER_PIXEL, -MAX_TILT, MAX_TILT);
    this.targetPose.tiltX = clamp(this.targetPose.tiltX + dy * TILT_PER_PIXEL, -MAX_TILT, MAX_TILT);
  }

  applyZoom(delta: number): void {
    if (!this.inspecting) {
      return;
    }

    this.targetPose.zoom = clamp(this.targetPose.zoom + delta * ZOOM_PER_STEP, MIN_ZOOM, MAX_ZOOM);
  }

  update(delta: number): void {
    // Honor prefers-reduced-motion: snap to the target pose instead of easing.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rate = reducedMotion ? INSTANT_RATE : EASE_RATE;
    const blend = 1 - Math.exp(-rate * delta);

    this.pose.tiltX += (this.targetPose.tiltX - this.pose.tiltX) * blend;
    this.pose.tiltY += (this.targetPose.tiltY - this.pose.tiltY) * blend;
    this.pose.zoom += (this.targetPose.zoom - this.pose.zoom) * blend;

    // Resting: sit on the board plane exactly grid-aligned. Inspect: lift so the
    // tilt pivot never clips into the plane.
    const targetHeight = this.inspecting ? HOVER_HEIGHT : REST_HEIGHT;
    this.hoverY += (targetHeight - this.hoverY) * blend;
    this.pieceRoot.position.y = this.hoverY;

    this.pivot.rotation.set(this.pose.tiltX, this.pose.tiltY, 0);
    this.pivot.scale.setScalar(this.pose.zoom);

    // Hard-drop animation: slide then squash on the separately shown copy.
    if (this.dropAnimation && !this.dropAnimation.done) {
      const dropState = this.dropAnimation;
      dropState.age += delta;

      if (dropState.phase === 'slide') {
        const progress = Math.min(dropState.age / DROP_SLIDE_SECONDS, 1);
        const eased = progress * progress; // ease-in: accelerating fall
        this.dropRoot.position.z = dropState.fromZ + (dropState.toZ - dropState.fromZ) * eased;

        if (progress >= 1) {
          dropState.phase = 'squash';
          dropState.age = 0;
        }
      } else {
        const progress = Math.min(dropState.age / DROP_SQUASH_SECONDS, 1);
        // Squash down and back: scaleY dips to DROP_SQUASH_AMOUNT then returns.
        const dip = Math.sin(progress * Math.PI);
        this.dropRoot.scale.y = 1 - dip * (1 - DROP_SQUASH_AMOUNT);

        if (progress >= 1) {
          dropState.done = true;
        }
      }

      if (dropState.done) {
        this.clearDrop();
        dropState.onDone();
      }
    }

    // Spawn animation: age in, fade and scale the piece blocks.
    if (this.spawnAge < SPAWN_SECONDS) {
      this.spawnAge = Math.min(this.spawnAge + delta, SPAWN_SECONDS);
    }
    this.applySpawnAge();

    // Marching ants: shift every vertex's baked line distance by the crawl
    // distance so the dash pattern walks around the silhouette. Cheap: the
    // silhouette has only a few segments. Disabled under reduced motion.
    if (reducedMotion) {
      if (this.phantomDashOffset !== 0) {
        this.phantomDashOffset = 0;
        this.applyDashOffset();
      }
    } else {
      this.phantomDashOffset = (this.phantomDashOffset + GHOST_DASH_SPEED * delta) % (GHOST_DASH + GHOST_GAP);
      this.applyDashOffset();
    }
  }

  // Drives the spawn-in animation: piece blocks fade from 0 to full opacity
  // and scale from SPAWN_START_SCALE to 1 over SPAWN_SECONDS.
  private applySpawnAge(): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const progress = reduced ? 1 : Math.min(this.spawnAge / SPAWN_SECONDS, 1);
    const eased = 1 - Math.pow(1 - progress, 2); // ease-out
    const opacity = eased;
    const scale = SPAWN_START_SCALE + (1 - SPAWN_START_SCALE) * eased;

    for (const block of this.blocks) {
      if (!block.visible) {
        continue;
      }

      const material = block.material as THREE.MeshLambertMaterial;
      if (progress < 1) {
        material.transparent = true;
        material.opacity = opacity;
        block.scale.setScalar(scale);
      } else {
        material.transparent = false;
        material.opacity = 1;
        block.scale.setScalar(1);
      }
      material.needsUpdate = false;
    }
  }

  private applyShape(shape: Matrix): void {
    const cells: Array<[number, number]> = [];

    shape.forEach((row, sy) => {
      row.forEach((cell, sx) => {
        if (cell !== '.') {
          cells.push([sx, sy]);
        }
      });
    });

    const xs = cells.map(([sx]) => sx);
    const ys = cells.map(([, sy]) => sy);
    const centerX: [number, number] = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];

    this.cells = cells;
    this.center = centerX;

    this.blocks.forEach((block, index) => {
      const cell = cells[index];

      if (!cell) {
        block.visible = false;
        return;
      }

      block.visible = true;
      block.position.set(cell[0] - centerX[0], 0, cell[1] - centerX[1]);
    });
  }

  // Rebuilds the dashed silhouette outline and faint fill for the current shape.
  // Cells are converted to block-local coordinates (relative to the shape
  // center) so the silhouette lands exactly where the piece's blocks sit.
  private refreshPhantom(): void {
    const localCells: Cell[] = this.cells.map(
      ([sx, sy]) => [sx - this.center[0], sy - this.center[1]] as Cell,
    );

    this.phantomEdge.geometry.dispose();
    this.phantomFill.geometry.dispose();
    this.phantomEdge.geometry = buildSilhouette(localCells);
    this.phantomFill.geometry = buildSilhouetteFill(localCells);
    this.phantomEdge.computeLineDistances();

    const attribute = this.phantomEdge.geometry.getAttribute('lineDistance');
    if (attribute) {
      this.baselineDistances = Float32Array.from(attribute.array as Float32Array);
      this.applyDashOffset();
    }
  }

  private applyDashOffset(): void {
    const attribute = this.phantomEdge.geometry.getAttribute('lineDistance');
    if (!attribute || this.baselineDistances.length !== attribute.count) {
      return;
    }

    const distances = attribute.array as Float32Array;

    for (let index = 0; index < distances.length; index++) {
      distances[index] = this.baselineDistances[index] + this.phantomDashOffset;
    }

    attribute.needsUpdate = true;
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

  private materialFor(value: string): THREE.MeshLambertMaterial {
    const tone = this.theme.tones[value as keyof ThemeContext['tones']];
    const color = tone ?? this.theme.boardBase;

    let material = this.materials.get(color);

    if (!material) {
      material = new THREE.MeshLambertMaterial({ color });
      this.materials.set(color, material);
    }

    return material;
  }

  dispose(): void {
    this.blockGeometry.dispose();
    this.blockEdgesGeometry.dispose();
    this.phantomEdge.geometry.dispose();
    this.phantomFill.geometry.dispose();
    this.phantomEdgeMaterial.dispose();
    this.phantomFillMaterial.dispose();
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
    this.outlineMaterials.forEach((material) => material.dispose());
    this.outlineMaterials.clear();
    this.group.clear();
  }
}
