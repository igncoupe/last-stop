// Other cars on Route 9 at one in the morning. Not many, and not all of them are right:
//   pass     - an ordinary car going the other way
//   dark     - no headlights until it's almost on you, then high beams and the horn
//   swerve   - drifts into your lane flashing its lights, and jerks back at the last second
//   nobody   - creeps past with the dome light on and no one at the wheel
//   watcher  - a pale passenger in the back seat turns its head to follow you
//   shade    - the driver is the shadow, and it watches you go by
//   parked   - stopped on the far side, hazards on, door open, empty. Its horn goes off as you pass.
import * as THREE from "three";
import { mat, glow, box } from "../core/ps1.js";
import { route, LANE, ROAD_HALF, STOPS, nearCorner, roadY } from "./route.js";

const PAINT = [0x2b3442, 0x4a1f1f, 0x8a8370, 0x3a3d40, 0x1f2a22, 0x5a5048, 0x6b6b70];
const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

function radial() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
const glowTex = radial();

function carModel() {
  const g = new THREE.Group();
  const paint = mat({ color: PAINT[Math.floor(Math.random() * PAINT.length)] });
  const dark = mat({ color: 0x0c0d0f });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2229, transparent: true, opacity: 0.42, depthWrite: false });
  put(g, box(1.8, 0.55, 4.3, paint), 0, 0.62, 0);                       // body
  put(g, box(1.78, 0.18, 0.9, paint), 0, 0.98, 1.6);                    // bonnet hump
  put(g, box(1.62, 0.48, 2.0, glass), 0, 1.13, -0.3);                   // cabin glass
  put(g, box(1.68, 0.06, 1.9, paint), 0, 1.4, -0.3);                    // roof
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.06, 0.5, 0.08, paint), sx * 0.8, 1.13, -0.3 + sz * 0.96);   // pillars
  put(g, box(1.84, 0.16, 0.12, dark), 0, 0.4, 2.15);                    // front bumper
  put(g, box(1.84, 0.16, 0.12, dark), 0, 0.4, -2.15);                   // rear bumper
  put(g, box(0.9, 0.16, 0.04, dark), 0, 0.68, 2.16);                    // grille
  for (const sx of [-1, 1]) for (const sz of [-1.35, 1.35]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12).rotateZ(Math.PI / 2), dark), sx * 0.82, 0.33, sz);
  // seats, so an empty driver's seat reads as empty
  const seatMat = mat({ color: 0x24262a });
  for (const [sx, sz] of [[0.42, 0.05], [-0.42, 0.05], [0.42, -0.95], [-0.42, -0.95]]) {
    put(g, box(0.5, 0.12, 0.5, seatMat), sx, 0.88, sz);
    put(g, box(0.5, 0.5, 0.1, seatMat), sx, 1.12, sz - 0.27);
  }
  // lights
  const headOn = glow(0xfff1d0), headOff = mat({ color: 0x2a2a28 });
  const heads = [-0.62, 0.62].map((x) => put(g, box(0.32, 0.14, 0.04, headOn), x, 0.7, 2.17));
  for (const x of [-0.65, 0.65]) put(g, box(0.3, 0.12, 0.04, glow(0x8a0f0c)), x, 0.72, -2.17);
  const hazardMat = glow(0xffa32a);
  const hazards = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) hazards.push(put(g, box(0.1, 0.08, 0.06, hazardMat), sx * 0.85, 0.72, sz * 2.12));
  // headlights: a bright glow at each lamp (it blooms when it's pointed at you), and the light they throw on the road
  const beamMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1d8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Group();
  for (const x of [-0.62, 0.62]) {
    const halo = new THREE.Sprite(beamMat);
    halo.scale.set(1.1, 0.8, 1);
    put(beam, halo, x, 0.7, 2.25);
  }
  g.add(beam);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffe2b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 10), poolMat);
  pool.rotation.x = -Math.PI / 2;
  put(g, pool, 0, 0.04, 7.5);
  // the inside: dome light, a driver, a back-seat passenger, an opening driver's door
  const dome = put(g, box(0.3, 0.03, 0.2, glow(0xfff2c8)), 0, 1.36, -0.2);
  const figureMat = mat({ color: 0x15161a });
  const driver = put(g, new THREE.Group(), 0.42, 0, 0.15);                // the driver sits on the car's left
  put(driver, box(0.45, 0.32, 0.25, figureMat), 0, 1.0, 0);
  const driverHead = put(driver, new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), figureMat), 0, 1.27, 0);
  const passenger = put(g, new THREE.Group(), -0.45, 0, -0.85);
  put(passenger, box(0.42, 0.3, 0.24, mat({ color: 0x3b4044 })), 0, 0.98, 0);
  const paleMat = mat({ color: 0xa7b0ab, emissive: 0x161c1a });
  const paleHead = put(passenger, new THREE.Group(), 0, 1.24, 0);
  put(paleHead, new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), paleMat), 0, 0, 0);
  for (const ex of [-0.04, 0.04]) put(paleHead, new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), new THREE.MeshBasicMaterial({ color: 0x000000 })), ex, 0.02, 0.095);
  const doorPivot = put(g, new THREE.Group(), 0.9, 0, 0.75);
  put(doorPivot, box(0.06, 0.5, 1.05, paint), 0, 0.82, -0.52);
  doorPivot.visible = false;
  return { g, heads, headOn, headOff, hazards, beam, pool, dome, driver, driverHead, passenger, paleHead, figureMat, doorPivot };
}

export function createTraffic(scene, sfx) {
  const VOID = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const cars = [];
  let timer = 12;
  let hold = 0;
  const cam = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  // two shared lights (a fixed number, so nothing recompiles when cars come and go):
  // one inside the nearest car with its dome light on, one thrown ahead of the nearest headlights
  const domeShared = new THREE.PointLight(0xfff2c8, 0, 3.6, 1.5);
  const headShared = new THREE.PointLight(0xffe8c0, 0, 24, 1.4);
  scene.add(domeShared, headShared);

  function setHeadlights(c, on, bright = 1) {
    c.heads.forEach((h) => { h.material = on ? c.headOn : c.headOff; });
    c.beam.visible = on;
    c.pool.visible = on;
    c.beam.children.forEach((h) => h.scale.set(1.1 * bright, 0.8 * bright, 1));
    c.pool.material.opacity = 0.22 * Math.min(bright, 1.6);
  }
  function spawn(mode, busD) {
    const m = carModel();
    const c = { ...m, mode, d: busD + (mode === "parked" ? 125 : 165), lateral: -LANE, speed: 12 + Math.random() * 4, t: 0, passed: false, honked: false, flash: 0 };
    c.passenger.visible = false;
    c.dome.visible = false;
    c.hazards.forEach((h) => { h.visible = false; });
    if (mode === "dark") setHeadlights(c, false);
    if (mode === "nobody") {
      c.driver.visible = false;
      c.dome.visible = true;
      c.speed = 6;
    }
    if (mode === "watcher") { c.passenger.visible = true; c.dome.visible = true; c.speed = 7; }
    if (mode === "shade") {
      c.driver.traverse((o) => { if (o.isMesh) o.material = VOID; });
      c.speed = 5.5;
    }
    if (mode === "parked") {
      c.lateral = -(ROAD_HALF - 1.1);
      c.speed = 0;
      c.driver.visible = false;
      c.dome.visible = true;
      c.doorPivot.visible = true;
      c.doorPivot.rotation.y = 1.0;
      setHeadlights(c, false);
    }
    if (mode === "swerve") c.speed = 15;
    scene.add(c.g);
    cars.push(c);
    place(c);
  }
  function place(c) {
    c.g.position.copy(route.at(c.d, c.lateral, roadY(c.d)));
    // facing the other way down the road (the one on your tail goes your way)
    c.g.rotation.set(0, route.heading(c.d) + (c.mode === "tail" ? 0 : Math.PI), 0);
  }
  function remove(c) {
    scene.remove(c.g);
    c.g.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    cars.splice(cars.indexOf(c), 1);
  }
  function pick(night) {
    const scary = Math.random() < (night <= 1 ? 0.22 : night === 2 ? 0.38 : 0.5);
    if (!scary) return "pass";
    const pool = ["dark", "parked"];
    if (night >= 2) pool.push("swerve", "nobody");
    if (night >= 3) pool.push("watcher", "shade");
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const okAt = (d, L) => d > 90 && d < L - 140 && !nearCorner(d, 35) && !Object.values(STOPS).some((s) => Math.abs(s - d) < 25);

  let lastBusD = 0;
  // the one on your tail: where it is and what it's doing, every frame
  function tail(c, dt, busD, speed) {
    const behind = busD - 9.8;                 // its nose just off your back bumper
    const beside = busD + 4.6;                 // its passenger window level with yours
    const honk = (dur) => { sfx("horn", dur); c.honks++; };
    if (c.phase === "approach") {
      c.d = Math.min(behind, c.d + (speed + 8) * dt);
      if (c.d >= behind - 0.05) { c.phase = "tail"; c.honkT = 0.2; }
    } else if (c.phase === "tail") {
      c.d = behind;
      c.honkT -= dt;
      if (c.honkT <= 0 && !c.hush) { honk(c.honks === 0 ? 1.3 : 0.3); c.honkT = c.honks === 1 ? 1.8 : 0.45; }
      c.flash -= dt;
      if (c.flash <= 0) { c.flash = 0.2; setHeadlights(c, !c.beam.visible, 2.6); }   // flashing you
    } else if (c.phase === "pass" || c.phase === "beside") {
      setHeadlights(c, true, 1.6);
      c.lateral += (-0.9 - c.lateral) * Math.min(1, dt * 1.6);
      const want = beside - c.d;
      c.d += Math.sign(want) * Math.min(Math.abs(want), (speed + 6) * dt, Math.abs(want) * dt * 3 + speed * dt + 0.02);
      if (c.phase === "pass" && Math.abs(beside - c.d) < 0.4 && c.lateral < -0.7) c.phase = "beside";
      if (c.phase === "beside") c.d = beside;
      c.honkT -= dt;
      if (c.honkT <= 0 && !c.hush) { honk(0.35); c.honkT = 0.62; }
    } else if (c.phase === "away") {
      c.speed = Math.max(c.speed, speed) + dt * 9;
      c.d += c.speed * dt;
      if (c.d - busD > 120) { remove(c); return; }
    }
    place(c);
    if (c.passenger.visible) {
      // its head turns to you
      const local = c.g.worldToLocal(cam.clone());
      c.paleHead.rotation.y = Math.atan2(local.x + 0.55, local.z - 0.1);
    }
  }

  return {
    // add a car for a moment so its shaders get compiled while the game loads
    warmCar() {
      const m = carModel();
      m.g.position.set(0, -50, 0);
      scene.add(m.g);
      return () => scene.remove(m.g);
    },
    get count() { return cars.length; },
    // scripted scenes can ask for an empty road for a while
    hold(seconds) { hold = Math.max(hold, seconds); },
    clear() { while (cars.length) remove(cars[0]); timer = 10; hold = 0; },
    spawn,
    // The car that sits on your bumper (night 3). It comes up behind you with its high beams on, honking; pass()
    // sends it out and alongside your window; quiet() stops the horn; domeOn() lights it up inside (nobody at
    // the wheel, something in the passenger seat); leave(true) is gone in an instant.
    tailgater() {
      const m = carModel();
      const c = { ...m, mode: "tail", phase: "approach", d: lastBusD - 48, lateral: LANE, speed: 0, t: 0, passed: true, honks: 0,
        honkT: 0.4, hush: false, gone: false, flash: 0 };
      c.passenger.visible = false;
      c.dome.visible = false;
      c.hazards.forEach((h) => { h.visible = false; });
      setHeadlights(c, true, 2.6);                       // high beams, straight into your mirror
      scene.add(c.g);
      cars.push(c);
      place(c);
      c.pass = () => { if (!c.gone) c.phase = "pass"; };
      c.quiet = () => { c.hush = true; };
      c.domeOn = () => {
        c.dome.visible = true;
        c.driver.visible = false;                        // there's nobody at the wheel
        c.passenger.visible = true;                      // ...and somebody right up against the glass
        c.passenger.position.set(-0.55, 0, 0.1);
      };
      c.window = () => c.g.localToWorld(new THREE.Vector3(-0.8, 1.15, 0));
      c.leave = (now = false) => {
        if (c.gone) return;
        c.gone = true;
        if (now || !cars.includes(c)) { if (cars.includes(c)) remove(c); return; }
        c.phase = "away";
      };
      return c;
    },
    update(dt, { busD, speed, active, night, camera, player }) {
      lastBusD = busD;
      hold = Math.max(0, hold - dt);
      if (active && hold <= 0 && cars.length < 2) {
        timer -= dt * (speed > 1 ? 1 : 0.3);
        if (timer <= 0) {
          timer = 14 + Math.random() * 16;
          const mode = pick(night);
          if (okAt(busD + 165, route.length)) spawn(mode, busD);
        }
      }
      camera.getWorldPosition(cam);
      for (const c of [...cars]) {
        c.t += dt;
        if (c.mode === "tail") { tail(c, dt, busD, speed); continue; }
        const rel = c.d - (busD + 5);           // + ahead of the bus nose, - behind it
        if (c.mode === "swerve") {
          // drifts across into your lane, flashing, then jerks back
          const want = rel > 45 && rel < 85 ? LANE * 0.55 : -LANE;
          c.lateral += (want - c.lateral) * Math.min(1, dt * (rel < 45 ? 5 : 1.2));
          c.flash -= dt;
          if (rel < 80 && rel > 12 && c.flash <= 0) { c.flash = 0.16; setHeadlights(c, !c.beam.visible, 2.2); }
          if (rel < 75 && !c.honked) { c.honked = true; sfx("horn", 1.6); }
          if (rel < 45 && !c.screeched) { c.screeched = true; sfx("screech"); setHeadlights(c, true, 2.2); }
        }
        if (c.mode === "dark" && rel < 24 && !c.honked) {
          c.honked = true;
          setHeadlights(c, true, 2.6);
          sfx("horn", 0.9);
          player.shake(0.6);
        }
        if (c.mode === "parked") {
          const blink = Math.floor(c.t * 1.6) % 2 === 0;
          c.hazards.forEach((h) => { h.visible = blink; });
          if (rel < 4 && !c.honked) { c.honked = true; sfx("horn", 1.2); setHeadlights(c, true, 2); }
        }
        if (c.mode === "watcher" || c.mode === "shade") {
          // a head that turns to follow you
          const head = c.mode === "watcher" ? c.paleHead : c.driverHead;
          head.getWorldPosition(tmp);
          const local = c.g.worldToLocal(cam.clone());
          const yaw = Math.atan2(local.x - (c.mode === "watcher" ? -0.45 : 0.42), local.z - (c.mode === "watcher" ? -0.85 : 0.15));
          head.rotation.y += (THREE.MathUtils.clamp(yaw, -1.9, 1.9) - head.rotation.y) * Math.min(1, dt * 3);
          if (rel < 3 && !c.honked) { c.honked = true; sfx(c.mode === "shade" ? "breath" : "whisper"); }
        }
        if (!c.passed && rel < 0) {
          c.passed = true;
          if (c.speed > 1) sfx("whoosh");
          if (c.mode === "swerve") player.shake(1.2);
        }
        c.d -= c.speed * dt;
        place(c);
        if (rel < -45) remove(c);
      }
      // move the shared lights to the cars that need them
      let domeCar = null, headCar = null;
      for (const c of cars) {
        const rel = c.d - busD;
        if (rel < -25 || rel > 140) continue;
        if (c.dome.visible && (!domeCar || Math.abs(rel) < Math.abs(domeCar.d - busD))) domeCar = c;
        if (c.beam.visible && rel > -5 && (!headCar || rel < headCar.d - busD)) headCar = c;
      }
      domeShared.intensity = domeCar ? 2.6 : 0;
      if (domeCar) domeShared.position.copy(domeCar.g.localToWorld(tmp.set(0, 1.22, -0.35)));
      headShared.intensity = headCar ? 22 * (headCar.beam.children[0].scale.x / 1.1) : 0;
      if (headCar) headShared.position.copy(headCar.g.localToWorld(tmp.set(0, 1.4, 7)));
    },
  };
}
