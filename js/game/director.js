// The director runs the story scripts (js/story/night*.js). Scripts are async
// functions that get `g`, a small toolbox: say lines, wait for stops, move
// people, change the lights, scare the player.
import * as THREE from "three";
import { ui } from "../core/ui.js";
import { Sound } from "../audio.js";
import { CAST, spoken, lineId } from "../story/cast.js";
import { Person } from "../world/people.js";
import { route, STOPS } from "../world/route.js";

// a glowing arrow (with a light beam) that bobs over wherever you need to go
function makeMarker() {
  const g = new THREE.Group();
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffb54a, fog: false }));
  arrow.rotation.x = Math.PI;
  g.add(arrow);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 40, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb54a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  beam.position.y = 20.5;
  g.add(beam);
  g.visible = false;
  g.userData = { beam };
  return g;
}

export function createDirector(w) {
  const { scene, camera, player, drive, bus, props, places, settings } = w;
  const marker = makeMarker();
  scene.add(marker);
  const navEl = document.getElementById("nav");
  let nav = null;          // { stop: { d, name } } | { mesh } | { point }
  let navText = "";
  let bob = 0;
  let idle = 0;
  const waiters = new Set();
  const actors = new Map();
  let doorControl = true;
  let routeOverride = null;
  let stormT = 0;
  let storm = false;
  const s = { flags: {}, kind: 0, late: 0, warn: 0, lateAtNight: 0, night: 1 };

  // wait until test(dt) is true. Frame-based, so pausing the game pauses scripts too.
  function until(test, timeoutMs = 0) {
    return new Promise((done) => {
      const entry = { test, done, left: timeoutMs ? timeoutMs / 1000 : Infinity };
      waiters.add(entry);
    });
  }
  function positionFor(who) {
    const a = actors.get(who);
    if (a) return () => a.root.localToWorld(new THREE.Vector3(0, a.look.height - 0.15, 0));
    if (CAST[who].fx === "radio") return () => bus.radioMesh.getWorldPosition(new THREE.Vector3());
    return null;
  }
  const nameOf = (who) => {
    const n = CAST[who].name;
    return typeof n === "function" ? n(s.flags) : n;
  };

  const g = {
    state: s,
    get flags() { return s.flags; },
    get lateTonight() { return s.late - s.lateAtNight; },
    kind(n = 1) { s.kind += n; },
    late(n) { s.late += n; },
    warn(n = 1) { s.warn += n; },

    wait(ms) {
      let t = 0;
      return until((dt) => (t += dt) * 1000 >= ms);
    },
    // run fn(dt) every frame until it returns true (for hand-made animations)
    frames(fn) { return until(fn); },
    until(test, timeoutMs) {
      let t = 0;
      return until((dt) => {
        t += dt;
        if (timeoutMs && t * 1000 >= timeoutMs) return true;
        return test();
      }).then(() => !!test());
    },

    // ---------- talking ----------
    async say(who, text, { keep = false, after = 260 } = {}) {
      const c = CAST[who];
      ui.subtitle(nameOf(who), c.color, text);
      const played = await Sound.voice(lineId(who, text), { fx: c.fx, at: positionFor(who) });
      if (!played) await g.wait(Math.max(1500, text.length * 60 + 500));
      if (!keep) ui.clearSubtitle();
      if (after) await g.wait(after);
    },
    think(text, opts) { return g.say("you", text, opts); },
    // dialogue options; the one you pick is said out loud (unless it's an [action])
    async choose(options, { silent = false } = {}) {
      ui.clearSubtitle();
      const i = await ui.choices(options);
      const line = spoken(options[i]);
      if (line && !silent) await g.say("you", line);
      return i;
    },
    hint(text) { ui.hint(text); },

    // ---------- the bus ----------
    // wait until the bus stops at a stop (true) or drives past it (false)
    async arrive(name, { hint = true } = {}) {
      const d = name === "???" ? props.mystery.d : STOPS[name];
      if (hint) nav = { stop: { d, name: name === "???" ? "???" : name } };
      await until(() => drive.stoppedNear(d) || drive.passed(d));
      if (nav && nav.stop) nav = null;
      return drive.stoppedNear(d);
    },
    get navTarget() { return nav; },
    // point the arrow at a place on foot (cleared with navTo(null))
    navTo(point) { nav = point ? { point: point.clone() } : null; },
    // wait for the doors (F) to be opened/closed, or for a timeout. Returns true if they did.
    async doors(open, timeoutMs = 0, hintText = null) {
      if (hintText !== false) ui.hint(hintText || (open ? "Open the doors  [F]" : "Close the doors  [F]"));
      let t = 0;
      const ok = await until((dt) => {
        t += dt;
        return bus.doorsOpen === open || (timeoutMs && t * 1000 > timeoutMs) || (!open && drive.moving);
      }).then(() => bus.doorsOpen === open);
      ui.hint(null);
      return ok;
    },
    setDoors(open) {
      if (bus.doorsOpen !== open) Sound.sfx("door");
      bus.setDoors(open);
    },
    lockDoors(locked) { doorControl = !locked; },
    get doorControl() { return doorControl; },
    // wait until the bus is moving again (the player drove off)
    departed() { return until(() => drive.moving); },
    auto(speed, stopAtD = null) { drive.auto(speed, stopAtD); },
    release() { drive.release(); },
    park() { drive.park(); },
    get d() { return drive.d; },
    route(text, glitch = false) { routeOverride = text ? { text, glitch } : null; },
    radio(text) { bus.setRadio(text); },
    interior(mode) { bus.setInterior(mode); },
    visor(down) { bus.setVisor(down); },
    mystery(d) { props.mystery.place(d); },
    mysteryName(text) { props.mystery.setName(text); },

    // ---------- people ----------
    spawn(key, look, { ghost = false, at = null, yaw = 0, mirrorOnly = false } = {}) {
      if (actors.has(key)) actors.get(key).remove();
      const p = new Person(scene, look, { ghost });
      if (at) p.placeAt(at, yaw);
      if (mirrorOnly) p.setMirrorOnly(true);
      actors.set(key, p);
      return p;
    },
    actor(key) { return actors.get(key); },
    despawn(key) {
      const p = actors.get(key);
      if (p) p.remove();
      actors.delete(key);
    },
    despawnAll() { [...actors.keys()].forEach((k) => g.despawn(k)); },
    // sit someone straight down in a bus seat
    seat(key, seatName) {
      const p = actors.get(key);
      p.sit(bus.group, bus.seatSlots[seatName], 0);
      return p;
    },
    // walk from where they are, up the steps, pay, and sit down
    async board(key, seatName, speed = 1.4) {
      const p = actors.get(key);
      const outside = bus.group.localToWorld(bus.boardPath[0].clone());
      await p.walk([outside], { speed, parent: scene });
      const seatPos = bus.seatSlots[seatName];
      await p.walk([bus.boardPath[1], bus.boardPath[2]], { speed, parent: bus.group });
      Sound.sfx("coin");
      await p.walk([new THREE.Vector3(0, 0.45, seatPos.z + 0.4), new THREE.Vector3(seatPos.x * 0.6, 0.45, seatPos.z + 0.1)], { speed, parent: bus.group });
      p.sit(bus.group, seatPos, 0);
    },
    // get off the bus and walk somewhere (a world position), then vanish
    async alight(key, to = null, { vanish = true, speed = 1.4 } = {}) {
      const p = actors.get(key);
      if (!p) return;
      const z = p.root.position.z;
      p.stand();
      await p.walk([new THREE.Vector3(0, 0.45, z), bus.boardPath[2], bus.boardPath[1], bus.boardPath[0]], { speed, parent: bus.group });
      if (to) await p.walk([to], { speed, parent: scene });
      if (vanish) g.despawn(key);
    },
    // the drowned don't walk off. They're just gone when you look again.
    vanish(key) { g.despawn(key); },

    // ---------- look and feel ----------
    mood(m) { Sound.mood(m); },
    amb(levels) { Sound.ambience(levels); },
    sfx(name, ...args) { Sound.sfx(name, ...args); },
    lamps(on) { w.city.setLampsOn(on); },
    rain(on) { props.rain.set(on); Sound.ambience({ rain: on ? 1 : 0 }); },
    flood(on, level) { props.flood.set(on, level); },
    storm(on) { storm = on; g.rain(on); stormT = 3; },
    sky(preset) { w.setSky(preset); },
    shake(a = 1) { player.shake(a); },
    look(target) { player.lookAtSoon(target); },
    lookAtActor(key) {
      const a = actors.get(key);
      player.lookAtSoon(a ? a.root.localToWorld(new THREE.Vector3(0, a.look.height - 0.15, 0)) : null);
    },
    cutscene(on, target = null) { on ? player.cutscene(target) : player.endCutscene(); },
    // a real jumpscare, in the world: "face" lunges at you, "hands" slam the
    // glass, "eyes" open in the dark first. The bus lights stutter with it.
    async scare(kind = "face") {
      if (!settings.scares) {
        Sound.sfx("heartbeat", 3, 96);
        await g.wait(700);
        return;
      }
      const before = bus.interiorMode;
      if (kind === "eyes") {
        bus.setInterior("off");
        Sound.sfx("breath");
        await g.wait(1350);
      }
      bus.setInterior("flicker");
      Sound.sfx(kind === "hands" ? "bang" : "sting");
      if (kind === "hands") Sound.sfx("sting");
      player.shake(kind === "hands" ? 1.4 : 2.2);
      document.body.classList.add("scare-flash");
      setTimeout(() => document.body.classList.remove("scare-flash"), 110);
      const playing = w.horror.play(kind === "eyes" ? "face" : kind);
      await until(() => !w.horror.playing);
      await playing;
      bus.setInterior(before || "on");
    },
    // kept for older scripts: same as a face scare
    faceScare() { return g.scare("face"); },
    fade(to, ms = 1200, white = false) { return ui.fade(to, ms, white); },
    card(opts) { return ui.card(opts); },
    interact(mesh, label, { arrow = true } = {}) {
      if (arrow) nav = { mesh };
      return new Promise((done) => {
        const entry = player.addInteract({
          mesh,
          label: () => label,
          use: () => {
            player.removeInteract(entry);
            if (nav && nav.mesh === mesh) nav = null;
            done();
          },
        });
      });
    },

    // ---------- moving the player between places ----------
    sitInBus() { player.endCutscene(); player.sitIn(bus.group, bus.driverEye); player.setColliders([]); },
    fixedCamera(parent, pos, rot) { player.fixed(parent, pos, rot); },
    walkAt(pos, yaw, colliders = []) { player.walkAt(pos, yaw); player.setColliders(colliders); },
    places,
    props,
    bus,
    drive,
    camera,
  };

  // is the player looking at a world point (within `deg` degrees)?
  g.gazing = (point, deg = 14) => {
    const from = camera.getWorldPosition(new THREE.Vector3());
    const dir = camera.getWorldDirection(new THREE.Vector3());
    return dir.dot(point.clone().sub(from).normalize()) > Math.cos(THREE.MathUtils.degToRad(deg));
  };
  g.mirrorPoint = () => bus.group.localToWorld(new THREE.Vector3(0.22, 2.5, 5.78));
  g.backRow = () => bus.group.localToWorld(new THREE.Vector3(0, 1.4, -5.2));
  g.lookingAtMirror = () => g.gazing(g.mirrorPoint(), 9);
  g.lookingBack = () => g.gazing(g.backRow(), 25);
  g.lookingAtActor = (key, deg = 18) => {
    const a = actors.get(key);
    return !!a && g.gazing(a.root.localToWorld(new THREE.Vector3(0, a.look.height - 0.3, 0)), deg);
  };
  // someone standing in the road ahead, lit by the headlights.
  // Stop in time and they stare, then vanish. Hit them and... you'll see.
  g.roadFigure = async (look = "drowned", ahead = 75) => {
    const d0 = drive.d + ahead;
    g.spawn("roadfig", look, { ghost: true, at: route.at(d0, 2.3, 0), yaw: route.heading(d0) + Math.PI });
    // resolves when you reach them, or after you've sat stopped in sight of them for a few seconds
    let stoppedFor = 0;
    await until((dt) => {
      if (drive.d > d0 - 8) return true;
      stoppedFor = drive.speed < 0.3 ? stoppedFor + dt : 0;
      return stoppedFor > (drive.d > d0 - 45 ? 0.5 : 4);
    });
    if (drive.d > d0 - 8 && drive.speed > 1.5) {
      g.despawn("roadfig");
      Sound.sfx("bang");
      await g.scare("face");
      player.shake(2.2);
      return "hit";
    }
    await g.wait(1800);
    bus.setInterior("flicker");
    Sound.sfx("lightsout");
    await g.wait(900);
    g.despawn("roadfig");
    bus.setInterior("on");
    return "stopped";
  };
  // something walks up the aisle, a little closer every time you check the mirror
  g.creepMirror = async (look = "drowned") => {
    g.spawn("creep", look, { ghost: true, mirrorOnly: true });
    for (const seat of ["B1", "L7", "L4", "L1"]) {
      g.seat("creep", seat);
      ui.hint("Check your mirror");
      await until(() => g.lookingAtMirror(), 14000);
      ui.hint(null);
      Sound.sfx(seat === "L1" ? "breath" : "drip");
      await g.wait(seat === "L1" ? 1200 : 2600);
    }
    ui.hint("Turn around");
    await until(() => g.lookingBack() || g.gazing(bus.group.localToWorld(new THREE.Vector3(0.66, 1.3, 3.1)), 30), 12000);
    ui.hint(null);
    g.despawn("creep");
    await g.wait(1600);
    await until(() => g.gazing(bus.group.localToWorld(new THREE.Vector3(0.7, 1.6, 12)), 35), 10000);
    await g.faceScare(look, 0.6);
  };
  // creepy things that just happen while you drive: whispers, footsteps in
  // the aisle, the stop bell on an empty bus, people on the sidewalk who
  // aren't there when you get close, streetlights that stutter
  let dread = false;
  let dreadT = 20;
  let watcher = null;
  g.dread = (on) => { dread = on; dreadT = 12 + Math.random() * 12; };
  const EVENTS = [
    () => Sound.sfx("whisper"),
    () => Sound.sfx("breath"),
    () => Sound.sfx("steps"),
    () => Sound.sfx("knock", 2),
    () => { if (bus.passengers === 0) Sound.sfx("bell"); else Sound.sfx("drip"); },
    () => {
      w.city.setLampsOn(false);
      Sound.sfx("lightsout");
      setTimeout(() => w.city.setLampsOn(true), 180 + Math.random() * 400);
    },
    () => { bus.setInterior("flicker"); setTimeout(() => { if (bus.interiorMode === "flicker") bus.setInterior("on"); }, 900); },
    () => Sound.sfx("siren"),
    () => {
      // someone standing on the sidewalk ahead
      if (watcher) return;
      const d0 = drive.d + 70 + Math.random() * 40;
      const side = Math.random() < 0.7 ? 6.4 : -6.4;
      watcher = { d: d0, p: new Person(scene, "drowned", { ghost: true }).placeAt(route.at(d0, side, 0.15), route.heading(d0) + (side > 0 ? Math.PI / 2 : -Math.PI / 2)) };
    },
  ];
  g.tickDread = (dt) => {
    if (watcher) {
      watcher.p.lookAt(camera.getWorldPosition(new THREE.Vector3()));
      if (drive.d > watcher.d - 22 || !dread) { watcher.p.remove(); watcher = null; }
    }
    if (!dread || !drive.moving) return;
    dreadT -= dt;
    if (dreadT > 0) return;
    dreadT = 14 + Math.random() * 20;
    EVENTS[Math.floor(Math.random() * EVENTS.length)]();
  };

  // show a hint and wait for a key press
  g.pressKey = async (code, text) => {
    ui.hint(text);
    await until(() => w.input.hit(code));
    ui.hint(null);
  };

  function clear() {
    waiters.clear();
    g.despawnAll();
    routeOverride = null;
    doorControl = true;
    storm = false;
    g.dread(false);
    nav = null;
    ui.hint(null);
    ui.clearSubtitle();
    ui.clearChoices();
  }

  return {
    g,
    state: s,
    clear,
    reset(saved) {
      const base = { flags: {}, kind: 0, late: 0, warn: 0, lateAtNight: 0, night: 1 };
      const copy = saved ? JSON.parse(JSON.stringify(saved)) : {};
      Object.assign(s, base, copy);
      s.flags = copy.flags || {};
      clear();
    },
    // routes text for the bus display: either the script's override or "next stop"
    routeText(nextName) {
      if (routeOverride) return routeOverride;
      return { text: nextName ? `NEXT: ${nextName.toUpperCase()}` : "ROUTE 9", glitch: false };
    },
    update(dt) {
      g.tickDread(dt);
      // guidance: an arrow over the target, and a distance readout while driving
      bob += dt;
      let text = "";
      let urgent = false;
      if (nav && nav.stop) {
        const left = nav.stop.d - drive.d;
        marker.visible = left > -6;
        marker.position.copy(route.at(nav.stop.d - 6, 2.3, 4.6 + Math.sin(bob * 3) * 0.25));
        marker.scale.setScalar(1);
        marker.userData.beam.visible = true;
        if (drive.inZone(nav.stop.d)) {
          text = drive.speed > 0.35 ? "Stop here  ·  brake  [S]" : "";
          urgent = drive.speed > 0.35;
        } else if (left > 70) {
          text = `Next stop: ${nav.stop.name}  ·  ${Math.round(left)} m`;
        } else if (left > 0) {
          text = `${nav.stop.name}  ·  slow down, pull into the yellow box`;
          urgent = drive.speed > 9;
        }
      } else if (nav && (nav.mesh || nav.point)) {
        const p = nav.mesh ? nav.mesh.getWorldPosition(new THREE.Vector3()) : nav.point;
        marker.visible = true;
        marker.position.set(p.x, p.y + 0.75 + Math.sin(bob * 3) * 0.08, p.z);
        marker.scale.setScalar(0.35);
        marker.userData.beam.visible = false;
      } else {
        marker.visible = false;
      }
      // sitting still with nothing to do? point the way
      const idleNow = !nav && player.mode === "seat" && !player.state.locked && drive.state.control === "player" && !bus.doorsOpen && drive.speed < 0.3 && !document.getElementById("hint").classList.contains("on") && !document.querySelector("#choices .choice");
      idle = idleNow ? idle + dt : 0;
      if (idle > 6) {
        const ahead = Object.entries(STOPS).map(([n, d]) => ({ n, d })).filter((x) => x.d > drive.d + 6).sort((a, b) => a.d - b.d)[0];
        text = ahead ? `Keep driving  ·  next stop: ${ahead.n}` : "Keep driving";
      }
      if (text !== navText) {
        navText = text;
        navEl.textContent = text;
        navEl.classList.toggle("on", !!text);
      }
      navEl.classList.toggle("urgent", urgent);
      waiters.forEach((wt) => {
        wt.left -= dt;
        if (wt.test(dt) || wt.left <= 0) {
          waiters.delete(wt);
          wt.done();
        }
      });
      if (storm) {
        stormT -= dt;
        if (stormT <= 0) {
          stormT = 7 + Math.random() * 10;
          w.lightning();
          setTimeout(() => Sound.sfx("thunder"), 400 + Math.random() * 1200);
        }
      }
    },
  };
}
