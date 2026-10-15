// The director runs the story scripts (js/story/night*.js). Scripts are async
// functions that get `g`, a small toolbox: say lines, wait for stops, move
// people, change the lights, scare the player.
import * as THREE from "three";
import { ui } from "../core/ui.js";
import { Sound } from "../audio.js";
import { CAST, spoken, lineId } from "../story/cast.js";
import { Person } from "../world/people.js";
import { route, STOPS } from "../world/route.js";

export function createDirector(w) {
  const { scene, camera, player, drive, bus, props, places, settings } = w;
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
      if (hint) ui.hint(`Drive to ${name === "???" ? "the next stop" : name}`);
      await until(() => drive.stoppedNear(d) || drive.passed(d));
      ui.hint(null);
      return drive.stoppedNear(d);
    },
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
    async scare(kind = "face") {
      if (!settings.scares) {
        Sound.sfx("heartbeat", 3, 96);
        await g.wait(700);
        return;
      }
      Sound.sfx("sting");
      player.shake(1.6);
      await ui.scare(kind);
    },
    // a drowned face right in front of you, in the world
    async faceScare(look = "drowned", dist = 0.55) {
      if (!settings.scares) { Sound.sfx("heartbeat", 3, 96); await g.wait(700); return; }
      const p = new Person(scene, look, { ghost: true });
      const pos = camera.getWorldPosition(new THREE.Vector3());
      const dir = camera.getWorldDirection(new THREE.Vector3());
      p.placeAt(pos.clone().addScaledVector(dir, dist).setY(pos.y - p.look.height + 0.12), Math.atan2(-dir.x, -dir.z));
      Sound.sfx("sting");
      player.shake(1.8);
      await g.wait(650);
      p.remove();
    },
    fade(to, ms = 1200, white = false) { return ui.fade(to, ms, white); },
    card(opts) { return ui.card(opts); },
    interact(mesh, label) {
      return new Promise((done) => {
        const entry = player.addInteract({ mesh, label: () => label, use: () => { player.removeInteract(entry); done(); } });
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
    await until(() => drive.d > d0 - 8 || (drive.speed < 0.3 && drive.d > d0 - 45));
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
  // random whispers, breathing and knocks while the bus is moving
  let dread = false;
  let dreadT = 20;
  g.dread = (on) => { dread = on; dreadT = 15 + Math.random() * 15; };
  g.tickDread = (dt) => {
    if (!dread || !drive.moving) return;
    dreadT -= dt;
    if (dreadT > 0) return;
    dreadT = 22 + Math.random() * 28;
    const pick = ["whisper", "breath", "drip", "knock", "whisper"][Math.floor(Math.random() * 5)];
    Sound.sfx(pick, ...(pick === "knock" ? [2] : []));
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
