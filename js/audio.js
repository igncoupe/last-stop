// Sound: a generated horror score, ambience (rain, engine, water, hum),
// sound effects, and the voice player with per-character effects.
// Music and effects are synthesized live; voices are MP3s in /voices.
let ctx = null;
let master, musicBus, ambBus, sfxBus, voiceBus, reverb, noiseBuf;
let volume = 0.8;
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
  musicBus = bus(0.55);
  ambBus = bus(0.7);
  sfxBus = bus(0.9);
  voiceBus = bus(1.15);
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

function bus(level) { const g = gainNode(level); g.connect(master); return g; }
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
function out(node, peak, t, a, dcy, rev = 0, pan = 0) {
  const g = gainNode();
  env(g, t, a, peak, dcy);
  node.connect(g);
  let last = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
  last.connect(sfxBus);
  if (rev) send(g, rev);
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
function loadClip(id) {
  if (!clips.has(id)) {
    clips.set(id, fetch(`voices/${id}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => (buf && ctx ? ctx.decodeAudioData(buf) : null))
      .catch(() => null));
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
  if (ctx.state === "suspended") { try { await ctx.resume(); } catch { /* no permission yet */ } }
  if (ctx.state !== "running") return false;   // no sound allowed: subtitles carry the line
  const buf = await loadClip(id);
  if (!buf) return false;
  const { input, tail } = fxChain(fx);
  let outNode = tail;
  let panner = null;
  if (at) {
    panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.refDistance = 1.2;
    panner.rolloffFactor = 1;
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
    entry.stop = () => { try { srcs.forEach((x) => x.stop()); } catch { /* already stopped */ } };
  });
}

export const Sound = {
  init,
  mood,
  ambience,
  engine,
  voice,
  prefetch(ids) { if (ctx && voicesOn) ids.forEach((id) => loadClip(id)); },
  // fast automated tests can't wait for real-time voice clips
  setVoices(on) { voicesOn = on; },
  stopVoices() { live.forEach((e) => e.stop && e.stop()); },
  sfx(name, ...args) { if (ctx && SFX[name]) SFX[name](ctx.currentTime + 0.02, ...args); },
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
    live.forEach(({ panner, at }) => {
      if (!panner || !at) return;
      const v = at();
      if (!v) return;
      if (panner.positionX) { panner.positionX.value = v.x; panner.positionY.value = v.y; panner.positionZ.value = v.z; }
      else panner.setPosition(v.x, v.y, v.z);
    });
  },
  setVolume(v) { volume = v; if (ctx && !muted) ramp(master.gain, v, 0.2); },
  setMuted(m) { muted = m; if (ctx) ramp(master.gain, m ? 0 : volume, 0.2); },
  get muted() { return muted; },
  get ready() { return !!ctx; },
};
