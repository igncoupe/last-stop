// The hands. Every hand on the glass in the game is this one hand: long, thin fingers, the palm flattened white
// where it presses, and around it the grime it leaves behind, dragged down the glass. "press" is a hand that's
// there, right now, against the other side of the glass; "print" is what's left when it's gone. Same hand, so
// once you've seen it, you know it.
import * as THREE from "three";
import { mat } from "../core/ps1.js";

const W = 256;
const H = 320;
let seed = 3;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// the outline of the hand, fingers up, in a W x H box (palm width u)
function handShape(x, { u = 92, cx = W / 2, base = H - 18, long = 1.25 } = {}) {
  x.beginPath();
  // the palm, a little wider across the knuckles than at the wrist
  const top = base - u * 1.08;
  x.moveTo(cx - u * 0.42, base);
  x.quadraticCurveTo(cx - u * 0.56, base - u * 0.55, cx - u * 0.5, top + u * 0.08);
  x.lineTo(cx + u * 0.52, top + u * 0.1);
  x.quadraticCurveTo(cx + u * 0.56, base - u * 0.5, cx + u * 0.4, base);
  x.closePath();
  // four long fingers, splayed a little
  const fingers = [[-0.37, 0.92, 0.2, -0.13], [-0.13, 1.05, 0.21, -0.04], [0.12, 0.98, 0.2, 0.05], [0.36, 0.74, 0.17, 0.16]];
  for (const [fx, len, fw, ang] of fingers) {
    x.save();
    x.translate(cx + fx * u, top + u * 0.14);
    x.rotate(ang);
    const L = len * u * long;
    x.roundRect(-fw * u / 2, -L, fw * u, L + u * 0.12, fw * u / 2);
    x.restore();
  }
  // the thumb, out to the side
  x.save();
  x.translate(cx - u * 0.48, base - u * 0.42);
  x.rotate(-0.95);
  x.roundRect(-0.12 * u, -0.72 * u * long * 0.9, 0.24 * u, 0.72 * u * long * 0.9 + u * 0.1, 0.12 * u);
  x.restore();
}
// where the finger pads and the heel of the palm are (they press hardest)
function pads(u = 92, cx = W / 2, base = H - 18, long = 1.25) {
  const top = base - u * 1.08;
  const out = [];
  for (const [fx, len, , ang] of [[-0.37, 0.92, 0.2, -0.13], [-0.13, 1.05, 0.21, -0.04], [0.12, 0.98, 0.2, 0.05], [0.36, 0.74, 0.17, 0.16]]) {
    const L = len * u * long;
    out.push([cx + fx * u + Math.sin(ang) * L * 0.86, top + u * 0.14 - Math.cos(ang) * L * 0.86, u * 0.085]);
  }
  out.push([cx - u * 0.48 - Math.sin(0.95) * 0.55 * u, base - u * 0.42 - Math.cos(0.95) * 0.55 * u, u * 0.09]);
  out.push([cx, base - u * 0.3, u * 0.3]);
  return out;
}

function mask(long) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  handShape(x, { long });
  x.fill();
  return c;
}

// the mark left on the glass: ash and silt, the ridges of the fingertips, dragged down and dripping
function paintPrint(x, long = 1.25) {
  seed = 11;
  x.clearRect(0, 0, W, H + 140);
  const m = mask(long);
  // smeared down the glass as it slid: fainter copies of itself, lower and lower
  for (let i = 9; i >= 1; i--) {
    x.globalAlpha = 0.05 + 0.02 * (9 - i);
    x.drawImage(m, (rnd() - 0.5) * 3, i * 9);
  }
  x.globalAlpha = 1;
  // the print itself: dark at the rim where the skin lifted off, patchy in the middle
  const p = document.createElement("canvas");
  p.width = W; p.height = H;
  const y = p.getContext("2d");
  y.drawImage(m, 0, 0);
  y.globalCompositeOperation = "source-in";
  y.fillStyle = "rgba(176,172,163,.7)";            // ash, grey and soft, the color of what it is
  y.fillRect(0, 0, W, H);
  y.globalCompositeOperation = "destination-out";
  for (const [px, py, r] of pads(92, W / 2, H - 18, long)) {
    const g = y.createRadialGradient(px, py, 0, px, py, r * 1.4);
    g.addColorStop(0, "rgba(0,0,0,.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    y.fillStyle = g;
    y.beginPath(); y.arc(px, py, r * 1.4, 0, Math.PI * 2); y.fill();
    // fingerprint ridges, in the clear patch
    y.strokeStyle = "rgba(0,0,0,.6)";
    y.lineWidth = 1;
    for (let k = 2; k < r; k += 2.6) { y.beginPath(); y.ellipse(px, py, k, k * 1.25, 0, Math.PI * 1.1, Math.PI * 1.9 + rnd() * 0.3); y.stroke(); }
  }
  for (let i = 0; i < 260; i++) { y.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.5})`; y.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2); }
  // the creases of the palm
  y.strokeStyle = "rgba(0,0,0,.7)";
  y.lineWidth = 1.6;
  y.beginPath(); y.moveTo(W * 0.3, H * 0.62); y.quadraticCurveTo(W * 0.48, H * 0.66, W * 0.68, H * 0.6); y.stroke();
  y.beginPath(); y.moveTo(W * 0.33, H * 0.7); y.quadraticCurveTo(W * 0.42, H * 0.78, W * 0.4, H * 0.9); y.stroke();
  // the edges aren't clean: it was wet, and it moved
  y.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 500; i++) {
    const a = rnd() * Math.PI * 2;
    y.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.6})`;
    y.beginPath(); y.arc(W / 2 + Math.cos(a) * (40 + rnd() * 90), H * 0.55 + Math.sin(a) * (60 + rnd() * 120), 1 + rnd() * 3.5, 0, Math.PI * 2); y.fill();
  }
  x.drawImage(p, 0, 0);
  // where the fingers dragged as it slid down the glass: long streaks from every fingertip
  x.globalCompositeOperation = "source-over";
  for (const [px, py, r] of pads(92, W / 2, H - 18, long).slice(0, 5)) {
    for (let k = 0; k < 3; k++) {
      const sx = px + (k - 1) * r * 0.5 + (rnd() - 0.5) * 2;
      const len = 60 + rnd() * 120;
      const gr = x.createLinearGradient(0, py, 0, py + len);
      gr.addColorStop(0, `rgba(176,172,163,${0.35 + rnd() * 0.2})`);
      gr.addColorStop(1, "rgba(176,172,163,0)");
      x.strokeStyle = gr;
      x.lineWidth = 1.5 + rnd() * 2.5;
      x.beginPath();
      x.moveTo(sx, py);
      for (let t = 0; t <= 1.001; t += 0.1) x.lineTo(sx + Math.sin(t * 6 + k) * 1.5 + t * (rnd() - 0.5) * 3, py + len * t);
      x.stroke();
    }
  }
  // and the wet running from it
  x.globalCompositeOperation = "source-over";
  for (let i = 0; i < 6; i++) {
    const dx = W * (0.3 + rnd() * 0.4);
    const len = 30 + rnd() * 110;
    const gr = x.createLinearGradient(0, H * 0.8, 0, H * 0.8 + len);
    gr.addColorStop(0, "rgba(176,172,163,.5)");
    gr.addColorStop(1, "rgba(176,172,163,0)");
    x.fillStyle = gr;
    x.fillRect(dx, H * 0.8, 2 + rnd() * 2, len);
    x.fillStyle = "rgba(176,172,163,.5)";
    x.beginPath(); x.arc(dx + 1.5, H * 0.8 + len * 0.8, 2.4, 0, Math.PI * 2); x.fill();
  }
}

// the hand itself, pressed flat to the glass from the other side: waterlogged, grey-white, the pads blanched
// where they press, the grime of it smeared round the edges
function paintPress(x, long = 1.25) {
  seed = 29;
  x.clearRect(0, 0, W, H + 140);
  const m = mask(long);
  // a dark wet halo where it's pressing, and the smear below it
  x.filter = "blur(4px)";
  x.globalAlpha = 0.65;
  x.drawImage(m, 0, 4);
  x.globalAlpha = 0.25;
  for (let i = 1; i < 6; i++) x.drawImage(m, 0, 6 + i * 10);
  x.filter = "none";
  x.globalAlpha = 1;
  const p = document.createElement("canvas");
  p.width = W; p.height = H;
  const y = p.getContext("2d");
  y.drawImage(m, 0, 0);
  y.globalCompositeOperation = "source-in";
  const g = y.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#c9d0cd");
  g.addColorStop(0.6, "#aeb7b4");
  g.addColorStop(1, "#7d8886");
  y.fillStyle = g;
  y.fillRect(0, 0, W, H);
  // mottled, bruised, wrinkled from the water
  y.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 30; i++) {
    const px = rnd() * W, py = rnd() * H, r = 6 + rnd() * 22;
    const b = y.createRadialGradient(px, py, 0, px, py, r);
    b.addColorStop(0, `rgba(${rnd() < 0.4 ? "70,80,96" : "120,130,126"},${0.15 + rnd() * 0.2})`);
    b.addColorStop(1, "rgba(0,0,0,0)");
    y.fillStyle = b;
    y.fillRect(px - r, py - r, r * 2, r * 2);
  }
  for (const [px, py, r] of pads(92, W / 2, H - 18, long)) {
    // blanched where it presses hardest, the skin puckered in rings
    const w2 = y.createRadialGradient(px, py, 0, px, py, r * 1.3);
    w2.addColorStop(0, "rgba(236,240,236,.9)");
    w2.addColorStop(1, "rgba(236,240,236,0)");
    y.fillStyle = w2;
    y.beginPath(); y.arc(px, py, r * 1.3, 0, Math.PI * 2); y.fill();
    y.strokeStyle = "rgba(90,100,98,.45)";
    y.lineWidth = 1;
    for (let k = 3; k < r * 1.2; k += 2.8) { y.beginPath(); y.ellipse(px, py, k * 1.1, k, 0, 0, Math.PI * 2); y.stroke(); }
  }
  // the joints of the fingers, the lines of the palm
  y.strokeStyle = "rgba(60,66,66,.55)";
  y.lineWidth = 1.4;
  for (const fy of [0.33, 0.45]) { y.beginPath(); y.moveTo(W * 0.22, H * fy); y.lineTo(W * 0.78, H * fy + 6); y.stroke(); }
  y.beginPath(); y.moveTo(W * 0.3, H * 0.62); y.quadraticCurveTo(W * 0.48, H * 0.66, W * 0.68, H * 0.6); y.stroke();
  y.beginPath(); y.moveTo(W * 0.33, H * 0.7); y.quadraticCurveTo(W * 0.42, H * 0.78, W * 0.4, H * 0.9); y.stroke();
  // dirt under the edges, darker at the outline
  y.globalCompositeOperation = "source-atop";
  y.strokeStyle = "rgba(40,40,36,.55)";
  y.lineWidth = 5;
  handShape(y, { long });
  y.stroke();
  x.drawImage(p, 0, 0);
}

const cache = {};
// the texture: "press" (the hand, there) or "print" (what it left)
export function handTexture(kind = "print") {
  if (cache[kind]) return cache[kind];
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H + 140;               // (room below for the smear and the drips)
  const x = c.getContext("2d");
  if (kind === "press") paintPress(x); else paintPrint(x);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache[kind] = t;
  cache[kind + "Canvas"] = c;
  return t;
}
export function handCanvas(kind = "print") { handTexture(kind); return cache[kind + "Canvas"]; }

// a hand on the glass, as a thin plane (its palm facing +z): size 1 is a big man's hand, wrist to fingertip
export function handMesh(kind = "press", size = 1, { lit = true } = {}) {
  const t = handTexture(kind);
  const w = 0.21 * size;
  const h = w * ((H + 140) / W);
  const m = lit
    ? mat({ map: t, transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.DoubleSide, color: kind === "press" ? 0x9fb0b4 : 0xffffff })
    : new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0x9aa0a0 });
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, -h * 0.12, 0);         // (the middle of the palm at the origin, the smear hanging below)
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = 3;
  return mesh;
}

// draw the print onto another canvas (the windshield's): centre, size in pixels (palm to fingertip), turn
export function drawPrint(x, cx, cy, size, rot = 0, alpha = 1) {
  const c = handCanvas("print");
  x.save();
  x.globalAlpha = alpha;
  x.translate(cx, cy);
  x.rotate(rot);
  const w = size * (W / H);
  x.drawImage(c, -w / 2, -size * 0.62, w, size * ((H + 140) / H));
  x.restore();
}
