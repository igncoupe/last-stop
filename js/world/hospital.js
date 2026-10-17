// The fourth floor of St. Agnes (4 West), built inside the real hospital on Route 9, so Room 4B's window
// looks down at the actual street: the stop, the rain, and your bus waiting at the curb.
// Only shown while you're up there. Behind some of the other doors, something is awake.
import * as THREE from "three";
import { mat, glow, box, decal } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { route, STOPS } from "./route.js";
import { Sound } from "../audio.js";

const FLOOR_Y = 10.8;                      // the fourth floor
const FACADE = 15;                         // the hospital's street face, meters right of the road's center
const D0 = STOPS["St. Agnes"] - 41;        // where the corridor starts; Room 4B's window ends up over the bus

// local space: +x out through the street face (toward the road), +z along the road, y up from the floor.
// The corridor runs along z between the patient rooms (street side) and the station and lounge (inside).
const CORR_IN = -7.8;                      // inner wall of the corridor
const CORR_OUT = -5.2;                     // street-side wall of the corridor
const CX = (CORR_IN + CORR_OUT) / 2;
const Z0 = -1;
const Z1 = 42;
const WALL_T = 0.15;
const H = 3;                               // floor to ceiling
const DOOR_W = 1.2;
const DOOR_H = 2.2;

// ---------------------------------------------------------------- textures (painted on small canvases)
let seed = 4;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function paint(w, h, draw, repeat = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const flecks = (x, w, h, n, colors) => {
  for (let i = 0; i < n; i++) {
    x.fillStyle = colors[Math.floor(rnd() * colors.length)];
    x.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
  }
};
const TX = {
  // sheet vinyl in 60 cm tiles, speckled, a little scuffed
  floor: paint(64, 64, (x) => {
    x.fillStyle = "#c4bfae"; x.fillRect(0, 0, 64, 64);
    flecks(x, 64, 64, 420, ["#9d9686", "#d9d4c4", "#aaa392", "#8d8778"]);
    x.fillStyle = "rgba(60,55,45,.18)"; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64); x.fillRect(32, 0, 1, 64); x.fillRect(0, 32, 64, 1);
    x.fillStyle = "rgba(255,255,250,.18)"; x.fillRect(6, 8, 18, 3); x.fillRect(40, 44, 14, 2);        // where the lights shine on it
    x.strokeStyle = "rgba(40,36,30,.25)"; x.beginPath(); x.arc(46, 18, 7, 0.4, 2.1); x.stroke();          // a scuff from a wheel
  }),
  accent: paint(32, 32, (x) => {
    x.fillStyle = "#5f827d"; x.fillRect(0, 0, 32, 32);
    flecks(x, 32, 32, 90, ["#4a6a66", "#7a9a95"]);
    x.fillStyle = "rgba(0,0,0,.2)"; x.fillRect(0, 0, 32, 1); x.fillRect(0, 0, 1, 32);
  }),
  // a lay-in ceiling: fissured tiles on a white grid
  ceiling: paint(64, 64, (x) => {
    x.fillStyle = "#d5d3c9"; x.fillRect(0, 0, 64, 64);
    flecks(x, 64, 64, 380, ["rgba(90,88,80,.35)", "rgba(120,118,110,.3)"]);
    x.fillStyle = "#eeede6"; x.fillRect(0, 0, 64, 2); x.fillRect(0, 0, 2, 64); x.fillRect(32, 0, 2, 64); x.fillRect(0, 32, 64, 2);
    x.fillStyle = "rgba(150,120,70,.2)"; x.beginPath(); x.ellipse(48, 48, 9, 6, 0.3, 0, Math.PI * 2); x.fill();   // an old water stain
  }),
  wallUp: paint(32, 32, (x) => {
    x.fillStyle = "#d6d0bf"; x.fillRect(0, 0, 32, 32);
    flecks(x, 32, 32, 60, ["#ccc6b4", "#dfd9c9"]);
  }),
  // the lower wall: wipe-clean panels
  wallLow: paint(32, 32, (x) => {
    x.fillStyle = "#8ea69c"; x.fillRect(0, 0, 32, 32);
    flecks(x, 32, 32, 70, ["#819a90", "#9ab2a8"]);
    x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(31, 0, 1, 32);
  }),
  troffer: paint(32, 16, (x) => {
    x.fillStyle = "#f6f8f0"; x.fillRect(0, 0, 32, 16);
    x.fillStyle = "#c9ccc2";
    for (let i = 0; i <= 32; i += 8) x.fillRect(i, 0, 1, 16);
    x.fillRect(0, 0, 32, 1); x.fillRect(0, 8, 32, 1); x.fillRect(0, 15, 32, 1);
  }, false),
  trofferOff: paint(32, 16, (x) => {
    x.fillStyle = "#4a4d49"; x.fillRect(0, 0, 32, 16);
    x.fillStyle = "#3a3c39";
    for (let i = 0; i <= 32; i += 8) x.fillRect(i, 0, 1, 16);
    x.fillRect(0, 8, 32, 1);
  }, false),
  // a patient room door: wood veneer, a narrow wired-glass window, a steel kick plate
  door: paint(64, 128, (x) => {
    x.fillStyle = "#9b7550"; x.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(70,45,25,${0.1 + rnd() * 0.15})`; x.fillRect(Math.floor(rnd() * 64), 0, 1, 128); }
    x.fillStyle = "#2f3436"; x.fillRect(42, 14, 12, 44);
    x.fillStyle = "#1a2124"; x.fillRect(43, 15, 10, 42);
    x.fillStyle = "rgba(160,170,170,.35)";
    for (let i = 15; i < 57; i += 4) x.fillRect(43, i, 10, 1);
    for (let i = 43; i < 53; i += 4) x.fillRect(i, 15, 1, 42);
    x.fillStyle = "#a7acaf"; x.fillRect(0, 112, 64, 16);
    x.fillStyle = "#8c9195"; x.fillRect(0, 112, 64, 1);
    x.fillStyle = "#c9cdd0"; x.fillRect(6, 64, 10, 3); x.fillRect(6, 62, 3, 7);       // lever handle
  }, false),
  // a plain service door: painted steel
  steelDoor: paint(32, 64, (x) => {
    x.fillStyle = "#7f8f96"; x.fillRect(0, 0, 32, 64);
    flecks(x, 32, 64, 50, ["#74838a", "#8a9aa1"]);
    x.fillStyle = "#bfc4c7"; x.fillRect(3, 32, 6, 2);
    x.fillStyle = "#a7acaf"; x.fillRect(0, 56, 32, 8);
  }, false),
  // brushed steel elevator doors
  elevator: paint(64, 128, (x) => {
    x.fillStyle = "#9da2a5"; x.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 64; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "0,0,0"},${0.04 + rnd() * 0.06})`; x.fillRect(i, 0, 1, 128); }
    x.fillStyle = "#4b4f52"; x.fillRect(31, 0, 2, 128);
    x.fillStyle = "rgba(0,0,0,.15)"; x.fillRect(0, 100, 64, 28);
  }, false),
  curtain: paint(64, 64, (x) => {
    for (let i = 0; i < 64; i++) {
      const k = 0.78 + 0.22 * Math.sin(i / 64 * Math.PI * 10);
      x.fillStyle = `rgb(${Math.round(150 * k)},${Math.round(178 * k)},${Math.round(194 * k)})`;
      x.fillRect(i, 0, 1, 64);
    }
    x.fillStyle = "#d8dcd9"; x.fillRect(0, 0, 64, 9);
    x.fillStyle = "rgba(90,96,100,.5)";
    for (let i = 0; i < 64; i += 3) x.fillRect(i, 1, 1, 7);
  }),
  blanket: paint(32, 32, (x) => {
    x.fillStyle = "#a7bfd2"; x.fillRect(0, 0, 32, 32);
    x.fillStyle = "rgba(60,90,120,.25)";
    for (let i = 0; i < 32; i += 4) { x.fillRect(i, 0, 1, 32); x.fillRect(0, i, 32, 1); }
  }),
  sheet: paint(32, 32, (x) => {
    x.fillStyle = "#e7e9e3"; x.fillRect(0, 0, 32, 32);
    x.fillStyle = "rgba(120,125,130,.25)"; x.fillRect(4, 10, 24, 1); x.fillRect(9, 22, 18, 1);
  }),
  slats: paint(16, 32, (x) => {
    for (let i = 0; i < 32; i += 2) { x.fillStyle = i % 4 ? "#d9dbd6" : "#b9bcb6"; x.fillRect(0, i, 16, 2); }
  }),
  grille: paint(32, 16, (x) => {
    x.fillStyle = "#cfc8b4"; x.fillRect(0, 0, 32, 16);
    x.fillStyle = "#8f897a";
    for (let i = 2; i < 30; i += 3) x.fillRect(i, 2, 1, 7);
    x.fillStyle = "#b8b19d"; x.fillRect(0, 11, 32, 1);
  }, false),
  laminate: paint(32, 32, (x) => {
    x.fillStyle = "#cdbb98"; x.fillRect(0, 0, 32, 32);
    x.fillStyle = "rgba(90,70,40,.35)"; x.fillRect(0, 12, 32, 1); x.fillRect(14, 4, 4, 2); x.fillRect(14, 18, 4, 2);
  }, false),
  cork: paint(64, 48, (x) => {
    x.fillStyle = "#a57f4d"; x.fillRect(0, 0, 64, 48);
    flecks(x, 64, 48, 220, ["#8a6538", "#bd9762"]);
    const papers = [["#f1efe6", 4, 4, 16, 20], ["#fff5a8", 24, 6, 14, 12], ["#e6eef7", 42, 3, 18, 22], ["#f1efe6", 26, 24, 16, 20], ["#ffd6d6", 6, 28, 14, 14]];
    for (const [c, px, py, pw, ph] of papers) {
      x.fillStyle = c; x.fillRect(px, py, pw, ph);
      x.fillStyle = "rgba(40,40,40,.5)";
      for (let l = py + 3; l < py + ph - 2; l += 3) x.fillRect(px + 2, l, pw - 4, 1);
      x.fillStyle = "#c0392b"; x.fillRect(px + pw / 2, py + 1, 2, 2);
    }
  }, false),
  // the station's census board
  census: paint(128, 64, (x) => {
    x.fillStyle = "#f4f4ef"; x.fillRect(0, 0, 128, 64);
    x.fillStyle = "#1d4f8f"; x.font = "bold 9px sans-serif"; x.fillText("4 WEST  ·  NIGHT", 4, 10);
    x.fillStyle = "#333"; x.font = "7px monospace";
    const rows = [["4A", "—"], ["4B", "VARGA, T."], ["4C", "—"], ["4D", "HOLLIS"], ["4E", "—"], ["4F", "ADEYEMI"], ["4G", "—"], ["4H", "PRZYBYL"]];
    rows.forEach(([r, n], i) => { const cx = i < 4 ? 4 : 66; const cy = 20 + (i % 4) * 11; x.fillText(r, cx, cy); x.fillText(n, cx + 14, cy); });
    x.fillStyle = "#b03a2e"; x.font = "bold 7px sans-serif"; x.fillText("RN: MARA", 90, 10);
    x.strokeStyle = "#999"; x.strokeRect(0.5, 0.5, 127, 63);
  }, false),
  // Room 4B's whiteboard
  board4b: paint(128, 84, (x) => {
    x.fillStyle = "#f7f7f2"; x.fillRect(0, 0, 128, 84);
    x.fillStyle = "#1d4f8f"; x.font = "bold 8px sans-serif"; x.fillText("ST. AGNES  ·  ROOM 4B", 5, 11);
    x.fillStyle = "#222"; x.font = "7px sans-serif";
    x.fillText("Your nurse tonight:", 5, 24); x.fillText("Patient:", 5, 35); x.fillText("Today is:", 5, 46); x.fillText("Goal:", 5, 57);
    x.fillStyle = "#1e6b3a"; x.font = "italic 8px serif";
    x.fillText("Mara", 74, 24); x.fillText("T. Varga", 44, 35); x.fillText("rest  ·  comfort", 30, 57);
    x.fillStyle = "rgba(60,60,60,.3)"; x.fillRect(46, 41, 56, 6);                      // the date, wiped off and wiped off
    x.fillStyle = "#a12b2b"; x.font = "italic 8px serif";
    x.fillText("Is Route 9 running?", 8, 70); x.fillText("Yes  <3", 82, 79);
    x.strokeStyle = "#9a9a9a"; x.strokeRect(0.5, 0.5, 127, 83);
  }, false),
  poster: paint(48, 64, (x) => {
    x.fillStyle = "#f2f5f7"; x.fillRect(0, 0, 48, 64);
    x.fillStyle = "#1d6fa5"; x.fillRect(0, 0, 48, 14);
    x.fillStyle = "#fff"; x.font = "bold 7px sans-serif"; x.fillText("CLEAN", 4, 7); x.fillText("HANDS", 4, 13);
    x.fillStyle = "#e8c4a8"; x.fillRect(10, 22, 12, 20); x.fillRect(26, 22, 12, 20);
    x.fillStyle = "#7fb7da"; for (let i = 0; i < 8; i++) x.fillRect(8 + rnd() * 32, 20 + rnd() * 24, 2, 2);
    x.fillStyle = "#333"; x.font = "5px sans-serif"; x.fillText("SAVE LIVES", 10, 54); x.fillText("20 SECONDS", 9, 61);
  }, false),
  wetFloor: paint(32, 32, (x) => {
    x.fillStyle = "#f2c315"; x.fillRect(0, 0, 32, 32);
    x.fillStyle = "#111"; x.font = "bold 6px sans-serif"; x.fillText("CAUTION", 3, 8);
    x.fillRect(14, 12, 3, 3); x.fillRect(13, 15, 4, 7); x.fillRect(10, 22, 4, 2); x.fillRect(17, 21, 5, 2);
    x.font = "bold 5px sans-serif"; x.fillText("WET FLOOR", 2, 30);
  }, false),
  clock: paint(32, 32, (x) => {
    x.fillStyle = "#222"; x.beginPath(); x.arc(16, 16, 16, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#f4f4ef"; x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#333";
    for (let i = 0; i < 12; i++) x.fillRect(16 + Math.sin(i / 6 * Math.PI) * 12 - 0.5, 16 - Math.cos(i / 6 * Math.PI) * 12 - 0.5, 1.5, 1.5);
    x.strokeStyle = "#111"; x.lineWidth = 2;
    x.beginPath(); x.moveTo(16, 16); x.lineTo(16 + Math.sin(0.23 * Math.PI) * 7, 16 - Math.cos(0.23 * Math.PI) * 7); x.stroke();   // 12:27
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(16, 16); x.lineTo(16 + Math.sin(0.9 * Math.PI) * 11, 16 - Math.cos(0.9 * Math.PI) * 11); x.stroke();
  }, false),
  photo: paint(24, 18, (x) => {
    x.fillStyle = "#c8b48a"; x.fillRect(0, 0, 24, 18);
    x.fillStyle = "#6c6a5c"; x.fillRect(2, 2, 20, 14);
    x.fillStyle = "#d9cfae"; x.fillRect(3, 8, 18, 6);                  // a city bus, a long time ago
    x.fillStyle = "#5a6a78"; for (let i = 4; i < 20; i += 3) x.fillRect(i, 9, 2, 2);
    x.fillStyle = "#3a2d24"; x.fillRect(4, 5, 2, 3); x.fillRect(16, 5, 2, 3);   // two people waving
  }, false),
  // rain on the window glass: drops, and the trails they leave
  rainGlass: paint(64, 64, (x) => {
    x.clearRect(0, 0, 64, 64);
    for (let i = 0; i < 70; i++) {
      const px = Math.floor(rnd() * 64);
      const py = Math.floor(rnd() * 64);
      x.fillStyle = `rgba(210,225,240,${0.25 + rnd() * 0.35})`;
      x.fillRect(px, py, 1, 1 + Math.floor(rnd() * 2));
    }
    for (let i = 0; i < 9; i++) {
      const px = Math.floor(rnd() * 64);
      const len = 10 + Math.floor(rnd() * 30);
      const py = Math.floor(rnd() * 64);
      x.fillStyle = "rgba(200,215,235,.22)";
      for (let k = 0; k < len; k++) x.fillRect(px + Math.round(Math.sin((py + k) / 6)), (py + k) % 64, 1, 1);
    }
  }),
  tvNoise: paint(16, 12, (x) => { flecks(x, 16, 12, 192, ["#7a8aa8", "#c8d6f0", "#3a4658", "#9fb0cc"]); }, false),
};
TX.rainGlass2 = TX.rainGlass.clone();
TX.rainGlass2.needsUpdate = true;

export function buildHospital(scene) {
  const g = new THREE.Group();
  g.position.copy(route.at(D0, FACADE, FLOOR_Y));
  g.rotation.y = route.heading(D0);
  scene.add(g);
  // the meshes are only drawn while you're up there; the lights stay in the scene (switched off)
  // so the number of lights never changes
  const inside = new THREE.Group();
  inside.visible = false;
  g.add(inside);

  const M = {
    floor: mat({ map: TX.floor }),
    accent: decal(mat({ map: TX.accent }), 1),
    ceiling: mat({ map: TX.ceiling }),
    wallUp: mat({ map: TX.wallUp }),
    wallLow: mat({ map: TX.wallLow }),
    base: mat({ color: 0x3a3d3c }),
    rail: mat({ color: 0xb08a5c }),
    frame: mat({ color: 0x7d8b91 }),
    steel: mat({ color: 0xa9adb0 }),
    chrome: mat({ color: 0xc6cacc }),
    white: mat({ color: 0xe8e8e2 }),
    beige: mat({ color: 0xcfc8b4 }),
    dark: mat({ color: 0x262829 }),
    black: mat({ color: 0x121314 }),
    red: mat({ color: 0xa8231c }),
    teal: mat({ color: 0x3f6e6c }),
    vinylChair: mat({ color: 0x4b6f73 }),
    wood: mat({ color: 0x8a6a48 }),
    glassDark: glow(0x0e1418),
    door: mat({ map: TX.door }),
    steelDoor: mat({ map: TX.steelDoor }),
    elevator: mat({ map: TX.elevator }),
    curtain: mat({ map: TX.curtain, side: THREE.DoubleSide }),
    blanket: mat({ map: TX.blanket }),
    sheet: mat({ map: TX.sheet }),
    slats: mat({ map: TX.slats }),
    grille: mat({ map: TX.grille }),
    laminate: mat({ map: TX.laminate }),
    troffer: glow(0xffffff, { map: TX.troffer }),
    trofferOff: mat({ map: TX.trofferOff }),
  };
  const solids = [];
  const add = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const blk = (w, h, d, m, x, y, z, { solid = false, tile = null, parent = inside } = {}) => {
    const b = add(parent, box(w, h, d, m, tile), x, y, z);
    if (solid) solids.push(b);
    return b;
  };
  const plane = (w, h, m, x, y, z, ry = 0, parent = inside) => {
    const p = add(parent, new THREE.Mesh(new THREE.PlaneGeometry(w, h), m), x, y, z);
    p.rotation.y = ry;
    return p;
  };
  const rod = (a, b, r, m, parent = inside) => {
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    parent.add(mesh);
    return mesh;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const sign = (text, w, h, x, y, z, ry, opts = {}) =>
    plane(w, h, glow(0xffffff, { map: tex.sign(text, { bg: "#f0efe8", fg: "#1f2a30", w: 128, h: 32, font: 13, ...opts }) }), x, y, z, ry);

  // ---- a wall along z (at x), from z0 to z1, two-tone, with a handrail; gaps where doors open
  // face: +1 if the side you see faces +x, -1 if it faces -x
  function wallZ(x, z0, z1, face, { rail = true, gaps = [] } = {}) {
    const cuts = [z0, ...gaps.flatMap(([a, b]) => [a, b]), z1];
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i];
      const b = cuts[i + 1];
      const len = b - a;
      if (len <= 0.01) continue;
      const zc = (a + b) / 2;
      blk(WALL_T, 1.1, len, M.wallLow, x, 0.55, zc, { solid: true, tile: [2, 1.1] });
      blk(WALL_T, H - 1.1, len, M.wallUp, x, 1.1 + (H - 1.1) / 2, zc, { tile: [2, 1.9] });
      blk(0.02, 0.1, len, M.base, x + face * (WALL_T / 2 + 0.01), 0.05, zc);
      if (rail && len > 0.6) {
        blk(0.05, 0.06, len - 0.2, M.rail, x + face * (WALL_T / 2 + 0.07), 0.9, zc);
        for (let bz = a + 0.3; bz < b - 0.2; bz += 1.2) blk(0.06, 0.04, 0.03, M.chrome, x + face * (WALL_T / 2 + 0.03), 0.88, bz);
      }
    }
    // the wall above each opening
    for (const [a, b] of gaps) blk(WALL_T, H - DOOR_H, b - a, M.wallUp, x, DOOR_H + (H - DOOR_H) / 2, (a + b) / 2);
  }
  // a wall along x (at z), from x0 to x1
  function wallX(z, x0, x1, { gaps = [] } = {}) {
    const cuts = [x0, ...gaps.flatMap(([a, b]) => [a, b]), x1];
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i];
      const b = cuts[i + 1];
      if (b - a <= 0.01) continue;
      const xc = (a + b) / 2;
      blk(b - a, 1.1, WALL_T, M.wallLow, xc, 0.55, z, { solid: true, tile: [2, 1.1] });
      blk(b - a, H - 1.1, WALL_T, M.wallUp, xc, 1.1 + (H - 1.1) / 2, z, { tile: [2, 1.9] });
    }
    for (const [a, b] of gaps) blk(b - a, H - DOOR_H, WALL_T, M.wallUp, (a + b) / 2, DOOR_H + (H - DOOR_H) / 2, z);
  }
  // floor and ceiling over a rectangle
  function slab(x0, x1, z0, z1, { lights = true, off = [] } = {}) {
    const w = x1 - x0;
    const d = z1 - z0;
    blk(w, 0.1, d, M.floor, (x0 + x1) / 2, -0.05, (z0 + z1) / 2, { tile: [1.2, 1.2] });
    blk(w, 0.1, d, M.ceiling, (x0 + x1) / 2, H + 0.05, (z0 + z1) / 2, { tile: [1.2, 1.2] });
    if (!lights) return [];
    const panels = [];
    for (let z = z0 + 1.2; z < z1 - 0.6; z += 2.4) {
      const isOff = off.some((o) => Math.abs(o - z) < 1.2);
      panels.push(blk(0.6, 0.02, 1.2, isOff ? M.trofferOff : M.troffer, (x0 + x1) / 2, H - 0.005, z));
    }
    return panels;
  }
  // a door in a wall along z, seen from the corridor; open: 0 shut, else the angle it stands open at
  function door(x, zc, face, { m = M.door, open = 0, w = DOOR_W, label = null, name = null, dispenser = true } = {}) {
    // the steel frame
    for (const s of [-1, 1]) blk(0.08, DOOR_H + 0.05, 0.06, M.frame, x + face * 0.06, (DOOR_H + 0.05) / 2, zc + s * (w / 2 + 0.03));
    blk(0.08, 0.06, w + 0.12, M.frame, x + face * 0.06, DOOR_H + 0.03, zc);
    // the leaf, hinged on the -z side
    const pivot = add(inside, new THREE.Group(), x - face * 0.01, 0, zc - w / 2);
    const leaf = blk(0.05, DOOR_H - 0.02, w - 0.02, m, 0, DOOR_H / 2, w / 2, { parent: pivot });
    pivot.rotation.y = -face * open;         // opens away from the corridor, into the room
    solids.push(leaf);
    // the room sign beside it, with a name slot
    if (label) {
      const plate = glow(0xffffff, { map: tex.sign(label, { bg: "#33414a", fg: "#f4f4f4", w: 64, h: 32, font: 16 }) });
      plane(0.26, 0.13, plate, x + face * 0.09, 1.62, zc + w / 2 + 0.3, face > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (name) plane(0.26, 0.06, glow(0xffffff, { map: tex.sign(name, { bg: "#f4f4ef", fg: "#222", w: 64, h: 16, font: 9 }) }), x + face * 0.09, 1.5, zc + w / 2 + 0.3, face > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    if (dispenser) {
      blk(0.1, 0.2, 0.13, M.white, x + face * 0.12, 1.25, zc - w / 2 - 0.3);
      blk(0.06, 0.03, 0.04, M.dark, x + face * 0.17, 1.15, zc - w / 2 - 0.3);
    }
    return pivot;
  }

  // ================================================================ the corridor
  const corridorPanels = slab(CORR_IN, CORR_OUT, Z0, Z1, { off: [16.6, 31] });
  // teal border tiles a little way out from each wall
  blk(0.25, 0.01, Z1 - Z0, M.accent, CORR_IN + 0.35, 0.005, (Z0 + Z1) / 2);
  blk(0.25, 0.01, Z1 - Z0, M.accent, CORR_OUT - 0.35, 0.005, (Z0 + Z1) / 2);

  // street side: patient rooms 4H ... 4A, each 5.2 m wide. 4E stands open a little; 4B is open.
  const ROOMS = [["4H", 2.8], ["4G", 8.0], ["4F", 13.2], ["4E", 18.4], ["4D", 23.6], ["4C", 28.8], ["4B", 34.0], ["4A", 39.2]];
  const doorZ = (zc) => zc + 1.6;
  const outGaps = [[doorZ(18.4) - DOOR_W / 2, doorZ(18.4) + DOOR_W / 2], [doorZ(34) - DOOR_W / 2, doorZ(34) + DOOR_W / 2]];
  wallZ(CORR_OUT + WALL_T / 2, Z0, Z1, -1, { gaps: outGaps });
  const NAMES = { "4B": "VARGA, T.", "4D": "HOLLIS, R.", "4F": "ADEYEMI, O.", "4H": "PRZYBYL, A." };
  for (const [n, zc] of ROOMS) {
    door(CORR_OUT, doorZ(zc), -1, { open: n === "4B" ? 1.45 : n === "4E" ? 0.55 : 0, label: n, name: NAMES[n] });
  }

  // inside: the elevators, two service doors, the nurses' station, the staff lounge, more rooms
  const LOBBY = [0.4, 5.6];
  const STATION = [11.4, 20.6];
  const LOUNGE_DOOR = 22.6;
  wallZ(CORR_IN - WALL_T / 2, Z0, Z1, 1, { gaps: [LOBBY, STATION, [LOUNGE_DOOR - DOOR_W / 2, LOUNGE_DOOR + DOOR_W / 2]] });
  const inner = [["SOILED UTILITY", 7.2], ["CLEAN SUPPLY", 9.9], ["4J", 28.2], ["4K", 33.4], ["QUIET ROOM", 38.6]];
  for (const [n, z] of inner) {
    const isRoom = /^4/.test(n);
    door(CORR_IN, z, 1, { m: isRoom ? M.door : M.steelDoor, w: isRoom ? DOOR_W : 0.95, label: isRoom ? n : null, dispenser: isRoom });
    if (!isRoom) sign(n, 0.7, 0.16, CORR_IN + 0.09, 2.3, z, Math.PI / 2);
  }
  door(CORR_IN, LOUNGE_DOOR, 1, { m: M.steelDoor, open: 0.5, dispenser: false });
  sign("STAFF LOUNGE", 0.7, 0.16, CORR_IN + 0.09, 2.3, LOUNGE_DOOR, Math.PI / 2);

  // the two ends: stairs, under green EXIT signs
  wallX(Z0 - WALL_T / 2, CORR_IN, CORR_OUT);
  wallX(Z1 + WALL_T / 2, CORR_IN, CORR_OUT);
  for (const [z, ry] of [[Z0 + 0.01, 0], [Z1 - 0.01, Math.PI]]) {
    const pivot = add(inside, new THREE.Group(), CX, 0, z);
    pivot.rotation.y = ry;
    blk(1.0, 2.1, 0.05, M.steelDoor, 0, 1.05, 0, { parent: pivot });
    blk(0.8, 0.05, 0.08, M.chrome, 0, 1.0, 0.05, { parent: pivot });                   // the push bar
    plane(0.4, 0.15, glow(0xffffff, { map: tex.sign("EXIT", { bg: "#0d1a10", fg: "#3dff6a", w: 64, h: 24, font: 18 }) }), CX, 2.62, z + (ry ? -0.03 : 0.03), ry);
    sign("STAIR " + (ry ? "B" : "A"), 0.42, 0.12, CX + 0.85, 1.65, z + (ry ? -0.02 : 0.02), ry);
  }
  // ceiling details: smoke detectors and sprinkler heads, and a hanging sign
  for (let z = 3; z < Z1; z += 6) {
    add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), M.white), CX + 0.6, H - 0.02, z);
    add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 5), M.chrome), CX - 0.6, H - 0.03, z + 3);
  }
  const hang = add(inside, new THREE.Group(), CX, 2.62, 6.2);
  plane(1.5, 0.3, glow(0xffffff, { map: tex.sign("4 WEST   ROOMS 4A–4H  →", { bg: "#1f4d73", fg: "#ffffff", w: 160, h: 32, font: 12 }) }), 0, 0, 0, Math.PI, hang);
  plane(1.5, 0.3, glow(0xffffff, { map: tex.sign("←  ELEVATORS   STAIR A", { bg: "#1f4d73", fg: "#ffffff", w: 160, h: 32, font: 12 }) }), 0, 0, 0.01, 0, hang);
  for (const s of [-0.6, 0.6]) blk(0.01, 0.38, 0.01, M.chrome, s, 0.34, 0, { parent: hang });

  // ---- the elevator lobby
  slab(CORR_IN - 3, CORR_IN, LOBBY[0], LOBBY[1], { lights: false });
  blk(0.6, 0.02, 1.2, M.troffer, CORR_IN - 1.5, H - 0.005, 3);
  wallZ(CORR_IN - 3 - WALL_T / 2, LOBBY[0], LOBBY[1], 1, { rail: false });
  wallX(LOBBY[0] - WALL_T / 2, CORR_IN - 3, CORR_IN);
  wallX(LOBBY[1] + WALL_T / 2, CORR_IN - 3, CORR_IN);
  for (const z of [1.8, 4.2]) {
    blk(0.04, 2.2, 1.1, M.elevator, CORR_IN - 2.93, 1.1, z);
    for (const s of [-1, 1]) blk(0.06, 2.3, 0.06, M.steel, CORR_IN - 2.9, 1.15, z + s * 0.58);
    blk(0.06, 0.06, 1.22, M.steel, CORR_IN - 2.9, 2.3, z);
    plane(0.16, 0.1, glow(0xffffff, { map: tex.sign("4", { bg: "#120b04", fg: "#ff9a3a", w: 16, h: 12, font: 10 }) }), CORR_IN - 2.9, 2.5, z, Math.PI / 2);
  }
  blk(0.03, 0.22, 0.1, M.steel, CORR_IN - 2.93, 1.15, 3.0);
  plane(0.04, 0.04, glow(0xffd27a), CORR_IN - 2.9, 1.2, 3.0, Math.PI / 2);
  plane(0.04, 0.04, glow(0x6e5a3a), CORR_IN - 2.9, 1.1, 3.0, Math.PI / 2);
  // waiting chairs and a fake plant
  for (let i = 0; i < 3; i++) chair(CORR_IN - 0.5 - i * 0.62, LOBBY[1] - 0.45, Math.PI);
  plant(CORR_IN - 2.5, LOBBY[0] + 0.45);

  // ---- the nurses' station: an empty counter, screens still on, a call light blinking for 4B
  const SB = CORR_IN - 3.4;                  // back wall of the station
  slab(SB, CORR_IN, STATION[0], STATION[1], { lights: false });
  blk(0.6, 0.02, 1.2, M.troffer, CORR_IN - 1.7, H - 0.005, 14.4);
  blk(0.6, 0.02, 1.2, M.trofferOff, CORR_IN - 1.7, H - 0.005, 17.6);
  wallZ(SB - WALL_T / 2, STATION[0], STATION[1], 1, { rail: false });
  wallX(STATION[0] - WALL_T / 2, SB, CORR_IN);
  wallX(STATION[1] + WALL_T / 2, SB, CORR_IN);
  const cx0 = CORR_IN - 0.75;                // the counter
  blk(0.5, 1.05, 7.8, M.laminate, cx0, 0.525, 16, { solid: true });
  blk(0.32, 0.04, 7.9, M.white, cx0 + 0.32, 1.12, 16);
  blk(0.04, 0.12, 7.9, M.white, cx0 + 0.18, 1.08, 16);
  for (const zz of [12.15, 19.85]) blk(1.6, 1.05, 0.5, M.laminate, cx0 - 0.55, 0.525, zz, { solid: true });
  blk(0.7, 0.04, 7.0, M.beige, SB + 0.4, 0.76, 16);                 // the desk along the back wall
  blk(0.04, 0.5, 7.0, M.dark, SB + 0.06, 1.4, 16);                   // shelf back
  for (let i = 0; i < 14; i++) blk(0.22, 0.28, 0.06, [M.red, M.teal, M.beige, M.dark][i % 4], SB + 0.2, 1.45, 13.2 + i * 0.13);
  // screens: one facing out over the counter so you can see it from the hall
  const screenTex = paint(32, 24, (x) => {
    x.fillStyle = "#0b1f3a"; x.fillRect(0, 0, 32, 24);
    x.fillStyle = "#2f6fb5"; x.fillRect(0, 0, 32, 4);
    x.fillStyle = "#9cc8f0";
    for (let r = 6; r < 22; r += 3) x.fillRect(2, r, 6 + Math.floor(rnd() * 20), 1);
    x.fillStyle = "#e05555"; x.fillRect(26, 6, 4, 2);
  }, false);
  for (const [zz, ry] of [[14.0, Math.PI / 2 - 0.3], [17.6, Math.PI / 2 + 0.25]]) {
    const mon = add(inside, new THREE.Group(), cx0 - 0.05, 1.05, zz);
    mon.rotation.y = ry;
    blk(0.5, 0.32, 0.04, M.black, 0, 0.26, 0, { parent: mon });
    plane(0.46, 0.28, glow(0xffffff, { map: screenTex }), 0, 0.26, 0.025, 0, mon);
    blk(0.04, 0.12, 0.04, M.black, 0, 0.06, -0.02, { parent: mon });
  }
  blk(0.16, 0.06, 0.22, M.dark, cx0 - 0.1, 1.08, 15.6);              // the phone
  add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.11, 8), M.white), cx0 - 0.15, 1.11, 18.5);   // a cold coffee
  officeChair(SB + 1.1, 14.6, 0.4);
  officeChair(SB + 1.5, 18.2, -0.9);                                  // pushed back, like someone left in a hurry
  // census board, clock, the call-light panel, a hand-washing poster
  plane(1.4, 0.7, glow(0xffffff, { map: TX.census }), SB + 0.01, 1.85, 16.4, Math.PI / 2);
  plane(0.32, 0.32, glow(0xffffff, { map: TX.clock }), SB + 0.01, 2.45, 13.0, Math.PI / 2);
  const callTex = tex.live(48, 12);
  const callPanel = plane(0.6, 0.15, glow(0xffffff, { map: callTex.texture }), SB + 0.01, 2.45, 19.2, Math.PI / 2);
  void callPanel;
  plane(1.8, 0.28, glow(0xffffff, { map: tex.sign("NURSES' STATION", { bg: "#1f4d73", fg: "#ffffff", w: 160, h: 24, font: 13 }) }), CORR_IN + 0.02, 2.55, 16, Math.PI / 2);
  plane(0.36, 0.48, glow(0xffffff, { map: TX.poster }), CORR_IN + 0.09, 1.5, 10.95, Math.PI / 2);

  // ---- the staff lounge: dark, a television talking to nobody
  const LB = CORR_IN - 4.6;
  slab(LB, CORR_IN, 21.0, 26.0, { lights: false });
  blk(0.6, 0.02, 1.2, M.trofferOff, CORR_IN - 2.3, H - 0.005, 23.5);
  wallZ(LB - WALL_T / 2, 21, 26, 1, { rail: false });
  wallX(21 - WALL_T / 2, LB, CORR_IN);
  wallX(26 + WALL_T / 2, LB, CORR_IN);
  blk(0.9, 0.45, 2.0, M.teal, LB + 2.4, 0.22, 23.6, { solid: true });          // a sofa
  blk(0.25, 0.45, 2.0, M.teal, LB + 2.85, 0.6, 23.6);
  blk(0.6, 0.4, 1.0, M.wood, LB + 1.4, 0.2, 23.6, { solid: true });            // coffee table
  blk(0.08, 0.5, 0.85, M.black, LB + 0.08, 1.5, 23.6);                          // the TV
  const tvMat = glow(0xffffff, { map: TX.tvNoise });
  plane(0.78, 0.44, tvMat, LB + 0.13, 1.5, 23.6, Math.PI / 2);
  const tvSpill = blk(1.4, 0.01, 1.6, glow(0x8fa6d8, { transparent: true, opacity: 0.0, depthWrite: false }), CORR_IN + 0.75, 0.012, LOUNGE_DOOR);

  // ---- along the walls: things a ward keeps in its corridor
  wheelchair(CORR_IN + 0.45, 4.9 + 3.4, -Math.PI / 2);
  ivPole(CORR_OUT - 0.35, 16.8, null);
  crashCart(CORR_IN + 0.33, 21.0 + 3.1);
  linenCart(CORR_OUT - 0.33, 27.3);
  gurney(CORR_IN + 0.38, 36.4);
  vitalsStand(CORR_OUT - 0.32, 11.6);
  wetFloor(CORR_IN + 0.55, 25.6);
  // fire extinguisher cabinet, a water fountain, a bulletin board
  blk(0.12, 0.7, 0.45, M.red, CORR_IN + 0.06, 1.3, 26.6);
  plane(0.36, 0.58, glow(0x2a3236, { transparent: true, opacity: 0.6 }), CORR_IN + 0.125, 1.3, 26.6, Math.PI / 2);
  blk(0.32, 0.3, 0.42, M.steel, CORR_IN + 0.16, 0.85, 31.0);
  blk(1.3, 0.85, 0.02, mat({ map: TX.cork }), CORR_IN + 0.02, 1.6, 36.2).rotation.y = Math.PI / 2;
  sign("QUIET PLEASE · PATIENTS RESTING", 0.9, 0.14, CORR_OUT - 0.09, 2.35, 21.4, -Math.PI / 2, { font: 10 });
  sign("VISITING HOURS END AT 9 PM", 0.8, 0.13, CORR_IN + 0.09, 2.35, 3.0 + 3.2, Math.PI / 2, { font: 10 });

  // ================================================================ Room 4B
  const RZ = 34;                             // the room's middle
  const R0 = RZ - 2.6 + WALL_T;              // the room's own wall faces
  const R1 = RZ + 2.6 - WALL_T;
  const RX0 = CORR_OUT + WALL_T;
  const WX = -0.12;                          // the window glass
  const WZ = RZ + 0.6;                       // the window's middle
  const roomPanels = slab(CORR_OUT, -0.05, R0, R1, { lights: false });
  void roomPanels;
  blk(0.6, 0.02, 1.2, M.trofferOff, -2.6, H - 0.005, RZ);
  wallX(RZ - 2.6 + WALL_T / 2, CORR_OUT, -0.05);
  wallX(RZ + 2.6 - WALL_T / 2, CORR_OUT, -0.05);
  // the street wall, built round the window
  const SILL = 0.85;
  const TOP = 2.35;
  const HALF = 1.1;
  const sw = (z0, z1, y0, y1) => blk(0.15, y1 - y0, z1 - z0, y0 < 1.1 ? M.wallLow : M.wallUp, -0.125, (y0 + y1) / 2, (z0 + z1) / 2, { solid: y0 < 1, tile: [2, 1.5] });
  sw(RZ - 2.6, RZ + 2.6, 0, SILL);
  sw(RZ - 2.6, RZ + 2.6, TOP, H);
  sw(RZ - 2.6, WZ - HALF, SILL, TOP);
  sw(WZ + HALF, RZ + 2.6, SILL, TOP);
  // the window: an aluminum frame, two panes, rain running down the glass
  const alu = mat({ color: 0x8b9196 });
  blk(0.16, 0.06, HALF * 2 + 0.1, alu, -0.12, SILL + 0.03, WZ);
  blk(0.16, 0.06, HALF * 2 + 0.1, alu, -0.12, TOP - 0.03, WZ);
  for (const s of [-1, 0, 1]) blk(0.16, TOP - SILL, s ? 0.06 : 0.05, alu, -0.12, (SILL + TOP) / 2, WZ + s * (HALF + 0.02));
  blk(0.12, 0.04, HALF * 2, alu, -0.12, 1.38, WZ);                                // the transom over the lower panes
  const glassMat = glow(0x9fb6c8, { transparent: true, opacity: 0.1, depthWrite: false });
  const winGlass = plane(HALF * 2, TOP - SILL, glassMat, WX, (SILL + TOP) / 2, WZ, -Math.PI / 2);
  TX.rainGlass.repeat.set(1.6, 1.1);
  TX.rainGlass2.repeat.set(1.1, 0.8);
  plane(HALF * 2, TOP - SILL, glow(0xffffff, { map: TX.rainGlass, transparent: true, opacity: 0.55, depthWrite: false }), WX - 0.005, (SILL + TOP) / 2, WZ, -Math.PI / 2);
  plane(HALF * 2, TOP - SILL, glow(0xffffff, { map: TX.rainGlass2, transparent: true, opacity: 0.4, depthWrite: false }), WX - 0.01, (SILL + TOP) / 2, WZ, -Math.PI / 2);
  // inside: the sill, the heater under it, blinds pulled most of the way up
  blk(0.3, 0.04, HALF * 2 + 0.3, M.white, -0.33, SILL - 0.01, WZ);
  blk(0.3, 0.55, HALF * 2 - 0.1, M.grille, -0.36, 0.3, WZ, { solid: true });
  blk(0.07, 0.07, HALF * 2 + 0.1, M.white, -0.24, TOP - 0.04, WZ);
  blk(0.05, 0.24, HALF * 2, M.slats, -0.24, TOP - 0.2, WZ);
  blk(0.04, 0.03, HALF * 2, M.white, -0.24, TOP - 0.34, WZ);
  for (const s of [-0.7, 0.75]) blk(0.006, 0.6, 0.006, M.white, -0.22, TOP - 0.62, WZ + s);
  blk(0.012, 0.75, 0.012, M.chrome, -0.21, TOP - 0.75, WZ - 0.9);           // the wand
  // a dead plant on the sill, and a card that's been there a long time
  add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.12, 8), mat({ color: 0x9a5a3a })), -0.33, SILL + 0.07, WZ + 0.8);
  for (let i = 0; i < 4; i++) rod(V(-0.33, SILL + 0.12, WZ + 0.8), V(-0.33 + (rnd() - 0.5) * 0.15, SILL + 0.25 + rnd() * 0.08, WZ + 0.8 + (rnd() - 0.5) * 0.2), 0.006, mat({ color: 0x6b5a32 }));
  const card = blk(0.1, 0.13, 0.005, M.white, -0.3, SILL + 0.08, WZ - 0.6);
  card.rotation.set(0, 0.3, -0.2);

  // the bed: head against the wall by the door, the window at its side
  const BX = -2.6;
  const BZ = R0 + 1.05;                       // the middle of the bed (its head just off the wall)
  blk(0.92, 0.3, 1.95, M.dark, BX, 0.3, BZ, { solid: true });
  for (const [sx, sz] of [[-0.4, -0.85], [0.4, -0.85], [-0.4, 0.85], [0.4, 0.85]]) blk(0.06, 0.12, 0.06, M.black, BX + sx, 0.06, BZ + sz);
  blk(0.9, 0.18, 2.0, M.sheet, BX, 0.56, BZ);
  blk(0.62, 0.12, 0.38, M.white, BX, 0.71, R0 + 0.3);                              // the pillow
  blk(0.97, 0.3, 1.2, M.blanket, BX, 0.79, BZ + 0.4);                               // the blanket, over his legs
  blk(0.98, 0.04, 0.16, M.white, BX, 0.95, BZ - 0.12);                              // the sheet folded over it
  blk(1.0, 0.55, 0.05, mat({ color: 0xc4bba4 }), BX, 0.88, R0 + 0.03);              // headboard
  blk(1.0, 0.4, 0.05, mat({ color: 0xc4bba4 }), BX, 0.72, BZ + 1.0);                // footboard
  blk(0.4, 0.07, 0.01, glow(0x2b4d3a), BX, 0.82, BZ + 1.03);                        // its control panel
  for (const s of [-1, 1]) {
    blk(0.03, 0.22, 0.85, M.frame, BX + s * 0.5, 0.86, R0 + 0.62);
    blk(0.03, 0.22, 0.65, M.frame, BX + s * 0.5, 0.86, BZ + 0.55);
  }
  blk(0.05, 0.03, 0.08, M.white, BX + 0.52, 0.98, R0 + 0.9);                       // the call button, clipped to the rail
  // the headwall: gases, the suction jar, a reading light
  blk(1.8, 0.32, 0.06, M.beige, BX, 1.5, R0 + 0.03);
  for (const [dx, c] of [[-0.6, 0x2f9e4f], [-0.42, 0xdedede], [-0.24, 0x1a1a1a], [0.55, 0x2f9e4f]]) blk(0.08, 0.08, 0.03, mat({ color: c }), BX + dx, 1.5, R0 + 0.07);
  blk(0.1, 0.16, 0.08, glow(0xb8d6c8, { transparent: true, opacity: 0.7 }), BX - 0.6, 1.3, R0 + 0.1);
  blk(0.35, 0.06, 0.12, M.white, BX + 0.1, 2.05, R0 + 0.06);
  plane(0.3, 0.04, glow(0xffe4b8), BX + 0.1, 2.015, R0 + 0.08, 0).rotation.x = Math.PI / 2;
  // the monitor on its arm, counting slowly
  const monTex = tex.live(64, 40);
  blk(0.05, 0.05, 0.4, M.chrome, BX - 0.95, 1.85, R0 + 0.2);
  const monitor = add(inside, new THREE.Group(), BX - 0.95, 1.75, R0 + 0.42);
  monitor.rotation.y = 0.5;
  blk(0.44, 0.32, 0.1, M.dark, 0, 0, 0, { parent: monitor });
  plane(0.4, 0.26, glow(0xffffff, { map: monTex.texture }), 0, 0, 0.055, 0, monitor);
  // the IV: a pole, a bag, the line to his arm
  const ivTop = ivPole(BX + 0.8, R0 + 0.6, true);
  rod(ivTop.clone().add(V(0, -0.35, 0)), V(BX + 0.3, 0.9, R0 + 1.45), 0.004, glow(0xdfe8ee, { transparent: true, opacity: 0.6 }));
  // the bedside cabinet: old flowers, a cup, a photo of a bus
  blk(0.45, 0.75, 0.45, M.laminate, BX - 1.05, 0.375, R0 + 0.55, { solid: true });
  add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.18, 8), glow(0x9fb7c0, { transparent: true, opacity: 0.55 })), BX - 1.1, 0.84, R0 + 0.45);
  for (let i = 0; i < 6; i++) {
    const tip = V(BX - 1.1 + (rnd() - 0.5) * 0.2, 1.0 + rnd() * 0.1, R0 + 0.45 + (rnd() - 0.5) * 0.2);
    rod(V(BX - 1.1, 0.88, R0 + 0.45), tip, 0.005, mat({ color: 0x5f6b3a }));
    blk(0.05, 0.04, 0.05, mat({ color: [0x8a5a5a, 0x9b7a4a, 0x6b4a5a][i % 3] }), tip.x, tip.y - 0.03, tip.z);   // heads drooping
  }
  add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 8), M.white), BX - 0.92, 0.8, R0 + 0.66);
  const frame = add(inside, new THREE.Group(), BX - 1.0, 0.82, R0 + 0.36);
  frame.rotation.set(-0.2, 0.6, 0);
  blk(0.14, 0.11, 0.015, M.wood, 0, 0, 0, { parent: frame });
  plane(0.12, 0.09, mat({ map: TX.photo }), 0, 0, 0.009, 0, frame);
  // the overbed table, his dinner under its lid, untouched
  blk(0.08, 0.95, 0.08, M.chrome, BX + 0.7, 0.48, BZ + 0.55);
  blk(0.55, 0.05, 0.12, M.dark, BX + 0.7, 0.04, BZ + 0.55);
  blk(0.85, 0.03, 0.42, M.laminate, BX + 0.35, 0.97, BZ + 0.55);
  add(inside, new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: 0xc0c4c6 })), BX + 0.25, 0.99, BZ + 0.55);
  blk(0.1, 0.08, 0.18, M.white, BX + 0.6, 1.02, BZ + 0.45);
  // the privacy curtain, half drawn on its ceiling track
  blk(0.03, 0.03, 3.0, M.chrome, BX - 0.75, H - 0.04, R0 + 1.6);
  blk(1.6, 0.03, 0.03, M.chrome, BX + 0.05, H - 0.04, R0 + 3.1);
  const curtain = plane(1.3, 2.55, M.curtain, BX - 0.75, 1.72, R0 + 0.8, Math.PI / 2);
  curtain.scale.x = 1;
  // a visitor's recliner by the window, a plastic chair by the bed
  recliner(-0.95, R1 - 0.85, -2.3);
  chair(BX - 1.15, BZ + 0.9, 1.8);
  // the sink and mirror by the door, gloves, the sharps box
  blk(0.45, 0.18, 0.55, M.white, RX0 + 0.23, 0.85, R0 + 1.4, { solid: true });
  blk(0.12, 0.25, 0.04, M.chrome, RX0 + 0.06, 1.05, R0 + 1.4);
  plane(0.5, 0.6, glow(0x3a4650), RX0 + 0.01, 1.55, R0 + 1.4, Math.PI / 2);
  blk(0.12, 0.3, 0.3, M.white, RX0 + 0.06, 1.45, R0 + 2.05);
  blk(0.1, 0.25, 0.18, M.red, RX0 + 0.05, 1.35, R0 + 2.55);
  for (let i = 0; i < 3; i++) blk(0.1, 0.12, 0.25, mat({ color: [0x7da0d8, 0xe8e8e8, 0x8fd18f][i] }), RX0 + 0.05, 1.15 + i * 0.14, R0 + 0.65);
  // the whiteboard he faces, a TV he never watches, a clock
  plane(1.25, 0.82, glow(0xffffff, { map: TX.board4b }), BX, 1.55, R1 - 0.01, Math.PI);
  blk(0.75, 0.45, 0.06, M.black, BX - 1.2, 2.35, R1 - 0.06);
  plane(0.69, 0.39, glow(0x10171c), BX - 1.2, 2.35, R1 - 0.095, Math.PI);
  plane(0.28, 0.28, glow(0xffffff, { map: TX.clock }), BX + 1.3, 2.4, R1 - 0.01, Math.PI);

  // ================================================================ 4E, door ajar: someone very still
  const E0 = 18.4 - 2.6;
  const E1 = 18.4 + 2.6;
  slab(CORR_OUT, -0.05, E0, E1, { lights: false });
  wallX(E0 + WALL_T / 2, CORR_OUT, -0.05);
  wallX(E1 - WALL_T / 2, CORR_OUT, -0.05);
  blk(0.15, H, E1 - E0, M.wallUp, -0.125, H / 2, 18.4, { solid: true });
  blk(0.05, 1.4, 2.2, M.slats, -0.22, 1.6, 18.4);                                   // blinds shut
  blk(0.01, 1.3, 2.1, glow(0x3a2a18, { transparent: true, opacity: 0.35 }), -0.25, 1.6, 18.4);   // streetlight through them
  blk(0.92, 0.3, 1.95, M.dark, -2.6, 0.3, E0 + 1.2, { solid: true });
  blk(0.9, 0.18, 2.0, M.sheet, -2.6, 0.56, E0 + 1.2);
  blk(0.95, 0.22, 1.7, M.blanket, -2.6, 0.72, E0 + 1.3);                           // a shape under the blanket
  blk(0.4, 0.16, 0.3, M.blanket, -2.6, 0.82, E0 + 0.45);
  const eMon = blk(0.06, 0.04, 0.02, glow(0x3fe07a), -3.6, 1.75, E0 + 0.2);

  // ================================================================ lights
  const lights = [
    new THREE.PointLight(0xe6efe2, 0, 13, 1.4),
    new THREE.PointLight(0xe6efe2, 0, 13, 1.4),
    new THREE.PointLight(0xffdcb0, 0, 6.5, 1.5),
  ];
  const LIGHT_ON = [7, 7, 2.6];
  add(g, lights[0], CX, 2.7, 9);
  add(g, lights[1], CX, 2.7, 27);
  add(g, lights[2], BX + 0.1, 2.3, R0 + 0.8);
  void eMon;

  // ================================================================ furniture builders (hoisted)
  function chair(x, z, ry) {
    const c = add(inside, new THREE.Group(), x, 0, z);
    c.rotation.y = ry;
    blk(0.46, 0.06, 0.44, M.vinylChair, 0, 0.46, 0, { parent: c });
    blk(0.46, 0.42, 0.05, M.vinylChair, 0, 0.72, -0.2, { parent: c });
    for (const [sx, sz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) blk(0.03, 0.45, 0.03, M.chrome, sx, 0.22, sz, { parent: c });
    solids.push(c.children[0]);
  }
  function officeChair(x, z, ry) {
    const c = add(inside, new THREE.Group(), x, 0, z);
    c.rotation.y = ry;
    blk(0.48, 0.08, 0.46, M.black, 0, 0.5, 0, { parent: c });
    blk(0.44, 0.5, 0.06, M.black, 0, 0.82, -0.22, { parent: c });
    blk(0.05, 0.42, 0.05, M.chrome, 0, 0.26, 0, { parent: c });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      blk(0.04, 0.03, 0.3, M.black, Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15, { parent: c }).rotation.y = a;
    }
    solids.push(c.children[0]);
  }
  function recliner(x, z, ry) {
    const c = add(inside, new THREE.Group(), x, 0, z);
    c.rotation.y = ry;
    blk(0.72, 0.42, 0.7, M.vinylChair, 0, 0.21, 0, { parent: c });
    const back = blk(0.72, 0.75, 0.16, M.vinylChair, 0, 0.75, -0.34, { parent: c });
    back.rotation.x = -0.25;
    for (const s of [-1, 1]) blk(0.12, 0.25, 0.66, M.vinylChair, s * 0.36, 0.52, 0, { parent: c });
    solids.push(c.children[0]);
  }
  function plant(x, z) {
    add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 8), mat({ color: 0x4a4a48 })), x, 0.2, z);
    for (let i = 0; i < 9; i++) {
      const l = blk(0.08, 0.5, 0.02, mat({ color: i % 2 ? 0x3c6b3a : 0x4f7d45 }), x + (rnd() - 0.5) * 0.2, 0.7 + rnd() * 0.3, z + (rnd() - 0.5) * 0.2);
      l.rotation.set((rnd() - 0.5) * 1.2, rnd() * 3, (rnd() - 0.5) * 1.2);
    }
  }
  function wheelchair(x, z, ry) {
    const c = add(inside, new THREE.Group(), x, 0, z);
    c.rotation.y = ry;
    blk(0.45, 0.05, 0.42, M.black, 0, 0.5, 0, { parent: c });
    blk(0.45, 0.4, 0.04, M.black, 0, 0.75, -0.2, { parent: c });
    for (const s of [-1, 1]) {
      const wheel = add(c, new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 4, 14), M.dark), s * 0.27, 0.3, -0.05);
      wheel.rotation.y = Math.PI / 2;
      blk(0.02, 0.5, 0.02, M.chrome, s * 0.23, 0.6, -0.22, { parent: c });
      blk(0.02, 0.02, 0.12, M.chrome, s * 0.23, 0.95, -0.28, { parent: c });          // push handles
      blk(0.03, 0.08, 0.03, M.black, s * 0.18, 0.04, 0.28, { parent: c });            // casters
      blk(0.12, 0.02, 0.12, M.dark, s * 0.1, 0.14, 0.36, { parent: c });             // footrests
    }
    solids.push(c.children[0]);
  }
  function ivPole(x, z, bag) {
    const base = add(inside, new THREE.Group(), x, 0, z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      blk(0.03, 0.03, 0.28, M.chrome, Math.sin(a) * 0.13, 0.05, Math.cos(a) * 0.13, { parent: base }).rotation.y = a;
    }
    add(base, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.95, 6), M.chrome), 0, 1.02, 0);
    blk(0.3, 0.012, 0.012, M.chrome, 0, 1.95, 0, { parent: base });
    if (bag) {
      blk(0.13, 0.22, 0.04, glow(0xe6eef2, { transparent: true, opacity: 0.6 }), 0.1, 1.78, 0, { parent: base });
      blk(0.11, 0.05, 0.035, glow(0xf0f6f8, { transparent: true, opacity: 0.8 }), 0.1, 1.72, 0, { parent: base });
    }
    return new THREE.Vector3(x + 0.1, 1.68, z);
  }
  function crashCart(x, z) {
    blk(0.5, 0.95, 0.7, M.red, x, 0.5, z, { solid: true });
    for (let i = 0; i < 4; i++) blk(0.01, 0.01, 0.6, M.dark, x + 0.255, 0.25 + i * 0.2, z);
    blk(0.3, 0.18, 0.4, mat({ color: 0xd9d14a }), x, 1.07, z);                         // the defibrillator
    plane(0.2, 0.08, glow(0x2a8a4a), x + 0.152, 1.08, z, Math.PI / 2);
  }
  function linenCart(x, z) {
    blk(0.55, 0.05, 1.0, M.chrome, x, 0.2, z);
    blk(0.55, 0.05, 1.0, M.chrome, x, 1.05, z);
    for (const [sx, sz] of [[-0.25, -0.47], [0.25, -0.47], [-0.25, 0.47], [0.25, 0.47]]) blk(0.03, 1.1, 0.03, M.chrome, x + sx, 0.6, z + sz);
    blk(0.5, 0.35, 0.92, M.white, x, 0.4, z, { solid: true });
    blk(0.5, 0.25, 0.92, mat({ color: 0xbfd3e6 }), x, 0.78, z);
    blk(0.56, 0.6, 0.02, mat({ color: 0x2f5f8f }), x, 0.75, z + 0.51);
  }
  function gurney(x, z) {
    blk(0.65, 0.12, 1.95, M.sheet, x, 0.82, z, { solid: true });
    blk(0.6, 0.05, 1.85, M.dark, x, 0.7, z);
    blk(0.06, 0.6, 0.06, M.chrome, x, 0.36, z - 0.7);
    blk(0.06, 0.6, 0.06, M.chrome, x, 0.36, z + 0.7);
    blk(0.55, 0.05, 1.7, M.dark, x, 0.08, z);
    blk(0.5, 0.1, 0.32, M.white, x, 0.92, z - 0.75);
    for (const s of [-1, 1]) blk(0.03, 0.18, 1.2, M.frame, x + s * 0.33, 0.97, z);
  }
  function vitalsStand(x, z) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      blk(0.03, 0.03, 0.26, M.dark, x + Math.sin(a) * 0.12, 0.05, z + Math.cos(a) * 0.12).rotation.y = a;
    }
    add(inside, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.05, 6), M.chrome), x, 0.55, z);
    blk(0.28, 0.24, 0.14, M.white, x, 1.18, z, { solid: true });
    plane(0.18, 0.11, glow(0x113322), x - 0.075, 1.2, z, -Math.PI / 2);
  }
  function wetFloor(x, z) {
    const s = add(inside, new THREE.Group(), x, 0, z);
    s.rotation.y = 0.5;
    for (const k of [-1, 1]) {
      const p = blk(0.3, 0.62, 0.012, mat({ map: TX.wetFloor }), 0, 0.3, k * 0.09, { parent: s });
      p.rotation.x = k * 0.28;
    }
  }

  // ================================================================ behaviour
  g.updateMatrixWorld(true);
  inside.visible = true;
  const colliders = solids.map((m) => new THREE.Box3().setFromObject(m));
  inside.visible = false;
  const toWorld = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  const inv = g.matrixWorld.clone().invert();
  const tmp = new THREE.Vector3();
  // forward down the corridor, for the player's yaw (walking faces -z of the camera)
  const fwd = toWorld(0, 0, 1).sub(toWorld(0, 0, 0));
  const spawnYaw = Math.atan2(-fwd.x, -fwd.z);

  // somewhere else on the floor, something is awake: [where, sound, extra args, gain, muffle]
  const SOURCES = [
    [V(CORR_OUT, 1.4, doorZ(2.8)), "cough", [2], 0.32, 1300],
    [V(CORR_OUT, 1.4, doorZ(8.0)), "beeps", [5, 1.3], 0.18, 1600],
    [V(CORR_OUT, 1.4, doorZ(13.2)), "sob", [], 0.3, 1200],
    [V(CORR_OUT - 0.5, 1.2, doorZ(18.4)), "breath", [], 0.22, 2200],
    [V(CORR_OUT - 0.5, 1.2, doorZ(18.4)), "beeps", [4, 1.8], 0.16, 2400],
    [V(CORR_OUT, 1.3, doorZ(23.6)), "creak", [], 0.3, 1400],
    [V(CORR_OUT, 1.3, doorZ(23.6)), "knock", [2], 0.18, 900],
    [V(CORR_OUT, 1.5, doorZ(28.8)), "whisper", [], 0.32, 1700],
    [V(CORR_OUT, 1.4, doorZ(39.2)), "hum", [], 0.3, 1300],
    [V(CORR_IN, 1.4, 28.2), "cough", [1], 0.25, 1100],
    [V(CORR_IN, 1.2, 7.2), "drip", [], 0.3, 1800],
    [V(CX, 0.5, Z1), "squeak", [5], 0.22, 1500],
    [V(CX, 0.5, Z1), "steps", [], 0.16, 1200],
    [V(CORR_IN, 1.3, 38.6), "creak", [], 0.22, 1000],
  ];
  let active = false;
  let soundT = 4;
  let lastSource = -1;
  let tvT = 0;
  let murmurT = 0;
  let beat = 0;
  let lastBeatWhole = 0;
  let callT = 0;
  let flick = 0;
  const camPos = new THREE.Vector3();
  const local = new THREE.Vector3();

  function placeSound(at, camera) {
    // where it is, seen from your head: how far, and to which side
    const world = g.localToWorld(at.clone());
    camera.getWorldPosition(camPos);
    const dist = world.distanceTo(camPos);
    local.copy(world);
    camera.worldToLocal(local);
    const pan = THREE.MathUtils.clamp(local.x / Math.max(1, dist), -1, 1) * 0.8;
    return { dist, pan };
  }

  return {
    group: g,
    colliders,
    spawn: toWorld(CX, 1.7, 1.6),
    spawnYaw,
    win: winGlass,
    bedHead: toWorld(BX, 0.9, R0 + 0.35),
    roomPos: toWorld(-2.6, 0, RZ),
    navPoint: toWorld(CORR_OUT - 0.25, 2.25, doorZ(RZ)),
    // Mara walks you there: down the hall, in through the door, to the foot of the bed
    maraStart: toWorld(CX + 0.4, 0, 3.6),
    maraPath: [toWorld(CX, 0, doorZ(RZ)), toWorld(CORR_OUT + 0.9, 0, doorZ(RZ)), toWorld(BX - 1.25, 0, BZ + 1.35)],
    // the old man in the bed: on his back, his head on the pillow
    layInBed(p) {
      g.add(p.root);
      p.root.position.set(BX, 0.78, BZ + 0.85);
      p.root.rotation.set(-Math.PI / 2 + 0.1, 0, 0);
    },
    get active() { return active; },
    setActive(on) {
      active = on;
      inside.visible = on;
      lights.forEach((l, i) => { l.intensity = on ? LIGHT_ON[i] : 0; });
      soundT = 3;
    },
    // is a point inside the hospital building? (no rain in here)
    inside(x, y, z) {
      if (!active) return false;
      tmp.set(x, y, z).applyMatrix4(inv);
      return tmp.x < 0.3 && tmp.x > -34.3 && tmp.z > -5 && tmp.z < 107 && tmp.y > -FLOOR_Y - 0.5 && tmp.y < 26 - FLOOR_Y;
    },
    update(dt, camera, heartRate = 48) {
      if (!active) return;
      // the monitor in 4B: his heart, slow
      beat += (dt * heartRate) / 60;
      const c = monTex.ctx;
      c.fillStyle = "#020c06";
      c.fillRect(0, 0, 64, 40);
      c.strokeStyle = "#3fe07a";
      c.beginPath();
      for (let x = 0; x < 44; x++) {
        const ph = (beat * 44 - x) / 44;
        const f = ph - Math.floor(ph);
        const y = f < 0.07 ? 14 - Math.sin((f / 0.07) * Math.PI) * 10 : 14;
        x ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      c.strokeStyle = "#5fb8ff";
      c.beginPath();
      for (let x = 0; x < 44; x++) c.lineTo(x, 30 + Math.sin(beat * 6.28 * 0.3 + x / 5) * 3);
      c.stroke();
      c.fillStyle = "#3fe07a"; c.font = "bold 9px monospace"; c.fillText(String(heartRate), 46, 15);
      c.fillStyle = "#5fb8ff"; c.font = "8px monospace"; c.fillText("91", 47, 32);
      monTex.texture.needsUpdate = true;
      camera.getWorldPosition(camPos);
      if (Math.floor(beat) !== lastBeatWhole) {
        lastBeatWhole = Math.floor(beat);
        const m = placeSound(V(BX - 0.95, 1.75, R0 + 0.5), camera);
        if (m.dist < 7) Sound.sfxAt("beeps", { gain: 0.12 * (1 - m.dist / 7), pan: m.pan, muffle: 4000 }, 1);
      }
      // the station's call light for 4B, blinking
      callT += dt;
      const cc = callTex.ctx;
      cc.fillStyle = "#151515"; cc.fillRect(0, 0, 48, 12);
      for (let i = 0; i < 8; i++) { cc.fillStyle = i === 1 && callT % 1 < 0.5 ? "#ff3b30" : "#3a2a2a"; cc.fillRect(2 + i * 6, 3, 4, 6); }
      callTex.texture.needsUpdate = true;
      // the TV in the lounge, and its light on the floor outside the door
      tvT -= dt;
      if (tvT <= 0) {
        tvT = 0.06 + Math.random() * 0.12;
        const k = 0.5 + Math.random() * 0.5;
        tvMat.color.setRGB(k, k, k * 1.1);
        tvSpill.material.opacity = 0.05 + k * 0.08;
        TX.tvNoise.offset.set(Math.random(), Math.random());
      }
      // one tube in the hall that won't stay on
      flick -= dt;
      if (flick <= 0) {
        flick = Math.random() < 0.15 ? 0.05 + Math.random() * 0.1 : 0.4 + Math.random() * 2.5;
        const on = corridorPanels[9].material === M.troffer;
        corridorPanels[9].material = on ? M.trofferOff : M.troffer;
      }
      // rain running down the glass
      TX.rainGlass.offset.y += dt * 0.05;
      TX.rainGlass2.offset.y += dt * 0.11;
      // the lounge TV, muttering to itself when you're near
      murmurT -= dt;
      if (murmurT <= 0) {
        const m = placeSound(V(CORR_IN, 1.3, LOUNGE_DOOR), camera);
        murmurT = 3.4;
        if (m.dist < 14) Sound.sfxAt("murmur", { gain: 0.16 * (1 - m.dist / 14), pan: m.pan, muffle: 1800 }, 3.4);
      }
      // and behind the other doors, now and then, something
      soundT -= dt;
      if (soundT <= 0) {
        soundT = 4 + Math.random() * 7;
        for (let tries = 0; tries < 6; tries++) {
          const i = Math.floor(Math.random() * SOURCES.length);
          if (i === lastSource) continue;
          const [at, name, args, gain, muffle] = SOURCES[i];
          const m = placeSound(at, camera);
          if (m.dist < 2.5 || m.dist > 24) continue;
          lastSource = i;
          Sound.sfxAt(name, { gain: gain * Math.min(1, 1.3 - m.dist / 24), pan: m.pan, muffle }, ...args);
          break;
        }
      }
    },
  };
}
