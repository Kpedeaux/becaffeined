/* ==========================================================================
 * audio.js — Web Audio API synthesis
 *
 * All sound effects are synthesized at runtime. Zero asset weight, zero
 * licensing. The first call to any sfx unlocks the audio context (browsers
 * block audio until a user gesture).
 *
 * Why this approach over .mp3 files:
 *   - No 200KB+ asset payload.
 *   - Easy to vary pitch/duration per cascade level (combo chain).
 *   - No CORS/cache headaches on Cloudflare Pages.
 *
 * Why not Tone.js: 100KB library for what we can do in ~80 lines.
 * ========================================================================== */

import { getSettings, setSettings } from './storage.js';

let ctx = null;
let masterGain = null;
let muted = !getSettings().sound;

function ensureCtx() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(ctx.destination);
  return ctx;
}

function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

/* Generic envelope helper */
function envNote({
  freq,
  type = 'sine',
  duration = 0.18,
  attack = 0.005,
  decay = 0.08,
  sustain = 0.0,
  release = 0.08,
  peak = 0.6,
  detune = 0,
  glide = null,    // { to, time }
}) {
  if (!ensureCtx() || muted) return;
  resume();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  if (glide) {
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(glide.to, t + glide.time);
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(peak * 0.7, t + attack + decay);
  g.gain.setValueAtTime(peak * 0.7 * (sustain || 0.7), t + duration - release);
  g.gain.linearRampToValueAtTime(0, t + duration);

  osc.connect(g);
  g.connect(masterGain);

  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/* Quick noise burst for thuds */
function noiseBurst({ duration = 0.12, peak = 0.3, filterFreq = 1200 }) {
  if (!ensureCtx() || muted) return;
  resume();
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter); filter.connect(g); g.connect(masterGain);
  src.start(t);
  src.stop(t + duration + 0.02);
}

/* ----- Public SFX ----- */
export function sfxSwap() {
  envNote({ freq: 440, type: 'triangle', duration: 0.10, peak: 0.25,
            glide: { to: 580, time: 0.08 } });
}
export function sfxIllegal() {
  envNote({ freq: 220, type: 'sawtooth', duration: 0.12, peak: 0.18,
            glide: { to: 160, time: 0.1 } });
}
export function sfxMatch(cascadeLevel = 1) {
  // Pitch climbs with cascade level — chain audio reward
  const base = 520 + (cascadeLevel - 1) * 80;
  envNote({ freq: base, type: 'triangle', duration: 0.16, peak: 0.32,
            glide: { to: base * 1.5, time: 0.12 } });
  envNote({ freq: base * 1.25, type: 'sine', duration: 0.18,
            peak: 0.22, glide: { to: base * 1.9, time: 0.14 } });
}
export function sfxBigCombo() {
  envNote({ freq: 380, type: 'triangle', duration: 0.4, peak: 0.4,
            glide: { to: 880, time: 0.36 } });
  setTimeout(() => envNote({ freq: 660, type: 'sine', duration: 0.3, peak: 0.3,
            glide: { to: 1320, time: 0.28 } }), 80);
}
export function sfxSpecial() {
  envNote({ freq: 600, type: 'square', duration: 0.18, peak: 0.25,
            glide: { to: 1200, time: 0.14 } });
  noiseBurst({ duration: 0.16, peak: 0.15, filterFreq: 2200 });
}
export function sfxLevelUp() {
  // Three-note rising arpeggio
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((f, i) => {
    setTimeout(() => envNote({
      freq: f, type: 'triangle', duration: 0.28, peak: 0.35
    }), i * 120);
  });
}
export function sfxGameOver() {
  // Descending — let-down
  const notes = [523.25, 392.0, 311.13, 261.63];
  notes.forEach((f, i) => {
    setTimeout(() => envNote({
      freq: f, type: 'sine', duration: 0.32, peak: 0.3
    }), i * 140);
  });
}
export function sfxTick() {
  envNote({ freq: 880, type: 'square', duration: 0.04, peak: 0.12 });
}

/* ----- Mute toggle ----- */
export function isMuted() { return muted; }
export function setMuted(value) {
  muted = !!value;
  setSettings({ sound: !muted });
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
}
export function toggleMute() { setMuted(!muted); return muted; }

/** Call once on first user gesture to unlock audio on iOS/Safari. */
export function unlockOnGesture() {
  ensureCtx();
  resume();
}
