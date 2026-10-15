// LAST STOP — entry point. Builds the world, runs the game loop, and plays
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
import { NIGHTS, ENDINGS, CREDITS } from "./story/nights.js";

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
  throw new Error("Last Stop needs a keyboard and mouse.");
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
scene.fog = new THREE.FogExp2(0x05070c, 0.03);
scene.background = new THREE.Color(0x05070c);

const SKIES = {
  night: { fog: 0x05070c, density: 0.03, hemi: 0.35 },
  storm: { fog: 0x070a10, density: 0.042, hemi: 0.3 },
  dawn: { fog: 0x8a95a3, density: 0.014, hemi: 1.6 },
  void: { fog: 0x05070b, density: 0.024, hemi: 0.35 },   // the bridge: dark, but you can see the road
  hospital: { fog: 0x0b0d0c, density: 0.02, hemi: 0.4 },
};
let hemiBase = 0.35;
function setSky(name) {
  const k = SKIES[name] || SKIES.night;
  scene.fog.color.set(k.fog);
  scene.fog.density = k.density;
  scene.background.set(k.fog);
  hemi.intensity = hemiBase = k.hemi;
}
// a cold flash across the sky, not a white-out
function lightning() {
  hemi.intensity = 1.8;
  setTimeout(() => { hemi.intensity = hemiBase; }, 70);
  setTimeout(() => { hemi.intensity = 1.3; }, 150);
  setTimeout(() => { hemi.intensity = hemiBase; }, 230);
}

const city = buildCity(scene);
const props = buildProps(scene);
const bus = buildBus(scene);
const places = buildPlaces(scene);
const drive = createDrive(bus);
const player = createPlayer(camera, scene);

const settings = Object.assign({ volume: 0.8, mouse: 1, scares: true, subs: true, warned: false }, store.get(SETTINGS) || {});
const horror = createHorror(camera);
const shade = createShade(scene);
const traffic = createTraffic(scene, (name, ...args) => Sound.sfx(name, ...args));
const world = { scene, camera, player, drive, bus, props, places, city, settings, setSky, lightning, input, horror, shade, traffic };
const director = createDirector(world);
const g = director.g;

// the green door button on the dash (F does the same thing)
function toggleDoors() {
  if (player.mode !== "seat" || !g.doorControl || drive.speed > 0.5) return;
  g.setDoors(!bus.doorsOpen);
}
player.addInteract({
  mesh: bus.interactables[1],
  label: () => (player.mode === "seat" && g.doorControl && drive.speed <= 0.5 ? (bus.doorsOpen ? "Close doors" : "Open doors") : null),
  use: toggleDoors,
});

/* ---------- loop ---------- */
let playing = false;
let paused = false;
let last = performance.now();
let lastRoute = "";
const focus = new THREE.Vector3();
// is a world point inside the bus? (so rain doesn't fall through the roof)
const busInverse = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
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
const nextFrame = TEST ? (cb) => setTimeout(() => cb(performance.now()), 33) : (cb) => requestAnimationFrame(cb);

const FAST = TEST ? Number(params.get("fast")) || 1 : 1;   // ?test&fast=6 plays 6x faster
if (FAST > 1) Sound.setVoices(false);                       // subtitles only, timed by the game clock

function frame(now) {
  nextFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000) * FAST;
  last = now;
  if (paused) return;
  if (playing && input.hit("KeyF")) toggleDoors();
  player.state.vibration = drive.speed / 14;
  player.update(dt, input);
  // look at the rear-view mirror and your eyes focus on it: the view narrows so you can see who's back there
  const wantFov = player.mode === "seat" && g.lookingAtMirror() ? 34 : 72;
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }
  horror.update(dt);
  shade.update(dt, camera);
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
  props.rain.update(dt, focus, insideBus);
  props.flood.update(dt);
  props.mystery.update(dt);
  places.hospital.update(dt);
  places.bridge.update(dt);
  people.update(dt);
  director.update(dt);
  Sound.update(camera);
  if (player.mode === "seat") bus.renderMirror(renderer, scene);
  renderer.render(scene, camera);
  input.endFrame();
}

/* ---------- pause ---------- */
input.init(canvas);
// while a night card or ending card is up, letting go of the mouse is not a pause
let inMenu = false;
function setPaused(on) {
  paused = on;
  $("screen-pause").hidden = !on;
  Sound.setMuted(on || settings.muted);
}
input.onLockChange = (locked) => {
  if (!playing || inMenu) return;
  setPaused(!locked);
};
canvas.addEventListener("click", () => { if (playing && !inMenu) input.lock(); });
$("btn-resume").addEventListener("click", () => input.lock());
$("btn-quit").addEventListener("click", () => location.reload());

/* ---------- the game ---------- */
async function loadManifest() {
  try { return await (await fetch("voices/manifest.json")).json(); } catch { return null; }
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
  setSky("night");
  g.storm(false);
  g.route(null);
  Sound.ambience({ wind: 1, hum: 0 });
  // you start by the dispatch office, facing the bus; the bus is solid
  bus.group.updateMatrixWorld(true);
  const busBox = new THREE.Box3().setFromObject(bus.group).expandByScalar(-0.15);
  g.walkAt(props.depot.spawn, 0.35, [...props.colliders, busBox]);
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
    try {
      ending = await info.run(g);
    } catch (err) {
      // a broken script must never leave you stranded on a dark road: say so, and go on to the next night
      console.error(`Night ${n} stopped:`, err);
      inMenu = true;
      input.unlock();
      await ui.fade(1, 600);
      await ui.card({ kicker: `Night ${n}`, title: "Something went wrong", sub: "The night couldn't carry on, so the shift ends here.", note: String(err && err.message || err).slice(0, 160), actions: [{ label: "Continue" }] });
      ending = ending || "notyet";
    }
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
  await ui.card({ kicker: `Ending ${e.number} of 4`, title: e.title, sub: e.blurb, note: `Endings found: ${found.size} / 4${e.hint ? " · " + e.hint : ""}`, actions: [{ label: "Credits" }] });
  await ui.credits(CREDITS);
  location.reload();
}

function showTitle() {
  $("screen-warning").hidden = true;
  $("screen-title").hidden = false;
  const saved = store.get(SAVE);
  $("btn-continue").hidden = !saved;
  $("btn-new").classList.toggle("primary", !saved);
  if (saved) $("btn-continue").textContent = `Continue · Night ${saved.night}`;
  const found = store.get(FOUND) || [];
  $("endings-found").textContent = `Endings found: ${found.length} / 4`;
}

async function begin(startNight, saved) {
  Sound.init();
  Sound.setVolume(settings.volume);
  $("screen-title").hidden = true;
  ui.loading("Loading voices…");
  manifest = await loadManifest();
  ui.loading(null);
  play(startNight, saved);
}

$("btn-new").addEventListener("click", () => begin(Number(params.get("night")) || 1, null));
$("btn-continue").addEventListener("click", () => {
  const saved = store.get(SAVE);
  begin(saved.night, saved);
});
$("btn-warning").addEventListener("click", () => {
  settings.warned = true;
  store.set(SETTINGS, settings);
  showTitle();
});

// settings
const bind = (id, key, read, apply) => {
  const el = $(id);
  if (el.type === "checkbox") el.checked = settings[key];
  else el.value = key === "volume" ? settings.volume * 100 : settings.mouse * 100;
  el.addEventListener("input", () => {
    settings[key] = read(el);
    apply && apply(settings[key]);
    store.set(SETTINGS, settings);
  });
};
bind("set-volume", "volume", (el) => el.value / 100, (v) => Sound.setVolume(v));
bind("set-mouse", "mouse", (el) => el.value / 100, (v) => { input.sensitivity = v; });
bind("set-scares", "scares", (el) => el.checked);
bind("set-subs", "subs", (el) => el.checked, (v) => { ui.subsOn = v; });
input.sensitivity = settings.mouse;
ui.subsOn = settings.subs;

/* ---------- start ---------- */
addEventListener("resize", () => resize(camera));
resize(camera);
if (!camera.aspect || !Number.isFinite(camera.aspect)) { camera.aspect = 16 / 9; camera.updateProjectionMatrix(); }
resetWorld(1);
nextFrame(frame);
if (TEST) {
  window.__lastStop = { g, drive, bus, player, props, director, camera, renderer, scene, input, horror, shade, places, traffic };
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
