// The Route 9 bus. Origin = center of the bus at road level, local +z = forward.
// Local +x is the driver's side (left); the door is on the right (local -x).
import * as THREE from "three";
import { mat, glow, box } from "../core/ps1.js";
import { tex } from "../core/textures.js";

export const MIRROR_ONLY = 1;   // layer for things you can only see in the mirror

const put = (parent, mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

export function buildBus(scene) {
  const bus = new THREE.Group();
  scene.add(bus);
  const W = 1.25;          // half width
  const shell = mat({ color: 0xd8cfb8 });
  const trim = mat({ color: 0x2b2d31 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x6f8696, transparent: true, opacity: 0.14, depthWrite: false });
  const fabric = mat({ map: tex.moquette() });
  const yellow = mat({ color: 0xd9a52b });

  // floor, roof, ceiling
  put(bus, box(2.5, 0.1, 12, mat({ map: tex.busFloor() }), [1, 1]), 0, 0.42, 0);
  put(bus, box(2.6, 0.1, 12.1, shell), 0, 3.02, 0);
  put(bus, box(2.48, 0.04, 11.9, mat({ color: 0xbdb6a6 })), 0, 2.9, 0);
  const strips = [];
  for (const x of [-0.75, 0.75]) strips.push(put(bus, box(0.18, 0.03, 9.5, glow(0xe8f0ff)), x, 2.87, -0.4));

  // side walls with window openings; the right side has a gap for the door
  for (const side of [1, -1]) {
    const x = side * W;
    const lowLen = side === -1 ? 9.6 : 12;
    put(bus, box(0.08, 0.95, lowLen, shell), x, 0.9, side === -1 ? -1.2 : 0);
    put(bus, box(0.08, 0.5, 12, shell), x, 2.68, 0);
    for (let z = -5.6; z <= 5.7; z += 1.4) {
      if (side === -1 && z > 3.6 && z < 5.6) continue;
      put(bus, box(0.1, 1.3, 0.12, trim), x, 1.95, z);
    }
    put(bus, box(0.02, 1.3, side === -1 ? 9.6 : 12, glassMat), x, 1.95, side === -1 ? -1.2 : 0);
    put(bus, box(0.04, 0.16, 12, mat({ color: 0xd2721f })), side * (W + 0.05), 1.15, 0);
  }

  // front: dashboard, windshield, destination sign
  put(bus, box(2.5, 0.95, 0.08, shell), 0, 0.9, 6);
  put(bus, box(2.5, 1.5, 0.02, glassMat), 0, 2.1, 6);
  put(bus, box(2.4, 0.42, 0.7, trim), 0, 1.15, 5.62);
  const destTex = tex.sign("9  NORTHGATE", { bg: "#120c02", fg: "#ffb54a", w: 128, h: 20, font: 15 });
  put(bus, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), glow(0xffffff, { map: destTex })), 0, 2.83, 6.07);

  // back wall + back window
  put(bus, box(2.5, 1.0, 0.08, shell), 0, 0.92, -6);
  put(bus, box(2.5, 1.4, 0.02, glassMat), 0, 2.05, -6);

  // wheels
  for (const z of [-3.6, 3.9]) for (const s of [1, -1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), mat({ color: 0x111111 }));
    w.rotation.z = Math.PI / 2;
    put(bus, w, s * 1.15, 0.5, z);
  }

  // seats: rows on both sides, plus a full back bench
  const seatSlots = {};
  const seat = (x, z, name) => {
    put(bus, box(0.9, 0.12, 0.46, fabric), x, 0.86, z);
    put(bus, box(0.9, 0.62, 0.08, fabric), x, 1.22, z - 0.24);
    if (name) seatSlots[name] = new THREE.Vector3(x, 0.45, z);
  };
  let row = 0;
  for (let z = 3.1; z > -4.9; z -= 0.86, row++) {
    seat(0.66, z, `L${row}`);
    if (z < 3.4) seat(-0.66, z, `R${row}`);
  }
  put(bus, box(2.4, 0.12, 0.5, fabric), 0, 0.88, -5.55);
  put(bus, box(2.4, 0.7, 0.08, fabric), 0, 1.25, -5.84);
  for (const [n, x] of [["B0", -0.8], ["B1", -0.27], ["B2", 0.27], ["B3", 0.8]]) seatSlots[n] = new THREE.Vector3(x, 0.45, -5.5);

  // poles
  for (let z = 2.6; z > -5; z -= 1.72) {
    for (const x of [-0.25, 0.25]) put(bus, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.45, 6), yellow), x, 1.67, z);
  }

  // driver's area
  put(bus, box(0.55, 0.12, 0.55, mat({ color: 0x1c1d20 })), 0.7, 0.95, 4.75);
  put(bus, box(0.55, 0.8, 0.1, mat({ color: 0x1c1d20 })), 0.7, 1.4, 4.45);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 14), trim);
  wheel.rotation.x = -1.1;
  put(bus, wheel, 0.7, 1.42, 5.32);
  put(bus, box(0.06, 0.06, 0.4, trim), 0.7, 1.3, 5.45);
  put(bus, box(0.3, 0.9, 0.3, mat({ color: 0x3a3c40 })), -0.05, 0.9, 5.05);   // fare box

  // dashboard screen: speed, time, schedule (redrawn by update())
  const dash = tex.live(96, 40);
  const dashScreen = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.15), glow(0xffffff, { map: dash.texture })), 0.7, 1.37, 5.33);
  dashScreen.rotation.set(-0.55, Math.PI, 0, "YXZ");

  // route display above the windshield, facing the passengers and you
  const route = tex.live(160, 24);
  const routeScreen = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2), glow(0xffffff, { map: route.texture })), -0.3, 2.62, 5.9);
  routeScreen.rotation.y = Math.PI;

  // radio in the middle of the dash
  const radioTex = tex.live(48, 16);
  const radio = put(bus, box(0.32, 0.14, 0.2, [trim, trim, trim, trim, trim, glow(0xffffff, { map: radioTex.texture })]), 0.15, 1.43, 5.5);
  radio.userData.interact = "radio";

  // door button on the dash, left of the wheel (closer to the door side)
  const doorBtn = put(bus, box(0.1, 0.05, 0.1, glow(0x3fd06a)), 0.3, 1.38, 5.32);
  doorBtn.userData.interact = "doors";

  // sun visor above the driver; flips down
  const visorPivot = put(bus, new THREE.Group(), 0.7, 2.72, 5.72);
  const visor = put(visorPivot, box(0.6, 0.02, 0.3, mat({ color: 0x2a2620 })), 0, 0, -0.15);
  visor.userData.interact = "visor";

  // rear-view mirror with a real camera behind it
  const mirrorRT = new THREE.WebGLRenderTarget(192, 64, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
  mirrorRT.texture.colorSpace = THREE.SRGBColorSpace;
  mirrorRT.texture.wrapS = THREE.RepeatWrapping;
  mirrorRT.texture.repeat.x = -1;
  const mirror = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), new THREE.MeshBasicMaterial({ map: mirrorRT.texture })), 0.22, 2.5, 5.78);
  mirror.rotation.y = Math.PI + 0.12;
  put(bus, box(0.66, 0.26, 0.03, trim), 0.22, 2.5, 5.8);
  const mirrorCam = new THREE.PerspectiveCamera(42, 3, 0.1, 60);
  mirrorCam.position.set(0.22, 2.35, 5.6);
  mirrorCam.rotation.set(-0.12, -0.08, 0);   // cameras look down -z: toward the back of the bus
  mirrorCam.layers.enable(MIRROR_ONLY);
  bus.add(mirrorCam);

  // folding doors (two panels on hinges)
  const doorPanels = [];
  for (const [z, dir] of [[3.75, 1], [5.55, -1]]) {
    const pivot = put(bus, new THREE.Group(), -W, 0.45, z);
    put(pivot, box(0.06, 1.95, 0.9, [glassMat, glassMat, trim, trim, trim, trim]), 0, 0.98, dir * 0.45);
    doorPanels.push({ pivot, dir });
  }
  const steps = put(bus, box(0.6, 0.2, 1.8, trim), -0.95, 0.25, 4.65);

  // lights: interior, headlights, dash glow
  const interior = [new THREE.PointLight(0xe6eeff, 5, 9, 1.4), new THREE.PointLight(0xe6eeff, 4, 9, 1.4)];
  put(bus, interior[0], 0, 2.6, 2.5);
  put(bus, interior[1], 0, 2.6, -3);
  const head = new THREE.SpotLight(0xfff2d8, 160, 70, 0.5, 0.6, 1.2);
  put(bus, head, 0, 1.0, 6.3);
  head.target.position.set(0, 0, 30);
  bus.add(head.target);
  const dashLight = put(bus, new THREE.PointLight(0xffb54a, 0.8, 2, 2), 0.6, 1.5, 5.4);

  // water that can rise inside the bus
  const waterIn = put(bus, box(2.4, 0.02, 11.8, new THREE.MeshPhongMaterial({ color: 0x0d1d29, map: tex.water(), shininess: 120, transparent: true, opacity: 0.85 })), 0, 0.48, 0);
  waterIn.visible = false;

  // ---- state
  const state = { doorsOpen: false, doorAmt: 0, interior: "on", flickerT: 0, routeText: "", routeGlitch: false, radio: "CH 9", visorDown: false };

  function drawRoute(t) {
    const c = route.ctx;
    c.fillStyle = "#0b0702";
    c.fillRect(0, 0, 160, 24);
    let text = state.routeText;
    if (state.routeGlitch && Math.random() < 0.15) text = text.replace(/[A-Z?]/g, () => "?#%&@"[Math.floor(Math.random() * 5)]);
    c.fillStyle = state.routeGlitch ? "#ffd27a" : "#ffb54a";
    c.font = "bold 14px monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 80 + (state.routeGlitch && Math.random() < 0.1 ? (Math.random() - 0.5) * 6 : 0), 12);
    route.texture.needsUpdate = true;
  }
  function drawDash(info) {
    const c = dash.ctx;
    c.fillStyle = "#050505";
    c.fillRect(0, 0, 96, 40);
    c.fillStyle = "#ffb54a";
    c.font = "bold 16px monospace";
    c.fillText(`${String(Math.round(info.speed * 2.237)).padStart(2, " ")} mph`, 4, 16);
    c.font = "12px monospace";
    c.fillText(info.clock, 4, 32);
    c.fillStyle = info.late > 0 ? "#ff5a4f" : "#86cf9b";
    c.fillText(info.late > 0 ? `+${info.late}m` : "ON TIME", 54, 32);
    dash.texture.needsUpdate = true;
  }
  function drawRadio() {
    const c = radioTex.ctx;
    c.fillStyle = "#050505";
    c.fillRect(0, 0, 48, 16);
    if (state.radio) {
      c.fillStyle = "#86cf9b";
      c.font = "bold 11px monospace";
      c.fillText(state.radio, 4, 12);
    }
    radioTex.texture.needsUpdate = true;
  }
  drawRadio();

  let dashTimer = 0;
  return {
    group: bus,
    seatSlots,
    mirrorCam,
    mirrorRT,
    interactables: [radio, doorBtn, visor],
    radioMesh: radio,
    // points (local) people walk through to get on: outside, steps, aisle
    boardPath: [new THREE.Vector3(-2.3, 0, 4.6), new THREE.Vector3(-0.9, 0.45, 4.6), new THREE.Vector3(-0.1, 0.45, 3.6)],
    driverEye: new THREE.Vector3(0.7, 1.72, 4.78),
    get doorsOpen() { return state.doorsOpen; },
    setDoors(open) { state.doorsOpen = open; },
    setRoute(text, glitch = false) { state.routeText = text; state.routeGlitch = glitch; drawRoute(); },
    setRadio(text) { state.radio = text; drawRadio(); },
    setVisor(down) { state.visorDown = down; },
    setInterior(mode) { state.interior = mode; },
    setHeadlights(on) { head.visible = on; },
    // 0 = dry, 1 = up to the seats
    setWater(level) { waterIn.visible = level > 0; waterIn.position.y = 0.48 + level * 0.45; },
    update(dt, info) {
      // doors swing
      const target = state.doorsOpen ? 1 : 0;
      state.doorAmt += Math.sign(target - state.doorAmt) * Math.min(Math.abs(target - state.doorAmt), dt * 2.2);
      doorPanels.forEach(({ pivot, dir }) => { pivot.rotation.y = -dir * state.doorAmt * 1.45; });
      visorPivot.rotation.x = THREE.MathUtils.lerp(visorPivot.rotation.x, state.visorDown ? 1.5 : 0, dt * 6);
      // interior lights
      state.flickerT += dt;
      let level = 1;
      if (state.interior === "off") level = Math.random() < 0.01 ? 0.5 : 0;
      if (state.interior === "flicker") level = Math.sin(state.flickerT * 31) > 0.6 || Math.random() < 0.08 ? 0.15 : 1;
      if (state.interior === "red") level = 0.6;
      interior.forEach((l) => {
        l.intensity = 5 * level;
        l.color.set(state.interior === "red" ? 0xff2a1a : 0xe6eeff);
      });
      strips.forEach((s) => s.material.color.set(level > 0.2 ? (state.interior === "red" ? 0xff3a2a : 0xe8f0ff) : 0x202224));
      dashLight.intensity = state.interior === "off" ? 0.4 : 0.8;
      // screens (redrawn a few times a second)
      dashTimer -= dt;
      if (dashTimer <= 0) {
        dashTimer = 0.15;
        drawDash(info);
        drawRoute();
      }
    },
    renderMirror(renderer, scene) {
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(mirrorRT);
      renderer.render(scene, mirrorCam);
      renderer.setRenderTarget(was);
    },
  };
}
