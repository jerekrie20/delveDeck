// Stage 7b — the slice's synth. No files, Rule 1: every sound is Web Audio oscillators
// and a touch of filtered noise, built on the fly (`TODO.md` § Audio, brought forward for
// the slice so the big turn can be *heard* landing as well as seen).
//
// Three laws it keeps, lifted from the audio spec so retrofitting them later is not a
// rewrite:
//
//  1. **The context is created only on a user GESTURE.** Every entry point here is reached
//     from a tap (a cast, END TURN, FIGHT AGAIN), so the lazy `ctx()` below is always first
//     touched inside a click — an AudioContext made before that lands `suspended` and every
//     sound after it silently does nothing.
//  2. **Sound REINFORCES, never INFORMS.** Every cue here rides a beat already drawn on the
//     screen (a hit number, a shake, the veil). Muting loses nothing you needed to see.
//  3. **A silent game is a complete game.** If Web Audio is missing or the context throws,
//     every call is a no-op and the fight plays on.
//
// It maps the pure `FightEvent` beats to sound; it computes no combat rule and holds no
// fight state — the same dumb-renderer contract `fx.ts` keeps.

import type { FightEvent } from '../shared/slice/fight';

const MUTE_KEY = 'slice.muted';

let context: AudioContext | null = null;
let master: GainNode | null = null;
/** Default AUDIBLE — this is the owner's gut-check prototype, not a page in a feed (where
 *  the spec defaults muted). Persisted so a preference survives a reload. */
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

/** Flip mute and persist it. Returns the new state so the caller can redraw its toggle. */
export function toggleMuted(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* private mode — the preference just does not persist. */
  }
  return muted;
}

/** The lazily-made context + master bus, or null if this browser has no Web Audio. Called
 *  only from inside a tap, so the context is never born suspended. */
function ctx(): { ac: AudioContext; bus: GainNode } | null {
  if (muted) return null;
  if (context && master) {
    if (context.state === 'suspended') void context.resume();
    return { ac: context, bus: master };
  }
  if (typeof window.AudioContext !== 'function') return null;
  try {
    context = new window.AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    return { ac: context, bus: master };
  } catch {
    return null;
  }
}

interface ToneSpec {
  freq: number;
  /** Slide the pitch to this by the end — a fall reads as impact, a rise as a charge. */
  to?: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  /** Seconds to wait before it sounds — lets a sequence of beats read as a sequence. */
  delay?: number;
}

/** One oscillator with a fast attack and an exponential tail — the whole synth voice. */
function tone({ freq, to, type = 'sine', dur = 0.14, gain = 0.3, delay = 0 }: ToneSpec): void {
  const c = ctx();
  if (!c) return;
  const start = c.ac.currentTime + delay;
  const osc = c.ac.createOscillator();
  const env = c.ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env);
  env.connect(c.bus);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** A short burst of filtered noise — the body of an impact, under the tonal layer. */
function noise(dur: number, gain: number, cutoff: number, delay = 0): void {
  const c = ctx();
  if (!c) return;
  const start = c.ac.currentTime + delay;
  const frames = Math.floor(c.ac.sampleRate * dur);
  const buffer = c.ac.createBuffer(1, frames, c.ac.sampleRate);
  const data = buffer.getChannelData(0);
  // A deterministic-enough pseudo-noise; no need for crypto here, and no Math.random law
  // in the client, but this is presentation, not the sim — a plain LCG keeps it tidy.
  let s = 1;
  for (let i = 0; i < frames; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = ((s / 0x3fffffff) - 1) * (1 - i / frames);
  }
  const src = c.ac.createBufferSource();
  src.buffer = buffer;
  const filter = c.ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const env = c.ac.createGain();
  env.gain.value = gain;
  src.connect(filter);
  filter.connect(env);
  env.connect(c.bus);
  src.start(start);
  src.stop(start + dur + 0.02);
}

// ---- the beats, as sound ----------------------------------------------------------

/** Map one fight beat to its cue. `delay` staggers a turn's beats so they read in order.
 *  Silent for the beats that carry no sound of their own (a plain block wall). */
export function playEvent(event: FightEvent, delay: number): void {
  switch (event.t) {
    case 'cast':
      // The detonation cast gets its boom from the `detonate` beat that follows it.
      if (!event.detonate) tone({ freq: 520, to: 760, type: 'triangle', dur: 0.1, gain: 0.16, delay });
      break;
    case 'hit':
      if (event.amount > 0) {
        tone({ freq: 300, to: 150, type: 'square', dur: 0.1, gain: 0.14, delay });
        noise(0.09, 0.12, 1600, delay);
      } else {
        // Fully soaked by the block — a dull, cyan-feeling thunk.
        tone({ freq: 190, to: 150, type: 'sine', dur: 0.09, gain: 0.1, delay });
      }
      break;
    case 'statusApply':
      tone({ freq: 640, to: 900, type: 'sawtooth', dur: 0.12, gain: 0.08, delay });
      break;
    case 'detonate':
      // The payoff — a low boom, a bright flare over it, and a noise body.
      tone({ freq: 140, to: 55, type: 'sawtooth', dur: 0.5, gain: 0.34, delay });
      tone({ freq: 880, to: 300, type: 'triangle', dur: 0.32, gain: 0.16, delay: delay + 0.01 });
      noise(0.4, 0.3, 2600, delay);
      break;
    case 'execute':
      // A heavy physical cash-in — a lower, punchier boom than the fire detonation.
      tone({ freq: 160, to: 48, type: 'square', dur: 0.42, gain: 0.32, delay });
      noise(0.34, 0.32, 1400, delay);
      break;
    case 'defenseGain':
      tone({ freq: 440, to: 880, type: 'sine', dur: 0.28, gain: 0.14, delay });
      tone({ freq: 660, to: 1320, type: 'sine', dur: 0.22, gain: 0.08, delay: delay + 0.04 });
      break;
    case 'statusTick':
      tone({ freq: 480, to: 360, type: 'sawtooth', dur: 0.14, gain: 0.07, delay });
      break;
    case 'enemyAttack': {
      // The hurt hit lands harder the more of it reaches HP past the ward.
      const through = event.amount - event.absorbed;
      if (through > 0) {
        tone({ freq: 220, to: 70, type: 'square', dur: 0.24, gain: 0.24, delay });
        noise(0.22, 0.24, 1100, delay);
      } else {
        // Fully warded — a softer, violet-tinted absorb.
        tone({ freq: 360, to: 260, type: 'sine', dur: 0.16, gain: 0.12, delay });
      }
      break;
    }
    case 'enemyBlock':
      tone({ freq: 240, to: 300, type: 'sine', dur: 0.16, gain: 0.1, delay });
      break;
  }
}

/** The two ends of a fight, played when the veil appears. */
export function playOutcome(won: boolean): void {
  if (won) {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.16, delay: i * 0.09 }));
  } else {
    [330, 262, 196, 131].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.4, gain: 0.16, delay: i * 0.12 }));
  }
}
