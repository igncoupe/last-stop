// The director runs the story scripts (js/story/night*.js). Scripts are async
// functions that get `g`, a small toolbox: say lines, wait for stops, move
// people, change the lights, scare the player.
import * as THREE from "three";
import { ui } from "../core/ui.js";
import { Sound } from "../audio.js";
import { CAST, spoken, lineId } from "../story/cast.js";
import { Person } from "../world/people.js";
import { route, STOPS, LANE } from "../world/route.js";

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
  const s = { flags: {}, kind: 0, late: 0, warn: 0, lateAtNight: 0, night: 1, waiting: "" };

  // who is sitting where, so nobody sits on anybody: a taken seat sends you to the nearest free one
  const seated = new Map();            // seat name -> actor key
  function freeSeatOf(key) { for (const [seat, k] of seated) if (k === key) seated.delete(seat); }
  function takeSeat(key, want) {
    freeSeatOf(key);
    const taken = (seat) => seated.has(seat) && actors.has(seated.get(seat));
    let seat = want;
    if (taken(want)) {
      const at = bus.seatSlots[want];
      seat = Object.keys(bus.seatSlots).filter((n) => !taken(n))
        .sort((a, b) => bus.seatSlots[a].distanceTo(at) - bus.seatSlots[b].distanceTo(at))[0] || want;
    }
    seated.set(seat, key);
    return seat;
  }

  let speech = Promise.resolve();
  async function speak(who, text, { keep = false, after = 260 } = {}) {
    s.waiting = `line (${who})`;
    const c = CAST[who];
    ui.subtitle(nameOf(who), c.color, text);
    // a line can never hold up the story: whatever happens to its audio, it ends in a bounded time
    const cap = new Promise((r) => setTimeout(() => r("cap"), 9000 + text.length * 110));
    const played = await Promise.race([Sound.voice(lineId(who, text), { fx: c.fx, at: positionFor(who) }), cap]);
    if (!played) await g.wait(Math.max(1500, text.length * 60 + 500));
    if (!keep) ui.clearSubtitle();
    if (after) await g.wait(after);
  }

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
      s.waiting = "until " + String(test).replace(/\s+/g, " ").slice(0, 90);
      let t = 0;
      return until((dt) => {
        t += dt;
        if (timeoutMs && t * 1000 >= timeoutMs) return true;
        return test();
      }).then(() => !!test());
    },

    // ---------- talking ----------
    // lines never talk over each other: if someone is already speaking, this one waits its turn
    say(who, text, opts = {}) {
      const turn = speech.then(() => speak(who, text, opts));
      speech = turn.catch(() => {});
      return turn;
    },
    think(text, opts) { return g.say("you", text, opts); },
    // hold a document up close (null puts it away)
    paper(doc) { ui.paper(doc); },
    // read a document: it stays up while the lines are thought out loud
    async read(doc, lines) {
      ui.paper(doc);
      await g.wait(500);
      for (const line of lines) await g.think(line);
      ui.paper(null);
      await g.wait(300);
    },
    // dialogue options; the one you pick is said out loud (unless it's an [action])
    async choose(options, { silent = false } = {}) {
      ui.clearSubtitle();
      const i = await ui.choices(options);
      const line = spoken(options[i]);
      if (line && !silent) await g.say("you", line);
      return i;
    },
    // show the objective; "look at X" hints also glide the view there
    hint(text) {
      ui.hint(text);
      const auto = text && autoLook.find(([re]) => re.test(text));
      if (auto) player.lookAtSoon(auto[1]);
    },

    // ---------- the bus ----------
    // wait until the bus stops at a stop (true) or drives past it (false)
    async arrive(name, { hint = true } = {}) {
      s.waiting = "arrive " + name;
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
      s.waiting = "doors " + (open ? "open" : "closed");
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
    departed() {
      s.waiting = "drive off";
      return until(() => drive.moving || drive.d >= drive.state.endD - 1.5);
    },
    auto(speed, stopAtD = null) { drive.auto(speed, stopAtD); },
    release() { drive.release(); },
    park() { drive.park(); },
    get d() { return drive.d; },
    route(text, glitch = false) { routeOverride = text ? { text, glitch } : null; },
    radio(text) { bus.setRadio(text); },
    interior(mode) { bus.setInterior(mode); },
    visor(down) { bus.setVisor(down); },
    mystery(d) { props.mystery.place(d); },
    // the stop with no name is never behind you: if you've passed it, it moves ahead
    mysteryAhead(min = 100) {
      if (props.mystery.d === null || props.mystery.d - drive.d >= min) return props.mystery.d;
      let d = drive.d + 170;
      const clash = (x) => Object.values(STOPS).some((sd) => Math.abs(sd - x) < 45);
      while (clash(d)) d += 20;
      d = Math.min(d, route.length - 110);
      d = Math.max(d, drive.d + 70);          // and never behind you, however late in the run it is
      d = Math.min(d, route.length - 45);     // ...and never off the end of the road
      props.mystery.place(d);
      return d;
    },
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
      freeSeatOf(key);
    },
    despawnAll() { [...actors.keys()].forEach((k) => g.despawn(k)); },
    // sit someone straight down in a bus seat
    seat(key, seatName) {
      const p = actors.get(key);
      p.sit(bus.group, bus.seatSlots[takeSeat(key, seatName)], 0);
      return p;
    },
    // walk from where they are, up the steps, pay, and sit down
    async board(key, seatName, speed = 1.4) {
      s.waiting = `${key} boarding`;
      const p = actors.get(key);
      const outside = bus.group.localToWorld(bus.boardPath[0].clone());
      const step = bus.group.localToWorld(bus.boardPath[1].clone());
      const at = p.root.getWorldPosition(new THREE.Vector3());
      // someone already up on the steps (they came to the door to ask) just carries on in
      if (at.distanceTo(step) >= at.distanceTo(outside)) await p.walk([outside], { speed, parent: scene });
      const seatPos = bus.seatSlots[takeSeat(key, seatName)];
      await p.walk([bus.boardPath[1], bus.boardPath[2]], { speed, parent: bus.group, ground: bus.groundAt });
      Sound.sfx("coin");
      // the last step is up to the seat's own height (seats over the wheels sit on a platform)
      await p.walk([new THREE.Vector3(0, 0.45, seatPos.z + 0.4), new THREE.Vector3(seatPos.x * 0.6, seatPos.y, seatPos.z + 0.1)], { speed, parent: bus.group, ground: bus.groundAt });
      p.sit(bus.group, seatPos, 0);
    },
    // get off the bus and walk somewhere (a world position), then vanish
    async alight(key, to = null, { vanish = true, speed = 1.4 } = {}) {
      s.waiting = `${key} getting off`;
      const p = actors.get(key);
      if (!p) return;
      const z = p.root.position.z;
      freeSeatOf(key);
      p.stand();
      await p.walk([new THREE.Vector3(0, 0.45, z), bus.boardPath[2], bus.boardPath[1], bus.boardPath[0]], { speed, parent: bus.group, ground: bus.groundAt });
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
      s.waiting = "scare " + kind;
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
      Sound.sfx("scream", kind === "hands" ? 1.1 : 1.5);
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
    // wait for the player to press E on something. The promise has cancel().
    interact(mesh, label, { arrow = true } = {}) {
      s.waiting = "press E: " + label;
      if (arrow) nav = { mesh };
      let entry = null;
      const p = new Promise((done) => {
        entry = player.addInteract({
          mesh,
          label: () => label,
          use: () => {
            player.removeInteract(entry);
            if (nav && nav.mesh === mesh) nav = null;
            done();
          },
        });
      });
      p.cancel = () => {
        player.removeInteract(entry);
        if (nav && nav.mesh === mesh) nav = null;
      };
      return p;
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

  const headOf = (key) => () => {
    const a = actors.get(key);
    return a ? a.root.localToWorld(new THREE.Vector3(0, a.look.height - 0.2, 0)) : null;
  };
  // hints that turn your head for you
  const autoLook = [
    [/mirror/i, () => g.mirrorPoint()],
    [/back row|Turn around/i, () => g.backRow()],
    [/at the door/i, () => bus.group.localToWorld(new THREE.Vector3(-1.2, 1.6, 4.6))],
    [/at the shelter/i, headOf("drowned1")],
    [/out the window/i, () => places.hospital.win.getWorldPosition(new THREE.Vector3())],
    [/back to the bed/i, () => places.hospital.bedHead],
  ];

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
  // ---------- the shadow: what's left of Rhee. It watches from stops, it runs, it jumps ----------
  const shade = w.shade;
  const camPos = () => camera.getWorldPosition(new THREE.Vector3());
  g.shade = shade;
  // stand somewhere (facing you, or facing `faceTo`); poses: stand | crouch | bar | point
  g.shadeAt = (pos, poseName = "stand", faceTo = null) => shade.standAt(pos, faceTo || camPos(), poseName);
  g.shadeHide = () => shade.hide();
  g.shadeDissolve = (seconds) => shade.dissolve(seconds);
  // standing in the road ahead, only there for the length of a lightning flash
  g.shadeFlash = async (ahead) => {
    w.traffic.hold(12);
    shade.standAt(route.at(drive.d + 6 + ahead, LANE, 0), camPos());
    w.lightning();
    setTimeout(() => Sound.sfx("thunder"), 300 + Math.random() * 500);
    await g.wait(260);
    shade.hide();
  };
  // it runs along the sidewalk beside the bus, keeping up whatever you do, then cuts across the headlights
  g.shadeRun = async (seconds = 6) => {
    w.traffic.hold(seconds + 10);
    let off = -8;                  // next to the back of the bus
    let lateral = 5.6;
    let t = 0;
    let cut = false;
    let finished = false;
    const prev = route.at(drive.d + off, lateral, 0);
    Sound.sfx("skitter", seconds + 1.2);
    await new Promise((done) => {
      shade.runWith((dt) => {
        t += dt;
        if (t < seconds) off += dt * 2.2;
        else { cut = true; off += dt * 9; lateral = Math.max(LANE - 0.6, lateral - dt * 5.5); }
        if (cut && lateral <= LANE - 0.6 + 1e-3 && !finished) { finished = true; done(); }
        const pos = route.at(drive.d + off, lateral, 0);
        const dx = pos.x - prev.x, dz = pos.z - prev.z;
        const yaw = dx * dx + dz * dz > 1e-6 ? Math.atan2(dx, dz) : route.heading(drive.d);
        prev.copy(pos);
        return { pos, yaw };
      });
    });
    bus.setInterior("flicker");
    Sound.sfx("lightsout");
    await g.wait(260);
    shade.hide();
    bus.setInterior("on");
  };
  // crouched in the road ahead, in the headlights. When you get close it jumps onto the windshield.
  g.shadeLeap = async ({ ahead = 40, hold = 1400, crack = true, keepParked = false } = {}) => {
    w.traffic.hold(30);
    const nose = () => drive.d + 6;
    const d0 = nose() + ahead;
    shade.crouchAt(route.at(d0, LANE, 0), bus.group.localToWorld(new THREE.Vector3(0, 1.6, 6)));
    Sound.sfx("rise", 2.4);
    let still = 0;
    await until((dt) => {
      still = drive.speed < 0.5 ? still + dt : 0;
      return nose() > d0 - 14 || still > 2.5;       // stop, and it comes to you anyway
    }, 25000);
    if (!settings.scares) {
      bus.setInterior("flicker");
      Sound.sfx("lightsout");
      await g.wait(500);
      shade.hide();
      bus.setInterior("on");
      Sound.sfx("heartbeat", 3, 96);
      return;
    }
    player.lookAtSoon(bus.group.localToWorld(new THREE.Vector3(0.3, 2.0, 6)));   // you look up when it moves
    Sound.sfx("shriek");
    const land = bus.group.localToWorld(bus.windshieldLanding.clone());
    const dist = shade.root.getWorldPosition(new THREE.Vector3()).distanceTo(land);
    await shade.leap(bus.group, bus.windshieldLanding, THREE.MathUtils.clamp(dist / 32, 0.3, 0.6));
    Sound.sfx("slam");
    if (crack) Sound.sfx("crack");
    Sound.sfx("sting");
    Sound.sfx("scream", 1.7);
    player.shake(2.6);
    bus.setInterior("flicker");
    bus.setSmudge(crack ? 2 : 1);
    document.body.classList.add("scare-flash");
    setTimeout(() => document.body.classList.remove("scare-flash"), 110);
    const wasControl = drive.state.control;
    if (wasControl === "player") drive.park();       // you stand on the brake without meaning to
    Sound.sfx("brake");
    await g.wait(hold);
    bus.setInterior("off");
    Sound.sfx("lightsout");
    await g.wait(550);
    shade.hide();
    bus.setInterior("on");
    if (wasControl === "player" && !keepParked) drive.release();   // (or the script lets go when it is ready)
  };

  // the shadow in the aisle: only in the mirror, a few rows closer every time you look
  g.shadeCreep = async () => {
    const face = new THREE.Vector3(0.7, 1.7, 4.8);
    shade.mirrorOnly(true);
    for (const [x, z] of [[0, -4.6], [0, -1.6], [0.15, 2.3]]) {
      shade.standIn(bus.group, new THREE.Vector3(x, 0.47, z), face);
      g.hint("Check your mirror");
      await until(() => g.lookingAtMirror(), 14000);
      ui.hint(null);
      Sound.sfx(z > 0 ? "breath" : "drip");
      await g.wait(z > 0 ? 1500 : 2300);
      bus.setInterior("flicker");
      Sound.sfx("lightsout");
      await g.wait(500);
      bus.setInterior("on");
    }
    shade.hide();
    g.hint("Turn around");
    await until(() => g.lookingBack() || g.gazing(bus.group.localToWorld(new THREE.Vector3(0.3, 1.4, 2.6)), 35), 12000);
    ui.hint(null);
    shade.mirrorOnly(false);
  };

  // something walks up the aisle, a little closer every time you check the mirror
  g.creepMirror = async (look = "drowned") => {
    g.spawn("creep", look, { ghost: true, mirrorOnly: true });
    for (const seat of ["B1", "L7", "L4", "L1"]) {
      g.seat("creep", seat);
      g.hint("Check your mirror");
      await until(() => g.lookingAtMirror(), 14000);
      ui.hint(null);
      Sound.sfx(seat === "L1" ? "breath" : "drip");
      await g.wait(seat === "L1" ? 1200 : 2600);
    }
    g.hint("Turn around");
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
  g.pressKey = async (code, text, timeoutMs = 0) => {
    s.waiting = "key: " + text;
    ui.hint(text);
    await until(() => w.input.hit(code), timeoutMs);      // with a timeout, it carries on by itself
    ui.hint(null);
  };

  function clear() {
    waiters.clear();
    speech = Promise.resolve();          // a night that's over doesn't hold up the next one's lines
    seated.clear();
    g.despawnAll();
    routeOverride = null;
    doorControl = true;
    storm = false;
    g.dread(false);
    nav = null;
    ui.hint(null);
    ui.clearSubtitle();
    ui.clearChoices();
    ui.paper(null);
    w.shade.hide();
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
      // (never while someone is talking, a choice is up, or you're at a stop)
      const atAStop = Object.values(STOPS).some((sd) => drive.inZone(sd)) || (props.mystery.d !== null && drive.inZone(props.mystery.d));
      const idleNow = !nav && !atAStop && player.mode === "seat" && !player.state.locked && drive.state.control === "player" && !bus.doorsOpen && drive.speed < 0.3
        && !document.getElementById("hint").classList.contains("on") && !document.querySelector("#choices .choice") && !document.getElementById("subtitle").classList.contains("on");
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
