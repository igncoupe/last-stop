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
import { Person } from "./people.js";

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

// A '90s sedan, the kind still on the road at one in the morning: a real body (a sloped hood, a windshield
// raked back, a roofline, wheel arches), chrome, round headlights, and a proper inside: a dash, a steering
// wheel, seats with headrests, a mirror. old: the one from the river, rusted and filthy, its inside half full
// of water (you only see that when the light comes on).
function carModel({ old = false } = {}) {
  const g = new THREE.Group();
  const paint = mat({ color: old ? 0x26302a : PAINT[Math.floor(Math.random() * PAINT.length)] });
  const dark = mat({ color: 0x0c0d0f });
  const chrome = mat({ color: old ? 0x6a6458 : 0xb8bcc0 });
  const trimMat = mat({ color: 0x16171a });
  const glass = new THREE.MeshLambertMaterial({ color: old ? 0x26322c : 0x1a2229, transparent: true, opacity: old ? 0.48 : 0.4, depthWrite: false, side: THREE.DoubleSide });
  const W = 0.88;                                   // half width
  // the body, from the side: bumpers, hood, beltline, trunk, with an arch over each wheel
  const WZ = 1.36, AR = 0.4;
  const side = new THREE.Shape();
  side.moveTo(2.22, 0.3);
  side.lineTo(WZ + AR, 0.3);
  side.absarc(WZ, 0.32, AR, 0, Math.PI, false);
  side.lineTo(-WZ + AR, 0.3);
  side.absarc(-WZ, 0.32, AR, 0, Math.PI, false);
  side.lineTo(-2.22, 0.3);
  side.lineTo(-2.27, 0.56);
  side.lineTo(-2.18, 0.84);
  side.lineTo(-1.5, 0.89);
  side.lineTo(1.15, 0.87);
  side.lineTo(2.16, 0.77);
  side.lineTo(2.27, 0.56);
  side.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(side, { depth: W * 2, bevelEnabled: false, curveSegments: 10 }).rotateY(-Math.PI / 2).translate(W, 0, 0);
  g.add(new THREE.Mesh(bodyGeo, paint));
  // the greenhouse: glass all round, a roof, and the pillars
  const cab = new THREE.Shape();
  cab.moveTo(1.12, 0.87);
  cab.lineTo(0.5, 1.33);
  cab.lineTo(-0.85, 1.36);
  cab.lineTo(-1.5, 0.89);
  cab.closePath();
  const cabGeo = new THREE.ExtrudeGeometry(cab, { depth: (W - 0.06) * 2, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(W - 0.06, 0, 0);
  g.add(new THREE.Mesh(cabGeo, glass));
  put(g, box((W - 0.04) * 2, 0.05, 1.42, paint), 0, 1.37, -0.17);                         // the roof
  const pillar = (z0, y0, z1, y1, x) => {
    const len = Math.hypot(z1 - z0, y1 - y0);
    const p = put(g, box(0.07, len, 0.07, paint), x, (y0 + y1) / 2, (z0 + z1) / 2);
    p.rotation.x = Math.atan2(z1 - z0, y1 - y0);
  };
  for (const s of [-1, 1]) {
    pillar(1.12, 0.87, 0.5, 1.33, s * (W - 0.06));                                        // A
    pillar(-0.12, 0.88, -0.12, 1.35, s * (W - 0.06));                                     // B
    pillar(-1.5, 0.89, -0.85, 1.36, s * (W - 0.06));                                      // C
    put(g, box(0.02, 0.03, 2.6, chrome), s * (W + 0.005), 0.88, -0.2);                    // chrome along the windows
    put(g, box(0.02, 0.05, 4.2, trimMat), s * (W + 0.006), 0.52, 0);                      // the rubbing strip
    for (const z of [0.35, -0.6]) put(g, box(0.03, 0.03, 0.14, chrome), s * (W + 0.01), 0.78, z);   // door handles
    put(g, box(0.004, 0.5, 0.01, trimMat), s * (W + 0.002), 0.6, -0.12);                  // the door seam
    const mirror = put(g, box(0.16, 0.1, 0.07, trimMat), s * (W + 0.08), 0.96, 0.95);    // wing mirrors
    mirror.rotation.y = s * 0.2;
  }
  // the front: chrome bumper, a grille with bars, round headlights; the back: tail lights, a plate
  put(g, box(1.84, 0.14, 0.12, chrome), 0, 0.4, 2.24);
  put(g, box(1.84, 0.14, 0.12, chrome), 0, 0.4, -2.24);
  put(g, box(0.86, 0.18, 0.03, dark), 0, 0.64, 2.25);
  for (let i = 0; i < 4; i++) put(g, box(0.84, 0.015, 0.035, chrome), 0, 0.57 + i * 0.045, 2.26);
  const headOn = glow(0xfff1d0), headOff = mat({ color: 0x2a2a28 });
  const heads = [];
  for (const s of [-1, 1]) for (const x of [0.6, 0.8]) {
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 12).rotateX(Math.PI / 2), chrome), s * x, 0.66, 2.24);
    heads.push(put(g, new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), headOn), s * x, 0.66, 2.265));
  }
  for (const x of [-0.66, 0.66]) put(g, box(0.34, 0.14, 0.04, glow(0x8a0f0c)), x, 0.7, -2.25);
  put(g, box(0.42, 0.14, 0.02, mat({ color: old ? 0xa8a490 : 0xe9e4d4 })), 0, 0.5, -2.31);   // plate
  put(g, box(0.42, 0.14, 0.02, mat({ color: old ? 0xa8a490 : 0xe9e4d4 })), 0, 0.42, 2.31);
  // wheels: tires with hubcaps, tucked into the arches
  for (const sx of [-1, 1]) for (const sz of [-WZ, WZ]) {
    const wheel = put(g, new THREE.Group(), sx * 0.76, 0.33, sz);
    wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14).rotateZ(Math.PI / 2), dark));
    put(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12).rotateZ(Math.PI / 2), chrome), sx * 0.115, 0, 0);
  }
  // inside: the dash, the wheel, the seats (with headrests), the mirror
  put(g, box(1.6, 0.2, 0.42, trimMat), 0, 0.76, 0.95);
  put(g, box(1.6, 0.05, 0.5, mat({ color: 0x1e2024 })), 0, 0.88, 1.05);
  const wheelRim = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 18), trimMat), 0.42, 0.92, 0.62);
  wheelRim.rotation.x = -0.45;
  put(g, box(0.04, 0.04, 0.3, trimMat), 0.42, 0.84, 0.76).rotation.x = 0.7;               // the column
  const seatMat = mat({ color: old ? 0x2a2620 : 0x2a2c31 });
  for (const sx of [0.42, -0.42]) {
    put(g, box(0.5, 0.14, 0.5, seatMat), sx, 0.5, 0.05);
    const back = put(g, box(0.5, 0.6, 0.12, seatMat), sx, 0.82, -0.22);
    back.rotation.x = -0.18;
    put(g, box(0.26, 0.16, 0.1, seatMat), sx, 1.2, -0.3);                                 // headrests
  }
  put(g, box(1.5, 0.14, 0.5, seatMat), 0, 0.5, -0.95);                                    // the back seat
  put(g, box(1.5, 0.56, 0.12, seatMat), 0, 0.8, -1.22).rotation.x = -0.2;
  put(g, box(0.2, 0.06, 0.03, trimMat), 0, 1.24, 0.55);                                   // rear-view mirror
  const hazardMat = glow(0xffa32a);
  const hazards = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) hazards.push(put(g, box(0.1, 0.07, 0.05, hazardMat), sx * 0.86, 0.72, sz * 2.24));
  // the river car: rust bleeding through the paint, mud up the doors, weed caught in the grille, and inside, water
  let flooded = null;
  if (old) {
    const rust = mat({ color: 0x5a3018 });
    for (let i = 0; i < 14; i++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      put(g, box(0.01, 0.06 + Math.random() * 0.14, 0.12 + Math.random() * 0.4, rust), s * (W + 0.004), 0.36 + Math.random() * 0.3, (Math.random() - 0.5) * 3.8);
    }
    const mud = mat({ color: 0x2c2a20 });
    for (const s of [-1, 1]) put(g, box(0.008, 0.16, 3.6, mud), s * (W + 0.003), 0.4, 0);
    const weed = mat({ color: 0x2c3a1e });
    for (let i = 0; i < 6; i++) put(g, box(0.03, 0.2 + Math.random() * 0.2, 0.02, weed), -0.35 + i * 0.14, 0.52, 2.27).rotation.z = (Math.random() - 0.5) * 0.6;
    flooded = put(g, new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x1a2a22, transparent: true, opacity: 0.82, depthWrite: false })), 0, 0.74, -0.4);
    flooded.visible = false;
  }
  // headlights: a bright glow at each lamp (it blooms when it's pointed at you), and the light they throw on the road
  const beamMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1d8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Group();
  for (const x of [-0.7, 0.7]) {
    const halo = new THREE.Sprite(beamMat);
    halo.scale.set(1.1, 0.8, 1);
    put(beam, halo, x, 0.66, 2.33);
  }
  g.add(beam);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffe2b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 10), poolMat);
  pool.rotation.x = -Math.PI / 2;
  put(g, pool, 0, 0.04, 7.5);
  // the inside: dome light, a driver, a back-seat passenger, an opening driver's door
  const dome = put(g, box(0.3, 0.03, 0.2, glow(0xfff2c8)), 0, 1.34, -0.2);
  const figureMat = mat({ color: 0x15161a });
  const driver = put(g, new THREE.Group(), 0.42, 0, 0.05);                // the driver sits on the car's left
  put(driver, box(0.44, 0.42, 0.24, figureMat), 0, 0.8, -0.05);
  put(driver, box(0.14, 0.08, 0.14, figureMat), 0, 1.05, -0.03);
  const driverHead = put(driver, new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), figureMat), 0, 1.17, 0);
  for (const s of [-1, 1]) put(driver, box(0.08, 0.08, 0.42, figureMat), s * 0.2, 0.86, 0.22);   // arms out to the wheel
  const passenger = put(g, new THREE.Group(), -0.45, 0, -0.95);
  put(passenger, box(0.42, 0.34, 0.24, mat({ color: 0x3b4044 })), 0, 0.78, 0);
  const paleMat = mat({ color: 0xa7b0ab, emissive: 0x161c1a });
  const paleHead = put(passenger, new THREE.Group(), 0, 1.06, 0);
  put(paleHead, new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), paleMat), 0, 0, 0);
  for (const ex of [-0.04, 0.04]) put(paleHead, new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), new THREE.MeshBasicMaterial({ color: 0x000000 })), ex, 0.02, 0.095);
  const doorPivot = put(g, new THREE.Group(), W, 0, 0.75);
  put(doorPivot, box(0.06, 0.5, 1.05, paint), 0, 0.62, -0.52);
  doorPivot.visible = false;
  return { g, heads, headOn, headOff, hazards, beam, pool, dome, driver, driverHead, passenger, paleHead, figureMat, doorPivot, flooded, wheelRim };
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
    if (c.g.userData.onRemove) c.g.userData.onRemove();
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
  let cameraRef = null;
  // the one on your tail: where it is and what it's doing, every frame
  function tail(c, dt, busD, speed) {
    const behind = busD - 9.8;                 // its nose just off your back bumper
    const beside = busD + 4.6;                 // its passenger window level with yours
    const honk = (dur) => { sfx("horn", dur); c.honks++; };
    if (c.phase === "approach") {
      c.d = Math.min(behind, c.d + (speed + 11) * dt);
      if (c.d >= behind - 0.05) { c.phase = "tail"; c.honkT = 0.2; }
    } else if (c.phase === "tail") {
      c.d = behind;
      c.honkT -= dt;
      if (c.honkT <= 0 && !c.hush) { honk(c.honks === 0 ? 1.1 : 0.3); c.honkT = c.honks === 1 ? 1.2 : 0.45; }
      c.flash -= dt;
      if (c.flash <= 0) { c.flash = 0.2; setHeadlights(c, !c.beam.visible, 2.6); }   // flashing you
    } else if (c.phase === "pass" || c.phase === "beside") {
      setHeadlights(c, true, 1.6);
      c.lateral += (-0.9 - c.lateral) * Math.min(1, dt * 1.6);
      const want = beside - c.d;
      c.d += Math.sign(want) * Math.min(Math.abs(want), (speed + 8) * dt, Math.abs(want) * dt * 3.5 + speed * dt + 0.02);
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
    if (c.dome.visible) c.wheelRim.rotation.z = Math.sin(c.t * 1.7) * 0.35;
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
      const m = carModel({ old: true });
      const c = { ...m, mode: "tail", phase: "approach", d: lastBusD - 32, lateral: LANE, speed: 0, t: 0, passed: true, honks: 0,
        honkT: 0.4, hush: false, gone: false, flash: 0 };
      c.passenger.visible = false;
      c.dome.visible = false;
      c.hazards.forEach((h) => { h.visible = false; });
      setHeadlights(c, true, 2.6);                       // high beams, straight into your mirror
      // in the front passenger seat, in the dark: a drowned woman, her hair plastered to her face. You only
      // see her when the light comes on.
      const woman = new Person(scene, "carwoman", { ghost: true });
      woman.sit(c.g, new THREE.Vector3(-0.42, 0.08, 0.05), 0);
      woman.root.visible = false;
      c.woman = woman;
      scene.add(c.g);
      cars.push(c);
      place(c);
      c.pass = () => { if (!c.gone) c.phase = "pass"; };
      c.quiet = () => { c.hush = true; };
      c.domeOn = () => {
        c.dome.visible = true;
        c.driver.visible = false;                        // there's nobody at the wheel
        c.woman.root.visible = true;                     // ...and her, sitting in water up to her waist
        c.woman.watch(cameraRef);                        // turning to look at you
        if (c.flooded) c.flooded.visible = true;
      };
      c.window = () => c.g.localToWorld(new THREE.Vector3(-0.8, 1.15, 0));
      c.leave = (now = false) => {
        if (c.gone) return;
        c.gone = true;
        if (now || !cars.includes(c)) { if (cars.includes(c)) remove(c); return; }
        c.phase = "away";
      };
      c.g.userData.onRemove = () => c.woman.remove();
      return c;
    },
    update(dt, { busD, speed, active, night, camera, player }) {
      lastBusD = busD;
      cameraRef = camera;
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
      // (the river car's light is brighter and sick green, so you see exactly what's in it)
      domeShared.intensity = domeCar ? (domeCar.mode === "tail" ? 6 : 2.6) : 0;
      domeShared.color.set(domeCar && domeCar.mode === "tail" ? 0xb8e8c8 : 0xfff2c8);
      if (domeCar) domeShared.position.copy(domeCar.g.localToWorld(tmp.set(0, 1.22, -0.35)));
      headShared.intensity = headCar ? 22 * (headCar.beam.children[0].scale.x / 1.1) : 0;
      if (headCar) headShared.position.copy(headCar.g.localToWorld(tmp.set(0, 1.4, 7)));
    },
  };
}
