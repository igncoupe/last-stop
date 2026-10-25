// The Route 9 bus. Origin = center of the bus at road level, local +z = forward.
// Local +x is the driver's side (left); the door is on the right (local -x).
import * as THREE from "three";
import { mat, glow, box } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { makeFogPane } from "./fog.js";
import { handMesh, drawPrint } from "./hands.js";
import { waterMaterial } from "./water.js";

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
  {
    const floorMat = mat({ map: tex.busFloor() });
    const SW0 = 3.66, SW1 = 5.64;          // the stairwell opening runs between the door posts
    put(bus, box(2.5, 0.1, SW0 + 6, floorMat, [1, 1]), 0, 0.42, (SW0 - 6) / 2);
    put(bus, box(1.72, 0.1, SW1 - SW0, floorMat, [1, 1]), 0.39, 0.42, (SW0 + SW1) / 2);
    put(bus, box(2.5, 0.1, 6 - SW1, floorMat, [1, 1]), 0, 0.42, (SW1 + 6) / 2);
  }
  put(bus, box(2.6, 0.1, 12.1, shell), 0, 3.02, 0);
  put(bus, box(2.48, 0.04, 11.9, mat({ color: 0xbdb6a6 })), 0, 2.9, 0);
  const strips = [];
  for (const x of [-0.75, 0.75]) strips.push(put(bus, box(0.18, 0.03, 9.5, glow(0xe8f0ff)), x, 2.87, -0.4));

  // the lower body side: one panel with real arched cut-outs over the wheels,
  // running from the skirt (just above the road) up to the window line
  const WHEELS_Z = [-3.7, 2.75];
  const ARCH_R = 0.62, WHEEL_Y = 0.5, SKIRT = 0.28, LOW_TOP = 1.375;
  function lowerSide(side, z0, z1) {
    const sh = new THREE.Shape();
    sh.moveTo(z0, SKIRT);
    for (const wz of WHEELS_Z) {
      if (wz - ARCH_R < z0 || wz + ARCH_R > z1) continue;
      sh.lineTo(wz - ARCH_R, SKIRT);
      sh.lineTo(wz - ARCH_R, WHEEL_Y);
      sh.absarc(wz, WHEEL_Y, ARCH_R, Math.PI, 0, true);
      sh.lineTo(wz + ARCH_R, SKIRT);
    }
    sh.lineTo(z1, SKIRT);
    sh.lineTo(z1, LOW_TOP);
    sh.lineTo(z0, LOW_TOP);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false, curveSegments: 14 });
    geo.rotateY(-Math.PI / 2);          // shape x -> bus z; the 8 cm depth -> across the side
    const m = new THREE.Mesh(geo, shell);
    m.position.set(side * W + 0.04, 0, 0);
    bus.add(m);
    // a dark rubber skirt along the bottom edge
    for (const [a, b] of [[z0, WHEELS_Z[0] - ARCH_R], [WHEELS_Z[0] + ARCH_R, Math.min(z1, WHEELS_Z[1] - ARCH_R)], [WHEELS_Z[1] + ARCH_R, z1]]) {
      if (b - a > 0.05) put(bus, box(0.1, 0.06, b - a, mat({ color: 0x1a1b1d })), side * (W + 0.01), SKIRT + 0.03, (a + b) / 2);
    }
  }

  // side walls with window openings; the right side has a gap for the door
  for (const side of [1, -1]) {
    const x = side * W;
    lowerSide(side, -6, side === -1 ? 3.62 : 6);
    put(bus, box(0.08, 0.5, 12, shell), x, 2.68, 0);
    for (let z = -5.6; z <= 5.7; z += 1.4) {
      if (side === -1 && z > 3.6 && z < 5.6) continue;
      put(bus, box(0.1, 1.3, 0.12, trim), x, 1.95, z);
    }
    put(bus, box(0.02, 1.3, side === -1 ? 9.6 : 12, glassMat), x, 1.95, side === -1 ? -1.2 : 0);
    // the orange stripe stops at the door, like the real paint job
    const stripe = mat({ color: 0xd2721f });
    if (side === -1) {
      put(bus, box(0.04, 0.15, 9.62, stripe), x - 0.05, 1.205, -1.19);
      put(bus, box(0.04, 0.15, 0.34, stripe), x - 0.05, 1.205, 5.83);
    } else put(bus, box(0.04, 0.15, 12, stripe), x + 0.05, 1.205, 0);
  }

  // front: dashboard, windshield, destination sign
  put(bus, box(2.5, 1.095, 0.08, shell), 0, 0.8275, 6);
  put(bus, box(2.5, 1.5, 0.02, glassMat), 0, 2.1, 6);
  {
    const surround = mat({ color: 0x141517 });
    put(bus, box(2.56, 0.08, 0.06, surround), 0, 1.37, 6.02);              // bottom of the windshield
    put(bus, box(2.56, 0.1, 0.06, surround), 0, 2.88, 6.02);               // top
    for (const sx of [-1, 1]) put(bus, box(0.09, 1.56, 0.07, surround), sx * 1.24, 2.12, 6.02);   // A-pillars
    // wipers, parked at the bottom of the glass
    for (const sx of [-1, 1]) {
      const arm = put(bus, box(0.85, 0.02, 0.02, surround), sx * 0.44, 1.428, 6.045);
      arm.rotation.z = sx * 0.03;
      put(bus, box(0.05, 0.04, 0.04, surround), sx * 0.84, 1.425, 6.04);    // pivot
    }
  }
  // what's left on the outside of the windshield after something hits it: ash handprints, a crack
  // both versions are drawn now, while loading, so a hit on the glass never stalls on drawing them
  const smudgeCanvases = [1, 2].map(() => { const c = document.createElement("canvas"); c.width = 512; c.height = 300; return c; });
  const smudgeTexes = smudgeCanvases.map((c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; });
  let smudgeCanvas = smudgeCanvases[0];
  const smudgeTex = smudgeTexes[0];
  const smudge = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5),
    new THREE.MeshBasicMaterial({ map: smudgeTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })), 0, 2.1, 6.025);
  smudge.rotation.y = Math.PI;          // reads the right way round from the driver's seat
  smudge.visible = false;
  function drawSmudge(level) {
    const x = smudgeCanvas.getContext("2d");
    x.clearRect(0, 0, 512, 300);
    if (!level) return;
    const W2 = 512, H2 = 300;
    // the bus x of a mark -> canvas u (the plane is turned to face the driver)
    const U = (bx) => ((1.25 - bx) / 2.5) * W2;
    const V = (by) => ((2.85 - by) / 1.5) * H2;
    // where its hands were: the same hand as every other hand on this bus, in grime, dragged down the glass
    drawPrint(x, U(-0.75), V(2.4), 122, -0.32);
    drawPrint(x, U(1.12), V(2.42), 128, 0.3);
    drawPrint(x, U(0.6), V(1.9), 96, 0.12, 0.7);
    // a dusty smear the shape of a body, where it was pressed against the glass
    const grd = x.createRadialGradient(U(0.3), V(2.15), 10, U(0.3), V(2.15), 120);
    grd.addColorStop(0, "rgba(120,118,112,0.32)");
    grd.addColorStop(1, "rgba(120,118,112,0)");
    x.fillStyle = grd;
    x.fillRect(0, 0, W2, H2);
    if (level >= 2) {
      // a star of cracks from where its head hit: a crushed white spot, jagged lines that branch and thin out
      x.filter = "none";
      const cx = U(0.3), cy = V(2.4);
      x.fillStyle = "rgba(220,226,230,0.28)";
      x.beginPath(); x.ellipse(cx, cy, 6, 5, 0.3, 0, Math.PI * 2); x.fill();
      const branch = (px, py, a, len, width) => {
        if (len < 5 || width < 0.3) return;
        x.strokeStyle = `rgba(225,232,236,${0.18 + width * 0.18})`;
        x.lineWidth = width;
        x.beginPath();
        x.moveTo(px, py);
        let qx = px, qy = py;
        for (let s = 0; s < 4; s++) {
          a += (Math.random() - 0.5) * 0.5;
          qx += Math.cos(a) * len / 4;
          qy += Math.sin(a) * len / 4;
          x.lineTo(qx, qy);
        }
        x.stroke();
        if (Math.random() < 0.55) branch(qx, qy, a + (Math.random() - 0.5) * 1.2, len * 0.55, width * 0.6);
        branch(qx, qy, a, len * 0.6, width * 0.7);
      };
      const n = 7 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) branch(cx, cy, (i / n) * Math.PI * 2 + Math.random() * 0.4, 40 + Math.random() * 40, 1.1);
      // one broken ring, not a spider web
      x.strokeStyle = "rgba(225,232,236,0.22)";
      x.lineWidth = 0.7;
      x.beginPath();
      for (let k = 0; k <= 9; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.4;
        const rr = 14 + (Math.random() - 0.5) * 6;
        if (k === 0) x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      x.stroke();
    }
    x.filter = "none";
  }
  smudgeCanvas = smudgeCanvases[0]; drawSmudge(1);
  smudgeCanvas = smudgeCanvases[1]; drawSmudge(2);
  smudgeTexes.forEach((t) => { t.needsUpdate = true; });
  // the dash: full depth in front of the driver, a shallow shelf on the door side so the front door can fold
  put(bus, box(1.42, 0.45, 0.535, trim), 0.49, 1.165, 5.7175);       // driver's side: x -0.22..1.2, z 5.45..5.985
  put(bus, box(0.98, 0.45, 0.315, trim), -0.71, 1.165, 5.8275);      // door side: x -1.2..-0.22, z 5.67..5.985
  // Teodor's old driver's log, pushed up against the windshield at the end of the dash (js/game/file.js)
  const logbook = put(bus, new THREE.Group(), 1.11, 1.405, 5.57);          // (left of the binnacle, so you can see it)
  logbook.rotation.y = 0.2;
  put(logbook, box(0.17, 0.03, 0.23, mat({ color: 0x4a2f1c })), 0, 0, 0);                  // the cover, cracked brown
  put(logbook, box(0.012, 0.022, 0.215, mat({ color: 0xe6dcc0 })), -0.08, 0, 0);            // the page edges
  put(logbook, box(0.09, 0.002, 0.05, mat({ color: 0xd8cfae })), 0, 0.016, 0.04);           // a paper label
  put(logbook, box(0.02, 0.002, 0.07, mat({ color: 0x8a1f1f })), 0.05, 0.016, -0.08);       // a red ribbon marker
  const destTex = tex.sign("9  NORTHGATE", { bg: "#120c02", fg: "#ffb54a", w: 128, h: 20, font: 15 });
  put(bus, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), glow(0xffffff, { map: destTex })), 0, 2.83, 6.07);

  // back wall + back window
  put(bus, box(2.5, 1.0, 0.08, shell), 0, 0.92, -6);
  put(bus, box(2.5, 1.4, 0.02, glassMat), 0, 2.05, -6);

  // wheels: they sit up inside the arches, tucked in under the body like a real transit bus.
  // Tire with a sidewall, a steel rim with vent holes, ten lug nuts and a hub cap.
  // The front wheel sits behind the door.
  const tireMat = mat({ color: 0x101011 });
  const sidewallMat = mat({ color: 0x1d1d1f });
  const rimMat = mat({ color: 0x9aa0a6 });
  const rimDark = mat({ color: 0x5c6166 });
  const nutMat = mat({ color: 0xc3c8cc });
  const wellMat = mat({ color: 0x070708, side: THREE.DoubleSide });
  const lipMat = mat({ color: 0x1a1b1d });
  const disc = (r0, r1, h, seg, material) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg).rotateZ(Math.PI / 2), material);
  for (const z of WHEELS_Z) for (const s of [1, -1]) {
    const wheelG = put(bus, new THREE.Group(), s * 1.11, 0.5, z);
    wheelG.add(disc(0.5, 0.5, 0.26, 20, tireMat));
    put(wheelG, disc(0.48, 0.48, 0.012, 20, sidewallMat), s * 0.131, 0, 0);       // sidewall
    put(wheelG, disc(0.32, 0.32, 0.016, 18, rimMat), s * 0.136, 0, 0);            // rim
    put(wheelG, disc(0.24, 0.24, 0.01, 16, rimDark), s * 0.143, 0, 0);            // dished centre
    for (let i = 0; i < 8; i++) {                                                 // vent holes
      const a = (i / 8) * Math.PI * 2 + 0.2;
      put(wheelG, disc(0.035, 0.035, 0.01, 8, tireMat), s * 0.145, Math.sin(a) * 0.27, Math.cos(a) * 0.27);
    }
    for (let i = 0; i < 10; i++) {                                                // lug nuts
      const a = (i / 10) * Math.PI * 2;
      put(wheelG, disc(0.017, 0.017, 0.035, 6, nutMat), s * 0.15, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
    }
    put(wheelG, disc(s > 0 ? 0.1 : 0.075, s > 0 ? 0.075 : 0.1, 0.06, 12, nutMat), s * 0.16, 0, 0);   // hub cap, narrow end out
    // the dark wheel well inside the arch
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.27, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), wellMat);
    put(bus, well, s * 1.115, 0.5, z);
    // a black rubber lip around the edge of the arch
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.635, 0.028, 6, 18, Math.PI), lipMat);
    lip.rotation.y = Math.PI / 2;
    put(bus, lip, s * (W + 0.045), 0.5, z);
    for (const e of [-1, 1]) put(bus, box(0.06, 0.22, 0.056, lipMat), s * (W + 0.045), 0.39, z + e * 0.635);
    // mud flaps behind the rear wheels
    if (z < 0) put(bus, box(0.3, 0.34, 0.025, lipMat), s * 1.08, 0.22, z - 0.66);
    // inside, the wheel sits under a slim hump along the wall, beside the seats
    put(bus, box(0.26, 0.66, 1.1, mat({ color: 0x2c2e32 })), s * 1.08, 0.77, z);
    put(bus, box(0.28, 0.02, 1.12, mat({ color: 0x1e1f22 })), s * 1.08, 1.11, z);     // rubber edge
  }

  // outside details: bumpers, lights, mirrors, roof unit
  const blackPlastic = mat({ color: 0x1a1b1d });
  put(bus, box(2.62, 0.28, 0.16, blackPlastic), 0, 0.32, 6.08);
  put(bus, box(2.62, 0.28, 0.16, blackPlastic), 0, 0.32, -6.08);
  put(bus, box(2.5, 0.3, 0.03, blackPlastic), 0, 0.66, 6.045);                  // the black band across the front
  {
    put(bus, box(0.9, 0.2, 0.02, mat({ color: 0x0c0c0d })), 0, 0.66, 6.06);            // grille
    for (let i = 0; i < 3; i++) put(bus, box(0.86, 0.02, 0.025, mat({ color: 0x3a3c40 })), 0, 0.6 + i * 0.06, 6.07);
    const plate = tex.sign("RT 9", { bg: "#e9e4d4", fg: "#1a1a1a", w: 48, h: 16, font: 11 });
    put(bus, new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), mat({ map: plate })), 0, 0.4, 6.165);
  }
  const lampMat = glow(0xfff4d6);
  for (const s of [1, -1]) {
    put(bus, box(0.54, 0.22, 0.03, mat({ color: 0x2a2c30 })), s * 0.86, 0.66, 6.06);   // headlight housing
    for (const lx of [0.72, 0.98]) {
      put(bus, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14).rotateX(Math.PI / 2), mat({ color: 0x8a8e92 })), s * lx, 0.66, 6.075);
      put(bus, new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), lampMat), s * lx, 0.66, 6.092);
    }
    put(bus, box(0.1, 0.12, 0.03, glow(0xffa32a)), s * 1.18, 0.66, 6.075);       // turn signals
    put(bus, box(0.3, 0.2, 0.04, glow(0x9c1410)), s * 1.0, 0.75, -6.06);        // tail lights
    // side mirror on an arm
    put(bus, box(0.05, 0.05, 0.5, blackPlastic), s * 1.45, 2.35, 5.9);
    put(bus, box(0.12, 0.38, 0.22, blackPlastic), s * 1.68, 2.15, 6.12);
  }
  put(bus, box(1.6, 0.28, 2.4, mat({ color: 0xc9c1ab })), 0, 3.2, -1.5);      // roof AC unit
  for (const s of [1, -1]) {
    // window rail, bottom (it stops at the door)
    if (s === -1) {
      put(bus, box(0.04, 0.05, 9.62, blackPlastic), -(W + 0.04), 1.31, -1.19);
      put(bus, box(0.04, 0.05, 0.34, blackPlastic), -(W + 0.04), 1.31, 5.83);
    } else put(bus, box(0.04, 0.05, 12, blackPlastic), W + 0.04, 1.31, 0);
    put(bus, box(0.04, 0.05, 12, blackPlastic), s * (W + 0.04), 2.62, 0);       // window rail, top
  }

  // seats: rows on both sides, plus a full back bench
  const seatSlots = {};
  // rows over the wheels are a little narrower, so the wheel hump fits along the wall beside them
  const overWheel = (z) => WHEELS_Z.some((wz) => Math.abs(z - wz) < 0.95);
  const shellMat = mat({ color: 0x2a2c31 });
  const legMat = mat({ color: 0x45484e });
  // a pair of seats (window + aisle) facing forward (+z), every row at the same height
  const seat = (x, z, name) => {
    const out = Math.sign(x);                   // toward the window
    const narrow = overWheel(z);
    const cx = narrow ? out * 0.58 : x;         // pair centre
    const half = narrow ? 0.185 : 0.225;        // seat centre offset
    const sw = narrow ? 0.35 : 0.42;            // seat width
    const g = put(bus, new THREE.Group(), cx, 0, z);
    for (const sx of [-half, half]) {
      put(g, box(sw, 0.04, 0.44, shellMat), sx, 0.8, 0);                  // plastic seat shell
      put(g, box(sw - 0.03, 0.065, 0.41, fabric), sx, 0.852, 0.01);       // cushion
      const back = put(g, new THREE.Group(), sx, 0.82, -0.2);
      back.rotation.x = -0.16;                                             // leans back a little
      put(back, box(sw, 0.62, 0.04, shellMat), 0, 0.31, -0.03);
      put(back, box(sw - 0.03, 0.56, 0.045, fabric), 0, 0.3, 0.01);
    }
    const reach = 1.21 - Math.abs(cx) + half * 2;                        // from the aisle seat's edge to the wall
    put(g, box(0.06, 0.3, 0.06, legMat), -out * (half + sw / 2 - 0.05), 0.62, -0.02);   // leg on the aisle side
    put(g, box(reach, 0.04, 0.05, legMat), out * (1.21 - Math.abs(cx) - reach / 2), 0.76, -0.02);   // beam into the wall
    // grab handle across the top of the aisle seat's back
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, sw - 0.12, 8).rotateZ(Math.PI / 2), yellow), -out * half, 1.45, -0.31);
    for (const hx of [-(sw / 2 - 0.08), sw / 2 - 0.08]) put(g, box(0.025, 0.06, 0.025, yellow), -out * half + hx, 1.41, -0.3);
    // passengers sit in the window seat
    if (name) seatSlots[name] = new THREE.Vector3(cx + out * half, 0.45, z);
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
  put(bus, box(0.55, 0.5, 0.1, mat({ color: 0x1c1d20 })), 0.7, 1.22, 4.45);   // low, so you can look back over it
  // steering wheel: rim, three spokes, hub, column
  const wheelG = put(bus, new THREE.Group(), 0.7, 1.33, 5.18);
  wheelG.rotation.x = -2.39;          // face tilted up toward the driver, so you see the whole rim
  wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 6, 24), mat({ color: 0x3a3b40 })));
  // worn grip wrap at ten and two
  for (const a of [-0.55, Math.PI + 0.55]) {        // (the wheel is flipped, so these sit up top)
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.026, 6, 6, 0.7), mat({ color: 0x25262a }));
    grip.rotation.z = a - 0.35;
    wheelG.add(grip);
  }
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const spoke = box(0.2, 0.026, 0.016, mat({ color: 0x7a8086 }));
    spoke.position.set(Math.cos(a + Math.PI / 2) * 0.1, Math.sin(a + Math.PI / 2) * 0.1, 0);
    spoke.rotation.z = a + Math.PI / 2;
    wheelG.add(spoke);
  }
  wheelG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12).rotateX(Math.PI / 2), mat({ color: 0x2a2c30 })));
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), mat({ color: 0xa8a090 }));
  badge.position.z = 0.027;
  wheelG.add(badge);
  const column = put(bus, box(0.07, 0.07, 0.42, trim), 0.7, 1.204, 5.315);
  column.rotation.x = 0.75;            // runs down from the hub into the dash
  // fare box: body, coin slot, glowing display, ticket slot
  const fare = put(bus, new THREE.Group(), -0.05, 0, 5.05);
  put(fare, box(0.3, 0.95, 0.3, mat({ color: 0x3d4045 })), 0, 0.92, 0);
  put(fare, box(0.32, 0.06, 0.32, mat({ color: 0x8a9096 })), 0, 1.42, 0);
  put(fare, box(0.08, 0.01, 0.02, mat({ color: 0x050505 })), 0, 1.455, 0.04);
  put(fare, box(0.18, 0.08, 0.01, glow(0x5fd38a)), 0, 1.25, -0.155);
  put(fare, box(0.12, 0.015, 0.01, mat({ color: 0x050505 })), 0, 1.1, -0.155);

  // dashboard screen: speed, time, schedule (redrawn by update())
  const dash = tex.live(144, 60);
  const binMat = mat({ color: 0x1f2023 });
  put(bus, box(0.56, 0.23, 0.16, binMat), 0.7, 1.505, 5.55);         // binnacle: y 1.39..1.62, z 5.47..5.63
  put(bus, box(0.6, 0.025, 0.21, binMat), 0.7, 1.6325, 5.525);        // its hood
  const dashScreen = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.15), glow(0xffffff, { map: dash.texture })), 0.7, 1.52, 5.466);
  dashScreen.rotation.y = Math.PI;                                     // faces the driver

  // route display above the windshield, facing the passengers and you
  const route = tex.live(160, 24);
  const routeScreen = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), glow(0xffffff, { map: route.texture })), -0.75, 2.62, 5.9);
  put(bus, box(0.86, 0.26, 0.04, trim), -0.75, 2.62, 5.925);           // its housing
  routeScreen.rotation.y = Math.PI;

  // the two-way radio: body, display, a channel knob and a handset on a hook
  const radioTex = tex.live(96, 32);
  const radio = put(bus, box(0.32, 0.11, 0.03, binMat), 0.13, 1.28, 5.437);           // faceplate, set into the dash face
  radio.userData.interact = "radio";
  const radioScreen = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.06), glow(0xffffff, { map: radioTex.texture })), 0.07, 1.28, 5.42);
  radioScreen.rotation.y = Math.PI;                                                   // faces the driver
  const knob = put(bus, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 10).rotateX(Math.PI / 2), mat({ color: 0x8a9096 })), 0.24, 1.28, 5.415);
  put(knob, box(0.004, 0.016, 0.004, mat({ color: 0x111111 })), 0, 0.008, -0.013);
  put(bus, box(0.05, 0.12, 0.04, mat({ color: 0x151618 })), -0.1, 1.27, 5.42);        // handset, on a hook beside it
  put(bus, box(0.03, 0.02, 0.03, binMat), -0.1, 1.345, 5.435);                         // its hook
  put(bus, new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 4, 10, Math.PI * 1.4), mat({ color: 0x151618 })), -0.1, 1.17, 5.43);  // curly cord

  // door control panel: a labeled plate with a big lit button that clicks down
  // a wedge that sits flat on the dash, its top sloping up toward the driver
  const wedge = new THREE.Shape();
  wedge.moveTo(-0.07, 0);
  wedge.lineTo(0.07, 0);
  wedge.lineTo(0.07, 0.075);
  wedge.lineTo(-0.07, 0.035);
  wedge.closePath();
  const wedgeGeo = new THREE.ExtrudeGeometry(wedge, { depth: 0.16, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(0.08, 0, 0);
  const pod = put(bus, new THREE.Mesh(wedgeGeo, binMat), 0.345, 1.39, 5.53);
  const face = put(pod, new THREE.Group(), 0, 0.055, 0);
  face.rotation.x = -Math.atan2(0.04, 0.14);                                 // lies on the sloped top
  const panelTex = tex.sign("DOORS", { bg: "#16171a", fg: "#e2e2e2", w: 64, h: 16, font: 12 });
  const label = put(face, new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.03), glow(0xffffff, { map: panelTex })), 0, 0.0015, 0.042);
  label.rotation.set(-Math.PI / 2, 0, Math.PI);                              // reads the right way up from the seat
  put(face, box(0.07, 0.01, 0.055, mat({ color: 0x5d6268 })), 0, 0.005, -0.028);  // bezel
  const doorBtn = put(face, box(0.05, 0.022, 0.038, glow(0x3fd06a)), 0, 0.016, -0.028);   // the lit button
  doorBtn.userData.interact = "doors";

  // sun visor above the driver; flips down
  const visorPivot = put(bus, new THREE.Group(), 0.7, 2.72, 5.6);
  const visorMat = mat({ color: 0x3a342b });
  const visor = put(visorPivot, box(0.6, 0.03, 0.3, visorMat), 0, 0, -0.16);
  visor.userData.interact = "visor";
  // hinge rod and its two brackets
  put(visorPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.66, 8).rotateZ(Math.PI / 2), mat({ color: 0xa8acb0 })), 0, 0.01, 0);
  for (const sx of [-0.34, 0.34]) put(visorPivot, box(0.03, 0.05, 0.04, trim), sx, 0.03, 0);
  // stitched padding: a raised rim around the edge
  const rim = mat({ color: 0x2a251f });
  put(visorPivot, box(0.6, 0.036, 0.02, rim), 0, 0, -0.305);
  put(visorPivot, box(0.02, 0.036, 0.3, rim), -0.29, 0, -0.16);
  put(visorPivot, box(0.02, 0.036, 0.3, rim), 0.29, 0, -0.16);
  // an elastic strap across the underside, with a folded paper tucked under it
  put(visorPivot, box(0.05, 0.008, 0.3, mat({ color: 0x15151a })), 0.12, -0.02, -0.16);
  const tucked = put(visorPivot, box(0.13, 0.006, 0.09, mat({ color: 0xcfc29a })), 0.1, -0.023, -0.2);
  tucked.rotation.y = 0.15;
  tucked.visible = false;

  // rear-view mirror with a real camera behind it
  // a sharp mirror: 1024 x 320, anti-aliased and mip-mapped, so you can actually see who's behind you.
  // The glass, its housing and the stalk are one unit, so the glass fills the whole housing.
  const MW = 0.84, MH = 0.26;
  const mirrorRT = new THREE.WebGLRenderTarget(1024, 320, {
    magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true, samples: 4,
  });
  mirrorRT.texture.colorSpace = THREE.SRGBColorSpace;
  mirrorRT.texture.wrapS = THREE.RepeatWrapping;
  mirrorRT.texture.repeat.x = -1;
  mirrorRT.texture.anisotropy = 4;
  const mirrorMount = put(bus, new THREE.Group(), 0.22, 2.5, 5.8);
  mirrorMount.rotation.y = 0.12;                                    // angled toward the driver
  const housing = mat({ color: 0x17181b });
  put(mirrorMount, box(MW + 0.04, MH + 0.04, 0.035, housing), 0, 0, 0.005);
  // a slightly raised rim all the way around the glass
  for (const sy of [-1, 1]) put(mirrorMount, box(MW + 0.04, 0.016, 0.012, trim), 0, sy * (MH / 2 + 0.012), -0.016);
  for (const sx of [-1, 1]) put(mirrorMount, box(0.016, MH + 0.04, 0.012, trim), sx * (MW / 2 + 0.012), 0, -0.016);
  const mirror = put(mirrorMount, new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ map: mirrorRT.texture, color: 0xeef3f6 })), 0, 0, -0.0135);
  mirror.rotation.y = Math.PI;                                      // the glass faces the driver
  // stalk up to the ceiling
  put(mirrorMount, box(0.05, 0.2, 0.05, trim), 0, MH / 2 + 0.1, 0.01);
  put(mirrorMount, box(0.12, 0.02, 0.1, trim), 0, MH / 2 + 0.2, 0.01);
  const mirrorCam = new THREE.PerspectiveCamera(38, MW / MH, 0.1, 60);
  mirrorCam.position.set(0.22, 2.35, 5.6);
  mirrorCam.rotation.set(-0.12, -0.08, 0);   // cameras look down -z: toward the back of the bus
  mirrorCam.layers.enable(MIRROR_ONLY);
  bus.add(mirrorCam);

  // ---- the front door: two framed glass leaves that fold in, a real stairwell ----
  const metal = mat({ color: 0x9aa0a6 });
  const rubber = mat({ color: 0x0c0c0d });
  const chrome = mat({ color: 0xc8ccd0 });
  const safety = mat({ color: 0xe0b21e, emissive: 0x2a1e00 });
  const DZ0 = 3.72;
  const DZ1 = 5.58;
  // door portal: body-coloured posts with a black rubber seal facing the opening, a header, a threshold
  for (const [z, e] of [[DZ0 - 0.05, 1], [DZ1 + 0.05, -1]]) {
    put(bus, box(0.12, 2.2, 0.1, shell), -W, 1.38, z);
    put(bus, box(0.13, 2.2, 0.03, rubber), -W, 1.38, z + e * 0.06);
  }
  put(bus, box(0.14, 0.14, DZ1 - DZ0 + 0.2, shell), -W, 2.54, (DZ0 + DZ1) / 2);
  put(bus, box(0.15, 0.03, DZ1 - DZ0, rubber), -W, 2.46, (DZ0 + DZ1) / 2);
  put(bus, box(0.04, 0.2, DZ1 - DZ0, trim), -W + 0.02, 0.1, (DZ0 + DZ1) / 2);          // riser under the door
  put(bus, box(0.1, 0.015, DZ1 - DZ0 + 0.1, chrome), -W + 0.03, 0.2075, (DZ0 + DZ1) / 2);  // threshold
  // a lit side sign above the door, like a real city bus
  const sideSign = tex.sign("9  NORTHGATE", { bg: "#120c02", fg: "#ffb54a", w: 128, h: 20, font: 15 });
  const sign = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2), glow(0xffffff, { map: sideSign })), -W - 0.052, 2.76, (DZ0 + DZ1) / 2);
  sign.rotation.y = -Math.PI / 2;
  put(bus, box(0.05, 0.26, 1.38, trim), -W - 0.02, 2.76, (DZ0 + DZ1) / 2);
  // the leaves: black aluminium frames, big tinted glass panes, a lower kick panel,
  // fat rubber seals where they meet, and a steel grab handle on the inside
  const doorFrame = mat({ color: 0x18191c });
  const doorGlass = new THREE.MeshLambertMaterial({ color: 0x34505e, transparent: true, opacity: 0.4, depthWrite: false });
  // Each leaf is bi-fold, like real inward-folding bus doors: two glass halves hinged together.
  // Opening, the outer half swings in from the post while the inner half folds back against it,
  // so the whole leaf tucks up beside its post in the stairwell (half a leaf deep) and never
  // reaches the dash or the handrails.
  // ---- hands on the glass (hidden until a scene wants them): the hand itself pressed to the outside of the
  // door and the windows, or the prints it leaves (on your window, where the thing held on)
  const handSets = { door: new THREE.Group(), windows: new THREE.Group(), ash: new THREE.Group() };
  Object.values(handSets).forEach((gr) => { gr.visible = false; bus.add(gr); });
  let handT = 0;
  const pressOn = (gr, kind, x, y, z, side, tilt, size = 1) => {
    const h = handMesh(kind, size);
    h.position.set(x, y, z);
    h.rotation.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, tilt);      // flat on the glass
    h.userData.baseY = y;
    h.userData.slide = 0.05 + Math.random() * 0.12;                       // how far it slides down the glass
    gr.add(h);
  };
  // the door glass: a crowd of hands, high and low
  for (const [y, z, t] of [[1.95, 3.95, 0.2], [1.62, 4.25, -0.3], [2.1, 4.55, 0.1], [1.35, 4.8, 0.4], [1.8, 5.05, -0.15], [2.05, 5.35, 0.3], [1.1, 4.1, -0.5], [1.5, 5.4, 0.15]]) {
    pressOn(handSets.door, "press", -W - 0.035, y, z, -1, t, 0.95 + Math.random() * 0.25);
  }
  // every window: pairs of hands, both sides, all the way down the bus
  for (const side of [-1, 1]) {
    for (let z = -5.2; z < (side < 0 ? 3.3 : 5.4); z += 1.05 + Math.random() * 0.4) {
      const y = 1.7 + Math.random() * 0.55;
      pressOn(handSets.windows, "press", side * (W + 0.035), y, z, side, (Math.random() - 0.5) * 0.9, 0.9 + Math.random() * 0.3);
      if (Math.random() < 0.7) pressOn(handSets.windows, "press", side * (W + 0.035), y + (Math.random() - 0.5) * 0.3, z + 0.28, side, (Math.random() - 0.5) * 0.9, 0.9 + Math.random() * 0.3);
    }
  }
  // the driver's window: prints, where it held on
  for (const [y, z, t] of [[2.05, 4.3, 0.3], [1.8, 5.1, -0.2], [2.25, 4.95, 0.1]]) pressOn(handSets.ash, "print", W + 0.03, y, z, 1, t, 1.15);

  const doorPanels = [];
  const leafW = (DZ1 - DZ0) / 2;
  const half = leafW / 2;
  const H = 2.215;
  // one half-leaf, built out from its hinge edge (local z = 0) in direction dir
  const doorHalf = (parent, dir, closing) => {
    const g = put(parent, new THREE.Group(), 0, 0, 0);
    const c = dir * half / 2;
    put(g, box(0.055, 0.08, half, doorFrame), 0, H - 0.04, c);                    // top rail
    put(g, box(0.055, 0.1, half, doorFrame), 0, 0.05, c);                         // bottom rail
    put(g, box(0.055, 0.06, half, doorFrame), 0, 0.62, c);                        // kick-panel rail
    put(g, box(0.03, 0.46, half - 0.06, metal), 0, 0.33, c);                      // brushed kick panel
    put(g, box(0.055, H, 0.045, doorFrame), 0, H / 2, dir * 0.0225);              // stile, hinge edge
    put(g, box(0.055, H, 0.045, doorFrame), 0, H / 2, dir * (half - 0.0225));     // stile, far edge
    put(g, box(0.014, H - 0.79, half - 0.07, doorGlass), 0, (0.65 + H - 0.08) / 2, c);   // tall pane
    if (closing) {
      put(g, box(0.075, H - 0.06, 0.05, rubber), 0, H / 2, dir * (half + 0.018));   // the seal they close on
      // grab handle on the inside, on two stand-offs
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.85, 8), chrome), 0.075, 1.32, dir * (half - 0.12));
      for (const hy of [0.92, 1.72]) put(g, box(0.07, 0.025, 0.025, chrome), 0.045, hy, dir * (half - 0.12));
    }
    return g;
  };
  for (const [z, dir] of [[DZ0, 1], [DZ1, -1]]) {
    const pivot = put(bus, new THREE.Group(), -W, 0.225, z);
    doorHalf(pivot, dir, false);
    const fold = put(pivot, new THREE.Group(), 0, 0, dir * half);
    doorHalf(fold, dir, true);
    put(fold, box(0.06, H - 0.12, 0.022, rubber), 0, H / 2, 0);                   // rubber fold joint
    doorPanels.push({ pivot, fold, dir });
  }
  // stairwell: two steps with yellow safety edges, a step light, chrome handrails
  const stepMat = mat({ map: tex.busFloor(), color: 0x6b6d70 });
  const SWL = 1.98, SWZ = 4.65;                                              // stairwell length and centre
  put(bus, box(0.48, 0.2, SWL, stepMat), -0.99, 0.1, SWZ);                  // lower step, solid to the road
  put(bus, box(0.04, 0.012, SWL, safety), -0.77, 0.206, SWZ);
  put(bus, box(0.28, 0.34, SWL, stepMat), -0.61, 0.17, SWZ);                // upper step
  put(bus, box(0.04, 0.012, SWL, safety), -0.49, 0.346, SWZ);
  put(bus, box(0.03, 0.47, SWL, trim), -0.455, 0.235, SWZ);                 // riser up to the floor
  put(bus, box(0.04, 0.012, SWL, safety), -0.455, 0.476, SWZ);              // yellow edge at the top
  for (const z of [3.66, 5.64]) put(bus, box(0.8, 0.46, 0.04, trim), -0.86, 0.23, z);    // stairwell side walls
  put(bus, box(0.02, 0.04, 0.3, glow(0xfff1c8)), -0.474, 0.4, DZ1 - 0.25);    // step light, in the riser
  for (const z of [DZ0 + 0.15, DZ1 - 0.15]) {
    put(bus, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.54, 8), chrome), -0.6, 1.61, z);
  }
  put(bus, box(0.05, 0.1, 0.34, trim), -1.18, 2.36, DZ1 - 0.3);             // door warning light: housing...
  put(bus, box(0.02, 0.06, 0.28, glow(0xffb54a)), -1.15, 2.36, DZ1 - 0.3);   // ...and lens
  // the little corner of body between the door and the windshield
  put(bus, box(0.08, 2.1, 0.3, shell), -W, 1.4, 5.84);

  // breath on the glass: a fog pane inside every window, the whole windshield, the door and the back window
  const fogPanes = { all: [] };
  const fogPane = (name, w, h, x, y, z, ry, px, seed) => {
    const p = makeFogPane(w, h, { px, seed });
    p.mesh.position.set(x, y, z);
    p.mesh.rotation.y = ry;
    bus.add(p.mesh);
    fogPanes.all.push(p);
    if (name) fogPanes[name] = p;
    return p;
  };
  fogPane("windshield", 2.46, 1.46, 0, 2.1, 5.972, Math.PI, 512, 3);
  fogPane(null, 11.8, 1.26, W - 0.035, 1.95, 0, -Math.PI / 2, 768, 5);
  fogPane(null, 9.5, 1.26, -W + 0.035, 1.95, -1.2, Math.PI / 2, 640, 9);
  fogPane("door", 1.8, 1.42, -W + 0.07, 1.62, (DZ0 + DZ1) / 2, Math.PI / 2, 192, 11);
  fogPane(null, 2.46, 1.36, 0, 2.05, -5.972, 0, 256, 13);

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
  const waterIn = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(2.42, 11.9).rotateX(-Math.PI / 2),
    waterMaterial({ deep: 0x0a1810, scale: 2.2, chop: 1.4, murk: 0.4, opacity: 0.88, side: THREE.DoubleSide })), 0, 0.48, 0);
  waterIn.visible = false;

  // ---- state
  const state = { doorsOpen: false, doorAmt: 0, interior: "on", flickerT: 0, routeText: "", routeGlitch: false, radio: "CH 9", visorDown: false };

  // the route display. Text that fits sits in the middle; anything longer slides through it, right to left,
  // the way a real LED sign scrolls
  function drawRoute() {
    const c = route.ctx;
    c.fillStyle = "#0b0702";
    c.fillRect(0, 0, 160, 24);
    let text = state.routeText;
    if (state.routeGlitch && Math.random() < 0.15) text = text.replace(/[A-Z?]/g, () => "?#%&@"[Math.floor(Math.random() * 5)]);
    c.fillStyle = state.routeGlitch ? "#ffd27a" : "#ffb54a";
    c.font = "bold 14px monospace";
    c.textBaseline = "middle";
    const jitter = state.routeGlitch && Math.random() < 0.1 ? (Math.random() - 0.5) * 6 : 0;
    const w = c.measureText(state.routeText).width;
    if (w <= 150) {
      state.routeScroll = null;
      c.textAlign = "center";
      c.fillText(text, 80 + jitter, 12);
    } else {
      // (one whole pass, a gap, and round again)
      const lap = w + 60;
      const x = 160 - ((state.routeScroll || 0) % (lap + 160));
      c.textAlign = "left";
      c.fillText(text, Math.round(x + jitter), 12);
      state.routeScrolling = true;
    }
    // the LED grid over it
    c.fillStyle = "rgba(0,0,0,.28)";
    for (let i = 0; i < 160; i += 2) c.fillRect(i, 0, 1, 24);
    for (let j = 0; j < 24; j += 2) c.fillRect(0, j, 160, 1);
    route.texture.needsUpdate = true;
  }
  function drawDash(info) {
    const c = dash.ctx;
    // laid out in the top two thirds: the steering wheel's rim covers the bottom of the screen
    c.fillStyle = "#050505";
    c.fillRect(0, 0, 144, 60);
    c.fillStyle = "#ffb54a";
    c.textBaseline = "alphabetic";
    c.textAlign = "right";
    c.font = "bold 26px monospace";
    c.fillText(String(Math.round(info.speed * 2.237)), 50, 30);
    c.textAlign = "left";
    c.font = "bold 11px monospace";
    c.fillText("mph", 53, 30);
    c.textAlign = "right";
    c.font = "bold 14px monospace";
    c.fillText(info.clock, 140, 17);
    c.font = "bold 11px monospace";
    c.fillStyle = info.late > 0 ? "#ff5a4f" : "#86cf9b";
    c.fillText(info.late > 0 ? `LATE ${info.late}m` : "ON TIME", 140, 33);
    c.textAlign = "left";
    c.fillStyle = "#3a2a10";
    c.fillRect(4, 40, 136, 1);
    c.fillStyle = "#8a6a2a";
    c.font = "9px monospace";
    c.fillText("ROUTE 9 · NIGHT", 4, 52);
    dash.texture.needsUpdate = true;
  }
  function drawRadio() {
    const c = radioTex.ctx;
    c.fillStyle = "#050505";
    c.fillRect(0, 0, 96, 32);
    if (state.radio) {
      // the whole thing always fits: long text gets a smaller font
      c.fillStyle = "#86cf9b";
      let size = 21;
      c.font = `bold ${size}px monospace`;
      const w = c.measureText(state.radio).width;
      if (w > 86) { size = Math.max(10, Math.floor(size * 86 / w)); c.font = `bold ${size}px monospace`; }
      c.textBaseline = "middle";
      c.fillText(state.radio, 5, 16);
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
    logbook,
    radioMesh: radio,
    // points (local) people walk through to get on: outside, steps, aisle
    boardPath: [new THREE.Vector3(-2.3, 0, 4.6), new THREE.Vector3(-0.9, 0.45, 4.6), new THREE.Vector3(-0.1, 0.45, 3.6)],
    // the height of whatever you're standing on, in bus space: the road, the two steps, the floor
    groundAt(x, z) {
      if (z > 3.62 && z < 5.68) {
        if (x < -1.25) return 0;          // the road outside the door
        if (x < -0.75) return 0.2;        // lower step
        if (x < -0.47) return 0.34;       // upper step
      }
      return x < -1.29 ? 0 : 0.45;        // the floor
    },
    driverEye: new THREE.Vector3(0.7, 1.72, 4.78),
    steeringWheel: wheelG,
    get doorsOpen() { return state.doorsOpen; },
    // how far open the doors are right now (0 shut, 1 open: they take a moment either way)
    get doorAmount() { return state.doorAmt; },
    setDoors(open) {
      if (open !== state.doorsOpen) state.btnT = 0.18;     // the button clicks down
      state.doorsOpen = open;
    },
    setRoute(text, glitch = false) { state.routeText = text; state.routeGlitch = glitch; state.routeScroll = 0; state.routeScrolling = false; drawRoute(); },
    setRadio(text) {
      if (text !== state.radio) state.knobTarget = (state.knobTarget || 0) - 1.1;   // the knob turns
      state.radio = text;
      drawRadio();
    },
    setVisor(down) { state.visorDown = down; },
    // the folded clipping tucked into the visor strap
    setClipping(on) { tucked.visible = on; },
    // 0 = clean glass, 1 = ash handprints, 2 = handprints and a crack
    // hands on the outside of the glass: null | "door" | "windows" | "ash" (prints on the driver's window)
    setHands(set) {
      for (const [name, group] of Object.entries(handSets)) group.visible = name === set || (set === "windows" && name === "door");
      handT = 0;
    },
    // the glass misting over (0 clear ... 1 fogged right over)
    fogPanes,
    setFog(k) { fogPanes.all.forEach((p) => p.set(k)); },
    setSmudge(level) { if (level) smudge.material.map = smudgeTexes[level - 1]; smudge.visible = level > 0; },
    smudgeTextures: smudgeTexes,
    // where something lands on the windshield (bus space, feet of a 2 m figure)
    windshieldLanding: new THREE.Vector3(0.3, 0.55, 6.17),
    setInterior(mode) { state.interior = mode; },
    get interiorMode() { return state.interior; },
    get passengers() { return bus.children.filter((c) => c.userData.person).length; },
    setHeadlights(on) { head.intensity = on ? 160 : 0; },
    get headlightsOn() { return head.intensity > 0; },
    // the solid body of the bus, in the world: what you can't walk through. Only the shell, never whatever's
    // attached to it (the camera rides in it with things hanging off it; the doorway has a trigger box)
    bounds() {
      bus.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const x of [-W - 0.05, W + 0.05]) for (const y of [0, 3.35]) for (const z of [-6.15, 6.2]) {
        box.expandByPoint(bus.localToWorld(new THREE.Vector3(x, y, z)));
      }
      return box;
    },
    // 0 = dry, 1 = up to the seats
    // (water coming in starts as a film on the floor: it only darkens to its full murk over the first few centimetres)
    setWater(level) {
      state.water = level;
      waterIn.visible = level > 0;
      waterIn.position.y = 0.48 + level * 0.45;
      waterIn.material.uniforms.uOpacity.value = 0.88 * Math.min(1, 0.25 + level / 0.12);
    },
    get water() { return state.water || 0; },
    update(dt, info) {
      // doors swing
      const target = state.doorsOpen ? 1 : 0;
      state.doorAmt += Math.sign(target - state.doorAmt) * Math.min(Math.abs(target - state.doorAmt), dt * 2.2);
      // leaves fold inward into the stairwell (eased, like air doors)
      const eased = state.doorAmt * state.doorAmt * (3 - 2 * state.doorAmt);
      handT += dt;
      for (const name of ["door", "windows"]) {
        if (!handSets[name].visible) continue;
        // pressing, flexing, sliding slowly down the glass
        for (const h of handSets[name].children) h.position.y = h.userData.baseY - Math.min(h.userData.slide, handT * 0.03) + Math.sin(handT * 3 + h.position.z * 5) * 0.004;
      }
      doorPanels.forEach(({ pivot, fold, dir }) => {
        pivot.rotation.y = dir * eased * 1.45;        // the outer half swings in...
        fold.rotation.y = -dir * eased * 2.9;         // ...and the inner half folds back against it
      });
      visorPivot.rotation.x = THREE.MathUtils.lerp(visorPivot.rotation.x, state.visorDown ? -1.45 : 0, dt * 6);
      // the steering wheel turns into the corners
      wheelG.rotation.z = THREE.MathUtils.lerp(wheelG.rotation.z, THREE.MathUtils.clamp((info.steer || 0) * 9, -2.2, 2.2), Math.min(1, dt * 4));
      // door button: pressed in for a moment, green = closed, amber = open
      state.btnT = Math.max(0, (state.btnT || 0) - dt);
      doorBtn.position.y = state.btnT > 0 ? 0.01 : 0.016;
      doorBtn.material.color.set(state.doorsOpen ? 0xffa32a : 0x3fd06a);
      knob.rotation.z += ((state.knobTarget || 0) - knob.rotation.z) * Math.min(1, dt * 10);
      // interior lights
      state.flickerT += dt;
      let level = 1;
      if (state.interior === "off") level = Math.random() < 0.01 ? 0.5 : 0;
      if (state.interior === "flicker") level = Math.sin(state.flickerT * 31) > 0.6 || Math.random() < 0.08 ? 0.15 : 1;
      if (state.interior === "red") level = 0.6;
      if (state.interior === "dim") level = Math.random() < 0.05 ? 0.06 : 0.24;
      interior.forEach((l) => {
        l.intensity = 5 * level;
        l.color.set(state.interior === "red" ? 0xff2a1a : state.interior === "dim" ? 0x7fcfbf : 0xe6eeff);
      });
      strips.forEach((s) => s.material.color.set(level > 0.2 ? (state.interior === "red" ? 0xff3a2a : 0xe8f0ff) : 0x202224));
      dashLight.intensity = state.interior === "off" || state.interior === "dim" ? 0.4 : 0.8;
      // the fog is only as bright as the lights on it; on the door, it folds away with the glass
      for (const p of fogPanes.all) if (p.mesh.visible) p.light(Math.max(0.12, level));
      fogPanes.door.mesh.visible = fogPanes.door.amount > 0.002 && state.doorAmt < 0.04;
      // screens (redrawn a few times a second; a scrolling route display every frame, so it slides smoothly)
      dashTimer -= dt;
      if (state.routeScrolling) {
        state.routeScroll = (state.routeScroll || 0) + dt * 34;
        drawRoute();
      }
      if (dashTimer <= 0) {
        dashTimer = 0.15;
        drawDash(info);
        if (!state.routeScrolling) drawRoute();
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
