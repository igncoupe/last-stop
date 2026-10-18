// Sound: a generated horror score, ambience (rain, engine, water, hum),
// sound effects, and the voice player with per-character effects.
// Music and effects are synthesized live; voices are MP3s in /voices.
let ctx = null;
let master, musicBus, ambBus, sfxBus, voiceBus, reverb, noiseBuf;
let volume = 0.8;
// the player's own mix (settings): voices, music, and effects with ambience
const levels = { voices: 1, music: 1, sfx: 1 };
let userVoice, userMusic, userSfx;
let muted = false;
let currentMood = null;
let moodVoices = [];
let melodyTimer = null;
const amb = {};

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const MOODS = {
  calm:    { drone: [33, 40], cutoff: 360, level: 0.2, lfo: 0.05, melody: { notes: [69, 72, 74, 76, 79, 81], every: [5, 9], level: 0.045 } },
  uneasy:  { drone: [33, 34], cutoff: 480, level: 0.24, lfo: 0.09, melody: { notes: [68, 69, 72, 75, 76], every: [6, 10], level: 0.04 } },
  dread:   { drone: [26, 32, 38], cutoff: 650, level: 0.32, lfo: 0.14, whistle: 87, melody: { notes: [56, 57, 63, 64, 70], every: [7, 12], level: 0.04 } },
  terror:  { drone: [26, 27, 33, 39], cutoff: 1100, level: 0.38, lfo: 0.8, whistle: 92 },
  grief:   { drone: [38, 45], cutoff: 420, level: 0.18, lfo: 0.04, wave: "triangle", melody: { notes: [62, 65, 69, 70, 72, 74], every: [3, 6], level: 0.055 } },
  hope:    { drone: [45, 52, 57], cutoff: 900, level: 0.15, lfo: 0.04, wave: "triangle", melody: { notes: [69, 71, 73, 76, 78, 81], every: [2.5, 5], level: 0.06 } },
  silence: { drone: [], level: 0 },
};

function init() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 8;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(limiter);
  limiter.connect(ctx.destination);
  userVoice = bus(levels.voices);
  userMusic = bus(levels.music);
  userSfx = bus(levels.sfx);
  musicBus = bus(0.55, userMusic);
  ambBus = bus(0.7, userSfx);
  sfxBus = bus(0.9, userSfx);
  // voices go through their own compressor, so every line lands at the same loudness
  voiceBus = gainNode(1.25);
  const voiceComp = ctx.createDynamicsCompressor();
  voiceComp.threshold.value = -26;
  voiceComp.knee.value = 12;
  voiceComp.ratio.value = 4;
  voiceComp.attack.value = 0.005;
  voiceComp.release.value = 0.2;
  const voiceMakeup = gainNode(1.5);
  voiceBus.connect(voiceComp);
  voiceComp.connect(voiceMakeup);
  voiceMakeup.connect(userVoice);
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(3.2);
  const rOut = gainNode(0.5);
  reverb.connect(rOut);
  rOut.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
  document.addEventListener("visibilitychange", () => { if (ctx) document.hidden ? ctx.suspend() : ctx.resume(); });
}

function bus(level, out = master) { const g = gainNode(level); g.connect(out); return g; }
function gainNode(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
function send(node, amount) { const g = gainNode(amount); node.connect(g); g.connect(reverb); }
function impulse(seconds) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const x = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}
function ramp(param, value, seconds) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + seconds);
}
function env(g, t, a, peak, dcy) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}
function noise(t, dur, type, freq, q) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (q) f.Q.value = q;
  src.connect(f);
  src.start(t, Math.random());
  src.stop(t + dur);
  return f;
}
function tone(t, dur, type, f0, f1) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}
// where effects go: the effects bus, or (inside sfxAt) a quiet, muffled, placed chain
let sfxDest = null;
let sfxDestLevel = 1;          // ...and how loud its echo is (a quiet sound has a quiet echo)
function out(node, peak, t, a, dcy, rev = 0, pan = 0) {
  const g = gainNode();
  env(g, t, a, peak, dcy);
  node.connect(g);
  let last = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
  last.connect(sfxDest || sfxBus);
  if (rev) send(g, rev * (sfxDest ? sfxDestLevel * 0.6 : 1));
  return g;
}

const SFX = {
  sting(t) {
    [220, 233.1, 311.1, 329.6, 466.2, 698.5, 740].forEach((f) => out(tone(t, 1.8, "sawtooth", f * 1.03, f * 0.92), 0.16, t, 0.006, 1.7, 0.5));
    out(noise(t, 0.7, "highpass", 1400), 0.7, t, 0.004, 0.6);
    out(tone(t, 1.3, "sine", 80, 26), 1, t, 0.004, 1.2);
  },
  knock(t, count = 3) {
    for (let i = 0; i < count; i++) {
      const tt = t + i * 0.34 + Math.random() * 0.04;
      out(tone(tt, 0.25, "sine", 115, 45), 0.8, tt, 0.003, 0.22, 0.3);
      out(noise(tt, 0.08, "lowpass", 900), 0.5, tt, 0.002, 0.07);
    }
  },
  bang(t) {
    out(tone(t, 0.5, "sine", 90, 30), 1, t, 0.002, 0.45, 0.4);
    out(noise(t, 0.12, "lowpass", 1200), 0.9, t, 0.002, 0.1);
    out(noise(t + 0.02, 0.7, "highpass", 3500), 0.18, t + 0.02, 0.01, 0.6);
  },
  // something heavy hitting the windshield: a body-thump, the glass flexing, the frame rattling
  slam(t) {
    out(tone(t, 0.7, "sine", 70, 24), 1.2, t, 0.001, 0.65, 0.5);
    out(noise(t, 0.18, "lowpass", 700), 1.1, t, 0.001, 0.16);
    out(noise(t + 0.01, 0.5, "bandpass", 2600, 1.4), 0.5, t + 0.01, 0.002, 0.45, 0.3);
    for (let i = 0; i < 7; i++) {
      const tt = t + 0.06 + i * 0.045 + Math.random() * 0.02;
      out(noise(tt, 0.03, "highpass", 2200), 0.25 / (1 + i * 0.3), tt, 0.001, 0.03);
    }
  },
  // glass cracking: sharp ticks spreading out, then a long creak
  crack(t) {
    for (let i = 0; i < 9; i++) {
      const tt = t + i * i * 0.012 + Math.random() * 0.01;
      out(noise(tt, 0.02, "highpass", 4500), 0.55 / (1 + i * 0.25), tt, 0.0005, 0.02, 0.2, (Math.random() - 0.5) * 0.8);
    }
    out(tone(t + 0.15, 0.9, "sawtooth", 2400, 1700), 0.035, t + 0.15, 0.05, 0.8, 0.3);
  },
  // not a voice. Something pretending to be one.
  shriek(t) {
    [880, 1245, 1661, 2349].forEach((f, i) => {
      const o = tone(t, 1.3, "sawtooth", f * 0.7, f * 1.18);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800 + i * 500;
      bp.Q.value = 3;
      o.connect(bp);
      out(bp, 0.22, t + i * 0.015, 0.02, 1.2, 0.6);
    });
    out(noise(t, 1.1, "bandpass", 3200, 2), 0.35, t, 0.02, 1.0, 0.5);
  },
  // the air tightening before something happens
  rise(t, dur = 2.4) {
    out(tone(t, dur, "sine", 55, 190), 0.35, t, dur * 0.85, 0.2, 0.4);
    out(tone(t, dur, "sawtooth", 58, 196), 0.05, t, dur * 0.85, 0.2, 0.4);
    out(noise(t, dur, "bandpass", 600, 0.8), 0.25, t, dur * 0.9, 0.15, 0.5);
  },
  // a scream, right in your ear: not quite human. Formants over a sliding, wavering pitch,
  // driven into distortion, with a breath of noise and a body-blow underneath. Everything else ducks.
  scream(t, dur = 1.5) {
    const g = gainNode(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.6, t + 0.03);
    g.gain.setValueAtTime(1.6, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const drive = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) { const x = i / 256 - 1; curve[i] = Math.tanh(x * 5); }
    drive.curve = curve;
    const formants = [[850, 6, 1], [1250, 7, 0.8], [2700, 9, 0.5], [3600, 10, 0.3]].map(([f, q, level]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = q;
      const lvl = gainNode(level);
      bp.connect(lvl);
      lvl.connect(drive);
      return bp;
    });
    const vib = ctx.createOscillator();
    vib.frequency.value = 7.5;
    const vibAmt = gainNode(22);
    vib.connect(vibAmt);
    vib.start(t);
    vib.stop(t + dur + 0.1);
    for (const [detune, type] of [[0, "sawtooth"], [14, "sawtooth"], [-11, "square"], [1200, "sawtooth"]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(780, t + dur * 0.35);
      o.frequency.exponentialRampToValueAtTime(610, t + dur);
      vibAmt.connect(o.frequency);
      formants.forEach((bp) => o.connect(bp));
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    drive.connect(g);
    out(noise(t, dur, "bandpass", 3000, 1.2), 0.5, t, 0.02, dur * 0.9, 0.3);        // the rasp of breath in it
    out(tone(t, 0.9, "sine", 70, 28), 1.4, t, 0.002, 0.85, 0.3);                     // body blow
    g.connect(userSfx);
    send(g, 0.5);
    // everything else drops away for a moment
    for (const b of [musicBus, ambBus]) {
      b.gain.cancelScheduledValues(t);
      b.gain.setValueAtTime(b.gain.value, t);
      b.gain.linearRampToValueAtTime(b.gain.value * 0.25, t + 0.05);
      b.gain.linearRampToValueAtTime(b.gain.value, t + dur + 1.5);
    }
  },
  // a car horn, held down, off to the left where the other lane is
  horn(t, dur = 1) {
    const g = gainNode(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.02);         // loud enough to cut through the engine and the rain
    g.gain.setValueAtTime(0.6, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    for (const f of [349, 440]) tone(t, dur + 0.15, "square", f).connect(lp);
    lp.connect(g);
    let last = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = -0.5; g.connect(p); last = p; }
    last.connect(sfxBus);
    send(g, 0.25);
  },
  // tires screaming on wet asphalt
  screech(t) {
    const n = noise(t, 1.1, "bandpass", 2600, 12);
    n.frequency.setValueAtTime(2900, t);
    n.frequency.linearRampToValueAtTime(2100, t + 1.0);
    out(n, 0.35, t, 0.02, 1.0, 0.2, -0.3);
  },
  // a car going past the other way
  whoosh(t) {
    const n = noise(t, 1.0, "bandpass", 400, 0.8);
    n.frequency.setValueAtTime(300, t);
    n.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
    n.frequency.exponentialRampToValueAtTime(250, t + 1.0);
    out(n, 0.5, t, 0.35, 0.6, 0.1, -0.6);
  },
  // bare feet, running, much too fast
  skitter(t, dur = 3) {
    for (let tt = t; tt < t + dur; tt += 0.13 + Math.random() * 0.03) {
      out(noise(tt, 0.04, "lowpass", 900), 0.3, tt, 0.002, 0.035, 0.2, 0.6);
    }
  },
  static(t, dur = 0.45) {
    const n = noise(t, dur, "bandpass", 2300, 0.7);
    const g = gainNode();
    for (let i = 0; i < dur * 32; i++) g.gain.setValueAtTime(Math.random() * 0.28, t + i / 32);
    g.gain.setValueAtTime(0, t + dur);
    n.connect(g);
    g.connect(sfxBus);
  },
  door(t) {
    out(noise(t, 0.8, "highpass", 2400), 0.3, t, 0.02, 0.7);
    out(tone(t + 0.6, 0.2, "sine", 85, 40), 0.5, t + 0.6, 0.004, 0.18);
  },
  thunder(t) {
    const n = noise(t, 4.5, "lowpass", 240);
    const g = gainNode();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.6);
    g.gain.linearRampToValueAtTime(0.6, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
    n.connect(g);
    g.connect(sfxBus);
    send(g, 0.5);
  },
  heartbeat(t, beats = 6, bpm = 72) {
    const gap = 60 / bpm;
    for (let i = 0; i < beats; i++) {
      out(tone(t + i * gap, 0.18, "sine", 64, 40), 0.75, t + i * gap, 0.01, 0.16);
      out(tone(t + i * gap + 0.23, 0.18, "sine", 58, 38), 0.45, t + i * gap + 0.23, 0.01, 0.16);
    }
  },
  drip(t) { out(tone(t, 0.25, "sine", 1500, 520), 0.22, t, 0.003, 0.22, 1); },
  brake(t) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1700;
    f.Q.value = 9;
    tone(t, 1, "sawtooth", 1700, 1480).connect(f);
    out(f, 0.12, t, 0.08, 0.85);
    out(noise(t, 1, "lowpass", 500), 0.16, t, 0.1, 0.8);
  },
  whisper(t) {
    const pan = Math.random() < 0.5 ? -0.8 : 0.8;
    const f = noise(t, 2, "bandpass", 1800, 4);
    for (let i = 0; i < 24; i++) f.frequency.setValueAtTime(800 + Math.random() * 2600, t + i * 0.08);
    out(f, 0.35, t, 0.25, 1.6, 0.6, pan);
  },
  coin(t) { [2600, 3900, 5300].forEach((fr, i) => out(tone(t + i * 0.003, 0.6, "sine", fr), 0.12 / (i + 1), t + i * 0.003, 0.002, 0.55, 0.4)); },
  bell(t) { [1320, 1980].forEach((fr, i) => out(tone(t, 1.2, "sine", fr), 0.18 / (i + 1), t, 0.002, 1.1, 0.5)); },
  punch(t) { out(noise(t, 0.08, "bandpass", 1800, 2), 0.7, t, 0.002, 0.07); out(tone(t + 0.05, 0.1, "square", 600, 300), 0.08, t + 0.05, 0.002, 0.08); },
  click(t) { out(noise(t, 0.03, "highpass", 3000), 0.4, t, 0.001, 0.025); },
  lightsout(t) { out(noise(t, 0.2, "lowpass", 380), 0.8, t, 0.002, 0.18); out(tone(t, 0.4, "square", 120, 35), 0.12, t, 0.002, 0.35); },
  breath(t) { out(noise(t, 1.4, "bandpass", 520, 1.2), 0.35, t, 0.7, 0.7, 0.3); out(noise(t + 1.6, 1.6, "bandpass", 430, 1.2), 0.28, t + 1.6, 0.3, 1.2, 0.3); },
  splash(t) { out(noise(t, 1.2, "lowpass", 1400), 0.7, t, 0.01, 1.1, 0.4); out(tone(t, 0.6, "sine", 200, 60), 0.4, t, 0.01, 0.5); },
  spark(t) { for (let i = 0; i < 6; i++) out(noise(t + i * 0.05 + Math.random() * 0.04, 0.05, "highpass", 4000), 0.5, t + i * 0.05, 0.001, 0.04); },
  rip(t) { out(noise(t, 0.5, "bandpass", 900, 1), 0.9, t, 0.005, 0.45); out(tone(t, 0.3, "sawtooth", 300, 80), 0.2, t, 0.002, 0.3); },
  // a coin dropped in the back of the bus: a few bounces, then it rolls and wobbles still
  coindrop(t) {
    [0, 0.17, 0.29, 0.37, 0.43, 0.47].forEach((b, i) => {
      const tt = t + b;
      out(tone(tt, 0.14, "sine", 3150 - i * 70), 0.16 * (1 - i * 0.13), tt, 0.001, 0.12, 0.7);
      out(tone(tt, 0.09, "sine", 4800 - i * 90), 0.05, tt, 0.001, 0.07, 0.7);
    });
    const r = noise(t + 0.52, 1.5, "bandpass", 3400, 7);
    const g = gainNode(0);
    r.connect(g);
    let tt = t + 0.52;
    for (let i = 0; i < 26; i++) { g.gain.setValueAtTime(i % 2 ? 0.03 : 0.1 * (1 - i / 28), tt); tt += 0.045 * (1 + i / 18); }
    g.gain.setValueAtTime(0, tt);
    out(g, 0.55, t + 0.52, 0.01, tt - t - 0.52, 0.5);
  },
  // the engine coughing (and dying)
  sputter(t) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * (0.16 + Math.random() * 0.08);
      out(noise(tt, 0.14, "lowpass", 260, 2), 0.9, tt, 0.004, 0.12, 0.2);
      out(tone(tt, 0.12, "sawtooth", 62, 38), 0.18, tt, 0.004, 0.1);
    }
  },
  // the starter grinding, then it catches
  ignition(t) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 3;
    const o = tone(t, 0.9, "sawtooth", 140);
    for (let i = 0; i < 9; i++) o.frequency.setValueAtTime(i % 2 ? 120 : 160, t + i * 0.1);
    o.connect(f);
    out(f, 0.3, t, 0.02, 0.85);
    out(noise(t + 0.9, 0.5, "lowpass", 300, 1.5), 0.8, t + 0.9, 0.01, 0.45, 0.2);
    out(tone(t + 0.9, 0.5, "sawtooth", 55, 40), 0.25, t + 0.9, 0.01, 0.45);
  },
  // ---- the other rooms on the fourth floor
  // an old man coughing, wet and tired
  cough(t, times = 2) {
    for (let i = 0; i < times; i++) {
      const tt = t + i * (0.42 + Math.random() * 0.2);
      out(noise(tt, 0.3, "bandpass", 420 + Math.random() * 120, 1.4), 0.6, tt, 0.01, 0.26);
      out(noise(tt, 0.22, "bandpass", 1500, 2), 0.25, tt, 0.006, 0.2);
      out(tone(tt, 0.2, "sawtooth", 140, 90), 0.08, tt, 0.01, 0.18);
    }
  },
  // someone turning over in a hospital bed: springs and a plastic mattress
  creak(t) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 12;
    const o = tone(t, 0.9, "sawtooth", 210, 160);
    o.frequency.setValueAtTime(210, t);
    for (let i = 1; i < 9; i++) o.frequency.setValueAtTime(150 + Math.random() * 120, t + i * 0.1);
    o.connect(f);
    out(f, 0.5, t, 0.05, 0.8);
    out(noise(t + 0.3, 0.6, "lowpass", 900), 0.2, t + 0.3, 0.1, 0.45);
  },
  // a heart monitor in another room; sometimes it skips
  beeps(t, count = 4, gap = 1.05) {
    for (let i = 0; i < count; i++) {
      if (i === count - 2 && Math.random() < 0.5) continue;
      const tt = t + i * gap;
      out(tone(tt, 0.12, "sine", 960), 0.3, tt, 0.004, 0.11);
    }
  },
  // humming, almost a tune, from a room where nobody should be awake
  hum(t) {
    const notes = [57, 60, 62, 60, 57, 55, 57];
    notes.forEach((m, i) => {
      const tt = t + i * 0.55;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 700;
      f.Q.value = 1.5;
      const o = tone(tt, 0.6, "triangle", 440 * Math.pow(2, (m - 69) / 12));
      o.connect(f);
      out(f, 0.5, tt, 0.08, 0.5, 0.3);
    });
  },
  // a sob, held in
  sob(t) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.38;
      out(noise(tt, 0.3, "bandpass", 650 + i * 60, 3), 0.45, tt, 0.03, 0.26, 0.3);
    }
    out(noise(t + 1.4, 1.1, "bandpass", 480, 1.6), 0.3, t + 1.4, 0.4, 0.7, 0.3);
  },
  // a television left on, voices you can't make out
  murmur(t, dur = 3.5) {
    const f = noise(t, dur, "bandpass", 1100, 1.2);
    const g = gainNode(0);
    f.connect(g);
    for (let i = 0; i < dur * 6; i++) g.gain.setValueAtTime(Math.random() < 0.7 ? 0.2 + Math.random() * 0.5 : 0.02, t + i / 6);
    g.gain.setValueAtTime(0, t + dur);
    out(g, 0.6, t, 0.2, dur - 0.2);
  },
  // a wheel that needs oil, rolling slowly past the end of the hall
  // an old telephone bell: two short trills (the phone call on night 2, the payphones on night 4)
  ring(t, bursts = 1) {
    for (let b = 0; b < bursts; b++) {
      for (const [start, len] of [[0, 0.42], [0.62, 0.42]]) {
        const tt = t + b * 3 + start;
        const am = ctx.createGain();
        am.gain.value = 0.5;                       // (0..1, trilling)
        const lfo = tone(tt, len, "square", 22);
        const depth = gainNode(0.5);
        lfo.connect(depth);
        depth.connect(am.gain);
        const bell = ctx.createBiquadFilter();
        bell.type = "bandpass";
        bell.frequency.value = 1150;
        bell.Q.value = 3;
        tone(tt, len, "triangle", 1080).connect(bell);
        tone(tt, len, "triangle", 1290).connect(bell);
        bell.connect(am);
        out(am, 0.32, tt, 0.004, len, 0.15);
      }
    }
  },
  squeak(t, times = 4) {
    for (let i = 0; i < times; i++) {
      const tt = t + i * 0.7;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2400;
      f.Q.value = 14;
      tone(tt, 0.18, "sawtooth", 2300 + Math.random() * 300, 2000).connect(f);
      out(f, 0.35, tt, 0.02, 0.15);
    }
  },
  // your own footstep on concrete
  step(t) {
    out(noise(t, 0.09, "lowpass", 700 + Math.random() * 200), 0.3, t, 0.004, 0.08, 0.1);
    out(tone(t, 0.07, "sine", 95, 55), 0.25, t, 0.003, 0.06);
  },
  // slow footsteps walking up the aisle behind you
  steps(t) {
    for (let i = 0; i < 5; i++) {
      const tt = t + i * 0.62;
      out(noise(tt, 0.1, "lowpass", 520), 0.16 + i * 0.03, tt, 0.004, 0.09, 0.5, i % 2 ? 0.25 : -0.25);
      out(tone(tt, 0.08, "sine", 80, 50), 0.12 + i * 0.02, tt, 0.003, 0.07, 0.3);
    }
  },
  // a siren far away across the city
  siren(t) {
    const o = ctx.createOscillator();
    o.type = "sine";
    for (let i = 0; i < 8; i++) o.frequency.setValueAtTime(i % 2 ? 960 : 720, t + i * 0.7);
    o.start(t);
    o.stop(t + 5.8);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1100;
    o.connect(f);
    const g = gainNode();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025, t + 1.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.6);
    f.connect(g);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.random() < 0.5 ? -0.7 : 0.7; g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
    send(g, 0.9);
  },
};

function mood(name) {
  if (!ctx || name === currentMood) return;
  currentMood = name;
  const m = MOODS[name] || MOODS.calm;
  const now = ctx.currentTime;
  moodVoices.forEach(({ g, nodes }) => { ramp(g.gain, 0, 3); nodes.forEach((n) => n.stop(now + 3.3)); });
  moodVoices = [];
  clearTimeout(melodyTimer);
  if (!m.drone.length) return;
  const g = gainNode();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = m.cutoff;
  filter.Q.value = 5;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = m.lfo;
  const depth = gainNode(m.cutoff * 0.45);
  lfo.connect(depth);
  depth.connect(filter.frequency);
  const nodes = [lfo];
  m.drone.forEach((n, i) => [-8, 8].forEach((cents) => {
    const o = ctx.createOscillator();
    o.type = m.wave || "sawtooth";
    o.frequency.value = hz(n);
    o.detune.value = cents + i * 3;
    o.connect(filter);
    o.start(now);
    nodes.push(o);
  }));
  if (m.whistle) {
    const w = ctx.createOscillator();
    w.frequency.value = hz(m.whistle);
    const vib = ctx.createOscillator();
    vib.frequency.value = 0.27;
    const vd = gainNode(11);
    vib.connect(vd);
    vd.connect(w.frequency);
    const wg = gainNode(0.03);
    w.connect(wg);
    wg.connect(g);
    w.start(now);
    vib.start(now);
    nodes.push(w, vib);
  }
  filter.connect(g);
  g.connect(musicBus);
  send(g, 0.35);
  lfo.start(now);
  ramp(g.gain, m.level / m.drone.length, 4);
  moodVoices.push({ g, nodes });
  if (m.melody) melody(m.melody);
}
function melody(mel) {
  melodyTimer = setTimeout(() => {
    if (!ctx || (MOODS[currentMood] || {}).melody !== mel) return;
    const n = mel.notes[Math.floor(Math.random() * mel.notes.length)];
    pluck(hz(n), mel.level);
    if (Math.random() < 0.35) setTimeout(() => pluck(hz(n - (Math.random() < 0.5 ? 5 : 7)), mel.level * 0.7), 450);
    melody(mel);
  }, (mel.every[0] + Math.random() * (mel.every[1] - mel.every[0])) * 1000);
}
function pluck(freq, level) {
  const now = ctx.currentTime;
  const g = gainNode();
  env(g, now, 0.01, level, 3.6);
  [1, 2.01, 3.98].forEach((h, i) => {
    const o = tone(now, 3.7, i ? "sine" : "triangle", freq * h);
    o.detune.value = (Math.random() - 0.5) * 16;
    const og = gainNode([1, 0.3, 0.08][i]);
    o.connect(og);
    og.connect(g);
  });
  g.connect(musicBus);
  send(g, 0.9);
}

function loop(type, freq, q) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (q) f.Q.value = q;
  const g = gainNode();
  src.connect(f);
  f.connect(g);
  g.connect(ambBus);
  src.start();
  return { g, f };
}
function startAmbience() {
  amb.rain = { ...loop("highpass", 900), max: 0.22 };
  const water = loop("lowpass", 420, 2);
  const wl = ctx.createOscillator();
  wl.frequency.value = 0.35;
  const wd = gainNode(180);
  wl.connect(wd);
  wd.connect(water.f.frequency);
  wl.start();
  amb.water = { ...water, max: 0.5 };
  const ef = ctx.createBiquadFilter();
  ef.type = "lowpass";
  ef.frequency.value = 150;
  const eg = gainNode();
  const oscs = [38, 38.7].map((f) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(ef); o.start(); return o; });
  ef.connect(eg);
  eg.connect(ambBus);
  amb.engine = { g: eg, max: 0.45, oscs };
  const hum = ctx.createOscillator();
  hum.type = "square";
  hum.frequency.value = 60;
  const hf = ctx.createBiquadFilter();
  hf.type = "lowpass";
  hf.frequency.value = 400;
  const hg = gainNode();
  hum.connect(hf);
  hf.connect(hg);
  hg.connect(ambBus);
  hum.start();
  amb.hum = { g: hg, max: 0.04 };
  // wind that rises and falls
  const wind = loop("bandpass", 380, 0.6);
  const wl2 = ctx.createOscillator();
  wl2.frequency.value = 0.07;
  const wd2 = gainNode(0.045);
  wl2.connect(wd2);
  wd2.connect(wind.g.gain);
  wl2.start();
  amb.wind = { ...wind, max: 0.09 };
  // tires hissing on wet asphalt, follows the bus speed
  amb.tires = { ...loop("highpass", 1600), max: 0.08 };
}
function ambience(levels) {
  if (!ctx) return;
  Object.entries(levels).forEach(([k, v]) => {
    const a = amb[k];
    if (!a) return;
    ramp(a.g.gain, Math.max(0, Math.min(1, v)) * a.max, 1.2);
  });
}
// engine pitch follows the bus speed (0..1)
function engine(level, rev) {
  if (!ctx) return;
  const a = amb.engine;
  a.g.gain.setTargetAtTime(level * a.max, ctx.currentTime, 0.3);
  a.oscs.forEach((o, i) => o.frequency.setTargetAtTime(34 + rev * 30 + i * 0.7, ctx.currentTime, 0.3));
  amb.tires.g.gain.setTargetAtTime(Math.min(1, rev * 1.2) * amb.tires.max, ctx.currentTime, 0.3);
}

/* ---------------- voices ---------------- */
const clips = new Map();
let clipVersions = {};                 // id -> hash of the file, so a re-recorded line isn't played from an old cached copy
function loadClip(id) {
  if (!clips.has(id)) {
    // a stalled download must never hold up the story: give up after 8 s and show the subtitle alone
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    clips.set(id, fetch(`voices/${id}.mp3${clipVersions[id] ? `?v=${clipVersions[id]}` : ""}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => (buf && ctx ? ctx.decodeAudioData(buf) : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer)));
  }
  return clips.get(id);
}
const live = new Set();

function fxChain(fx) {
  const input = gainNode(1);
  let tail = input;
  const chain = (node) => { tail.connect(node); tail = node; return node; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return chain(b); };
  if (fx === "radio" || fx === "phone") {
    filt("highpass", fx === "phone" ? 700 : 450);
    filt("lowpass", fx === "phone" ? 2600 : 3200);
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.6); }
    ws.curve = curve;
    chain(ws);
    chain(gainNode(0.8));
  } else if (fx === "ghost") {
    filt("lowpass", 2600);
    send(input, 0.55);
  } else if (fx === "whisper") {
    filt("highpass", 900);
    send(input, 0.8);
    chain(gainNode(0.75));
  } else if (fx === "inner") {
    filt("lowpass", 7000);
    send(input, 0.08);
  } else {
    send(input, 0.12);
  }
  return { input, tail };
}

// plays a voice clip; resolves when it ends (or right away if it's missing)
let voicesOn = true;
async function voice(id, { fx = "dry", at = null } = {}) {
  if (!ctx || !voicesOn) return false;
  // (resume can wait forever while the page is hidden, so it only gets a moment)
  if (ctx.state === "suspended") { try { await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]); } catch { /* no permission yet */ } }
  if (ctx.state !== "running") return false;   // no sound allowed: subtitles carry the line
  // a clip that won't download or won't decode gets 6 seconds, then the subtitle carries the line alone
  let late = false;
  const buf = await Promise.race([loadClip(id), new Promise((r) => setTimeout(() => { late = true; r(null); }, 6000))]);
  if (!buf || late) return false;
  const { input, tail } = fxChain(fx);
  let outNode = tail;
  // where they are only moves the voice left or right; it never gets quieter with distance
  let panner = null;
  if (at && ctx.createStereoPanner) {
    panner = ctx.createStereoPanner();
    tail.connect(panner);
    outNode = panner;
  }
  outNode.connect(voiceBus);
  const srcs = [];
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(input);
  srcs.push(src);
  if (fx === "ghost") {
    // a second, slower copy underneath: the drowned never sound quite right
    const twin = ctx.createBufferSource();
    twin.buffer = buf;
    twin.playbackRate.value = 0.985;
    const tg = gainNode(0.35);
    twin.connect(tg);
    tg.connect(input);
    srcs.push(twin);
  }
  ramp(musicBus.gain, 0.32, 0.3);
  const entry = { srcs, panner, at };
  live.add(entry);
  const now = ctx.currentTime;
  srcs.forEach((x, i) => x.start(now + i * 0.03));
  return new Promise((done) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      live.delete(entry);
      if (!live.size) ramp(musicBus.gain, 0.55, 0.8);
      done(true);
    };
    src.onended = finish;
    // never hang the story on a clip, even if the browser stops calling onended
    const check = () => {
      if (finished) return;
      if (ctx.currentTime > now + buf.duration + 1.5) finish();
      else setTimeout(check, 500);
    };
    setTimeout(check, (buf.duration + 0.5) * 1000);
    // ...or if the audio clock stops altogether (tab hidden, audio device asleep): real time decides then
    setTimeout(finish, (buf.duration + 2.5) * 1000);
    entry.stop = () => { try { srcs.forEach((x) => x.stop()); } catch { /* already stopped */ } };
  });
}

export const Sound = {
  init,
  mood,
  ambience,
  engine,
  voice,
  setVersions(v) { clipVersions = v || {}; },
  prefetch(ids) { if (ctx && voicesOn) ids.forEach((id) => loadClip(id)); },
  // fast automated tests can't wait for real-time voice clips
  setVoices(on) { voicesOn = on; },
  stopVoices() { live.forEach((e) => e.stop && e.stop()); },
  sfx(name, ...args) { if (ctx && SFX[name]) SFX[name](ctx.currentTime + 0.02, ...args); },
  // an effect from somewhere else: quiet, muffled by a door (lowpass), off to one side
  sfxAt(name, { gain = 0.3, pan = 0, muffle = 1400 } = {}, ...args) {
    if (!ctx || !SFX[name]) return;
    const g = gainNode(gain);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = muffle;
    g.connect(lp);
    let last = lp;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); lp.connect(p); last = p; }
    last.connect(sfxBus);
    sfxDest = g;
    sfxDestLevel = gain;
    try { SFX[name](ctx.currentTime + 0.02, ...args); } finally { sfxDest = null; sfxDestLevel = 1; }
  },
  // keep 3D voices and the listener in sync with the camera
  update(camera) {
    if (!ctx) return;
    const e = camera.matrixWorld.elements;
    const l = ctx.listener;
    const p = [e[12], e[13], e[14]];
    const f = [-e[8], -e[9], -e[10]];
    const u = [e[4], e[5], e[6]];
    if (l.positionX) {
      l.positionX.value = p[0]; l.positionY.value = p[1]; l.positionZ.value = p[2];
      l.forwardX.value = f[0]; l.forwardY.value = f[1]; l.forwardZ.value = f[2];
      l.upX.value = u[0]; l.upY.value = u[1]; l.upZ.value = u[2];
    } else {
      l.setPosition(...p);
      l.setOrientation(...f, ...u);
    }
    const r = [e[0], e[1], e[2]];        // the camera's right
    live.forEach(({ panner, at }) => {
      if (!panner || !at) return;
      const v = at();
      if (!v) return;
      const d = [v.x - p[0], v.y - p[1], v.z - p[2]];
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      const side = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / len;
      panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, side)) * 0.4, ctx.currentTime, 0.05);
    });
  },
  setLevels(l) {
    Object.assign(levels, l);
    if (ctx) { ramp(userVoice.gain, levels.voices, 0.1); ramp(userMusic.gain, levels.music, 0.1); ramp(userSfx.gain, levels.sfx, 0.1); }
  },
  setVolume(v) { volume = v; if (ctx && !muted) ramp(master.gain, v, 0.2); },
  setMuted(m) { muted = m; if (ctx) ramp(master.gain, m ? 0 : volume, 0.2); },
  get muted() { return muted; },
  get ready() { return !!ctx; },
};
