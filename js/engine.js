/* ===================================================================
   LAST STOP — engine
   Runs the story in js/story/: captions, choices, the windshield view,
   the route map, music cues, jumpscares, saving and endings.
   You shouldn't need to change this file to add story.
   =================================================================== */
(function () {
  "use strict";

  const SAVE_KEY = "laststop-save-v2";
  const ENDINGS_KEY = "laststop-endings-v1";
  const SETTINGS_KEY = "laststop-settings-v1";
  const SHIFT_START = 23 * 60 + 40; // 11:40 PM, in minutes after midnight
  const TYPE_MS = 24;               // delay between typed characters
  const LINE_GAP_MS = 420;          // pause after each line
  const DRIVE_MS = 2300;            // how long the bus drives between stops
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has("debug");
  const ENDINGS = Object.values(SCENES).filter((sc) => sc.ending).map((sc) => sc.ending);

  const $ = (id) => document.getElementById(id);
  const ui = {
    warning: $("warning-screen"), warningOk: $("btn-warning-ok"),
    title: $("title-screen"), newBtn: $("btn-new"), continueBtn: $("btn-continue"), endingsFound: $("endings-found"),
    volume: $("set-volume"), scares: $("set-scares"), flash: $("set-flash"),
    game: $("game"), night: $("hud-night"), clock: $("hud-clock"), schedule: $("hud-schedule"),
    muteBtn: $("btn-mute"), menuBtn: $("btn-menu"),
    view: $("view"), plate: $("stop-plate"), led: $("led-strip"),
    marker: $("bus-marker"), mapStops: $("map-stops"),
    captions: $("captions"), skipHint: $("skip-hint"), choices: $("choices"),
    card: $("card"), cardKicker: $("card-kicker"), cardTitle: $("card-title"), cardSub: $("card-sub"), cardNote: $("card-note"), cardActions: $("card-actions"),
    scare: $("scare"), debug: $("debug"),
  };

  let s = null;          // game state: plain data only, so it can be saved
  let run = 0;           // goes up on every scene change; old typing loops see it and stop
  let skipping = false;  // set when the player clicks or presses Space

  /* ---------- storage (localStorage can be blocked, so every call is guarded) ---------- */
  function readStore(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* game still works without saving */ }
  }
  function clearStore(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  const settings = Object.assign({ volume: 0.8, scares: true, flash: true, muted: false, warned: false }, readStore(SETTINGS_KEY) || {});
  const saveSettings = () => writeStore(SETTINGS_KEY, settings);

  const resolve = (v) => (typeof v === "function" ? v(s) : v);

  // a pause the player can skip
  function sleep(ms) {
    const end = performance.now() + (reduceMotion ? Math.min(ms, 250) : ms);
    return new Promise((done) => {
      (function check() {
        if (skipping || performance.now() >= end) done();
        else setTimeout(check, 30);
      })();
    });
  }
  // a pause the player can't skip (used for jumpscares)
  const hold = (ms) => new Promise((done) => setTimeout(done, ms));
  const untilSkip = () => new Promise((done) => {
    (function check() { if (skipping) done(); else setTimeout(check, 50); })();
  });

  function freshState() {
    return {
      scene: null, night: 1, stop: null,
      late: 0, lateAtNightStart: 0, kind: 0, warn: 0,
      flags: {},
      look: { mood: "calm", fx: "none", mirror: "empty", amb: { rain: 0, water: 0, engine: 0.35 } },
    };
  }

  /* ---------- route helpers ---------- */
  const tonight = () => NIGHTS[s.night];
  const isShown = (stop) => !stop.mystery || s.flags.sawMystery;
  const visibleStops = () => tonight().stops.filter(isShown);
  const findStop = (name) => tonight().stops.find((st) => st.name === name);
  const stopLabel = (stop) => (!stop ? "" : stop.mystery ? (s.flags.ashgroveNamed ? "Ashgrove" : "???") : stop.name);
  const tonightLate = () => s.late - s.lateAtNightStart;

  function formatClock(total) {
    const m = ((total % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }

  /* ---------- drawing the HUD, map and view ---------- */
  function renderHud() {
    const stop = findStop(s.stop);
    const late = tonightLate();
    ui.night.textContent = `Night ${s.night}`;
    ui.clock.textContent = formatClock(SHIFT_START + (stop ? stop.t : 0) + late);
    ui.schedule.textContent = late > 0 ? `+${late} min late` : "On time";
    ui.schedule.classList.toggle("late", late > 0);
  }

  function renderMap() {
    const stops = visibleStops();
    const here = stops.findIndex((st) => st.name === s.stop);
    const at = (i) => `${stops.length > 1 ? (i / (stops.length - 1)) * 100 : 0}%`;
    ui.mapStops.replaceChildren(...stops.map((stop, i) => {
      const li = document.createElement("li");
      li.className = "map-stop";
      if (i < here) li.classList.add("passed");
      if (i === here) li.classList.add("here");
      if (stop.mystery) li.classList.add("mystery");
      li.style.left = at(i);
      const dot = document.createElement("span");
      dot.className = "dot";
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = stopLabel(stop);
      li.append(dot, label);
      return li;
    }));
    ui.marker.style.left = at(Math.max(here, 0));
  }

  function setMode(mode) {
    ui.view.dataset.mode = mode;
    const label = stopLabel(findStop(s.stop));
    if (mode !== "driving") ui.plate.textContent = label;
    ui.led.textContent = mode === "driving" ? `Next stop: ${label}` : label;
  }

  // mood, fx, mirror and ambience all live in s.look so Continue can restore them
  function applyLook(changes) {
    Object.assign(s.look, changes);
    if (changes.amb) s.look.amb = Object.assign({}, s.look.amb, changes.amb);
    ui.view.dataset.fx = s.look.fx;
    ui.view.dataset.mirror = s.look.mirror;
    Sound.mood(s.look.mood);
    Sound.ambience(s.look.amb);
  }

  /* ---------- moving through the story ---------- */
  async function goTo(id) {
    const scene = SCENES[id];
    if (!scene) {
      console.error(`Last Stop: no scene called "${id}" in js/story/`);
      return;
    }
    const myRun = ++run;
    skipping = false;
    clearChoices();

    if (scene.night) {
      s.night = scene.night;
      s.lateAtNightStart = s.late;
      s.stop = scene.stop;
      ui.captions.replaceChildren();
      applyLook({ mood: "silence", fx: "none", mirror: "empty", amb: { rain: 0, water: 0, engine: 0.3 } });
      renderHud();
      renderMap();
      setMode("stopped");
      const n = NIGHTS[scene.night];
      await showCard({ kicker: "Route 9", title: n.title, sub: n.subtitle, actions: [{ label: "Start shift" }] });
    } else if (scene.stop !== s.stop) {
      await drive(scene.stop);
    }
    if (myRun !== run) return;
    skipping = false;

    s.scene = id;
    s.stop = scene.stop;
    if (!scene.ending) writeStore(SAVE_KEY, s);
    if (scene.onEnter) scene.onEnter(s);
    const look = {};
    ["mood", "fx", "mirror", "amb"].forEach((k) => { if (scene[k] !== undefined) look[k] = resolve(scene[k]); });
    applyLook(look);
    renderHud();
    renderMap();
    setMode(findStop(s.stop) && findStop(s.stop).mystery ? "mystery" : "stopped");
    renderDebug();

    const finished = await playLines(resolve(scene.lines) || [], myRun);
    if (!finished) return;
    if (scene.ending) showChoices([{ text: "…", pick: () => finishEnding(scene.ending) }]);
    else showChoices(resolve(scene.choices) || []);
  }

  async function drive(toStop) {
    ui.captions.classList.add("fading");
    s.stop = toStop;
    renderMap();
    renderHud();
    setMode("driving");
    Sound.ambience({ engine: 0.85 });
    await sleep(DRIVE_MS);
    Sound.ambience({ engine: s.look.amb.engine });
    Sound.sfx("brake");
    ui.captions.classList.remove("fading");
  }

  // plays a scene's lines: captions, plus cinematic directives
  async function playLines(lines, myRun) {
    ui.captions.replaceChildren();
    ui.skipHint.hidden = false;
    for (const raw of lines) {
      if (myRun !== run) return false;
      const line = typeof raw === "string" ? { text: raw } : raw;
      if (line.if && !line.if(s)) continue;

      if (line.mood || line.fx || line.mirror || line.amb) {
        const look = {};
        ["mood", "fx", "mirror", "amb"].forEach((k) => { if (line[k] !== undefined) look[k] = line[k]; });
        applyLook(look);
      }
      if (line.set) {
        Object.assign(s.flags, line.set);
        renderMap();
        setMode(ui.view.dataset.mode);
        renderDebug();
      }
      if (line.sfx) Sound.sfx(line.sfx, ...(line.args || []));
      if (line.shake) shake();
      if (line.clear) ui.captions.replaceChildren();
      if (line.scare) await jumpscare(line.scare);
      if (line.pause) await sleep(line.pause);
      if (line.text === undefined) continue;

      await caption(line, myRun);
      if (myRun !== run) return false;
      await sleep(LINE_GAP_MS + (line.after || 0));
    }
    ui.skipHint.hidden = true;
    return myRun === run;
  }

  async function caption(line, myRun) {
    const who = line.who && SPEAKERS[line.who];
    const p = document.createElement("p");
    p.className = who ? `line say say-${who.style}` : "line narration";
    if (line.big) p.classList.add("big");
    if (who) {
      const name = document.createElement("span");
      name.className = "who";
      name.textContent = resolve(who.name);
      p.append(name);
      if (who.style === "radio") Sound.sfx("static", 0.3);
    }
    const text = document.createElement("span");
    text.className = "text";
    p.append(text);
    ui.captions.append(p);

    const voice = line.vo ? Sound.voice(`audio/vo/${line.vo}.mp3`) : null;
    await typeText(text, resolve(line.text), myRun);
    if (voice && !skipping) await Promise.race([voice, untilSkip()]);
  }

  function typeText(node, text, myRun) {
    return new Promise((done) => {
      if (skipping || reduceMotion) {
        node.textContent = text;
        ui.captions.scrollTop = ui.captions.scrollHeight;
        return done();
      }
      let i = 0;
      (function tick() {
        if (myRun !== run) return done();
        if (skipping) {
          node.textContent = text;
          ui.captions.scrollTop = ui.captions.scrollHeight;
          return done();
        }
        i += 1;
        node.textContent = text.slice(0, i);
        ui.captions.scrollTop = ui.captions.scrollHeight;
        if (i >= text.length) return done();
        const ch = text[i - 1];
        const wait = ".!?".includes(ch) ? TYPE_MS * 9 : ",;:—".includes(ch) ? TYPE_MS * 5 : TYPE_MS;
        setTimeout(tick, wait);
      })();
    });
  }

  /* ---------- choices ---------- */
  function clearChoices() { ui.choices.replaceChildren(); }

  function showChoices(choices) {
    clearChoices();
    ui.skipHint.hidden = true;
    choices.filter((c) => !c.if || c.if(s)).forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice";
      b.style.animationDelay = `${i * 80}ms`;
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      const label = document.createElement("span");
      label.textContent = resolve(c.text);
      b.append(num, label);
      if (c.hint) {
        const hint = document.createElement("span");
        hint.className = "hint";
        hint.textContent = c.hint;
        b.append(hint);
      }
      b.addEventListener("click", () => choose(c));
      ui.choices.append(b);
    });
  }

  function choose(c) {
    if (c.pick) return c.pick();
    if (c.late) s.late += c.late;
    if (c.kind) s.kind += c.kind;
    if (c.warn) s.warn += c.warn;
    if (c.set) Object.assign(s.flags, c.set);
    goTo(resolve(c.next));
  }

  /* ---------- jumpscares ---------- */
  const SCARES = {
    face: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs>
      <radialGradient id="sk" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#ddd8ca"/><stop offset=".5" stop-color="#8d8a80"/><stop offset="1" stop-color="#090909"/></radialGradient>
      <radialGradient id="hole" r="50%"><stop offset="0" stop-color="#000"/><stop offset=".75" stop-color="#060606"/><stop offset="1" stop-color="#3a3630" stop-opacity="0"/></radialGradient>
      <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="16"/></filter></defs>
      <rect width="400" height="400" fill="#000"/>
      <g filter="url(#rough)">
        <ellipse cx="200" cy="220" rx="122" ry="170" fill="url(#sk)"/>
        <ellipse cx="148" cy="188" rx="36" ry="47" fill="url(#hole)"/><ellipse cx="252" cy="188" rx="36" ry="47" fill="url(#hole)"/>
        <circle cx="150" cy="194" r="3.5" fill="#f2ead2"/><circle cx="250" cy="194" r="3.5" fill="#f2ead2"/>
        <path d="M148 232 C 146 260 150 290 144 330 M252 232 C 254 262 250 300 256 340" stroke="#0b0b0b" stroke-width="5" fill="none"/>
        <path d="M200 228 l-13 36 h26z" fill="#2a2824" opacity=".7"/>
        <ellipse cx="200" cy="318" rx="40" ry="62" fill="#000"/>
        <path d="M84 150 C 92 50 308 50 316 150 L 312 360 C 300 270 290 190 270 150 L 262 380 C 250 280 236 180 214 140 L 206 210 C 196 160 186 150 176 145 L 150 390 C 146 280 140 200 128 160 L 96 370 C 92 290 88 210 84 150 Z" fill="#040404"/>
      </g></svg>`,
    hands: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs>
      <filter id="rough2"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="10"/></filter>
      <g id="hand"><ellipse cx="0" cy="62" rx="50" ry="60"/><rect x="-48" y="-58" width="19" height="96" rx="9"/><rect x="-25" y="-82" width="19" height="112" rx="9"/><rect x="-1" y="-80" width="19" height="108" rx="9"/><rect x="22" y="-62" width="18" height="92" rx="9"/><rect x="42" y="24" width="17" height="64" rx="8" transform="rotate(38 50 56)"/></g></defs>
      <rect width="400" height="400" fill="#020304"/>
      <g filter="url(#rough2)" fill="#bfbab0">
        <use href="#hand" transform="translate(110 160) rotate(-14)"/>
        <use href="#hand" transform="translate(292 176) rotate(12) scale(-1 1)"/>
      </g>
      <g stroke="#8fa0aa" stroke-opacity=".35" stroke-width="3" fill="none">
        <path d="M80 230 v120 M104 240 v140 M126 236 v90 M268 250 v130 M292 244 v110 M316 252 v120"/>
      </g></svg>`,
    eyes: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs>
      <radialGradient id="eg"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#c7bf9c"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="400" fill="#000"/>
      <ellipse cx="152" cy="200" rx="44" ry="17" fill="url(#eg)"/><ellipse cx="248" cy="200" rx="44" ry="17" fill="url(#eg)"/>
      <circle cx="152" cy="200" r="6" fill="#000"/><circle cx="248" cy="200" r="6" fill="#000"/></svg>`,
  };

  function shake() {
    ui.game.classList.remove("shake");
    void ui.game.offsetWidth; // restart the animation
    ui.game.classList.add("shake");
  }

  async function jumpscare(kind) {
    if (!settings.scares) {
      Sound.sfx("heartbeat", 3, 96);
      await hold(700);
      return;
    }
    Sound.sfx("sting");
    ui.scare.innerHTML = SCARES[kind] || SCARES.face;
    ui.scare.classList.remove("flash");
    void ui.scare.offsetWidth;
    ui.scare.classList.toggle("flash", settings.flash);
    ui.scare.hidden = false;
    shake();
    await hold(820);
    ui.scare.hidden = true;
    ui.scare.innerHTML = "";
  }

  /* ---------- cards (night titles and endings) ---------- */
  function showCard({ kicker, title, sub, note, actions }) {
    ui.cardKicker.textContent = kicker || "";
    ui.cardTitle.textContent = title || "";
    ui.cardSub.textContent = sub || "";
    ui.cardNote.textContent = note || "";
    ui.cardActions.replaceChildren();
    ui.card.hidden = false;
    return new Promise((done) => {
      actions.forEach((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = i === 0 ? "btn primary" : "btn";
        b.textContent = a.label;
        b.addEventListener("click", () => {
          Sound.init();
          ui.card.hidden = true;
          done();
          if (a.onClick) a.onClick();
        });
        ui.cardActions.append(b);
      });
      ui.cardActions.querySelector("button").focus();
    });
  }

  function finishEnding(ending) {
    clearStore(SAVE_KEY);
    clearChoices();
    const found = readStore(ENDINGS_KEY) || [];
    if (!found.includes(ending.id)) {
      found.push(ending.id);
      writeStore(ENDINGS_KEY, found);
    }
    const number = ENDINGS.findIndex((e) => e.id === ending.id) + 1;
    showCard({
      kicker: `Ending ${number} of ${ENDINGS.length}`,
      title: ending.title,
      sub: ending.blurb,
      note: `Endings found: ${found.length} / ${ENDINGS.length}` + (ending.hint ? ` · ${ending.hint}` : ""),
      actions: [{ label: "Ride again", onClick: newGame }, { label: "Title screen", onClick: showTitle }],
    });
  }

  /* ---------- screens ---------- */
  function showTitle() {
    run++;
    ui.card.hidden = true;
    ui.game.hidden = true;
    ui.warning.hidden = true;
    ui.title.hidden = false;
    const saved = readStore(SAVE_KEY);
    const canContinue = !!(saved && SCENES[saved.scene] && !SCENES[saved.scene].ending);
    ui.continueBtn.hidden = !canContinue;
    ui.newBtn.classList.toggle("primary", !canContinue);
    const found = readStore(ENDINGS_KEY) || [];
    ui.endingsFound.textContent = `Endings found: ${found.length} / ${ENDINGS.length}`;
    Sound.mood("uneasy");
    Sound.ambience({ rain: 0.6, engine: 0, water: 0 });
  }

  function openGame() {
    Sound.init();
    ui.title.hidden = true;
    ui.game.hidden = false;
    ui.captions.replaceChildren();
    clearChoices();
  }

  function newGame() {
    clearStore(SAVE_KEY);
    s = freshState();
    openGame();
    goTo(FIRST_SCENE);
  }

  function continueGame() {
    const saved = readStore(SAVE_KEY);
    if (!saved) return newGame();
    s = Object.assign(freshState(), saved);
    openGame();
    applyLook({});
    goTo(s.scene);
  }

  function renderDebug() {
    if (!DEBUG) return;
    ui.debug.hidden = false;
    ui.debug.textContent = JSON.stringify({ scene: s.scene, night: s.night, late: s.late, kind: s.kind, warn: s.warn, flags: s.flags }, null, 2);
  }

  /* ---------- input ---------- */
  function skip() {
    if (!ui.game.hidden && ui.card.hidden) skipping = true;
  }
  ui.game.addEventListener("click", (e) => {
    if (!e.target.closest("button")) skip();
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "m" || e.key === "M") return toggleMute();
    if (ui.game.hidden || !ui.card.hidden) return;
    const buttons = ui.choices.querySelectorAll("button");
    if ((e.key === " " || e.key === "Enter") && buttons.length === 0) {
      e.preventDefault();
      skip();
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && buttons[n - 1]) {
      e.preventDefault();
      buttons[n - 1].click();
    }
  });
  // browsers only allow sound after the first click or key press
  ["pointerdown", "keydown"].forEach((type) => document.addEventListener(type, () => {
    Sound.init();
    if (!ui.title.hidden) {
      Sound.mood("uneasy");
      Sound.ambience({ rain: 0.6 });
    }
  }, { once: true }));

  function toggleMute() {
    settings.muted = !settings.muted;
    Sound.setMuted(settings.muted);
    ui.muteBtn.classList.toggle("off", settings.muted);
    ui.muteBtn.textContent = settings.muted ? "Muted" : "Sound";
    saveSettings();
  }

  ui.warningOk.addEventListener("click", () => {
    settings.warned = true;
    saveSettings();
    Sound.init();
    showTitle();
  });
  ui.newBtn.addEventListener("click", newGame);
  ui.continueBtn.addEventListener("click", continueGame);
  ui.menuBtn.addEventListener("click", showTitle);
  ui.muteBtn.addEventListener("click", toggleMute);

  ui.volume.value = Math.round(settings.volume * 100);
  ui.scares.checked = settings.scares;
  ui.flash.checked = settings.flash;
  document.body.classList.toggle("no-flash", !settings.flash);
  Sound.setVolume(settings.volume);
  Sound.setMuted(settings.muted);
  ui.muteBtn.classList.toggle("off", settings.muted);
  ui.muteBtn.textContent = settings.muted ? "Muted" : "Sound";

  ui.volume.addEventListener("input", () => {
    settings.volume = ui.volume.value / 100;
    Sound.setVolume(settings.volume);
    saveSettings();
  });
  ui.scares.addEventListener("change", () => {
    settings.scares = ui.scares.checked;
    saveSettings();
  });
  ui.flash.addEventListener("change", () => {
    settings.flash = ui.flash.checked;
    document.body.classList.toggle("no-flash", !settings.flash);
    saveSettings();
  });

  /* ---------- start ---------- */
  if (DEBUG && params.get("scene")) {
    // ?debug&scene=n3_start jumps straight to a scene (night comes from the "n3_" prefix)
    s = freshState();
    const id = params.get("scene");
    s.night = Number((id.match(/^n(\d)/) || [])[1]) || 1;
    s.flags.sawMystery = true;
    s.stop = SCENES[id] ? SCENES[id].stop : null;
    openGame();
    goTo(id);
  } else if (!settings.warned) {
    ui.warning.hidden = false;
  } else {
    showTitle();
  }
})();
