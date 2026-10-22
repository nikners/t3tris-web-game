// Landing feedback for a hard drop (render-only).
//
// The logic has already locked the piece and spawned the next one, so this
// only shows what happened: the cells the piece filled flash from the piece
// tone to the light tone and back, and a small burst of square particles pops
// out of the landing spot and falls away.
//
// Everything here is torn down as soon as it is done — the meshes leave the
// scene and their materials are disposed — so a long game does not leak.
//
// The lengths come from the CSS tokens, the colours from the piece tones, so
// the timing and the palette live in one place.
import * as THREE from 'three';
import { columnToWorldX, rowToWorldZ } from './boardView';
import type { TetrominoType } from '../logic/pieces';
import { readDuration } from '../ui/tokens';
import type { ThemeContext } from './scene';

// The flash and the particles each have their own length.
const FLASH_TOKEN = '--land-flash';
const PARTICLE_TOKEN = '--land-particles';

// A drop of this many rows or more is a real drop and gets the full show.
// A shorter one only gets the flash.
export const MIN_SHAKE_ROWS = 3;

// The size of the particle burst.
const PARTICLE_MIN = 6;
const PARTICLE_MAX = 10;

// The particles are small squares, a fraction of a cell.
const PARTICLE_SIZE = 0.16;

// How the particles move: a little up, a little down the board, then gravity
// takes over.
const PARTICLE_LIFT = 3.4;
const PARTICLE_FALL = 5;
const PARTICLE_GRAVITY = 18;

// The flash sits above the cells, the particles above the flash.
const FLASH_Y = 0.05;
const PARTICLE_Y = 0.08;

export interface LandingCell {
  /** The column the piece filled. */
  x: number;
  /** The row the piece filled. */
  y: number;
}

export interface LandingFxOptions {
  /** Called when a long drop lands: the board shakes. */
  onShake?: () => void;
}

interface Flash {
  age: number;
  material: THREE.MeshBasicMaterial;
  outlineMaterial: THREE.LineBasicMaterial;
  meshes: THREE.Mesh[];
  tone: THREE.Color;
  light: THREE.Color;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

export class LandingFx {
  readonly group = new THREE.Group();

  private readonly theme: ThemeContext;

  private readonly flashSeconds: number;

  private readonly particleSeconds: number;

  private readonly cellGeometry = new THREE.PlaneGeometry(1, 1);

  private readonly cellOutlineGeometry = new THREE.EdgesGeometry(this.cellGeometry);

  private readonly particleGeometry = new THREE.PlaneGeometry(PARTICLE_SIZE, PARTICLE_SIZE);

  private flash: Flash | null = null;

  private particles: Particle[] = [];

  private particleMaterial: THREE.MeshBasicMaterial | null = null;

  private particleAge = 0;

  private readonly options: LandingFxOptions;

  constructor(theme: ThemeContext, options: LandingFxOptions = {}) {
    this.theme = theme;
    this.options = options;
    this.flashSeconds = readDuration(FLASH_TOKEN) / 1000;
    this.particleSeconds = readDuration(PARTICLE_TOKEN) / 1000;
  }

  // A piece landed. The cells it filled always flash; a drop of real length
  // also gets the particle burst and the shake of the board.
  play(cells: LandingCell[], type: TetrominoType, rows: number): void {
    this.flashCells(cells, type);

    if (rows < MIN_SHAKE_ROWS) {
      return;
    }

    this.burst(cells, type);
    this.options.onShake?.();
  }

  // The cells the piece filled flash from the piece tone to the light tone
  // and back again.
  flashCells(cells: LandingCell[], type: TetrominoType): void {
    this.clearFlash();

    if (cells.length === 0) {
      return;
    }

    const material = new THREE.MeshBasicMaterial({
      color: this.toneFor(type),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    // The flashed cell keeps its outline, so the cell reads as a cell that
    // lights up rather than as a hole in the board.
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: this.theme.edges[type] ?? this.theme.boardEdge,
      transparent: true,
      opacity: 1,
    });

    const meshes: THREE.Mesh[] = [];

    for (const cell of cells) {
      const overlay = new THREE.Mesh(this.cellGeometry, material);
      overlay.rotation.x = -Math.PI / 2;
      overlay.position.set(columnToWorldX(cell.x), FLASH_Y, rowToWorldZ(cell.y));

      const outline = new THREE.LineSegments(this.cellOutlineGeometry, outlineMaterial);
      outline.position.y = 0.01;
      overlay.add(outline);

      meshes.push(overlay);
      this.group.add(overlay);
    }

    this.flash = {
      age: 0,
      material,
      outlineMaterial,
      meshes,
      tone: new THREE.Color(this.toneFor(type)),
      light: new THREE.Color(this.theme.light),
    };
  }

  // A burst of square particles at the landing cells. They pop up, fall down
  // the board and fade out.
  burst(cells: LandingCell[], type: TetrominoType): void {
    this.clearParticles();

    if (cells.length === 0) {
      return;
    }

    const count =
      PARTICLE_MIN + Math.floor(Math.random() * (PARTICLE_MAX - PARTICLE_MIN + 1));

    const material = new THREE.MeshBasicMaterial({
      color: this.toneFor(type),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    this.particleMaterial = material;
    this.particleAge = 0;

    for (let index = 0; index < count; index += 1) {
      const cell = cells[index % cells.length];
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        columnToWorldX(cell.x) + (Math.random() - 0.5) * 0.6,
        PARTICLE_Y,
        rowToWorldZ(cell.y) + (Math.random() - 0.5) * 0.6,
      );

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          PARTICLE_LIFT * (0.6 + Math.random() * 0.8),
          PARTICLE_FALL * (0.4 + Math.random() * 0.8),
        ),
      });

      this.group.add(mesh);
    }
  }

  tick(delta: number): void {
    this.tickFlash(delta);
    this.tickParticles(delta);
  }

  private tickFlash(delta: number): void {
    const flash = this.flash;

    if (!flash) {
      return;
    }

    flash.age = Math.min(flash.age + delta, this.flashSeconds);

    const progress = this.flashSeconds > 0 ? flash.age / this.flashSeconds : 1;
    // The tone goes to the light tone and back again.
    const wave = progress < 0.5 ? progress * 2 : (1 - progress) * 2;

    flash.material.color.copy(flash.tone).lerp(flash.light, wave);
    flash.material.opacity = 1 - progress * 0.4;

    if (progress >= 1) {
      this.clearFlash();
    }
  }

  private tickParticles(delta: number): void {
    if (this.particles.length === 0) {
      return;
    }

    this.particleAge = Math.min(this.particleAge + delta, this.particleSeconds);
    const progress = this.particleSeconds > 0 ? this.particleAge / this.particleSeconds : 1;

    if (this.particleMaterial) {
      // Ease out: the burst thins away rather than blinking out.
      this.particleMaterial.opacity = 1 - progress * progress;
    }

    for (const particle of this.particles) {
      particle.velocity.y -= PARTICLE_GRAVITY * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
    }

    if (progress >= 1) {
      this.clearParticles();
    }
  }

  private clearFlash(): void {
    const flash = this.flash;

    if (!flash) {
      return;
    }

    flash.meshes.forEach((mesh) => this.group.remove(mesh));
    flash.material.dispose();
    flash.outlineMaterial.dispose();
    this.flash = null;
  }

  private clearParticles(): void {
    this.particles.forEach((particle) => this.group.remove(particle.mesh));
    this.particles = [];
    this.particleAge = 0;

    if (this.particleMaterial) {
      this.particleMaterial.dispose();
      this.particleMaterial = null;
    }
  }

  private toneFor(type: TetrominoType): string {
    return this.theme.tones[type] ?? this.theme.boardEdge;
  }

  dispose(): void {
    this.clearFlash();
    this.clearParticles();
    this.cellGeometry.dispose();
    this.cellOutlineGeometry.dispose();
    this.particleGeometry.dispose();
    this.group.clear();
  }
}
