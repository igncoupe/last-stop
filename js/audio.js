/* ===================================================================
   LAST STOP — sound
   All music and sound effects are generated live with the Web Audio
   API, so there are no audio files to download.

   Story scenes use it like this (see js/story/setup.js):
     { mood: "dread" }      change the music
     { sfx: "knock" }       play a sound effect
     { amb: { rain: 1 } }   change the background ambience
   =================================================================== */
const Sound = (() => {
  let ctx = null;
  let master, musicBus, ambBus, sfxBus, reverb, noiseBuf;
  let volume = 0.8;
  let muted = false;
  let currentMood = null;
  let moodVoices = [];
  let melodyTimer = null;
  const amb = {};

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  /* ---------- music moods ----------
     drone:   low notes (MIDI numbers) held under everything
     cutoff:  how bright the drone is
     lfo:     how fast it breathes
     whistle: a thin high note that wavers (very unsettling)
     melody:  sparse music-box notes picked at random */
  const MOODS = {
    calm:    { drone: [33, 40], cutoff: 360, level: 0.22, lfo: 0.05, melody: { notes: [69, 72, 74, 76, 79, 81], every: [4, 8], level: 0.05 } },
    uneasy:  { drone: [33, 34], cutoff: 480, level: 0.26, lfo: 0.09, melody: { notes: [68, 69, 72, 75, 76], every: [5, 9], level: 0.045 } },
    dread:   { drone: [26, 32, 38], cutoff: 650, level: 0.34, lfo: 0.14, whistle: 87, melody: { notes: [56, 57, 63, 64, 70], every: [6, 11], level: 0.045 } },
    terror:  { drone: [26, 27, 33, 39], cutoff: 1100, level: 0.4, lfo: 0.8, whistle: 92 },
    grief:   { drone: [38, 45], cutoff: 420, level: 0.2, lfo: 0.04, wave: "triangle", melody: { notes: [62, 65, 69, 70, 72, 74], every: [3, 6], level: 0.06 } },
    hope:    { drone: [45, 52, 57], cutoff: 900, level: 0.16, lfo: 0.04, wave: "triangle", melody: { notes: [69, 71, 73, 76, 78, 81], every: [2.5, 5], level: 0.065 } },
    silence: { drone: [], level: 0 },
  };

  /* ---------- setup ---------- */
  function init() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.ratio.value = 8;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    musicBus = bus(0.6);
    ambBus = bus(0.7);
    sfxBus = bus(0.95);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.4);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.55;
    reverb.connect(reverbOut);
    reverbOut.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    startAmbience();
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
  }

  function bus(level) {
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(master);
    return g;
  }
  function gainNode(value = 0) {
    const g = ctx.createGain();
    g.gain.value = value;
    return g;
  }
  function send(node, amount) {
    const g = gainNode(amount);
    node.connect(g);
    g.connect(reverb);
  }
  function impulse(seconds) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }
  function ramp(param, value, seconds) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }

  /* ---------- building blocks for sound effects ---------- */
  function env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
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
  function out(node, peakGain, t, attack, decay, reverbAmount = 0, pan = 0) {
    const g = gainNode();
    env(g, t, attack, peakGain, decay);
    node.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(sfxBus);
    } else {
      g.connect(sfxBus);
    }
    if (reverbAmount) send(g, reverbAmount);
    return g;
  }

  const SFX = {
    // the jumpscare hit: a screeching chord, a noise blast and a sub drop
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
      for (let i = 0; i < dur * 32; i++) g.gain.setValueAtTime(Math.random() * 0.3, t + i / 32);
      g.gain.setValueAtTime(0, t + dur);
      n.connect(g);
      g.connect(sfxBus);
    },
    door(t) {
      out(noise(t, 0.8, "highpass", 2400), 0.28, t, 0.02, 0.7);
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
    drip(t) {
      out(tone(t, 0.25, "sine", 1500, 520), 0.22, t, 0.003, 0.22, 1);
    },
    brake(t) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1700;
      f.Q.value = 9;
      tone(t, 1, "sawtooth", 1700, 1480).connect(f);
      out(f, 0.18, t, 0.08, 0.85);
      out(noise(t, 1, "lowpass", 500), 0.2, t, 0.1, 0.8);
    },
    whisper(t) {
      const pan = Math.random() < 0.5 ? -0.8 : 0.8;
      const f = noise(t, 2, "bandpass", 1800, 4);
      for (let i = 0; i < 24; i++) f.frequency.setValueAtTime(800 + Math.random() * 2600, t + i * 0.08);
      out(f, 0.35, t, 0.25, 1.6, 0.6, pan);
    },
    coin(t) {
      [2600, 3900, 5300].forEach((fr, i) => out(tone(t + i * 0.003, 0.6, "sine", fr), 0.12 / (i + 1), t + i * 0.003, 0.002, 0.55, 0.4));
    },
    lightsout(t) {
      out(noise(t, 0.2, "lowpass", 380), 0.8, t, 0.002, 0.18);
      out(tone(t, 0.4, "square", 120, 35), 0.12, t, 0.002, 0.35);
    },
    breath(t) {
      out(noise(t, 1.4, "bandpass", 520, 1.2), 0.35, t, 0.7, 0.7, 0.3);
      out(noise(t + 1.6, 1.6, "bandpass", 430, 1.2), 0.28, t + 1.6, 0.3, 1.2, 0.3);
    },
    splash(t) {
      out(noise(t, 1.2, "lowpass", 1400), 0.7, t, 0.01, 1.1, 0.4);
      out(tone(t, 0.6, "sine", 200, 60), 0.4, t, 0.01, 0.5);
    },
    ring(t) { // old phone ringing, twice
      for (let r = 0; r < 2; r++) {
        const tt = t + r * 2.2;
        const o1 = tone(tt, 1.1, "square", 440);
        const o2 = tone(tt, 1.1, "square", 480);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 900;
        o1.connect(f);
        o2.connect(f);
        out(f, 0.08, tt, 0.01, 1.05, 0.2);
      }
    },
  };

  /* ---------- music ---------- */
  function mood(name) {
    if (!ctx || name === currentMood) return;
    currentMood = name;
    const m = MOODS[name] || MOODS.calm;
    const now = ctx.currentTime;

    moodVoices.forEach(({ g, nodes }) => {
      ramp(g.gain, 0, 3);
      nodes.forEach((n) => n.stop(now + 3.3));
    });
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
    const lfoDepth = gainNode(m.cutoff * 0.45);
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    const nodes = [lfo];

    m.drone.forEach((n, i) => {
      [-8, 8].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = m.wave || "sawtooth";
        o.frequency.value = hz(n);
        o.detune.value = cents + i * 3;
        o.connect(filter);
        o.start(now);
        nodes.push(o);
      });
    });

    if (m.whistle) {
      const w = ctx.createOscillator();
      w.type = "sine";
      w.frequency.value = hz(m.whistle);
      const vib = ctx.createOscillator();
      vib.frequency.value = 0.27;
      const vibDepth = gainNode(11);
      vib.connect(vibDepth);
      vibDepth.connect(w.frequency);
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
    if (m.melody) playMelody(m.melody);
  }

  function playMelody(mel) {
    const wait = (mel.every[0] + Math.random() * (mel.every[1] - mel.every[0])) * 1000;
    melodyTimer = setTimeout(() => {
      if (!ctx || (MOODS[currentMood] || {}).melody !== mel) return;
      const n = mel.notes[Math.floor(Math.random() * mel.notes.length)];
      pluck(hz(n), mel.level);
      if (Math.random() < 0.35) setTimeout(() => pluck(hz(n - (Math.random() < 0.5 ? 5 : 7)), mel.level * 0.7), 450);
      playMelody(mel);
    }, wait);
  }

  // a soft, slightly out-of-tune music-box note
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

  /* ---------- ambience: rain, flood water, the bus engine ---------- */
  function loop(filterType, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
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
    const rain = loop("highpass", 900);
    amb.rain = { g: rain.g, max: 0.22 };

    const water = loop("lowpass", 420, 2);
    const wlfo = ctx.createOscillator();
    wlfo.frequency.value = 0.35;
    const wdepth = gainNode(180);
    wlfo.connect(wdepth);
    wdepth.connect(water.f.frequency);
    wlfo.start();
    amb.water = { g: water.g, max: 0.5 };

    const engF = ctx.createBiquadFilter();
    engF.type = "lowpass";
    engF.frequency.value = 150;
    const engG = gainNode();
    const oscs = [38, 38.7].map((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.connect(engF);
      o.start();
      return o;
    });
    engF.connect(engG);
    engG.connect(ambBus);
    amb.engine = { g: engG, max: 0.5, oscs };
  }

  function ambience(levels) {
    if (!ctx) return;
    Object.entries(levels).forEach(([name, level]) => {
      const a = amb[name];
      if (!a) return;
      ramp(a.g.gain, Math.max(0, Math.min(1, level)) * a.max, 1.6);
      if (a.oscs) a.oscs.forEach((o, i) => ramp(o.frequency, 36 + level * 14 + i * 0.7, 1.6));
    });
  }

  /* ---------- optional recorded voice lines ----------
     If a line has vo: "n1_mara_1", the engine plays audio/vo/n1_mara_1.mp3
     (when that file exists) while the caption is shown. */
  function voice(src) {
    return new Promise((done) => {
      const a = new Audio(src);
      a.volume = muted ? 0 : volume;
      a.addEventListener("ended", done, { once: true });
      a.addEventListener("error", done, { once: true });
      a.play().catch(done);
    });
  }

  return {
    init,
    mood,
    ambience,
    voice,
    sfx(name, ...args) {
      if (ctx && SFX[name]) SFX[name](ctx.currentTime + 0.02, ...args);
    },
    setVolume(v) {
      volume = v;
      if (ctx && !muted) ramp(master.gain, v, 0.2);
    },
    setMuted(m) {
      muted = m;
      if (ctx) ramp(master.gain, m ? 0 : volume, 0.2);
    },
    get muted() { return muted; },
  };
})();
