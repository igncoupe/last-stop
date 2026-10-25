// THE LAST STOP — entry point. Builds the world, runs the game loop, and plays
// the five nights in order. Story lives in js/story/.
import * as THREE from "three";
import { makeRenderer } from "./core/ps1.js";
import { input } from "./core/input.js";
import { ui } from "./core/ui.js";
import { Sound } from "./audio.js";
import { buildCity } from "./world/city.js";
import { buildProps } from "./world/props.js";
import { buildBus } from "./world/bus.js";
import { buildPlaces } from "./world/places.js";
import { people } from "./world/people.js";
import { route, STOPS, MYSTERY } from "./world/route.js";
import { createDrive } from "./game/drive.js";
import { createPlayer } from "./game/player.js";
import { createDirector } from "./game/director.js";
import { createHorror } from "./world/horror.js";
import { createShade } from "./world/shade.js";
import { createTraffic } from "./world/traffic.js";
import { createMenuArt } from "./core/menuArt.js";
import { createSelfBody } from "./world/selfBody.js";
import { createFile } from "./game/file.js";
import { updateWater } from "./world/water.js";
import { NIGHTS, ENDINGS, CREDITS } from "./story/nights.js";
import { KIND_ENOUGH } from "./story/common.js";

const $ = (id) => document.getElementById(id);
const SAVE = "laststop3d-save";
const FOUND = "laststop3d-endings";
const SETTINGS = "laststop3d-settings";
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not saved */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const params = new URLSearchParams(location.search);

// phones and tablets can't play this one
if (matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches && !params.has("force")) {
  $("screen-mobile").hidden = false;
  $("fade").style.opacity = 0;
  throw new Error("The Last Stop needs a keyboard and mouse.");
}

/* ---------- world ---------- */
const canvas = $("view");
const { renderer, resize } = makeRenderer(canvas, { preserve: params.has("test") });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.08, 260);
scene.add(camera);
const hemi = new THREE.HemisphereLight(0x4a5878, 0x0a0a0c, 0.35);
const ambient = new THREE.AmbientLight(0x1c2030, 0.6);
scene.add(hemi, ambient);
// moonlight over the river, and the lightning's flash: one cold light from high up. It's always in the scene (at 0
// when it's not needed), so turning it on never recompiles a shader.
const skyLight = new THREE.DirectionalLight(0xc8d8ff, 0);
skyLight.position.set(-40, 80, 30);
scene.add(skyLight);
scene.fog = new THREE.FogExp2(0x05070c, 0.03);
scene.background = new THREE.Color(0x05070c);

const SKIES = {
  night: { fog: 0x05070c, density: 0.03, hemi: 0.35 },
  storm: { fog: 0x070a10, density: 0.042, hemi: 0.3 },
  dawn: { fog: 0x8a95a3, density: 0.014, hemi: 1.6 },
  void: { fog: 0x05070b, density: 0.016, hemi: 0.38, moon: 1.1 },   // the bridge: dark, but you can see the road
  hospital: { fog: 0x0b0d0c, density: 0.02, hemi: 0.4 },
  ward: { fog: 0x090c10, density: 0.024, hemi: 0.42 },   // 4 West: indoors, but the night outside the windows
  underwater: { fog: 0x03100e, density: 0.2, hemi: 0.12 },  // the river: green-black, you can't see past the glass
  fogwall: { fog: 0x1c2229, density: 0.09, hemi: 0.4 },      // the last night, on the way to the bridge: nothing past 25 m
};
let hemiBase = 0.35;
let moonBase = 0;
const skyBase = new THREE.Color(0x05070c);
const SKY_FLASH = new THREE.Color(0x46526a);       // the sky, for the instant the lightning lights it
function setSky(name) {
  skyBlend = null;
  const k = SKIES[name] || SKIES.night;
  scene.fog.color.set(k.fog);
  scene.fog.density = k.density;
  scene.background.set(k.fog);
  skyBase.set(k.fog);
  hemi.intensity = hemiBase = k.hemi;
  skyLight.intensity = moonBase = k.moon || 0;
}
// ...or the sky changing into another over `seconds` (on the game's clock): the fog coming down, or lifting
let skyBlend = null;
function blendSky(name, seconds) {
  const k = SKIES[name] || SKIES.night;
  skyBlend = { t: 0, seconds, from: { fog: skyBase.clone(), density: scene.fog.density, hemi: hemiBase, moon: moonBase }, to: { ...k, fog: new THREE.Color(k.fog), moon: k.moon || 0 } };
}
function stepSky(dt) {
  if (!skyBlend) return;
  const b = skyBlend;
  b.t = Math.min(1, b.t + dt / b.seconds);
  const e = b.t * b.t * (3 - 2 * b.t);
  skyBase.lerpColors(b.from.fog, b.to.fog, e);
  // (fog thickens the way it looks like it does: evenly in how far you can see, not in the raw density)
  scene.fog.density = 1 / THREE.MathUtils.lerp(1 / b.from.density, 1 / b.to.density, e);
  hemiBase = THREE.MathUtils.lerp(b.from.hemi, b.to.hemi, e);
  moonBase = THREE.MathUtils.lerp(b.from.moon, b.to.moon, e);
  if (flashT < 0) {
    scene.background.copy(skyBase);
    scene.fog.color.copy(skyBase);
    hemi.intensity = hemiBase;
    skyLight.intensity = moonBase;
  }
  if (b.t >= 1) skyBlend = null;
}
// a cold flash across the sky, not a white-out: a flash, a flicker, a second flash, and it dies away. On the game's
// clock, so it pauses with the game.
let flashT = -1;
function lightning() { flashT = 0; }
function flashLevel(t) {
  if (t < 0.07) return 1;
  if (t < 0.13) return 0.12;
  if (t < 0.22) return 0.7;
  return 0.35 * Math.max(0, 1 - (t - 0.22) / 0.35);
}
// ...and the strike that comes down right on top of you (the stop with no name arriving, or going): for a split
// second it's blinding, a white-out; at its height whatever it hides changes (onPeak); the thunder cracks with it;
// and the dark comes straight back. With "Reduce flashing" the flash is a soft one; the strike is the same.
// One at a time: asked for again while one's going, the one that's going covers both.
let strike = null;               // { onPeak, peaked }
const SKY_STRIKE = new THREE.Color(0xcfd8ec);
const whiteout = document.getElementById("whiteout");
function strikeDown(onPeak = null) {
  if (strike) {
    if (onPeak && strike.peaked) onPeak();
    else if (onPeak) { const before = strike.onPeak; strike.onPeak = () => { if (before) before(); onPeak(); }; }
    return;
  }
  flashT = 0;
  strike = { onPeak, peaked: false };
  Sound.thunderCrack();
}
function strikeLevel(t) {
  if (t < 0.012) return t / 0.012;          // up in a blink
  if (t < 0.075) return 1;
  if (t < 0.12) return 0.25;                // a flicker
  if (t < 0.17) return 0.6;
  return 0.6 * Math.max(0, 1 - (t - 0.17) / 0.28);
}

const city = buildCity(scene);
const props = buildProps(scene);
const bus = buildBus(scene);
const places = buildPlaces(scene);
const drive = createDrive(bus);
const player = createPlayer(camera, scene);

const DEFAULTS = {
  volume: 0.8, voices: 1, music: 1, sfx: 1, horror: 1,
  mouse: 1, invertY: false,
  brightness: 1, fov: 72, grain: true, lessFlash: false,
  subs: true, subSize: "medium", shake: true,
};
const settings = Object.assign({ ...DEFAULTS, warned: false }, store.get(SETTINGS) || {});
// (the jumpscares are always on now: a save from before, with them switched off, forgets that it was)
if ("scares" in settings) { delete settings.scares; store.set(SETTINGS, settings); }
const horror = createHorror(camera);
const shade = createShade(scene);
const traffic = createTraffic(scene, (name, ...args) => Sound.sfx(name, ...args), (kind, at, dur) => Sound.horn(kind, { at, dur }));
const world = { scene, camera, player, drive, bus, props, places, city, settings, setSky, blendSky, lightning, strikeDown, input, horror, shade, traffic };
const director = createDirector(world);
const self = createSelfBody(scene, bus, player, camera);
world.self = self;
const g = director.g;
// the Route 9 file: posters, clippings and Teodor's log, for you to find
const file = createFile({ player, props, bus, drive, director, store });
g.file = file;

// the green door button on the dash (F does the same thing)
function toggleDoors() {
  if (player.mode !== "seat" || !g.doorControl || drive.speed > 0.5) return;
  // like a real bus: the doors won't close on someone standing on the steps
  if (bus.doorsOpen && g.someoneInDoorway()) { ui.toast("Someone's on the steps"); Sound.sfx("click"); return; }
  g.setDoors(!bus.doorsOpen);
}
player.addInteract({
  mesh: bus.interactables[1],
  label: () => (player.mode === "seat" && g.doorControl && drive.speed <= 0.5 ? (bus.doorsOpen ? "Close doors" : "Open doors") : null),
  use: toggleDoors,
});

/* ---------- the lights on the water ---------- */
// the streetlights that are on near you, your headlights, the bridge's last lamps
const LAMP_COLOR = new THREE.Color(0xffc27a);
const lampOnWater = new Map();
const headOnWater = { pos: new THREE.Vector3(), color: new THREE.Color(0xfff2d8), power: 1.7 };
const bridgeOnWater = places.bridge.lights.map((l) => ({ pos: l.position, color: l.color, power: 1.2 }));
const waterLights = [];
function lightsOnWater() {
  waterLights.length = 0;
  if (places.bridge.group.visible) waterLights.push(...bridgeOnWater);
  else {
    for (const lamp of city.lamps) {
      if (Math.abs(lamp.d - drive.d) > 110 || !city.isLit(lamp)) continue;
      let w = lampOnWater.get(lamp);
      if (!w) { w = { pos: lamp.pos, color: LAMP_COLOR, power: 1.4 }; lampOnWater.set(lamp, w); }
      waterLights.push(w);
    }
  }
  if (bus.headlightsOn) { headOnWater.pos.copy(bus.group.localToWorld(new THREE.Vector3(0, 1.1, 6.8))); waterLights.push(headOnWater); }
  return waterLights;
}

/* ---------- loop ---------- */
let playing = false;
let paused = false;
let last = performance.now();
let lastRoute = "";
const focus = new THREE.Vector3();
// is a world point inside the bus? (so rain doesn't fall through the roof)
const busInverse = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
let busHorn = null;                 // the horn, while H is held
const hornAt = new THREE.Vector3();
const insideBus = (x, y, z) => {
  tmpV.set(x, y, z).applyMatrix4(busInverse);
  return Math.abs(tmpV.x) < 1.4 && tmpV.y > -0.2 && tmpV.y < 3.3 && Math.abs(tmpV.z) < 6.3;
};

function nextStopName() {
  const stops = Object.entries(STOPS).map(([n, d]) => ({ n, d }));
  if (props.mystery.d !== null) stops.push({ n: props.mystery.named ? "Ashgrove" : "???", d: props.mystery.d });
  stops.sort((a, b) => a.d - b.d);
  const next = stops.find((x) => x.d > drive.d - 4);
  return next ? next.n : null;
}
const clockMinutes = () => 23 * 60 + 40 + Math.round((drive.d / route.length) * 40) + g.lateTonight;
function clockText() {
  const m = ((clockMinutes() % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}

// ?test runs the loop on a timer (for automated testing, where the page may not be painted)
const TEST = params.has("test");
// (60 steps a second, so automated runs go quickly; only every third one is drawn)
const nextFrame = TEST ? (cb) => setTimeout(() => cb(performance.now()), 16) : (cb) => requestAnimationFrame(cb);
let testFrame = 0;

const FAST = TEST ? Number(params.get("fast")) || 1 : 1;   // ?test&fast=10 plays 10x faster
if (FAST > 1) Sound.setVoices(false);                       // subtitles only, timed by the game clock
const SILENT = TEST && !params.has("sound");                // automated runs are silent unless &sound

// Never a dead end at Northgate. If you're stopped there and the story has nothing on screen for
// ten seconds, "End your shift [E]" comes up (with a note of what the story was waiting on).
let rescue = null;
function northgateRescue(n) {
  return new Promise((done) => { rescue = { n, idle: 0, offered: false, done }; });
}
function watchNorthgate(dt) {
  if (!rescue || !playing) return;
  const atEnd = player.mode === "seat" && drive.stoppedNear(STOPS["Northgate"]);
  const story = $("subtitle").classList.contains("on") || !!document.querySelector("#choices .choice") ||
    !!document.querySelector(".paper.on") || horror.playing || (!rescue.offered && $("cta").classList.contains("on"))
    // (someone getting off and walking away, or a scare playing out, is the story going on, not a dead end)
    || /getting off|boarding|scare|line \(/.test(director.state.waiting || "")
    // (nor is the screen going dark at the end of the shift)
    || (atEnd && Number(getComputedStyle($("fade")).opacity) > 0.02);
  rescue.idle = atEnd && !story ? rescue.idle + dt : 0;
  const note = $("stuck-note");
  if (!rescue.offered && rescue.idle > 10) {
    rescue.offered = true;
    ui.hint("End your shift  [E]");
    note.textContent = `(story was waiting on: ${director.state.waiting || "nothing"})`;
    note.hidden = false;
    console.warn("Northgate rescue offered; story was waiting on:", director.state.waiting);
  } else if (rescue.offered && story) {
    rescue.offered = false;                  // the story picked up again by itself: the offer goes away with it
    note.hidden = true;
    if ($("cta").textContent.includes("End your shift")) ui.hint(null);
  }
  if (rescue.offered && input.hit("KeyE")) {
    const r = rescue;
    rescue = null;
    ui.hint(null);
    note.hidden = true;
    Sound.sfx("punch");
    const f = director.state.flags;
    r.done(r.n < 5 ? null : f.ripped ? "deadair" : director.state.kind >= KIND_ENOUGH ? "home" : "ontime");
  }
}

function frame(now) {
  nextFrame(frame);
  // in a test run, window.__fast changes the speed mid-run (0 freezes the game for a screenshot)
  const dt = Math.min(0.05, (now - last) / 1000) * (TEST && window.__fast != null ? window.__fast : FAST);
  last = now;
  // ...and window.__manual hands the clock over to window.__tick(dt): one exact step at a time, for recording
  if (TEST && window.__manual) return;
  tick(dt);
}
if (TEST) window.__tick = (dt) => tick(dt, true);

function tick(dt, forceDraw = false) {
  if (paused) return;
  stepSky(dt);
  if (strike) {
    flashT += dt;
    const soft = settings.lessFlash;
    const f = flashT > 0.45 ? 0 : strikeLevel(flashT) * (soft ? 0.45 : 1);
    hemi.intensity = hemiBase + ((soft ? 1.6 : 3.4) - hemiBase) * f;
    skyLight.intensity = moonBase + (soft ? 3 : 8) * f;
    scene.background.lerpColors(skyBase, SKY_STRIKE, f);
    scene.fog.color.lerpColors(skyBase, SKY_STRIKE, f * 0.85);
    whiteout.style.opacity = String(f * (soft ? 0.12 : 0.9));
    if (!strike.peaked && flashT >= 0.03) {
      strike.peaked = true;
      if (strike.onPeak) strike.onPeak();
    }
    if (flashT > 0.45) { strike = null; flashT = -1; whiteout.style.opacity = "0"; }
  } else if (flashT >= 0) {
    flashT += dt;
    const f = flashT > 0.6 ? 0 : flashLevel(flashT);
    hemi.intensity = hemiBase + (1.9 - hemiBase) * f;
    skyLight.intensity = moonBase + 4.5 * f;
    // the sky lights up too (and the rain haze with it): everything stands out black against it
    scene.background.lerpColors(skyBase, SKY_FLASH, f);
    scene.fog.color.lerpColors(skyBase, SKY_FLASH, f * 0.6);
    if (flashT > 0.6) flashT = -1;
  }
  if (playing && input.hit("KeyF")) toggleDoors();
  // the horn: it sounds for as long as you hold H down (out at the front of the bus, so from the seat it's through the
  // glass), and stops when you let go
  if (playing && player.mode === "seat" && !player.state.locked && input.down("KeyH")) {
    if (!busHorn) {
      busHorn = Sound.horn("bus", { at: () => bus.group.localToWorld(hornAt.set(0, 0.75, 6.25)), outside: 1900 });
      g.honked = performance.now();
    }
  } else if (busHorn) { busHorn.stop(); busHorn = null; }
  player.state.vibration = drive.speed / 14;
  file.update(dt, input);
  player.update(dt, input);
  self.update(dt);
  // look at the rear-view mirror and your eyes focus on it: the view narrows so you can see who's back there
  // (and a scene can narrow it: looking up at a window across the street)
  const wantFov = world.fovOverride || (player.mode === "seat" && g.lookingAtMirror() ? 34 : settings.fov);
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * (world.fovOverride ? 1.6 : 4));
    camera.updateProjectionMatrix();
  }
  horror.update(dt);
  shade.update(dt, camera);
  watchNorthgate(dt);
  traffic.update(dt, { busD: drive.d, speed: drive.speed, active: playing && player.mode === "seat" && !drive.state.detached, night: g.state.night, camera, player });
  drive.update(dt, input, playing && player.mode === "seat" && !player.state.locked);
  Sound.engine(0.3 + (drive.speed / 14) * 0.6, drive.speed / 14);
  const rt = director.routeText(nextStopName());
  const key = rt.text + rt.glitch;
  if (key !== lastRoute) { bus.setRoute(rt.text, rt.glitch); lastRoute = key; }
  bus.update(dt, { speed: drive.speed, clock: clockText(), late: g.lateTonight, steer: drive.state.steer || 0 });
  camera.getWorldPosition(focus);
  city.update(focus, dt);
  props.depot.update(dt, clockMinutes());
  busInverse.copy(bus.group.matrixWorld).invert();
  Sound.setInside(insideBus(focus.x, focus.y, focus.z));
  props.rain.update(dt, focus, (x, y, z) => insideBus(x, y, z) || places.hospital.inside(x, y, z) || props.underShelter(x, y, z, focus));
  updateWater(dt, { camera, lights: lightsOnWater(), rain: props.rain.on });
  props.mystery.update(dt);
  places.hospital.update(dt, camera);
  places.bridge.update(dt);
  people.update(dt);
  director.update(dt);
  Sound.update(camera);
  const draw = forceDraw || !TEST || FAST <= 1 || testFrame++ % 3 === 0;
  // the main menu has its own picture: the game world isn't drawn behind it
  if (draw && !menuUp && player.mode === "seat") bus.renderMirror(renderer, scene);
  if (draw && !menuUp) renderer.render(scene, camera);
  input.endFrame();
}

// Compile every shader the game will ever need now, while it loads, instead of in the middle of a
// jumpscare: everything in the scene (hidden things too), a car, the mirror's view.
function warmUp() {
  const removeCar = traffic.warmCar();
  try {
    renderer.compile(scene, camera);
    bus.smudgeTextures.forEach((t) => renderer.initTexture(t));
    renderer.setRenderTarget(bus.mirrorRT);
    renderer.compile(scene, bus.mirrorCam);
  } finally {
    renderer.setRenderTarget(null);
    removeCar();
  }
}

/* ---------- pause ---------- */
input.init(canvas);
// while a night card or ending card is up, letting go of the mouse is not a pause
let inMenu = false;
function setPaused(on) {
  paused = on;
  if (on && busHorn) { busHorn.stop(); busHorn = null; }
  $("screen-pause").hidden = !on;
  Sound.setMuted(on || settings.muted);
}
input.onLockChange = (locked) => {
  if (!playing || inMenu) return;
  setPaused(!locked);
};
canvas.addEventListener("click", () => { if (playing && !inMenu) input.lock(); });
$("btn-resume").addEventListener("click", () => input.lock());
$("btn-pause-settings").addEventListener("click", () => openSettings("screen-pause"));
$("btn-quit").addEventListener("click", () => location.reload());
// in the desktop app (desktop/), the game can quit, and fullscreen is the window's own (Esc doesn't drop out of it)
const desktop = window.desktop || null;
if (desktop) {
  $("btn-exit").hidden = false;
  $("btn-exit").addEventListener("click", () => desktop.quit());
}

/* ---------- the game ---------- */
async function loadManifest() {
  try { return await (await fetch("voices/manifest.json", { cache: "no-cache" })).json(); } catch { return null; }
}
let manifest = null;

function resetWorld(n) {
  people.clear();
  director.clear();
  drive.release();
  drive.detach(false);
  drive.setLimit(14);
  drive.d = 14;
  bus.setWater(0);
  bus.setDoors(true);
  bus.setInterior("on");
  bus.setVisor(false);
  bus.setClipping(n === 4);                       // Teodor's clipping waits in the visor
  bus.setSmudge(0);
  shade.hide();
  traffic.clear();
  props.requestStop.place(null);
  props.requestStop.light(true);
  bus.group.getObjectByName("gift")?.removeFromParent();
  bus.setRadio("CH 9");
  bus.setHeadlights(true);
  props.mystery.place(n >= 2 ? MYSTERY[n] : null);
  props.mystery.named = false;
  props.mystery.setName("???");
  props.flood.set(false);
  props.rain.set(false);
  props.missingPoster.visible = false;
  places.bridge.group.visible = false;
  city.setLampsOn(true);
  city.clearOuts();
  setSky("night");
  g.storm(false);
  g.route(null);
  Sound.ambience({ wind: 1, hum: 0 });
  // you start by the dispatch office, facing the bus; the bus is solid
  // (just the bus's own body: last night's camera, and everything hanging off it, is still riding in the bus)
  g.walkAt(props.depot.spawn, 0.35, [...props.colliders, bus.bounds()]);
  file.setup(n);
  // the first time, a word about what's lying around to be read
  if (n === 1 && file.everCount === 0) setTimeout(() => { if (playing && g.state.night === 1) ui.toast("Look around. Some things can be read  ·  E", 4200); }, 9000);
}

async function play(startNight, saved) {
  playing = true;
  ui.showHud(true);
  director.reset(saved);
  let ending = null;
  for (let n = startNight; n <= 5; n++) {
    director.state.night = n;
    director.state.lateAtNight = director.state.late;
    store.set(SAVE, { night: n, flags: director.state.flags, kind: director.state.kind, late: director.state.late, warn: director.state.warn });
    inMenu = true;
    setPaused(false);
    input.unlock();
    await ui.fade(1, 600);
    resetWorld(n);
    if (manifest && manifest.nights[n]) Sound.prefetch(manifest.nights[n]);
    const info = NIGHTS[n];
    await ui.card({ kicker: "Route 9", title: `Night ${n}`, sub: info.subtitle, actions: [{ label: "Start shift" }] });
    inMenu = false;
    input.lock();
    // if the browser didn't hand over the mouse, show Resume so one click fixes it
    if (!TEST) setTimeout(() => { if (playing && !inMenu && !input.locked) setPaused(true); }, 700);
    ui.fade(0, 1500);
    let alive = true;
    const gNight = new Proxy(g, { get(target, key) { if (!alive) throw new Error("night over"); return target[key]; } });
    const run = info.run(gNight);
    run.catch(() => {});
    try {
      ending = await Promise.race([run, northgateRescue(n)]);
      if (rescue) rescue = null;
      if (n === 5 && !ending) ending = "notyet";
    } catch (err) {
      // a broken script must never leave you stranded on a dark road: say so, and go on to the next night
      console.error(`Night ${n} stopped:`, err);
      inMenu = true;
      input.unlock();
      await ui.fade(1, 600);
      await ui.card({ kicker: `Night ${n}`, title: "Something went wrong", sub: "The night couldn't carry on, so the shift ends here.", note: String(err && err.message || err).slice(0, 160), actions: [{ label: "Continue" }] });
      ending = ending || "notyet";
    }
    alive = false;
    rescue = null;
    $("stuck-note").hidden = true;
  }
  // the end
  store.del(SAVE);
  const found = new Set(store.get(FOUND) || []);
  found.add(ending);
  store.set(FOUND, [...found]);
  playing = false;
  inMenu = true;
  setPaused(false);
  ui.showHud(false);
  input.unlock();
  const e = ENDINGS[ending];
  await ui.fade(1, 1500);
  await ui.card({ kicker: `Ending ${e.number} of 4`, title: e.title, sub: e.blurb, note: `Endings found: ${found.size} / 4 · Route 9 file: ${file.count} / ${file.total}${e.hint ? " · " + e.hint : ""}`, actions: [{ label: "Credits" }] });
  await ui.credits(CREDITS);
  location.reload();
}

const menuArt = createMenuArt($("menu-art"));
let menuUp = true;
function showTitle() {
  $("screen-warning").hidden = true;
  $("screen-title").hidden = false;
  menuUp = true;
  menuArt.start();
  hideConfirm();
  const saved = store.get(SAVE);
  $("btn-continue").hidden = !saved;
  $("btn-new").classList.toggle("primary", !saved);
  if (saved) $("btn-continue").textContent = `Continue · Night ${saved.night}`;
  const found = store.get(FOUND) || [];
  $("endings-found").textContent = `Endings found: ${found.length} / 4  ·  Route 9 file: ${file.everCount} / ${file.total}`;
}

async function begin(startNight, saved) {
  if (!menuUp) return;                 // a double click starts one game, not two
  Sound.init();
  Sound.setVolume(SILENT ? 0 : settings.volume);
  Sound.setLevels({ voices: settings.voices, music: settings.music, sfx: settings.sfx, horror: settings.horror });
  $("screen-title").hidden = true;
  $("screen-settings").hidden = true;
  menuCol.hidden = false;
  menuUp = false;
  menuArt.stop();
  ui.loading("Loading voices…");
  manifest = await loadManifest();
  if (manifest) Sound.setVersions(manifest.versions, manifest.fx);
  ui.loading(null);
  play(startNight, saved);
}

// a new game over a save asks first
function hideConfirm() {
  $("confirm-new").hidden = true;
  $("menu-list").hidden = false;
}
$("btn-new").addEventListener("click", () => {
  const saved = store.get(SAVE);
  if (saved && !params.get("night")) {
    $("confirm-night").textContent = `Night ${saved.night}`;
    $("menu-list").hidden = true;
    $("confirm-new").hidden = false;
    $("btn-new-no").focus();
    return;
  }
  begin(Number(params.get("night")) || 1, null);
});
$("btn-new-yes").addEventListener("click", () => begin(Number(params.get("night")) || 1, null));
$("btn-new-no").addEventListener("click", () => { hideConfirm(); $("btn-new").focus(); });
$("btn-settings").addEventListener("click", () => openSettings("screen-title"));
$("btn-continue").addEventListener("click", () => {
  const saved = store.get(SAVE);
  begin(saved.night, saved);
});
$("btn-warning").addEventListener("click", () => {
  settings.warned = true;
  store.set(SETTINGS, settings);
  showTitle();
});

/* ---------- settings ---------- */
const pct = (v) => `${Math.round(v * 100)}%`;
const range = (key, label, min, max, step, show, sub) => ({ key, label, sub, type: "range", min, max, step, show });
const toggle = (key, label, sub) => ({ key, label, sub, type: "toggle" });
const fullscreen = {
  label: "Fullscreen", type: "toggle",
  get: () => (desktop ? desktop.isFullscreen() : !!document.fullscreenElement),
  set(on) {
    if (desktop) { desktop.setFullscreen(on); return; }
    if (on === !!document.fullscreenElement) return;
    const p = on ? document.documentElement.requestFullscreen?.() : document.exitFullscreen?.();
    if (p && p.catch) p.catch(() => {});
  },
};
const SETTING_TABS = [
  { name: "Audio", rows: [
    range("volume", "Master volume", 0, 1, 0.01, pct),
    range("voices", "Voices", 0, 1, 0.01, pct),
    range("music", "Music", 0, 1, 0.01, pct),
    range("sfx", "Effects", 0, 1, 0.01, pct, "Rain, the engine, the doors"),
    range("horror", "Scares", 0, 1, 0.01, pct, "Jumpscares, thunder, the stings: they stay loud when you turn the effects down"),
  ] },
  { name: "Controls", keys: true, rows: [
    range("mouse", "Mouse sensitivity", 0.2, 2, 0.05, (v) => `${v.toFixed(2)}x`),
    toggle("invertY", "Invert mouse", "Push the mouse forward to look down"),
  ] },
  { name: "Display", rows: [
    range("brightness", "Brightness", 0.6, 1.6, 0.05, pct, "Turn it up if the nights are too dark to see"),
    range("fov", "Field of view", 60, 90, 1, (v) => `${v}°`),
    toggle("grain", "Film grain"),
    toggle("lessFlash", "Reduce flashing", "Softer lightning and jumpscare flashes"),
    fullscreen,
  ] },
  { name: "Gameplay", rows: [
    toggle("subs", "Subtitles"),
    { key: "subSize", label: "Subtitle size", type: "choice", options: [["small", "Small"], ["medium", "Medium"], ["large", "Large"]] },
    toggle("shake", "Camera shake"),
  ] },
];
const KEYS = [
  ["W A S D", "Walk"], ["Mouse", "Look around"], ["E", "Use, pick up, talk"], ["W · S", "Gas and brake while driving (Space brakes too)"],
  ["F", "Open or close the doors"], ["H", "Horn"], ["1 2 3", "Pick an answer"], ["Esc", "Pause"],
];
// what each setting changes, right away
const APPLY = {
  volume: (v) => Sound.setVolume(SILENT ? 0 : v),
  voices: (v) => Sound.setLevels({ voices: v }),
  music: (v) => Sound.setLevels({ music: v }),
  sfx: (v) => Sound.setLevels({ sfx: v }),
  horror: (v) => Sound.setLevels({ horror: v }),
  lessFlash: (v) => document.body.classList.toggle("less-flash", v),
  mouse: (v) => { input.sensitivity = v; },
  invertY: (v) => { input.invertY = v; },
  brightness: (v) => { canvas.classList.toggle("bright", v !== 1); canvas.style.setProperty("--bright", String(v)); },
  grain: (v) => document.body.classList.toggle("no-grain", !v),
  subs: (v) => { ui.subsOn = v; },
  subSize: (v) => { document.body.dataset.subs = v; },
  shake: (v) => document.body.classList.toggle("no-shake", !v),
};
const shakeCamera = player.shake;
player.shake = (amount) => { if (settings.shake) shakeCamera(amount); };
function change(key, v) {
  settings[key] = v;
  if (APPLY[key]) APPLY[key](v);
  store.set(SETTINGS, settings);
}
Object.keys(APPLY).forEach((k) => { if (k !== "volume") APPLY[k](settings[k]); });

const node = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
function settingRow(d) {
  const row = node("div", "set-row");
  const lbl = node("div", "lbl", d.label);
  if (d.sub) lbl.append(node("span", "sub", d.sub));
  const ctl = node("div", "set-ctl");
  if (d.type === "range") {
    const el = node("input");
    Object.assign(el, { type: "range", min: d.min, max: d.max, step: d.step, value: settings[d.key] });
    el.setAttribute("aria-label", d.label);
    const val = node("span", "set-val");
    const show = () => {
      val.textContent = d.show(settings[d.key]);
      el.style.setProperty("--fill", `${((settings[d.key] - d.min) / (d.max - d.min)) * 100}%`);
    };
    el.addEventListener("input", () => { change(d.key, Number(el.value)); show(); });
    show();
    ctl.append(el, val);
  } else {
    const opts = d.type === "toggle" ? [[true, "On"], [false, "Off"]] : d.options;
    const seg = node("div", "seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", d.label);
    const now = () => (d.get ? d.get() : settings[d.key]);
    const paint = () => [...seg.children].forEach((btn, i) => btn.setAttribute("aria-pressed", String(opts[i][0] === now())));
    for (const [v, text] of opts) {
      const btn = node("button", null, text);
      btn.type = "button";
      btn.addEventListener("click", () => { if (d.set) d.set(v); else change(d.key, v); paint(); });
      seg.append(btn);
    }
    paint();
    ctl.append(seg);
  }
  row.append(lbl, ctl);
  return row;
}
function keyList() {
  const list = node("div", "keys");
  for (const [keys, what] of KEYS) {
    const k = node("span");
    keys.split(" ").forEach((t) => k.append(t === "·" ? " · " : node("kbd", null, t)));
    list.append(k, node("span", null, what));
  }
  return list;
}
let setTab = 0;
let settingsFrom = null;          // the screen Back goes to
function renderSettings() {
  const tabs = $("set-tabs");
  tabs.replaceChildren(...SETTING_TABS.map((t, i) => {
    const btn = node("button", "set-tab", t.name);
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(i === setTab));
    btn.addEventListener("click", () => { setTab = i; renderSettings(); $("set-tabs").children[i].focus(); });
    return btn;
  }));
  const tab = SETTING_TABS[setTab];
  $("set-body").replaceChildren(...tab.rows.map(settingRow), ...(tab.keys ? [keyList()] : []));
}
// over the main menu, the rainy street stays behind the settings; over the pause menu, the game does
const menuCol = document.querySelector("#screen-title .menu-col");
function openSettings(from) {
  settingsFrom = from;
  if (from === "screen-title") menuCol.hidden = true;
  else $(from).hidden = true;
  $("screen-settings").hidden = false;
  renderSettings();
}
function closeSettings() {
  $("screen-settings").hidden = true;
  menuCol.hidden = false;
  if (settingsFrom === "screen-pause") $("screen-pause").hidden = false;
  if (settingsFrom === "screen-title") $("btn-settings").focus();
  settingsFrom = null;
}
$("btn-set-back").addEventListener("click", closeSettings);
$("btn-set-reset").addEventListener("click", () => {
  for (const k of Object.keys(DEFAULTS)) change(k, DEFAULTS[k]);
  renderSettings();
});
addEventListener("keydown", (e) => {
  if (e.code !== "Escape") return;
  if (!$("screen-settings").hidden) closeSettings();
  else if (!$("confirm-new").hidden) { hideConfirm(); $("btn-new").focus(); }
});
document.addEventListener("fullscreenchange", () => { if (!$("screen-settings").hidden) renderSettings(); });

/* ---------- start ---------- */
addEventListener("resize", () => resize(camera));
resize(camera);
if (!camera.aspect || !Number.isFinite(camera.aspect)) { camera.aspect = 16 / 9; camera.updateProjectionMatrix(); }
resetWorld(1);
warmUp();
nextFrame(frame);
if (TEST) {
  window.__lastStop = { g, drive, bus, player, props, director, camera, renderer, scene, input, horror, shade, places, traffic, world, self, Sound, ui };
  // ?bot=kind|cold|deadair|random: the automatic playtester plays the game
  if (params.get("bot")) {
    import("../tools/playtest.js").then((m) => {
      settings.warned = true;
      showTitle();
      m.startBot(params.get("bot"));
      // &night=5&kind=9&flags=rheeTruth,maraHelped starts later with a chosen story so far
      const flags = Object.fromEntries((params.get("flags") || "").split(",").filter(Boolean).map((k) => [k, true]));
      begin(Number(params.get("night")) || 1, params.get("night") ? { flags, kind: Number(params.get("kind")) || 0 } : null);
    });
  }
}
ui.fade(0, 2000);
if (settings.warned) showTitle();
else $("screen-warning").hidden = false;
