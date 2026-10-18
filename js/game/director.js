// The director runs the story scripts (js/story/night*.js). Scripts are async
// functions that get `g`, a small toolbox: say lines, wait for stops, move
// people, change the lights, scare the player.
import * as THREE from "three";
import { ui } from "../core/ui.js";
import { Sound } from "../audio.js";
import { CAST, spoken, lineId } from "../story/cast.js";
import { Person } from "../world/people.js";
import { makeStoryProp } from "../world/storyProps.js";
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
  const s = { flags: {}, kind: 0, late: 0, warn: 0, lateAtNight: 0, night: 1, waiting: "", unheard: [] };

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

  // anyone standing or sitting in the bus counts as on it
  function onBus(p) {
    for (let o = p.root.parent; o; o = o.parent) if (o === bus.group) return true;
    return false;
  }
  // a voice is only heard when whoever's talking is close: drive away from someone at a stop and they're
  // gone mid-sentence. Thoughts, the radio, the phone and anyone on the bus are always heard.
  const HEAR = 22;
  const earA = new THREE.Vector3();
  const earB = new THREE.Vector3();
  function outOfEarshot(who) {
    const c = CAST[who];
    if (who === "you" || !c || c.fx === "radio" || c.fx === "phone") return false;
    const a = actors.get(who);
    if (!a || !a.root.parent || !a.root.visible || onBus(a)) return false;
    return a.root.getWorldPosition(earA).distanceTo(camera.getWorldPosition(earB)) > HEAR;
  }

  let boardings = 0;                   // how many people have got on so far (scenes at a stop look at this)

  // things people hand you, and where they end up: on the dash in front of you, or in your hand on foot
  const ITEMS = {
    coffee: () => {
      const gr = new THREE.Group();
      gr.add(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.033, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xece8de })));
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.05, 10), new THREE.MeshLambertMaterial({ color: 0x8a6440 }));
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 10), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
      lid.position.y = 0.066;
      gr.add(sleeve, lid);
      return gr;
    },
    soup: () => {
      const gr = new THREE.Group();
      gr.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.09, 12), new THREE.MeshLambertMaterial({ color: 0xf2f0ea })));
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.012, 12), new THREE.MeshLambertMaterial({ color: 0xd6d2c8 }));
      lid.position.y = 0.05;
      gr.add(lid);
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.17), new THREE.MeshLambertMaterial({ color: 0xb8ad8a }));
      bag.position.y = -0.055;
      gr.add(bag);
      return gr;
    },
    letter: () => {
      const gr = new THREE.Group();
      gr.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.004, 0.1), new THREE.MeshLambertMaterial({ color: 0xe9e1cc })));
      const stamp = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.005, 0.03), new THREE.MeshLambertMaterial({ color: 0x9a3a2a }));
      stamp.position.set(0.06, 0.001, -0.03);
      gr.add(stamp);
      return gr;
    },
    badge: () => {
      const gr = new THREE.Group();
      gr.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.008), new THREE.MeshLambertMaterial({ color: 0xb8913a, emissive: 0x2a1e08 })));
      return gr;
    },
  };
  const DASH_SPOT = { coffee: new THREE.Vector3(0.18, 1.45, 5.72), soup: new THREE.Vector3(-0.5, 1.44, 5.82), badge: new THREE.Vector3(1.1, 1.425, 5.6), letter: new THREE.Vector3(0.45, 1.395, 5.62) };
  let held = null;                     // what you're holding on foot
  const handed = [];                   // everything you've been given tonight (cleared each night)
  const storyProps = [];               // things the story talks about, put where it says (cleared each night)

  let speech = Promise.resolve();
  let cutLine = null;                  // ends the line that's playing now (g.interrupt)
  async function speak(who, text, { keep = false, after = 260 } = {}) {
    s.waiting = `line (${who})`;
    if (outOfEarshot(who)) { s.unheard.push(`${who}: ${text}`); return; }
    const c = CAST[who];
    ui.subtitle(nameOf(who), c.color, text);
    const cut = new Promise((r) => { cutLine = () => r("cut"); });
    let over = false;
    until(() => over || outOfEarshot(who)).then(() => { if (!over) { s.unheard.push(`${who} (cut off): ${text}`); g.interrupt(); } });
    try {
      return await speakOut(who, text, c, cut, keep, after);
    } finally {
      over = true;
    }
  }
  async function speakOut(who, text, c, cut, keep, after) {
    // a line can never hold up the story: whatever happens to its audio, it ends in a bounded time
    const cap = new Promise((r) => setTimeout(() => r("cap"), 9000 + text.length * 110));
    let played = await Promise.race([Sound.voice(lineId(who, text), { fx: c.fx, at: positionFor(who) }), cap, cut]);
    if (!played) played = await Promise.race([g.wait(Math.max(1500, text.length * 60 + 500)), cut]);
    cutLine = null;
    if (played === "cut") return;
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
    caption(kicker, text) { ui.caption(kicker, text); },
    // whoever is talking stops, mid-word
    interrupt() {
      Sound.stopVoices();
      if (cutLine) cutLine();
      ui.clearSubtitle();
    },
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
    // (at: a distance along the road, for someone flagging the bus down where there's no stop)
    async arrive(name, { hint = true, at = null } = {}) {
      s.waiting = "arrive " + name;
      const d = at !== null ? at : name === "???" ? props.mystery.d : STOPS[name];
      if (hint) nav = { stop: { d, name: name === "???" ? "???" : name } };
      drive.dockAt(d);
      await until(() => drive.stoppedNear(d) || drive.passed(d));
      drive.dockAt(null);
      if (nav && nav.stop) nav = null;
      return drive.stoppedNear(d);
    },
    get navTarget() { return nav; },
    // point the arrow at a place on foot (cleared with navTo(null))
    navTo(point) { nav = point ? { point: point.clone() } : null; },
    // a scene at a stop with someone outside the doors. Close the doors and drive off in the middle of it
    // and the scene is over: whoever's talking stops, whoever's walking stops where they are, the
    // choices go away, and the story carries on from after the scene. Returns true if it played out.
    async atStop(scene) {
      const startD = drive.d;
      let alive = true;
      let finished = false;
      const gone = () => { throw new Error("drove off"); };
      const sg = new Proxy(g, {
        get(target, key) {
          if (!alive) gone();
          const v = target[key];
          if (typeof v !== "function") return v;
          return (...args) => {
            const r = v.apply(target, args);
            // once you have driven off, nothing the scene was waiting on ever comes back to it
            return r && typeof r.then === "function" ? r.then((x) => (alive ? x : new Promise(() => {}))) : r;
          };
        },
      });
      const someoneOutside = () => [...actors.values()].some((p) => p.root.visible && !onBus(p) && !p.leaving
        && p.root.getWorldPosition(earA).distanceTo(bus.group.localToWorld(earB.copy(bus.boardPath[0]))) < 25);
      // driving off ends the scene while someone's still outside, or before anyone has got on
      const boarded = boardings;
      const run = scene(sg);
      const left = until(() => finished || (drive.state.control === "player" && !bus.doorsOpen && drive.moving && drive.d > startD + 1.5
        && (someoneOutside() || boardings === boarded)));
      const outcome = await Promise.race([run.then(() => "done", (err) => ({ err })), left.then(() => (finished ? "done" : "left"))]);
      finished = true;
      if (outcome === "done") return true;
      if (outcome.err) {
        if (alive) throw outcome.err;
        return false;
      }
      alive = false;
      g.interrupt();
      ui.cancelChoices();
      ui.hint(null);
      ui.paper(null);
      for (const p of actors.values()) if (!onBus(p)) p.halt();
      return false;
    },
    // is someone on the steps or in the doorway? (the doors won't close on them)
    someoneInDoorway() {
      return [...actors.values()].some((p) => {
        if (!p.root.visible) return false;
        const at = bus.group.worldToLocal(p.root.getWorldPosition(earA));
        return at.x < -0.3 && at.x > -1.6 && at.z > 3.4 && at.z < 5.9 && Math.abs(at.y) < 1.2;
      });
    },
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
    // the bus pulls in at a stop by itself: full speed, then the brakes, door at the shelter. Resolves when it's in.
    async autoStop(stopD, { brake } = {}) {
      s.waiting = "pulling in by itself";
      drive.release();
      drive.dockAt(stopD, { force: true, brake });
      await until(() => (drive.state.dock && drive.state.dock.done) || !drive.state.dock, 40000);
      drive.dockAt(null);
      drive.park();                        // and it stays put until the story lets you go (g.release)
    },
    // ...and the moment it starts braking
    braking() { return until(() => !drive.state.dock || drive.state.dock.braking || drive.state.dock.done, 40000); },
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
      boardings++;
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
      p.leaving = true;
      if (to) {
        // they walk off on their own; if the bus pulls away first, the story doesn't wait for them
        const walked = p.walk([to], { speed, parent: scene }).then(() => { if (vanish && actors.get(key) === p) g.despawn(key); });
        await Promise.race([walked, until(() => drive.moving)]);
      } else if (vanish) g.despawn(key);
    },
    // someone hands you something: they come up close (onto the bottom step, if you're in your seat),
    // hold it out, and you take it. In the bus it goes on the dash; on foot you hold it.
    async handOver(key, kind, { speed = 1.4 } = {}) {
      const p = actors.get(key);
      if (!p || !ITEMS[kind]) return;
      s.waiting = `${key} handing you ${kind}`;
      const item = ITEMS[kind]();
      p.rightHand.add(item);
      item.position.set(0, -0.06, 0.07);
      const me = camera.getWorldPosition(new THREE.Vector3());
      if (player.mode === "seat") {
        if (!onBus(p)) await p.walk([bus.boardPath[0], bus.boardPath[1]], { speed: 1.3, parent: bus.group, ground: bus.groundAt });
        const local = bus.group.worldToLocal(me.clone());
        p.root.rotation.y = Math.atan2(local.x - p.root.position.x, local.z - p.root.position.z);
      } else {
        const st = player.state;
        const to = new THREE.Vector3(st.pos.x - Math.sin(st.yaw) * 0.85, 0, st.pos.z - Math.cos(st.yaw) * 0.85);
        const from = p.root.getWorldPosition(new THREE.Vector3()).setY(0);
        if (from.distanceTo(to) > 0.3) await p.walk([to.clone().setY(p.root.position.y)], { speed, parent: scene });
        p.root.rotation.y = Math.atan2(me.x - to.x, me.z - to.z);
      }
      p.lookAt(me);
      p.reachOut(true);
      await g.wait(1000);
      // you take it: it comes across to you
      const start = item.getWorldPosition(new THREE.Vector3());
      scene.attach(item);
      const onFoot = player.mode !== "seat";
      const end = () => (onFoot
        ? camera.localToWorld(new THREE.Vector3(0.2, -0.24, -0.42))
        : bus.group.localToWorld(DASH_SPOT[kind].clone()));
      let t = 0;
      await until((dt) => {
        t = Math.min(1, t + dt / 0.55);
        item.position.lerpVectors(start, end(), t * t * (3 - 2 * t));
        return t >= 1;
      });
      if (onFoot) {
        camera.attach(item);
        if (held) held.removeFromParent();
        held = item;
      } else {
        bus.group.attach(item);
        item.position.copy(DASH_SPOT[kind]);
        item.rotation.set(0, Math.random() * 0.6 - 0.3, 0);
      }
      Sound.sfx("click");
      p.reachOut(false);
      p.lookAt(null);
      handed.push(item);
    },
    // put a thing where the story says it is: at a stop's shelter ({ stop, at }), on a bus seat ({ seat }),
    // or anywhere in the bus ({ bus })
    prop(kind, where) {
      const p = makeStoryProp(kind);
      if (where.stop) {
        const shelter = props.stops[where.stop].group;
        shelter.add(p);
        p.position.set(...where.at);
      } else if (where.at) {
        scene.add(p);
        p.position.copy(where.at);
        p.rotation.y = where.yaw || 0;
      } else if (where.seat) {
        bus.group.add(p);
        const s = bus.seatSlots[where.seat];
        p.position.set(s.x, 0.895, s.z + 0.05);
      } else {
        bus.group.add(p);
        p.position.set(...where.bus);
        if (where.rot) p.rotation.set(...where.rot);
      }
      p.userData.t0 = performance.now();
      storyProps.push(p);
      return p;
    },
    // anything the story builds itself, out in the world for tonight (taken away at the end of the night)
    place(obj, at, yaw = 0) {
      scene.add(obj);
      obj.position.copy(at);
      obj.rotation.y = yaw;
      obj.userData.t0 = performance.now();
      storyProps.push(obj);
      return obj;
    },
    // the drowned don't walk off. They're just gone when you look again.
    vanish(key) { g.despawn(key); },

    // ---------- look and feel ----------
    mood(m) { Sound.mood(m); },
    amb(levels) { Sound.ambience(levels); },
    sfx(name, ...args) { Sound.sfx(name, ...args); },
    sfxAt(name, at, { gain = 0.6, range = 70, muffle = null } = {}, ...args) {
      const from = camera.getWorldPosition(new THREE.Vector3());
      const dist = at.distanceTo(from);
      if (dist > range) return;
      const local = camera.worldToLocal(at.clone());
      const pan = THREE.MathUtils.clamp(local.x / Math.max(1, dist), -1, 1) * 0.8;
      Sound.sfxAt(name, { gain: gain * (1 - dist / range) ** 1.4, pan, muffle: muffle ?? 600 + 3400 * (1 - dist / range) }, ...args);
    },
    lamps(on) { w.city.setLampsOn(on); },
    // no other cars on the road for a while
    holdTraffic(seconds) { w.traffic.hold(seconds); },
    // the streetlights, one at a time: { d, side, ... } (out: dark, whatever else is going on)
    get streetlights() { return w.city.lamps; },
    lampOut(lamp, out) { w.city.setLampOut(lamp, out); },
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
    player.lookAtSoon(() => bus.group.localToWorld(new THREE.Vector3(0.3, 2.0, 6)));   // you look up when it moves (the point rides with the bus)
    Sound.sfx("shriek");
    const land = bus.group.localToWorld(bus.windshieldLanding.clone());
    const dist = shade.root.getWorldPosition(new THREE.Vector3()).distanceTo(land);
    await shade.leap(bus.group, bus.windshieldLanding, THREE.MathUtils.clamp(dist / 32, 0.3, 0.6));
    await hitGlass({ hold, crack, keepParked });
  };
  // out of the dark beside you: it hits the window right next to your head, holds on, and is gone
  g.shadeWindow = async ({ hold = 1600 } = {}) => {
    w.traffic.hold(30);
    s.waiting = "scare window";
    g.interrupt();
    if (!settings.scares) {
      bus.setInterior("flicker");
      Sound.sfx("lightsout");
      await g.wait(500);
      bus.setInterior("on");
      Sound.sfx("heartbeat", 3, 96);
      return;
    }
    const from = new THREE.Vector3(3.8, 0.3, 8.5);         // out in the dark, ahead of you and off to the side
    const land = new THREE.Vector3(1.34, 0.32, 4.85);      // its feet; its body flat on the glass beside your face
    shade.standIn(bus.group, from, new THREE.Vector3(0.7, 1.7, 4.8), "crouch");
    player.lookAtSoon(() => bus.group.localToWorld(new THREE.Vector3(1.3, 1.9, 4.9)));   // your head snaps round to it
    Sound.sfx("shriek");
    await shade.leap(bus.group, land, 0.2, { from, arc: 0.5, out: 0, faceY: -Math.PI / 2 });
    await hitGlass({ hold, crack: true, keepParked: true, smudge: false });
    bus.setHands("ash");                                    // where it held on
  };
  // a flash of lightning over an empty road
  g.flash = () => { w.lightning(); setTimeout(() => Sound.sfx("thunder"), 300 + Math.random() * 600); };
  // the windshield fogs up from the inside, right in front of you, and a finger writes in it, one letter at
  // a time. Resolves once the word is written; the fog clears by itself a while later.
  const LETTERS = {
    S: [[[0.86, 0.14], [0.5, 0.03], [0.15, 0.16], [0.2, 0.42], [0.8, 0.58], [0.86, 0.84], [0.5, 0.98], [0.12, 0.86]]],
    T: [[[0.04, 0.06], [0.96, 0.06]], [[0.5, 0.06], [0.5, 0.98]]],
    O: [Array.from({ length: 17 }, (_, i) => [0.5 + Math.sin((i / 16) * Math.PI * 2) * 0.42, 0.52 - Math.cos((i / 16) * Math.PI * 2) * 0.46])],
    P: [[[0.16, 0.98], [0.16, 0.05], [0.62, 0.05], [0.86, 0.18], [0.86, 0.38], [0.62, 0.5], [0.16, 0.5]]],
  };
  g.fogWrite = async (word, { letterMs = 700 } = {}) => {
    s.waiting = "writing on the glass";
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 192;
    const x = c.getContext("2d");
    // breath on cold glass: grey, thin at the top, thicker at the bottom, no hard edges
    const grad = x.createLinearGradient(0, 0, 0, 192);
    grad.addColorStop(0, "rgba(150,160,168,.35)");
    grad.addColorStop(1, "rgba(165,173,180,.7)");
    x.fillStyle = grad;
    x.fillRect(0, 0, 256, 192);
    for (let i = 0; i < 420; i++) { x.fillStyle = `rgba(200,208,214,${0.08 + Math.random() * 0.22})`; x.fillRect(Math.random() * 256, Math.random() * 192, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    x.globalCompositeOperation = "destination-in";
    const edge = x.createRadialGradient(128, 104, 30, 128, 104, 150);
    edge.addColorStop(0, "rgba(0,0,0,1)");
    edge.addColorStop(0.7, "rgba(0,0,0,.85)");
    edge.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = edge;
    x.fillRect(0, 0, 256, 192);
    x.globalCompositeOperation = "source-over";
    const t = new THREE.CanvasTexture(c);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.86), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false }));
    glass.position.set(0.62, 2.02, 5.962);
    glass.rotation.y = Math.PI;                       // facing you
    bus.group.add(glass);
    storyProps.push(glass);
    let k = 0;
    await until((dt) => { k = Math.min(1, k + dt / 2.6); glass.material.opacity = k * 0.75; return k >= 1; });
    // the letters are wiped clear of the fog
    x.globalCompositeOperation = "destination-out";
    x.strokeStyle = "#000";
    x.lineWidth = 10;
    x.lineCap = "round";
    x.lineJoin = "round";
    const W = 48, Hh = 92, gap = 11;
    const left = (256 - (word.length * W + (word.length - 1) * gap)) / 2;
    const bottoms = [];
    for (let i = 0; i < word.length; i++) {
      const strokes = (LETTERS[word[i]] || []).map((st) => st.map(([u, v]) => [left + i * (W + gap) + u * W, 42 + v * Hh]));
      const len = strokes.reduce((a, st) => a + st.slice(1).reduce((b, p, j) => b + Math.hypot(p[0] - st[j][0], p[1] - st[j][1]), 0), 0);
      Sound.sfx("squeak", 1);
      let drawn = 0;
      await until((dt) => {
        drawn = Math.min(len, drawn + (len * dt * 1000) / letterMs);
        x.beginPath();
        let left2 = drawn;
        for (const st of strokes) {
          x.moveTo(st[0][0], st[0][1]);
          for (let j = 1; j < st.length && left2 > 0; j++) {
            const seg = Math.hypot(st[j][0] - st[j - 1][0], st[j][1] - st[j - 1][1]);
            const f = Math.min(1, left2 / seg);
            x.lineTo(st[j - 1][0] + (st[j][0] - st[j - 1][0]) * f, st[j - 1][1] + (st[j][1] - st[j - 1][1]) * f);
            left2 -= seg;
          }
        }
        x.stroke();
        t.needsUpdate = true;
        return drawn >= len;
      });
      bottoms.push(left + i * (W + gap) + W * 0.5);
      await g.wait(180);
    }
    // the wet runs down from the letters
    x.lineWidth = 3;
    let d = 0;
    await until((dt) => {
      d = Math.min(1, d + dt / 1.6);
      x.beginPath();
      bottoms.forEach((bx, i) => { x.moveTo(bx + (i % 2 ? 9 : -7), 130); x.lineTo(bx + (i % 2 ? 9 : -7), 130 + d * 50); });
      x.stroke();
      t.needsUpdate = true;
      return d >= 1;
    });
    // ...and some time later, it fades off the glass
    (async () => {
      await g.wait(6000);
      let f = 1;
      await until((dt) => { f = Math.max(0, f - dt / 4); glass.material.opacity = f * 0.75; return f <= 0; });
      glass.removeFromParent();
    })();
  };
  // the camera leaves your seat: out the door, up at Room 4B's window on the fourth floor of St. Agnes, and
  // back, while you say what you see. pose: what the figure in the window is doing
  g.peekWindow = async (pose, line, { dim = false } = {}) => {
    s.waiting = "looking up at 4B";
    const H = places.hospital;
    H.setWindowFigure(pose, dim);
    const win = H.windowOutside;
    const cam = camera.getWorldPosition(new THREE.Vector3());
    const q0 = camera.getWorldQuaternion(new THREE.Quaternion());
    const out = bus.group.localToWorld(new THREE.Vector3(-3.6, 1.45, 2.2));     // on the sidewalk by the doors
    const look = new THREE.Matrix4().lookAt(out, win, new THREE.Vector3(0, 1, 0));
    const q1 = new THREE.Quaternion().setFromRotationMatrix(look);
    player.fixed(scene, cam, new THREE.Euler());
    camera.quaternion.copy(q0);
    const tween = (a, b, qa, qb, seconds) => {
      let t = 0;
      return until((dt) => {
        t = Math.min(1, t + dt / seconds);
        const e = t * t * (3 - 2 * t);
        camera.position.lerpVectors(a, b, e);
        camera.quaternion.slerpQuaternions(qa, qb, Math.min(1, e * 1.3));
        return t >= 1;
      });
    };
    const going = tween(cam, out, q0, q1, 2.2);
    await g.wait(700);
    const said = g.think(line);
    await going;
    await said;
    await g.wait(700);
    const back = bus.group.localToWorld(bus.driverEye.clone());
    await tween(out, back, q1, q0, 1.6);
    g.sitInBus();
  };
  // no warning at all: it was on the roof, and it comes down over the windshield
  g.shadeDrop = async ({ hold = 1500, keepParked = false } = {}) => {
    w.traffic.hold(30);
    s.waiting = "scare drop";
    g.interrupt();
    if (!settings.scares) {
      bus.setInterior("flicker");
      Sound.sfx("lightsout");
      await g.wait(500);
      bus.setInterior("on");
      Sound.sfx("heartbeat", 3, 96);
      return;
    }
    const roof = new THREE.Vector3(0.3, 3.25, 5.3);
    shade.standIn(bus.group, roof, new THREE.Vector3(0.3, 3.25, 12), "crouch");
    // if you're not already looking out the front, you look up at it (a point on the glass, which travels with the bus)
    if (!g.gazing(bus.group.localToWorld(new THREE.Vector3(0.5, 1.8, 7)), 40)) player.lookAtSoon(() => bus.group.localToWorld(new THREE.Vector3(0.4, 1.75, 6.1)));
    Sound.sfx("shriek");
    await shade.leap(bus.group, bus.windshieldLanding, 0.24, { from: roof, arc: 0, out: 0.7 });
    await hitGlass({ hold, crack: true, keepParked });
  };
  async function hitGlass({ hold, crack, keepParked, smudge = true }) {
    Sound.sfx("slam");
    if (crack) Sound.sfx("crack");
    Sound.sfx("sting");
    Sound.sfx("scream", 1.7);
    player.shake(2.6);
    bus.setInterior("flicker");
    if (smudge) bus.setSmudge(crack ? 2 : 1);
    document.body.classList.add("scare-flash");
    setTimeout(() => document.body.classList.remove("scare-flash"), 110);
    const wasControl = drive.state.control;
    if (wasControl === "player") drive.park();       // you stand on the brake without meaning to
    Sound.sfx("brake");
    // it doesn't just hang there. It beats on the glass, twice, and the crack spreads
    await g.wait(Math.min(650, hold * 0.4));
    Sound.sfx("bang");
    player.shake(1.8);
    await g.wait(330);
    Sound.sfx("bang");
    Sound.sfx("crack");
    player.shake(2.2);
    if (smudge) bus.setSmudge(2);
    Sound.sfx("whisper");
    await g.wait(Math.max(300, hold - 980));
    bus.setInterior("off");
    Sound.sfx("lightsout");
    await g.wait(550);
    shade.hide();
    bus.setInterior("on");
    if (wasControl === "player" && !keepParked) drive.release();   // (or the script lets go when it is ready)
  }

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
    drive.dockAt(null);
    handed.forEach((it) => it.removeFromParent());
    handed.length = 0;
    storyProps.forEach((it) => it.removeFromParent());
    storyProps.length = 0;
    bus.setHands(null);
    held = null;
    s.unheard = [];
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
    ui.caption(null);
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
      for (const p of storyProps) if (p.userData.update) p.userData.update((performance.now() - p.userData.t0) / 1000);
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
        const dock = drive.state.dock;
        if (drive.docking) {
          text = dock.braking ? `Stopping: ${nav.stop.name}` : `Pulling in: ${nav.stop.name}  ·  press W to drive past`;
        } else if (dock && dock.skipped) {
          text = left > -7 ? `Driving past ${nav.stop.name}` : "";
        } else if (drive.inZone(nav.stop.d)) {
          text = drive.speed > 0.35 ? "Stop here  ·  brake  [S]" : "";
          urgent = drive.speed > 0.35;
        } else if (left > 60) {
          text = `Next stop: ${nav.stop.name}  ·  ${Math.round(left)} m`;
        } else if (left > 0) {
          text = `${nav.stop.name}  ·  brake  [S]`;
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
