// Every texture in the game is painted here on small canvases, so there
// are no image files. Low resolution + nearest filtering = PS1 look.
import * as THREE from "three";
import { drawPhoto } from "./portraits.js";

let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}
function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckle(x, w, h, base, spread, count) {
  x.fillStyle = base;
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rand() * spread);
    x.fillStyle = `rgba(${v},${v},${v},${0.25 + rand() * 0.3})`;
    x.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1 + Math.floor(rand() * 2), 1);
  }
}

const cache = {};
const once = (key, make) => cache[key] || (cache[key] = make());

export const tex = {
  asphalt: () => once("asphalt", () => {
    const [c, x] = canvas(64, 64);
    speckle(x, 64, 64, "#1b1c1f", 70, 500);
    x.strokeStyle = "rgba(0,0,0,.6)";
    x.beginPath(); x.moveTo(10, 0); x.lineTo(18, 30); x.lineTo(12, 64); x.stroke();
    return toTexture(c);
  }),
  sidewalk: () => once("sidewalk", () => {
    const [c, x] = canvas(64, 64);
    speckle(x, 64, 64, "#45464a", 120, 300);
    x.fillStyle = "rgba(0,0,0,.45)";
    x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
    return toTexture(c);
  }),
  concrete: () => once("concrete", () => {
    const [c, x] = canvas(64, 64);
    speckle(x, 64, 64, "#3a3b3e", 110, 400);
    return toTexture(c);
  }),
  // a 4m x 3m tile of wall with one dark window (lit windows come from windows())
  building: (style = 0) => once("building" + style, () => {
    const walls = ["#3b3532", "#2e3238", "#45403a", "#33302d", "#3c4038"];
    const [c, x] = canvas(64, 48);
    seed = 13 + style;
    speckle(x, 64, 48, walls[style % walls.length], 90, 260);
    x.fillStyle = "#0b0c0f"; x.fillRect(16, 10, 32, 26);
    x.fillStyle = "#1b1d22"; x.fillRect(31, 10, 2, 26);
    return toTexture(c);
  }),
  // big atlas of windows, some lit; used as emissive map for buildings
  windows: (style = 0, chance = 0.22, warmth = 0.8) => once(`windows${style}-${chance}`, () => {
    const [c, x] = canvas(256, 192);
    x.fillStyle = "#000"; x.fillRect(0, 0, 256, 192);
    seed = 99 + style * 31;
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        if (rand() < chance) {
          const warm = rand() < warmth;
          x.fillStyle = warm ? `rgb(${200 + rand() * 50},${150 + rand() * 40},${70 + rand() * 30})` : "rgb(120,170,200)";
          x.fillRect(gx * 64 + 16, gy * 48 + 10, 32, 26);
          x.fillStyle = "rgba(0,0,0,.35)";
          x.fillRect(gx * 64 + 16, gy * 48 + 10 + 13 + Math.floor(rand() * 10), 32, 3);
        }
      }
    }
    const t = toTexture(c);
    t.repeat.set(0.25, 0.25);
    return t;
  }),
  // classic bus seat fabric
  moquette: () => once("moquette", () => {
    const [c, x] = canvas(32, 32);
    x.fillStyle = "#1d2a52"; x.fillRect(0, 0, 32, 32);
    seed = 7;
    const cols = ["#c0392b", "#e2b13c", "#2fa39a", "#8e44ad"];
    for (let i = 0; i < 26; i++) {
      x.fillStyle = cols[i % 4];
      x.fillRect(Math.floor(rand() * 30), Math.floor(rand() * 30), 2 + Math.floor(rand() * 3), 1);
    }
    return toTexture(c);
  }),
  busFloor: () => once("busFloor", () => {
    const [c, x] = canvas(32, 32);
    speckle(x, 32, 32, "#2b2c2e", 80, 80);
    x.fillStyle = "rgba(0,0,0,.4)";
    for (let i = 0; i < 32; i += 4) x.fillRect(0, i, 32, 1);
    return toTexture(c);
  }),
  water: () => once("water", () => {
    const [c, x] = canvas(64, 64);
    x.fillStyle = "#0a1620"; x.fillRect(0, 0, 64, 64);
    seed = 5;
    for (let i = 0; i < 90; i++) {
      x.fillStyle = `rgba(110,150,180,${0.1 + rand() * 0.25})`;
      x.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 64), 4 + Math.floor(rand() * 8), 1);
    }
    return toTexture(c);
  }),
  // the surface of dark water: long soft swells, a few glints
  waterBase: () => once("waterBase", () => {
    const [c, x] = canvas(64, 64);
    seed = 11;
    for (let y = 0; y < 64; y++) {
      for (let xx = 0; xx < 64; xx++) {
        const v = Math.sin((y / 64) * Math.PI * 6 + Math.sin((xx / 64) * Math.PI * 4) * 1.4) * 0.5 + 0.5;
        const k = 0.75 + v * 0.35 + (rand() - 0.5) * 0.08;
        x.fillStyle = `rgb(${Math.round(9 * k)},${Math.round(21 * k)},${Math.round(29 * k)})`;
        x.fillRect(xx, y, 1, 1);
      }
    }
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(150,185,205,${0.12 + rand() * 0.2})`;
      x.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 64), 2 + Math.floor(rand() * 5), 1);
    }
    return toTexture(c);
  }),
  // light moving across the water (drawn on top, added on)
  waterShine: () => once("waterShine", () => {
    const [c, x] = canvas(64, 64);
    x.clearRect(0, 0, 64, 64);
    seed = 23;
    for (let i = 0; i < 26; i++) {
      const y = Math.floor(rand() * 64);
      const x0 = Math.floor(rand() * 64);
      const len = 6 + Math.floor(rand() * 18);
      for (let k = 0; k < len; k++) {
        const a = Math.sin((k / len) * Math.PI) * (0.25 + rand() * 0.2);
        x.fillStyle = `rgba(170,200,220,${a.toFixed(2)})`;
        x.fillRect((x0 + k) % 64, (y + Math.round(Math.sin(k / 3) * 1.2) + 64) % 64, 1, 1);
      }
    }
    return toTexture(c);
  }),
  // one rain ring
  ring: () => once("ring", () => {
    const [c, x] = canvas(32, 32);
    x.clearRect(0, 0, 32, 32);
    x.strokeStyle = "rgba(200,220,235,.9)";
    x.lineWidth = 2;
    x.beginPath(); x.arc(16, 16, 13, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = "rgba(200,220,235,.35)";
    x.lineWidth = 1;
    x.beginPath(); x.arc(16, 16, 8, 0, Math.PI * 2); x.stroke();
    return toTexture(c, false);
  }),
  // a text sign. bg/fg colors, size in canvas pixels
  sign: (text, { bg = "#ffb54a", fg = "#140d03", w = 128, h = 32, font = 20, border = 0 } = {}) => {
    const [c, x] = canvas(w, h);
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (border) { x.strokeStyle = fg; x.lineWidth = border; x.strokeRect(border, border, w - border * 2, h - border * 2); }
    x.fillStyle = fg;
    x.font = `bold ${font}px monospace`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    const lines = String(text).split("\n");
    lines.forEach((ln, i) => x.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * font * 1.1));
    return toTexture(c, false);
  },
  poster: (lines) => {
    const [c, x] = canvas(120, 160);
    x.fillStyle = "#e6e1d2"; x.fillRect(0, 0, 120, 160);
    x.fillStyle = "#a51616"; x.font = "bold 22px sans-serif"; x.textAlign = "center";
    x.fillText(lines[0], 60, 24);
    // a photocopied photo: grey, a face, shoulders
    drawPhoto(x, "jun", 26, 32, 68, 70, { tone: "gray" });
    x.fillStyle = "#111"; x.font = "bold 11px monospace";
    lines.slice(1).forEach((ln, i) => x.fillText(ln, 60, 118 + i * 14));
    // rain streaks and a torn corner
    x.fillStyle = "rgba(60,60,70,.18)";
    for (let i = 0; i < 9; i++) x.fillRect(8 + i * 13, 0, 2, 160);
    x.fillStyle = "#2a2a2a"; x.beginPath(); x.moveTo(120, 140); x.lineTo(120, 160); x.lineTo(98, 160); x.fill();
    return toTexture(c, false);
  },
  // a canvas you redraw every frame (route display, speedometer)
  live: (w, h) => {
    const [c, x] = canvas(w, h);
    const t = toTexture(c, false);
    return { canvas: c, ctx: x, texture: t };
  },
};
