/**
 * PaperGrid Sound Engine
 * Synthesizes realistic pen/paper sounds using Web Audio API.
 * Zero external audio files — everything is generated procedurally.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Create a noise buffer (white/brown) */
function createNoiseBuffer(duration: number, type: 'white' | 'brown' = 'white'): AudioBuffer {
  const ac = getCtx();
  const length = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  } else {
    // Brown noise: integrated white noise
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

// ─── Pen Scratch (typing) ────────────────────────────────────
// Short burst of filtered brown noise, randomized pitch to avoid repetition
export function playPenScratch(): void {
  const ac = getCtx();
  const now = ac.currentTime;

  const source = ac.createBufferSource();
  source.buffer = createNoiseBuffer(0.06, 'brown');
  // Randomize playback rate for variety
  source.playbackRate.value = 0.8 + Math.random() * 0.8;

  const bandpass = ac.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 2500 + Math.random() * 2000;
  bandpass.Q.value = 1.5;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.08 + Math.random() * 0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  source.connect(bandpass).connect(gain).connect(ac.destination);
  source.start(now);
  source.stop(now + 0.06);
}

// ─── Page Flip ───────────────────────────────────────────────
// Noise sweep with frequency ramp — sounds like rustling paper
export function playPageFlip(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const duration = 0.35;

  const source = ac.createBufferSource();
  source.buffer = createNoiseBuffer(duration, 'white');

  const bandpass = ac.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(800, now);
  bandpass.frequency.exponentialRampToValueAtTime(4000, now + duration * 0.3);
  bandpass.frequency.exponentialRampToValueAtTime(1200, now + duration);
  bandpass.Q.value = 0.8;

  const highpass = ac.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 400;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
  gain.gain.setValueAtTime(0.12, now + duration * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(bandpass).connect(highpass).connect(gain).connect(ac.destination);
  source.start(now);
  source.stop(now + duration);
}

// ─── Checkbox Click ──────────────────────────────────────────
// Short sine pop with a tiny noise transient
export function playCheckboxClick(): void {
  const ac = getCtx();
  const now = ac.currentTime;

  // Sine pop
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.06);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.08);

  // Tiny transient click
  const click = ac.createBufferSource();
  click.buffer = createNoiseBuffer(0.01, 'white');
  const clickGain = ac.createGain();
  clickGain.gain.setValueAtTime(0.06, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
  click.connect(clickGain).connect(ac.destination);
  click.start(now);
  click.stop(now + 0.01);
}

// ─── Block Add (soft pop) ────────────────────────────────────
export function playBlockAdd(): void {
  const ac = getCtx();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

// ─── Block Delete (descending swoosh) ────────────────────────
export function playBlockDelete(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const duration = 0.2;

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + duration);

  const noise = ac.createBufferSource();
  noise.buffer = createNoiseBuffer(duration, 'white');

  const noiseBandpass = ac.createBiquadFilter();
  noiseBandpass.type = 'bandpass';
  noiseBandpass.frequency.setValueAtTime(3000, now);
  noiseBandpass.frequency.exponentialRampToValueAtTime(500, now + duration);
  noiseBandpass.Q.value = 1;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.06, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.08, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(oscGain).connect(ac.destination);
  noise.connect(noiseBandpass).connect(noiseGain).connect(ac.destination);

  osc.start(now);
  osc.stop(now + duration);
  noise.start(now);
  noise.stop(now + duration);
}

// ─── Drag Rustle (paper shuffle) ─────────────────────────────
export function playDragRustle(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const duration = 0.15;

  const source = ac.createBufferSource();
  source.buffer = createNoiseBuffer(duration, 'brown');
  source.playbackRate.value = 1.2 + Math.random() * 0.6;

  const bandpass = ac.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 3000 + Math.random() * 1500;
  bandpass.Q.value = 0.6;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(bandpass).connect(gain).connect(ac.destination);
  source.start(now);
  source.stop(now + duration);
}
