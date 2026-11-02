// Sound effects, all generated with the Web Audio API (no audio files).
// Muted by default. The toggle calls setMuted(); soundEvents.ts calls play().

export type SoundName =
  | 'move'
  | 'rotate'
  | 'hardDrop'
  | 'lineClear'
  | 'hold'
  | 'undo'
  | 'gameOver'
  | 'newBest';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = true;

function unlock(): void {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
}

export function setMuted(next: boolean): void {
  muted = next;

  if (!muted) {
    // Called from a click/keypress on the toggle, so the browser allows it.
    unlock();
  }
}

export function isMuted(): boolean {
  return muted;
}

// If sound was saved as ON, the first key press or click anywhere unlocks audio.
function onGesture(): void {
  if (!muted) {
    unlock();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onGesture, true);
  window.addEventListener('pointerdown', onGesture, true);
}

interface Tone {
  freq: number;
  to?: number;
  start?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
}

function tone(c: AudioContext, out: AudioNode, t: Tone): void {
  const t0 = c.currentTime + (t.start ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();

  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.freq, t0);

  if (t.to) {
    osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.dur);
  }

  // Short attack and release so nothing clicks or pops.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(t.gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.dur);

  osc.connect(g);
  g.connect(out);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
  osc.start(t0);
  osc.stop(t0 + t.dur + 0.02);
}

const CHIME = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5];

/** detail: rows dropped for 'hardDrop', lines cleared for 'lineClear'. */
export function play(name: SoundName, detail = 0): void {
  if (muted) {
    return;
  }
  if (typeof document !== 'undefined' && document.hidden) {
    return;
  }

  if (!ctx || !master || ctx.state !== 'running') {
    unlock();
    return;
  }

  const c = ctx;
  const out = master;

  switch (name) {
    case 'move':
      tone(c, out, { freq: 520, dur: 0.05, gain: 0.18, type: 'triangle' });
      break;
    case 'rotate':
      tone(c, out, { freq: 660, to: 820, dur: 0.06, gain: 0.2, type: 'triangle' });
      break;
    case 'hardDrop': {
      const gain = Math.min(0.55, 0.3 + detail * 0.02);
      tone(c, out, { freq: 240, to: 70, dur: 0.14, gain });
      tone(c, out, { freq: 900, dur: 0.03, gain: 0.1, type: 'square' });
      break;
    }
    case 'lineClear': {
      const count = Math.min(4, Math.max(1, detail));
      const notes = CHIME.slice(0, count + 1);

      notes.forEach((freq, i) => {
        const last = i === notes.length - 1;
        tone(c, out, {
          freq,
          start: 0.08 + i * 0.07,
          dur: last && count === 4 ? 0.4 : 0.22,
          gain: 0.22,
          type: 'triangle',
        });
      });
      break;
    }
    case 'hold':
      tone(c, out, { freq: 440, dur: 0.07, gain: 0.18, type: 'triangle' });
      tone(c, out, { freq: 587, start: 0.06, dur: 0.08, gain: 0.18, type: 'triangle' });
      break;
    case 'undo':
      tone(c, out, { freq: 620, to: 380, dur: 0.14, gain: 0.2, type: 'triangle' });
      break;
    case 'gameOver':
      tone(c, out, { freq: 392, dur: 0.4, gain: 0.25, type: 'triangle' });
      tone(c, out, { freq: 261.63, start: 0.35, dur: 0.5, gain: 0.25, type: 'triangle' });
      break;
    case 'newBest':
      // Starts after the game-over tones have mostly finished.
      tone(c, out, { freq: 659.25, start: 0.8, dur: 0.12, gain: 0.22, type: 'triangle' });
      tone(c, out, { freq: 880, start: 0.92, dur: 0.2, gain: 0.22, type: 'triangle' });
      break;
  }
}