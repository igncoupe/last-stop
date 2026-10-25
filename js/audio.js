// Sound: a generated horror score, ambience (rain, engine, water, hum),
// sound effects, and the voice player with per-character effects.
// Music and effects are synthesized live; voices are MP3s in /voices.
let ctx = null;
let master, musicBus, ambBus, sfxBus, voiceBus, reverb, noiseBuf, muffle;
// (and a way out that skips the muffle: for something right in your face, which you hear even underwater)
let near, nearSfx;
// the scares go through their own limiter, so a scream on top of a thunderclap is loud, not distorted
function limiter(into, threshold = -12) {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = threshold;
  c.knee.value = 6;
  c.ratio.value = 12;
  c.attack.value = 0.002;
  c.release.value = 0.25;
  c.connect(into);
  return c;
}
let volume = 0.8;
// the player's own mix (settings): voices, music, effects with ambience, and the scares (jumpscares, the thunder,
// the stingers: their own level, so turning the everyday sounds down doesn't take the fright out of them)
const levels = { voices: 1, music: 1, sfx: 1, horror: 1 };
let userVoice, userMusic, userSfx, userHorror, horrorBus;
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
  // everything goes through this on its way out: underwater, it closes right down
  muffle = ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 22000;
  muffle.Q.value = 0.9;
  master.connect(muffle);
  muffle.connect(limiter);
  limiter.connect(ctx.destination);
  near = ctx.createGain();
  near.gain.value = muted ? 0 : volume;
  near.connect(limiter);
  // test runs: where everything comes out, so it can be recorded (the trailer's sound is the game's own)
  if (/[?&]test\b/.test(location.search)) window.__soundOut = { ctx, out: limiter };
  userVoice = bus(levels.voices);
  userMusic = bus(levels.music);
  userSfx = bus(levels.sfx);
  userHorror = bus(levels.horror);
  horrorBus = limiter(userHorror);
  nearSfx = bus(levels.horror, near);
  nearSfx.limit = limiter(nearSfx);
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
  FX_FILES.forEach(loadFx);
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

// the sounds of the scares themselves: played on the scares' level (see levels)
const HORROR = new Set(["sting", "scream", "shriek", "thud", "slam", "crack", "thunder", "crackle"]);

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
  // the body blow under a jumpscare: felt more than heard
  thud(t) { out(tone(t, 0.9, "sine", 70, 28), 1.3, t, 0.002, 0.85, 0.3); },
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
    g.connect(horrorBus);
    send(g, 0.5);
    // everything else drops away for a moment
    for (const b of [musicBus, ambBus]) {
      b.gain.cancelScheduledValues(t);
      b.gain.setValueAtTime(b.gain.value, t);
      b.gain.linearRampToValueAtTime(b.gain.value * 0.25, t + 0.05);
      b.gain.linearRampToValueAtTime(b.gain.value, t + dur + 1.5);
    }
  },
  // a car horn held down for dur seconds (kind: see HORNS). Placed in the world, it's Sound.horn().
  horn(t, dur = 1, kind = "car") { hornVoice(kind, t, sfxDest || sfxBus, sfxDest ? 0 : 0.18).stop(t + dur); },
  // the bus's own horn
  bushorn(t, dur = 0.55) { hornVoice("bus", t, sfxDest || sfxBus, sfxDest ? 0 : 0.18).stop(t + dur); },
  // the brake pedal going down with nothing behind it: a dull knock as it bottoms out on the floor, and a thin hiss
  // of air from a system that's lost its pressure
  brakefail(t) {
    out(tone(t, 0.2, "sine", 130, 55), 0.7, t, 0.003, 0.18, 0.15);
    out(noise(t, 0.07, "lowpass", 700), 0.55, t, 0.002, 0.06);
    out(noise(t + 0.04, 0.05, "bandpass", 2400, 3), 0.18, t + 0.04, 0.002, 0.04);        // the linkage rattling
    out(noise(t + 0.08, 1.5, "highpass", 4200), 0.07, t + 0.08, 0.12, 1.3, 0.2);           // air, going nowhere
  },
  // a payphone's bell, for dur seconds: two little steel gongs and a clapper hammering between them twenty times
  // a second. (What plays while the recording of one is still on its way.)
  bellring(t, dur = 2) {
    for (let i = 0, tt = t; tt < t + dur; i++, tt += 0.05) {
      const gong = i % 2 ? 1.07 : 1;
      [[1680, 1], [4000, 0.45], [6900, 0.2]].forEach(([f, a]) => out(tone(tt, 0.3, "sine", f * gong), 0.09 * a, tt, 0.001, 0.26, 0.15));
    }
  },
  // water coming in: a roar through the cracked glass and the door seals, for dur seconds
  gush(t, dur = 3) {
    out(noise(t, dur, "lowpass", 900), 0.9, t, 0.15, dur - 0.15, 0.4);
    out(noise(t, dur, "bandpass", 2200, 0.7), 0.35, t, 0.1, dur - 0.1, 0.3);
    out(tone(t, dur, "sine", 48, 38), 0.5, t, 0.3, dur - 0.3, 0.2);
  },
  // something huge hitting the water: the body blow, the weight of the water thrown up, spray hissing down, and the
  // gulp as it goes in
  plunge(t) {
    out(tone(t, 1.4, "sine", 64, 22), 1.5, t, 0.002, 1.3, 0.6);
    out(noise(t, 0.25, "lowpass", 500), 1.4, t, 0.002, 0.22, 0.5);
    out(noise(t + 0.02, 2.2, "lowpass", 1400), 0.9, t + 0.02, 0.02, 2.1, 0.6);
    const hiss = noise(t + 0.25, 2.6, "highpass", 2600);
    out(hiss, 0.35, t + 0.25, 0.3, 2.3, 0.5);
    const gulp = noise(t + 0.15, 0.9, "bandpass", 420, 4);
    gulp.frequency.setValueAtTime(520, t + 0.15);
    gulp.frequency.exponentialRampToValueAtTime(130, t + 1.0);
    out(gulp, 0.7, t + 0.15, 0.05, 0.8, 0.4);
  },
  // the bus's frame dragging over a concrete edge: a grinding shriek of metal, crackling
  scrape(t, dur = 0.9) {
    const n = noise(t, dur, "bandpass", 1900, 6);
    n.frequency.setValueAtTime(2300, t);
    n.frequency.linearRampToValueAtTime(1500, t + dur);
    out(n, 0.5, t, 0.01, dur, 0.3);
    out(tone(t, dur, "square", 210, 160), 0.06, t, 0.01, dur, 0.2);
    for (let tt = t; tt < t + dur; tt += 0.03 + Math.random() * 0.05) out(noise(tt, 0.02, "highpass", 3500), 0.18, tt, 0.001, 0.02);
  },
  // a gasp: dragging in air, after none
  gasp(t) {
    const n = noise(t, 0.75, "bandpass", 700, 1.6);
    n.frequency.setValueAtTime(600, t);
    n.frequency.exponentialRampToValueAtTime(2600, t + 0.6);
    out(n, 0.9, t, 0.03, 0.7, 0.2);
    out(tone(t, 0.5, "sine", 180, 320), 0.12, t, 0.05, 0.45);
  },
  // the hull groaning under the water: metal bending, a long way down
  groan(t, dur = 3) {
    for (const [f0, f1, lvl] of [[46, 31, 0.5], [93, 61, 0.22], [140, 95, 0.12]]) {
      const o = tone(t, dur, "sawtooth", f0, f1);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      o.connect(lp);
      out(lp, lvl, t, dur * 0.3, dur * 0.7, 0.6);
    }
    out(noise(t, dur, "bandpass", 300, 3), 0.25, t, dur * 0.4, dur * 0.6, 0.5);
  },
  // the drowned, all of them at once: a low moan with no words in it, coming through the water
  moan(t, dur = 6) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = gainNode(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + dur * 0.3);
    g.gain.setValueAtTime(0.7, t + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g);
    g.connect(sfxBus);
    send(g, 0.7);
    for (let i = 0; i < 7; i++) {
      const f = 88 + i * 21 + Math.random() * 10;
      const o = tone(t, dur, "sawtooth", f, f * (0.8 + Math.random() * 0.1));
      const vib = ctx.createOscillator();
      vib.frequency.value = 2.5 + Math.random() * 3;
      const amt = gainNode(f * 0.025);
      vib.connect(amt);
      amt.connect(o.frequency);
      vib.start(t);
      vib.stop(t + dur + 0.05);
      // an "oo" and an "aa" in it, never quite either
      for (const [ff, q] of [[420 + i * 25, 5], [780 + i * 45, 6]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = ff;
        bp.Q.value = q;
        const lv = gainNode(0.6);
        o.connect(bp);
        bp.connect(lv);
        lv.connect(lp);
      }
    }
  },
  // air going up past you, underwater
  bubbles(t, dur = 2.5) {
    const n = Math.round(dur * 14);
    for (let i = 0; i < n; i++) {
      const tt = t + Math.random() * dur;
      const f = 240 + Math.random() * 520;
      out(tone(tt, 0.09, "sine", f, f * 1.9), 0.18 + Math.random() * 0.2, tt, 0.004, 0.08, 0.3);
    }
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
    g.connect(sfxDest || sfxBus);
    send(g, 0.5);
  },
  // lightning right on top of you: the air splitting (a hard crack of noise, a body blow), then the rumble. (What
  // plays while the recording of one is still on its way.)
  crackle(t) {
    out(noise(t, 0.09, "highpass", 1200), 1.4, t, 0.001, 0.08, 0.5);
    out(noise(t + 0.01, 0.4, "bandpass", 2500, 0.8), 0.7, t + 0.01, 0.003, 0.38, 0.6);
    out(tone(t, 0.8, "sine", 60, 24), 1.3, t, 0.002, 0.75, 0.4);
    SFX.thunder(t + 0.12);
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
  // something heavy walking on the bus roof, slowly: a muffled thud, and the metal panel flexing under it
  roofsteps(t, steps = 3) {
    let tt = t;
    for (let i = 0; i < steps; i++) {
      out(tone(tt, 0.2, "sine", 72, 36), 0.55, tt, 0.004, 0.18, 0.25);
      out(noise(tt, 0.14, "lowpass", 240), 0.5, tt, 0.003, 0.12, 0.25);
      const flex = ctx.createBiquadFilter();
      flex.type = "bandpass";
      flex.frequency.value = 850 + Math.random() * 300;
      flex.Q.value = 16;
      tone(tt + 0.03, 0.28, "sawtooth", 170 + Math.random() * 50).connect(flex);
      out(flex, 0.06, tt + 0.03, 0.01, 0.25, 0.15);
      tt += 0.8 + Math.random() * 0.35;
    }
  },
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

// ---- horns. An electric horn is a steel diaphragm slapping against a magnet behind a small flared trumpet, and most
// cars have a pair of them a third or so apart. What comes out is a hard, buzzy reed tone (near enough a narrow pulse
// wave), the trumpet's resonances on top of it and not much bass under it. It takes a few hundredths of a second to
// get going, holds for as long as the button's held, and stops almost dead.
const HORNS = {
  bus: { tones: [330, 415], level: 0.36, body: [[1250, 1.1, 8], [2700, 1.6, 6]], wobble: 0.003 },
  car: { tones: [415, 523], level: 0.3, body: [[1700, 1.2, 7], [3300, 1.8, 5]], wobble: 0.003 },
  // the old car on your tail: worn out and out of tune, one horn going flat
  old: { tones: [362, 438], level: 0.3, body: [[1500, 1.3, 7], [3000, 2, 4]], wobble: 0.012 },
};
let hornWave = null;
const HORN_MIN = 0.12;          // a tap on the button still sounds like a horn
function hornVoice(kind, t, dest, reverb = 0.18) {
  const h = HORNS[kind] || HORNS.car;
  if (!hornWave) {
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let k = 1; k < N; k++) re[k] = Math.sin(Math.PI * k * 0.22) / k;
    hornWave = ctx.createPeriodicWave(re, im);
  }
  const amp = gainNode(0);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(h.level, t + 0.03);
  const biquad = (type, f, q, gain = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
  // the trumpet: a couple of strong resonances, little below 300 Hz, rolled off at the top
  const body = [biquad("highpass", 280, 0.8), ...h.body.map(([f, q, db]) => biquad("peaking", f, q, db)), biquad("lowpass", 6500, 0.7)];
  body.reduce((a, b) => { a.connect(b); return b; });
  body[body.length - 1].connect(amp);
  amp.connect(dest);
  if (reverb) send(amp, reverb);
  const drive = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; drive[i] = Math.tanh(x * 2.2); }
  const nodes = [];
  h.tones.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.setPeriodicWave(hornWave);
    o.frequency.setValueAtTime(f * 0.88, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.045);     // the diaphragm getting up to speed
    // ...and it never quite holds still
    const wob = ctx.createOscillator();
    wob.frequency.value = 5.1 + i * 1.9;
    const wa = gainNode(f * h.wobble);
    wob.connect(wa);
    wa.connect(o.frequency);
    // each horn its own reed: driven hard, so it buzzes (two horns, not one sound, so they don't intermodulate)
    const pre = gainNode(0.5);
    const ws = ctx.createWaveShaper();
    ws.curve = drive;
    o.connect(pre);
    pre.connect(ws);
    ws.connect(body[0]);
    o.start(t);
    wob.start(t);
    nodes.push(o, wob);
  });
  // the contacts closing: a little tick at the start
  const tick = noise(t, 0.015, "highpass", 2000);
  const tg = gainNode(0);
  env(tg, t, 0.002, 0.2, 0.012);
  tick.connect(tg);
  tg.connect(dest);
  let stopped = false;
  return {
    // let go of it (at audio time t1; never before it has properly sounded). Can be called again to stop it sooner.
    stop(t1) {
      t1 = Math.max(t1, t + HORN_MIN);
      amp.gain.cancelScheduledValues(t1);
      amp.gain.setTargetAtTime(0.0001, t1, 0.012);
      if (stopped) return;
      stopped = true;
      nodes.forEach((n) => n.stop(t1 + 0.2));
      nodes[0].onended = () => amp.disconnect();
    },
  };
}

/* ---------------- recorded effects, and sounds that come from somewhere ---------------- */
// A few effects are recordings (sfx/*.mp3, made with ElevenLabs sound generation: tools/make_sfx_elevenlabs.py): one for
// each jumpscare, the payphone bell, the hospital door. They're fetched as soon as there's sound. One that isn't in
// yet (or never comes) doesn't play: fx() returns null, and the caller falls back on a synthesized sound.
const FX_FILES = ["daniel_door", "daniel_window", "breath_behind", "daniel_rise", "door_hands", "window_hands", "carwoman_glass",
  "mirror_creep", "mirror_drowned", "shade_roof", "shade_window", "underwater_scream", "payphone_ring", "door_latch",
  "thunder_crack", "hood_open", "hood_close", "wet_steps", "daniel_sting"];
// (they came out at different levels: these even them up)
const FX_LEVEL = { mirror_creep: 0.45, carwoman_glass: 0.6, daniel_window: 0.55, shade_roof: 0.75, shade_window: 1.2, daniel_rise: 1.5, window_hands: 1.3, breath_behind: 1.5,
  daniel_sting: 0.55, wet_steps: 4, hood_open: 1.3 };
const fxBufs = new Map();          // name -> AudioBuffer (null while it's on its way)
let fxVersions = {};
function loadFx(name) {
  if (fxBufs.has(name) || !ctx) return;
  fxBufs.set(name, null);
  fetch(`sfx/${name}.mp3${fxVersions[name] ? `?v=${fxVersions[name]}` : ""}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? ctx.decodeAudioData(b) : null))
    .then((buf) => { if (buf) fxBufs.set(name, buf); else fxBufs.delete(name); })
    .catch(() => fxBufs.delete(name));
}
// Sounds placed in the world. Every frame (update) each one is panned to where it is, quieter and duller the farther
// off it is, and duller again through the bus's walls when it's outside and you're in.
const emitters = new Set();
let inside = false;                                   // the listener is inside the bus (main.js says, every frame)
const ear = { p: [0, 0, 0], r: [1, 0, 0] };            // where the listener is, and which way is their right
function emitter({ gain = 1, at = null, range = 90, ref = 3, outside = false, pan = 0, rev = 0.15, dest = null } = {}) {
  const input = gainNode(1);
  const fade = gainNode(1);
  const level = gainNode(gain);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 20000;
  input.connect(fade);
  fade.connect(level);
  level.connect(lp);
  let last = lp;
  let panner = null;
  if (ctx.createStereoPanner) { panner = ctx.createStereoPanner(); panner.pan.value = pan; lp.connect(panner); last = panner; }
  last.connect(dest || sfxBus);
  if (rev) send(lp, rev);
  const e = { input, fade, level, lp, panner, at, gain, range, ref, outside, sources: [], done: false };
  e.end = () => {
    if (e.done) return;
    e.done = true;
    emitters.delete(e);
    setTimeout(() => { try { input.disconnect(); last.disconnect(); lp.disconnect(); } catch { /* gone */ } }, 300);
  };
  e.handle = {
    // fades out over `seconds` and stops
    stop(seconds = 0.06) {
      if (e.done || !ctx) return;
      const now = ctx.currentTime;
      fade.gain.cancelScheduledValues(now);
      fade.gain.setValueAtTime(fade.gain.value, now);
      fade.gain.linearRampToValueAtTime(0, now + seconds);
      e.sources.forEach((s) => { try { s.stop(now + seconds + 0.02); } catch { /* already stopped */ } });
      setTimeout(e.end, (seconds + 0.1) * 1000);
    },
    get playing() { return !e.done; },
  };
  if (at) { emitters.add(e); place(e, true); }
  return e;
}
function place(e, now = false) {
  const v = typeof e.at === "function" ? e.at() : e.at;
  if (!v) return;
  const dx = v.x - ear.p[0], dy = v.y - ear.p[1], dz = v.z - ear.p[2];
  const d = Math.max(0.05, Math.hypot(dx, dy, dz));
  // full up close, falling off with distance, gone by `range`
  let g = e.gain * Math.min(1, e.ref / d) ** 0.85 * Math.min(1, Math.max(0, (e.range - d) / (e.range * 0.3)));
  let cut = 18000 / (1 + d / 30);                    // the air takes the top off, at a distance
  if (e.outside && inside) { g *= 0.55; cut = Math.min(cut, typeof e.outside === "number" ? e.outside : 1100); }
  const side = (dx * ear.r[0] + dy * ear.r[1] + dz * ear.r[2]) / d;
  const at = ctx.currentTime;
  if (now) {
    e.level.gain.setValueAtTime(g, at);
    e.lp.frequency.setValueAtTime(cut, at);
    if (e.panner) e.panner.pan.setValueAtTime(Math.max(-1, Math.min(1, side)) * 0.85, at);
  } else {
    e.level.gain.setTargetAtTime(g, at, 0.04);
    e.lp.frequency.setTargetAtTime(cut, at, 0.04);
    if (e.panner) e.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, side)) * 0.85, at, 0.04);
  }
}
// the score, the ambience and the everyday effects drop away under something loud, and come back (the voices don't)
function duck(t, seconds) {
  for (const [b, base] of [[musicBus, live.size ? 0.32 : 0.55], [ambBus, 0.7], [sfxBus, 0.9]]) {
    b.gain.cancelScheduledValues(t);
    b.gain.setValueAtTime(b.gain.value, t);
    b.gain.linearRampToValueAtTime(base * 0.25, t + 0.05);
    b.gain.setValueAtTime(base * 0.25, t + seconds);
    b.gain.linearRampToValueAtTime(base, t + seconds + 1.5);
  }
}
// play a recording: { gain, at (a point, or a function giving one, for a sound that comes from somewhere), range, ref,
// outside, pan, offset (start this far in), duck (seconds), loud (straight onto the effects level, like the scream),
// close (right in your face: not muffled, even underwater) }. Returns something with stop(), or null if it isn't loaded.
function fx(name, { gain = 1, at = null, range, ref, outside, pan = 0, offset = 0, duck: ducking = 0, loud = false, close = false, rev = 0.15 } = {}) {
  if (!ctx) return null;
  const buf = fxBufs.get(name);
  if (!buf) { loadFx(name); return null; }
  const e = emitter({ gain: gain * (FX_LEVEL[name] || 1), at, range, ref, outside, pan, rev: close ? 0 : rev, dest: close ? nearSfx.limit : loud ? horrorBus : null });
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(e.input);
  const t = ctx.currentTime + 0.01;
  src.start(t, Math.min(offset, buf.duration - 0.05));
  src.onended = e.end;
  e.sources.push(src);
  if (ducking) duck(t, ducking);
  return e.handle;
}

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
// Downloads: a night's clips are fetched a few at a time, in story order, so the first lines are in long
// before the last ones. A download that fails or stalls is forgotten (and tried again the next time the line
// is wanted), never kept as a silent clip: a slow connection must never leave a line without its voice.
const queue = [];
let fetching = 0;
const AT_ONCE = 4;
function fetchClip(id) {
  // (a download that hangs gives its place up after 30 s)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  return fetch(`voices/${id}.mp3${clipVersions[id] ? `?v=${clipVersions[id]}` : ""}`, { signal: ctrl.signal })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buf) => (buf && ctx ? ctx.decodeAudioData(buf) : null))
    .catch(() => null)
    .then((buf) => { clearTimeout(timer); if (!buf) clips.delete(id); return buf; });
}
function pump() {
  while (fetching < AT_ONCE && queue.length) {
    const { id, done } = queue.shift();
    fetching++;
    fetchClip(id).then(done).finally(() => { fetching--; pump(); });
  }
}
function loadClip(id, { now = false } = {}) {
  if (!clips.has(id)) {
    let done;
    const p = new Promise((r) => { done = r; });
    clips.set(id, p);
    // a line that's wanted right now jumps the queue
    if (now) queue.unshift({ id, done });
    else queue.push({ id, done });
    pump();
  } else if (now) {
    // already waiting in the queue: move it to the front
    const i = queue.findIndex((q) => q.id === id);
    if (i > 0) queue.unshift(queue.splice(i, 1)[0]);
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
  // (it keeps downloading, so it's there the next time)
  let late = false;
  const buf = await Promise.race([loadClip(id, { now: true }), new Promise((r) => setTimeout(() => { late = true; r(null); }, 6000))]);
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
  // (fx: the same for the recorded effects)
  setVersions(v, fxv) { clipVersions = v || {}; fxVersions = fxv || {}; },
  prefetch(ids) { if (ctx && voicesOn) ids.forEach((id) => loadClip(id)); },
  // fast automated tests can't wait for real-time voice clips
  setVoices(on) { voicesOn = on; },
  stopVoices() { live.forEach((e) => e.stop && e.stop()); },
  // underwater: the whole world goes thick and far away (or comes back)
  underwater(on, seconds = 0.8) {
    if (!ctx) return;
    const f = muffle.frequency;
    f.cancelScheduledValues(ctx.currentTime);
    f.setValueAtTime(f.value, ctx.currentTime);
    f.exponentialRampToValueAtTime(on ? 380 : 22000, ctx.currentTime + seconds);
  },
  sfx(name, ...args) {
    if (!ctx || !SFX[name]) return;
    // the scares' own sounds go out on the scares' level
    if (!HORROR.has(name)) { SFX[name](ctx.currentTime + 0.02, ...args); return; }
    sfxDest = horrorBus;
    sfxDestLevel = 1 / 0.6;             // (their echo as loud as on the effects bus)
    try { SFX[name](ctx.currentTime + 0.02, ...args); } finally { sfxDest = null; sfxDestLevel = 1; }
  },
  // a lightning strike right overhead: the thunder crack, on the scares' level, everything else ducking under it
  thunderCrack() {
    if (!ctx) return;
    if (!fx("thunder_crack", { loud: true, offset: 0.09, duck: 2.6 })) { Sound.sfx("crackle"); duck(ctx.currentTime, 2.6); }
  },
  fx,
  // is this recording in (so it'll play)
  hasFx(name) { return !!fxBufs.get(name); },
  // a synthesized effect that comes from somewhere (`at`: as for fx()), for `seconds`; stop() cuts it off sooner
  sfxFrom(name, opts, seconds, ...args) {
    if (!ctx || !SFX[name]) return null;
    const e = emitter(opts);
    sfxDest = e.input;
    try { SFX[name](ctx.currentTime + 0.02, ...args); } finally { sfxDest = null; }
    setTimeout(e.end, (seconds + 1) * 1000);
    return e.handle;
  },
  // A horn, sounding until stop() (or for `dur` seconds): kind bus | car | old; at, outside as for fx(). Every horn is
  // outside the bus, so from inside you hear it through the body.
  horn(kind, { at = null, dur = 0, outside = 1100, gain = 1 } = {}) {
    if (!ctx) return { stop() {} };
    const e = emitter({ gain, at, outside, ref: 4, range: 160, rev: 0.2 });
    const t = ctx.currentTime + 0.01;
    const h = hornVoice(kind, t, e.input, 0);
    const stop = (when = 0) => { h.stop(ctx.currentTime + when); setTimeout(e.end, (when + 0.5) * 1000); };
    if (dur) stop(dur);
    return { stop: () => stop(0) };
  },
  // is the listener inside the bus (outside sounds get duller through its walls)
  setInside(on) { inside = on; },
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
    ear.p = p;
    ear.r = r;
    emitters.forEach((em) => place(em));
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
    if (ctx) {
      ramp(userVoice.gain, levels.voices, 0.1); ramp(userMusic.gain, levels.music, 0.1); ramp(userSfx.gain, levels.sfx, 0.1);
      ramp(userHorror.gain, levels.horror, 0.1); ramp(nearSfx.gain, levels.horror, 0.1);
    }
  },
  setVolume(v) { volume = v; if (ctx && !muted) { ramp(master.gain, v, 0.2); ramp(near.gain, v, 0.2); } },
  setMuted(m) { muted = m; if (ctx) { ramp(master.gain, m ? 0 : volume, 0.2); ramp(near.gain, m ? 0 : volume, 0.2); } },
  get muted() { return muted; },
  get ready() { return !!ctx; },
};
