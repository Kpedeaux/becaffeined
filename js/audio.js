/* ==========================================================================
 * audio.js — Coffee-shop-themed Web Audio synthesis
 *
 * Every sound is built at runtime from oscillators + filtered noise. Zero
 * asset weight, zero licensing, no CORS. The first user gesture unlocks
 * the audio context (browsers block audio until interaction).
 *
 * Sound design palette:
 *   - DRIP    short pluck + filtered noise splash + light reverb tail
 *   - STEAM   bandpass-filtered white noise, slow attack & release
 *   - GRIND   low sawtooth + brown noise, tremolo-modulated
 *   - BELL    FM-synthesized bright bell with long decay
 *   - SHOT    rising steam build then bubbling pluck cluster
 *
 * Mapping to game events:
 *   sfxSwap         drip
 *   sfxIllegal      muted dry click
 *   sfxMatch        drip + tiny splash, pitch climbs with cascade level
 *   sfxBigCombo     grinder rumble + sparkle bell
 *   sfxSpecial      espresso shot pull (steam + bubbles)
 *   sfxLevelUp      brewing-bell ding + pour
 *   sfxGameOver     descending hiss (steam dying down)
 *   sfxTick         single drip
 *
 * v2 upgrade path: replace these synths with curated CC0 field recordings
 * from a coffee shop, hosted in /assets/audio. The export surface here is
 * stable so call sites won't change.
 * ========================================================================== */

import { getSettings, setSettings } from './storage.js';

let ctx = null;
let masterGain = null;
let reverbBus = null;
let muted = !getSettings().sound;

/** Build a small, room-sized impulse response so reverb sounds like a
 *  café interior, not a cathedral. Pre-rendered once on context init. */
function buildRoomReverb(audioCtx) {
  const length = Math.floor(audioCtx.sampleRate * 0.6);
  const buf = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const decay = Math.pow(1 - t, 2.4);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  const conv = audioCtx.createConvolver();
  conv.buffer = buf;
  return conv;
}

function ensureCtx() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(ctx.destination);

  // Parallel reverb send — keeps dry/wet balance controllable per sound
  reverbBus = ctx.createGain();
  reverbBus.gain.value = 0.22;
  const conv = buildRoomReverb(ctx);
  reverbBus.connect(conv);
  conv.connect(masterGain);

  return ctx;
}
function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

/** Route to dry (master) and wet (reverb). Returns the gain node to connect
 *  oscillators/noise sources into. */
function busSend(dryAmount = 1, wetAmount = 0.4) {
  const dry = ctx.createGain();
  dry.gain.value = dryAmount;
  dry.connect(masterGain);
  const wet = ctx.createGain();
  wet.gain.value = wetAmount;
  wet.connect(reverbBus);
  // The caller connects sources to BOTH dry and wet
  return { dry, wet };
}

/** Helper: a one-shot oscillator note with pluck-style envelope. */
function pluck({
  freq, type = 'sine', duration = 0.18,
  peak = 0.35, attack = 0.002, release = 0.16,
  glideTo = null, glideTime = null,
  detune = 0, dry = 1, wet = 0.4,
}) {
  if (!ensureCtx() || muted) return;
  resume();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  if (glideTo != null && glideTime != null) {
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(0.001, glideTo), t + glideTime);
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const buses = busSend(dry, wet);
  osc.connect(env);
  env.connect(buses.dry);
  env.connect(buses.wet);

  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** Helper: bandpass-filtered noise burst. Used for water splash, steam,
 *  air-flow textures. */
function noise({
  duration = 0.15, peak = 0.18,
  filterType = 'bandpass', freq = 2000, q = 0.7,
  attack = 0.005, release = 0.12,
  freqEnd = null,
  dry = 0.7, wet = 0.5,
}) {
  if (!ensureCtx() || muted) return;
  resume();
  const t = ctx.currentTime;
  const sampleCount = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  if (freqEnd != null) {
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
  }


  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const buses = busSend(dry, wet);
  src.connect(filter);
  filter.connect(env);
  env.connect(buses.dry);
  env.connect(buses.wet);

  src.start(t);
  src.stop(t + duration + 0.05);
}

/** Brown-noise "rumble" generator — used for grinder bass tone. */
function brownNoiseBuffer(audioCtx, duration) {
  const len = Math.floor(audioCtx.sampleRate * duration);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

/** Brief grinder-rasp sound — one quick rip of beans through burrs.
 *  Layered brown-noise rumble + resonant bandpass sweep + sawtooth grit.
 *  Used standalone for matches and as the rumble layer for big combos. */
function grindRip(pitch = 1.0, duration = 0.12) {
  if (!ensureCtx() || muted) return;
  resume();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = brownNoiseBuffer(ctx, duration);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700 * pitch, t);
  bp.frequency.exponentialRampToValueAtTime(1400 * pitch, t + duration * 0.7);
  bp.Q.value = 4;
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(120 * pitch, t);
  saw.frequency.exponentialRampToValueAtTime(220 * pitch, t + duration * 0.7);
  const sawGain = ctx.createGain();
  sawGain.gain.value = 0.08;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.32, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(bp); bp.connect(env);
  saw.connect(sawGain); sawGain.connect(env);
  const buses = busSend(0.85, 0.4);
  env.connect(buses.dry); env.connect(buses.wet);
  src.start(t); saw.start(t);
  src.stop(t + duration); saw.stop(t + duration);
}

/* ==========================================================================
 * Public SFX
 * ========================================================================== */

/** A single coffee drip — used for swap. */
function drip(pitch = 1.0) {
  pluck({
    freq: 1100 * pitch, type: 'sine', duration: 0.16, peak: 0.32,
    attack: 0.001, glideTo: 380 * pitch, glideTime: 0.14,
    dry: 1, wet: 0.55,
  });
  setTimeout(() => noise({
    duration: 0.05, peak: 0.10, filterType: 'highpass',
    freq: 4500, q: 0.5, attack: 0.001, dry: 0.5, wet: 0.5,
  }), 8);
}

export function sfxSwap() { drip(1.0); }

export function sfxIllegal() {
  pluck({
    freq: 220, type: 'square', duration: 0.07, peak: 0.16,
    glideTo: 140, glideTime: 0.06, dry: 0.7, wet: 0.05,
  });
}

export function sfxMatch(cascadeLevel = 1, matchLength = 3) {
  // Match = grinder rip. Pitch climbs with cascade level so chains feel
  // satisfying. Longer matches get a brighter "bean crack" snap on top.
  const pitch = 1 + (cascadeLevel - 1) * 0.20;
  const dur = 0.10 + Math.min(cascadeLevel - 1, 3) * 0.025;
  grindRip(pitch, dur);
  // Bean-crack snap (high sine descending click) for any match
  setTimeout(() => pluck({
    freq: 2200 * pitch, type: 'sine', duration: 0.05, peak: 0.18,
    glideTo: 1100 * pitch, glideTime: 0.045,
    dry: 0.6, wet: 0.4,
  }), 8);
  // Match-4+ get an extra grind echo
  if (matchLength >= 4) {
    setTimeout(() => grindRip(pitch * 1.18, dur * 0.85), 75);
  }
  // Note: no bell ding on regular match cascades. The bell felt sad
  // and out of place on a 2-cascade chain. Pitch climb on the grind +
  // snap already conveys the chain reward. Bells are reserved for big
  // combos (sfxBigCombo, fires at cascade 4+) and level-ups.
}

function bellDing(scale = 1.0) {
  if (!ensureCtx() || muted) return;
  resume();
  const t = ctx.currentTime;
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  carrier.frequency.value = 1180 * scale;
  modulator.frequency.value = 295 * scale;
  modGain.gain.value = 280 * scale;
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.32, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  carrier.connect(env);
  const buses = busSend(0.8, 0.7);
  env.connect(buses.dry);
  env.connect(buses.wet);
  carrier.start(t); modulator.start(t);
  carrier.stop(t + 1.3); modulator.stop(t + 1.3);
}

export function sfxBigCombo() {
  if (!ensureCtx() || muted) return;
  resume();
  const t = ctx.currentTime;

  // Layer 1: anticipation — steam hiss building from low to high
  noise({
    duration: 0.45, peak: 0.22,
    filterType: 'bandpass', freq: 2400, q: 0.9, freqEnd: 7000,
    attack: 0.06, dry: 0.5, wet: 0.7,
  });

  // Layer 2: power — long grinder rumble with tremolo, fires after the
  // steam build so the dynamics climb rather than blur.
  setTimeout(() => {
    const dur = 0.50;
    const src = ctx.createBufferSource();
    src.buffer = brownNoiseBuffer(ctx, dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const t2 = ctx.currentTime;
    lp.frequency.setValueAtTime(600, t2);
    lp.frequency.exponentialRampToValueAtTime(1600, t2 + dur * 0.6);
    lp.Q.value = 0.7;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 65;
    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.15;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.22;
    const trem = ctx.createGain();
    trem.gain.value = 0.4;
    lfo.connect(lfoGain); lfoGain.connect(trem.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t2);
    env.gain.linearRampToValueAtTime(0.55, t2 + 0.04);
    env.gain.linearRampToValueAtTime(0.0001, t2 + dur);
    src.connect(lp); lp.connect(trem);
    saw.connect(sawGain); sawGain.connect(trem);
    trem.connect(env);
    const buses = busSend(0.85, 0.45);
    env.connect(buses.dry); env.connect(buses.wet);
    src.start(t2); saw.start(t2); lfo.start(t2);
    src.stop(t2 + dur); saw.stop(t2 + dur); lfo.stop(t2 + dur);
  }, 100);

  // Layer 3: payoff — ascending triple bell sparkle on top of the rumble
  setTimeout(() => bellDing(1.0), 320);
  setTimeout(() => bellDing(1.4), 440);
  setTimeout(() => bellDing(1.9), 540);

  // Layer 4: final release — steam pop airs out the energy
  setTimeout(() => noise({
    duration: 0.18, peak: 0.20,
    filterType: 'highpass', freq: 4800, q: 0.7,
    attack: 0.005, dry: 0.55, wet: 0.6,
  }), 600);
}

export function sfxSpecial() {
  if (!ensureCtx() || muted) return;
  resume();
  noise({
    duration: 0.32, peak: 0.18,
    filterType: 'bandpass', freq: 4500, q: 1.0, freqEnd: 7500,
    attack: 0.06, dry: 0.55, wet: 0.7,
  });
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const f = 700 + Math.random() * 800;
      pluck({
        freq: f, type: 'sine', duration: 0.10, peak: 0.22,
        glideTo: f * 0.4, glideTime: 0.08,
        dry: 0.8, wet: 0.5,
      });
    }, 110 + i * 70);
  }
}

export function sfxLevelUp() {
  bellDing(1.15);
  setTimeout(() => noise({
    duration: 0.45, peak: 0.18,
    filterType: 'bandpass', freq: 380, q: 0.9, freqEnd: 1400,
    attack: 0.03, dry: 0.6, wet: 0.55,
  }), 50);
  setTimeout(() => bellDing(1.7), 360);
}

export function sfxGameOver() {
  noise({
    duration: 0.9, peak: 0.22,
    filterType: 'bandpass', freq: 2800, q: 1.2, freqEnd: 380,
    attack: 0.02, dry: 0.7, wet: 0.6,
  });
  setTimeout(() => pluck({
    freq: 220, type: 'sine', duration: 0.6, peak: 0.18,
    glideTo: 110, glideTime: 0.55, dry: 0.7, wet: 0.7,
  }), 180);
}

export function sfxTick() { drip(1.4); }

/* Mute control */
export function isMuted() { return muted; }
export function setMuted(value) {
  muted = !!value;
  setSettings({ sound: !muted });
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
}
export function toggleMute() { setMuted(!muted); return muted; }

export function unlockOnGesture() {
  ensureCtx();
  resume();
}
