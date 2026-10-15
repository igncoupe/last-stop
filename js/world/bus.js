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
    // the orange stripe stops at the door, like the real paint job
    const stripe = mat({ color: 0xd2721f });
    if (side === -1) {
      put(bus, box(0.04, 0.16, 9.62, stripe), x - 0.05, 1.15, -1.19);
      put(bus, box(0.04, 0.16, 0.34, stripe), x - 0.05, 1.15, 5.83);
    } else put(bus, box(0.04, 0.16, 12, stripe), x + 0.05, 1.15, 0);
  }

  // front: dashboard, windshield, destination sign
  put(bus, box(2.5, 0.95, 0.08, shell), 0, 0.9, 6);
  put(bus, box(2.5, 1.5, 0.02, glassMat), 0, 2.1, 6);
  // what's left on the outside of the windshield after something hits it: ash handprints, a crack
  const smudgeCanvas = document.createElement("canvas");
  smudgeCanvas.width = 512;
  smudgeCanvas.height = 300;
  const smudgeTex = new THREE.CanvasTexture(smudgeCanvas);
  smudgeTex.colorSpace = THREE.SRGBColorSpace;
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
    // a print of a long, thin hand: smudged palm, four finger streaks, all dragged down the glass
    const hand = (cx, cy, rot, smear) => {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot);
      x.filter = "blur(1.5px)";
      x.fillStyle = "rgba(160,158,150,0.34)";
      x.beginPath(); x.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2); x.fill();
      for (let i = 0; i < 4; i++) {
        x.save();
        x.rotate((i - 1.5) * 0.16);
        x.beginPath(); x.ellipse((i - 1.5) * 1.2, -24, 2.2, 13 + (i === 1 || i === 2 ? 3 : 0), 0, 0, Math.PI * 2); x.fill();
        x.restore();
      }
      x.save(); x.rotate(-1.1); x.beginPath(); x.ellipse(0, -14, 2.2, 8, 0, 0, Math.PI * 2); x.fill(); x.restore();
      // dragged down the glass, streaky
      x.fillStyle = "rgba(160,158,150,0.13)";
      for (let i = 0; i < 4; i++) x.fillRect(-6 + i * 3.5, 4, 2.2, smear * (0.6 + Math.random() * 0.5));
      x.restore();
    };
    hand(U(-0.75), V(2.48), -0.35, 60);
    hand(U(1.18), V(2.5), 0.35, 70);
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
    smudgeTex.needsUpdate = true;
  }
  put(bus, box(2.4, 0.42, 0.7, trim), 0, 1.15, 5.62);
  const destTex = tex.sign("9  NORTHGATE", { bg: "#120c02", fg: "#ffb54a", w: 128, h: 20, font: 15 });
  put(bus, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), glow(0xffffff, { map: destTex })), 0, 2.83, 6.07);

  // back wall + back window
  put(bus, box(2.5, 1.0, 0.08, shell), 0, 0.92, -6);
  put(bus, box(2.5, 1.4, 0.02, glassMat), 0, 2.05, -6);

  // wheels: tire, steel hub, lug nuts, and a dark arch over each one.
  // The front wheel sits behind the door, like a real transit bus.
  const tireMat = mat({ color: 0x0e0e0f });
  const hubMat = mat({ color: 0x7c8186 });
  const archMat = mat({ color: 0x0b0b0c, side: THREE.DoubleSide });
  for (const z of [-3.7, 2.75]) for (const s of [1, -1]) {
    const wheelG = put(bus, new THREE.Group(), s * 1.13, 0.5, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.32, 14), tireMat);
    tire.rotation.z = Math.PI / 2;
    wheelG.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.34, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheelG.add(hub);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(wheelG, box(0.36, 0.04, 0.04, mat({ color: 0x3c4044 })), 0, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
    }
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.36, 14, 1, true, 0, Math.PI), archMat);   // the top half, over the tire
    arch.rotation.z = Math.PI / 2;
    put(bus, arch, s * 1.14, 0.5, z);
    // inside, the wheel sits under a raised housing, like a real low-floor bus
    put(bus, box(0.42, 0.72, 1.42, mat({ color: 0x3a3c40 })), s * 1.0, 0.8, z);
    put(bus, box(0.44, 0.03, 1.44, mat({ color: 0x8a6a1e })), s * 1.0, 1.17, z);      // worn yellow edge
  }

  // outside details: bumpers, lights, mirrors, roof unit
  const blackPlastic = mat({ color: 0x1a1b1d });
  put(bus, box(2.62, 0.28, 0.16, blackPlastic), 0, 0.32, 6.08);
  put(bus, box(2.62, 0.28, 0.16, blackPlastic), 0, 0.32, -6.08);
  for (const s of [1, -1]) {
    put(bus, box(0.34, 0.16, 0.04, glow(0xfff4d6)), s * 0.95, 0.62, 6.06);       // headlights
    put(bus, box(0.12, 0.1, 0.04, glow(0xffa32a)), s * 1.18, 0.62, 6.06);        // turn signals
    put(bus, box(0.3, 0.2, 0.04, glow(0x9c1410)), s * 1.0, 0.75, -6.06);        // tail lights
    // side mirror on an arm
    put(bus, box(0.05, 0.05, 0.5, blackPlastic), s * 1.45, 2.35, 5.9);
    put(bus, box(0.12, 0.38, 0.22, blackPlastic), s * 1.68, 2.15, 6.12);
  }
  put(bus, box(1.6, 0.28, 2.4, mat({ color: 0xc9c1ab })), 0, 3.2, -1.5);      // roof AC unit
  for (const s of [1, -1]) {
    put(bus, box(0.04, 0.05, 12, blackPlastic), s * (W + 0.04), 1.31, 0);       // window rail, bottom
    put(bus, box(0.04, 0.05, 12, blackPlastic), s * (W + 0.04), 2.62, 0);       // window rail, top
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
  put(bus, box(0.55, 0.5, 0.1, mat({ color: 0x1c1d20 })), 0.7, 1.22, 4.45);   // low, so you can look back over it
  // steering wheel: rim, three spokes, hub, column
  const wheelG = put(bus, new THREE.Group(), 0.7, 1.42, 5.32);
  wheelG.rotation.x = -1.1;
  wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 6, 24), mat({ color: 0x3a3b40 })));
  // worn grip wrap at ten and two
  for (const a of [0.55, Math.PI - 0.55]) {
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.026, 6, 6, 0.7), mat({ color: 0x25262a }));
    grip.rotation.z = a - 0.35;
    wheelG.add(grip);
  }
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const spoke = box(0.2, 0.026, 0.016, mat({ color: 0x7a8086 }));
    spoke.position.set(Math.cos(a - Math.PI / 2) * 0.1, Math.sin(a - Math.PI / 2) * 0.1, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheelG.add(spoke);
  }
  wheelG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12).rotateX(Math.PI / 2), mat({ color: 0x2a2c30 })));
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), mat({ color: 0xa8a090 }));
  badge.position.z = 0.027;
  wheelG.add(badge);
  put(bus, box(0.06, 0.06, 0.4, trim), 0.7, 1.3, 5.45);
  // fare box: body, coin slot, glowing display, ticket slot
  const fare = put(bus, new THREE.Group(), -0.05, 0, 5.05);
  put(fare, box(0.3, 0.95, 0.3, mat({ color: 0x3d4045 })), 0, 0.92, 0);
  put(fare, box(0.32, 0.06, 0.32, mat({ color: 0x8a9096 })), 0, 1.42, 0);
  put(fare, box(0.08, 0.01, 0.02, mat({ color: 0x050505 })), 0, 1.455, 0.04);
  put(fare, box(0.18, 0.08, 0.01, glow(0x5fd38a)), 0, 1.25, -0.155);
  put(fare, box(0.12, 0.015, 0.01, mat({ color: 0x050505 })), 0, 1.1, -0.155);

  // dashboard screen: speed, time, schedule (redrawn by update())
  const dash = tex.live(96, 40);
  const dashScreen = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.15), glow(0xffffff, { map: dash.texture })), 0.7, 1.37, 5.33);
  dashScreen.rotation.set(-0.55, Math.PI, 0, "YXZ");

  // route display above the windshield, facing the passengers and you
  const route = tex.live(160, 24);
  const routeScreen = put(bus, new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2), glow(0xffffff, { map: route.texture })), -0.3, 2.62, 5.9);
  routeScreen.rotation.y = Math.PI;

  // the two-way radio: body, display, a channel knob and a handset on a hook
  const radioTex = tex.live(48, 16);
  const radio = put(bus, box(0.22, 0.09, 0.15, [trim, trim, trim, trim, trim, glow(0xffffff, { map: radioTex.texture })]), 0.2, 1.4, 5.52);
  radio.userData.interact = "radio";
  const knob = put(bus, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 10).rotateX(Math.PI / 2), mat({ color: 0x8a9096 })), 0.27, 1.4, 5.435);
  put(knob, box(0.004, 0.018, 0.004, mat({ color: 0x111111 })), 0, 0.008, -0.013);
  put(bus, box(0.05, 0.11, 0.04, mat({ color: 0x151618 })), 0.06, 1.46, 5.47);       // handset
  put(bus, new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 4, 10, Math.PI * 1.4), mat({ color: 0x151618 })), 0.06, 1.38, 5.45);  // curly cord

  // door control panel: a labeled plate with a big lit button that clicks down
  const panelTex = tex.sign("DOORS", { bg: "#1b1c1f", fg: "#d8d8d8", w: 48, h: 16, font: 10 });
  put(bus, box(0.13, 0.015, 0.1, [trim, trim, glow(0xffffff, { map: panelTex }), trim, trim, trim]), 0.36, 1.355, 5.37);
  const doorBtn = put(bus, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), glow(0x3fd06a)), 0.36, 1.37, 5.35);
  doorBtn.userData.interact = "doors";

  // sun visor above the driver; flips down
  const visorPivot = put(bus, new THREE.Group(), 0.7, 2.72, 5.72);
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
  // door posts, header and threshold
  put(bus, box(0.14, 2.15, 0.1, trim), -W, 1.52, DZ0 - 0.05);
  put(bus, box(0.14, 2.15, 0.1, trim), -W, 1.52, DZ1 + 0.05);
  put(bus, box(0.16, 0.16, DZ1 - DZ0 + 0.2, trim), -W, 2.56, (DZ0 + DZ1) / 2);
  put(bus, box(0.16, 0.06, DZ1 - DZ0 + 0.2, chrome), -W, 0.03, (DZ0 + DZ1) / 2);
  // body panel below the window line, closing the side in around the door
  put(bus, box(0.08, 0.5, 0.12, shell), -W, 0.25, DZ0 - 0.16);
  // the leaves: frame, glass, push bar and a rubber seal on the closing edge
  const doorPanels = [];
  const leafW = (DZ1 - DZ0) / 2;
  for (const [z, dir] of [[DZ0, 1], [DZ1, -1]]) {
    const pivot = put(bus, new THREE.Group(), -W, 0.08, z);
    const leaf = put(pivot, new THREE.Group(), 0, 0, dir * leafW / 2);
    const H = 2.38;
    put(leaf, box(0.05, 0.08, leafW, metal), 0, H, 0);                  // top rail
    put(leaf, box(0.05, 0.3, leafW, metal), 0, 0.15, 0);                // kick plate
    put(leaf, box(0.05, H, 0.05, metal), 0, H / 2, -dir * (leafW / 2 - 0.025));  // hinge stile
    put(leaf, box(0.05, H, 0.05, metal), 0, H / 2, dir * (leafW / 2 - 0.025));   // closing stile
    put(leaf, box(0.07, H, 0.03, rubber), 0, H / 2, dir * (leafW / 2 + 0.01));   // rubber seal
    put(leaf, box(0.012, H - 0.4, leafW - 0.1, glassMat), 0, H / 2 + 0.1, 0);    // glass
    put(leaf, box(0.06, 0.05, leafW - 0.1, metal), 0, 1.25, 0);         // mid rail
    put(leaf, box(0.05, 0.04, leafW * 0.6, chrome), -0.05, 1.05, 0);    // push bar (inside)
    doorPanels.push({ pivot, dir });
  }
  // stairwell: two steps with yellow safety edges, a step light, chrome handrails
  const stepMat = mat({ map: tex.busFloor(), color: 0x6b6d70 });
  put(bus, box(0.5, 0.06, DZ1 - DZ0, stepMat), -1.0, 0.17, (DZ0 + DZ1) / 2);   // lower step
  put(bus, box(0.04, 0.03, DZ1 - DZ0, safety), -0.77, 0.21, (DZ0 + DZ1) / 2);
  put(bus, box(0.3, 0.06, DZ1 - DZ0, stepMat), -0.62, 0.31, (DZ0 + DZ1) / 2);  // upper step
  put(bus, box(0.04, 0.03, DZ1 - DZ0, safety), -0.49, 0.35, (DZ0 + DZ1) / 2);
  put(bus, box(0.04, 0.03, DZ1 - DZ0, safety), -1.22, 0.06, (DZ0 + DZ1) / 2);
  put(bus, box(0.6, 0.3, 0.05, trim), -0.95, 0.15, DZ0);                  // stairwell walls
  put(bus, box(0.6, 0.3, 0.05, trim), -0.95, 0.15, DZ1);
  put(bus, box(0.02, 0.05, 0.3, glow(0xfff1c8)), -0.66, 0.38, DZ1 - 0.1);  // step light
  for (const z of [DZ0 + 0.1, DZ1 - 0.1]) {
    put(bus, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 6), chrome), -0.9, 1.3, z);
  }
  put(bus, box(0.02, 0.1, 0.3, glow(0xffb54a)), -1.17, 2.5, DZ1 - 0.25);  // door warning light
  // the little corner of body between the door and the windshield
  put(bus, box(0.08, 2.1, 0.3, shell), -W, 1.4, 5.84);

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
    setDoors(open) {
      if (open !== state.doorsOpen) state.btnT = 0.18;     // the button clicks down
      state.doorsOpen = open;
    },
    setRoute(text, glitch = false) { state.routeText = text; state.routeGlitch = glitch; drawRoute(); },
    setRadio(text) {
      if (text !== state.radio) state.knobTarget = (state.knobTarget || 0) - 1.1;   // the knob turns
      state.radio = text;
      drawRadio();
    },
    setVisor(down) { state.visorDown = down; },
    // the folded clipping tucked into the visor strap
    setClipping(on) { tucked.visible = on; },
    // 0 = clean glass, 1 = ash handprints, 2 = handprints and a crack
    setSmudge(level) { drawSmudge(level); smudge.visible = level > 0; },
    // where something lands on the windshield (bus space, feet of a 2 m figure)
    windshieldLanding: new THREE.Vector3(0.3, 0.55, 6.17),
    setInterior(mode) { state.interior = mode; },
    get interiorMode() { return state.interior; },
    get passengers() { return bus.children.filter((c) => c.userData.person).length; },
    setHeadlights(on) { head.visible = on; },
    // 0 = dry, 1 = up to the seats
    setWater(level) { waterIn.visible = level > 0; waterIn.position.y = 0.48 + level * 0.45; },
    update(dt, info) {
      // doors swing
      const target = state.doorsOpen ? 1 : 0;
      state.doorAmt += Math.sign(target - state.doorAmt) * Math.min(Math.abs(target - state.doorAmt), dt * 2.2);
      // leaves fold inward into the stairwell (eased, like air doors)
      const eased = state.doorAmt * state.doorAmt * (3 - 2 * state.doorAmt);
      doorPanels.forEach(({ pivot, dir }) => { pivot.rotation.y = dir * eased * 1.42; });
      visorPivot.rotation.x = THREE.MathUtils.lerp(visorPivot.rotation.x, state.visorDown ? -1.45 : 0, dt * 6);
      // door button: pressed in for a moment, green = closed, amber = open
      state.btnT = Math.max(0, (state.btnT || 0) - dt);
      doorBtn.position.y = state.btnT > 0 ? 1.362 : 1.37;
      doorBtn.material.color.set(state.doorsOpen ? 0xffa32a : 0x3fd06a);
      knob.rotation.z += ((state.knobTarget || 0) - knob.rotation.z) * Math.min(1, dt * 10);
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
