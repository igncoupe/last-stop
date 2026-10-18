// Breath on cold glass. A fog pane sits just inside a sheet of glass: it mists over (beaded, thicker low down and
// at the edges, the way real condensation is), and a finger can write in it, one stroke at a time, the wet running
// down from the letters. Used on every window of the bus, and on the window in Room 4B.
import * as THREE from "three";

// one-stroke capitals, the way you'd draw them with a fingertip: polylines in a 1 x 1 box, y down
const ring = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});
const P_BOWL = [[0.14, 1], [0.14, 0.04], [0.6, 0.04], [0.86, 0.17], [0.86, 0.37], [0.6, 0.5], [0.14, 0.5]];
export const STROKES = {
  A: [[[0.04, 1], [0.5, 0.02], [0.96, 1]], [[0.22, 0.62], [0.78, 0.62]]],
  B: [[[0.14, 1], [0.14, 0.03], [0.58, 0.03], [0.83, 0.14], [0.83, 0.35], [0.58, 0.48], [0.14, 0.48]], [[0.58, 0.48], [0.88, 0.62], [0.88, 0.86], [0.6, 0.99], [0.14, 0.99]]],
  C: [ring(0.55, 0.5, 0.42, 0.48, -0.75, -Math.PI * 2 + 0.75)],
  D: [[[0.14, 0.03], [0.14, 0.99], [0.5, 0.99], [0.84, 0.8], [0.92, 0.5], [0.84, 0.2], [0.5, 0.03], [0.14, 0.03]]],
  E: [[[0.86, 0.03], [0.14, 0.03], [0.14, 0.99], [0.86, 0.99]], [[0.14, 0.5], [0.7, 0.5]]],
  F: [[[0.86, 0.03], [0.14, 0.03], [0.14, 1]], [[0.14, 0.5], [0.68, 0.5]]],
  G: [ring(0.53, 0.5, 0.42, 0.48, -0.7, -Math.PI * 2 + 0.2).concat([[0.95, 0.55], [0.58, 0.55]])],
  H: [[[0.12, 0], [0.12, 1]], [[0.88, 0], [0.88, 1]], [[0.12, 0.5], [0.88, 0.5]]],
  I: [[[0.5, 0], [0.5, 1]], [[0.24, 0.02], [0.76, 0.02]], [[0.24, 0.98], [0.76, 0.98]]],
  J: [[[0.78, 0], [0.78, 0.72], [0.62, 0.95], [0.38, 0.98], [0.16, 0.8]]],
  K: [[[0.14, 0], [0.14, 1]], [[0.86, 0], [0.14, 0.6]], [[0.36, 0.42], [0.9, 1]]],
  L: [[[0.14, 0], [0.14, 0.99], [0.86, 0.99]]],
  M: [[[0.05, 1], [0.12, 0.02], [0.5, 0.64], [0.88, 0.02], [0.95, 1]]],
  N: [[[0.12, 1], [0.12, 0.02], [0.88, 0.98], [0.88, 0]]],
  O: [ring(0.5, 0.5, 0.42, 0.48, -Math.PI / 2, Math.PI * 1.5, 18)],
  P: [P_BOWL],
  Q: [ring(0.5, 0.48, 0.42, 0.46, -Math.PI / 2, Math.PI * 1.5, 18), [[0.6, 0.72], [0.96, 1.04]]],
  R: [P_BOWL, [[0.46, 0.5], [0.9, 1]]],
  S: [[[0.86, 0.14], [0.5, 0.03], [0.15, 0.16], [0.2, 0.42], [0.8, 0.58], [0.86, 0.84], [0.5, 0.98], [0.12, 0.86]]],
  T: [[[0.04, 0.04], [0.96, 0.04]], [[0.5, 0.04], [0.5, 1]]],
  U: [[[0.12, 0], [0.12, 0.7], [0.3, 0.97], [0.7, 0.97], [0.88, 0.7], [0.88, 0]]],
  V: [[[0.05, 0], [0.5, 1], [0.95, 0]]],
  W: [[[0, 0], [0.24, 1], [0.5, 0.36], [0.76, 1], [1, 0]]],
  X: [[[0.1, 0], [0.9, 1]], [[0.9, 0], [0.1, 1]]],
  Y: [[[0.08, 0], [0.5, 0.5], [0.92, 0]], [[0.5, 0.5], [0.5, 1]]],
  Z: [[[0.1, 0.03], [0.9, 0.03], [0.1, 0.97], [0.9, 0.97]]],
  1: [[[0.28, 0.2], [0.55, 0], [0.55, 1]]],
  4: [[[0.66, 1], [0.66, 0], [0.08, 0.68], [0.95, 0.68]]],
  "'": [[[0.5, 0], [0.44, 0.22]]],
  ".": [[[0.48, 0.93], [0.52, 0.99]]],
};

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// condensation: a grey-white bloom, beaded with drops, thin at the top and thick at the bottom and the edges
function paintFog(x, w, h, s) {
  seed = s;
  x.clearRect(0, 0, w, h);
  const grad = x.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(176,186,194,.5)");
  grad.addColorStop(0.55, "rgba(188,196,203,.72)");
  grad.addColorStop(1, "rgba(200,207,212,.9)");
  x.fillStyle = grad;
  x.fillRect(0, 0, w, h);
  // blotches where it's breathed on thicker
  for (let i = 0; i < 26; i++) {
    const cx = rnd() * w, cy = rnd() * h, r = (0.08 + rnd() * 0.22) * Math.max(w, h);
    const b = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    b.addColorStop(0, `rgba(214,220,225,${0.1 + rnd() * 0.18})`);
    b.addColorStop(1, "rgba(214,220,225,0)");
    x.fillStyle = b;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // beads: thousands of tiny drops, each a bright point with a darker rim
  const n = Math.round((w * h) / 70);
  for (let i = 0; i < n; i++) {
    const px = rnd() * w, py = rnd() * h;
    const r = 0.4 + rnd() * rnd() * 2.6 * (0.6 + py / h);
    x.fillStyle = `rgba(110,122,132,${0.12 + rnd() * 0.18})`;
    x.beginPath(); x.arc(px, py + r * 0.3, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = `rgba(236,242,246,${0.2 + rnd() * 0.35})`;
    x.beginPath(); x.arc(px - r * 0.25, py - r * 0.25, r * 0.5, 0, Math.PI * 2); x.fill();
  }
  // a few drops already heavy enough to run, leaving clear streaks
  x.globalCompositeOperation = "destination-out";
  for (let i = 0; i < Math.round(w / 40); i++) {
    const px = rnd() * w, py = rnd() * h * 0.7, len = (0.1 + rnd() * 0.3) * h;
    x.lineWidth = 1 + rnd() * 1.5;
    x.strokeStyle = "rgba(0,0,0,.6)";
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k <= 8; k++) x.lineTo(px + Math.sin(k * 1.7 + i) * 1.2, py + (len * k) / 8);
    x.stroke();
  }
  // soft at the very edges (the frame keeps the glass warmer there)
  x.globalCompositeOperation = "destination-in";
  const e = x.createLinearGradient(0, 0, w, 0);
  e.addColorStop(0, "rgba(0,0,0,.55)"); e.addColorStop(0.04, "rgba(0,0,0,1)"); e.addColorStop(0.96, "rgba(0,0,0,1)"); e.addColorStop(1, "rgba(0,0,0,.55)");
  x.fillStyle = e;
  x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = "source-over";
}

// a fog pane: width x height meters, its own canvas (so a finger can write in it)
export function makeFogPane(width, height, { px = 384, seed: s = 1 } = {}) {
  const w = px;
  const h = Math.max(32, Math.round((px * height) / width));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  paintFog(x, w, h, s);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.visible = false;
  mesh.renderOrder = 2;
  const pane = {
    mesh, canvas: c, ctx: x, texture, w, h, amount: 0, level: 1,
    // 0 clear ... 1 fogged right over
    set(k) {
      pane.amount = k;
      material.opacity = k * 0.92;
      mesh.visible = k > 0.002;
    },
    // how lit the inside is (the fog is only as bright as the lights on it)
    light(k) { material.color.setScalar(0.35 + 0.65 * k); },
    clean() { paintFog(x, w, h, s); texture.needsUpdate = true; },
    // a finger writes `text` in it: returns { step(dt) -> true when it's done }. "\n" starts a new line.
    // at: where the middle of the writing is (0..1 across the pane); span: how much of the pane it may fill
    writer(text, { letterMs = 650, onLetter = null, at = 0.5, span = 0.86 } = {}) {
      const rows = text.toUpperCase().split("\n");
      const longest = Math.max(...rows.map((r) => r.length));
      // as big as fits: letters 0.8 as wide as they're tall, a gap between, a margin all round
      const lh = Math.min((h * 0.72) / rows.length / 1.2, (w * span) / (longest * 0.95));
      const lw = lh * 0.78;
      const gap = lh * 0.17;
      const stroke = Math.max(5, lh * 0.15);
      const top = (h - rows.length * lh * 1.25 + lh * 0.25) / 2;
      const jobs = [];
      rows.forEach((row, r) => {
        const rowW = row.length * lw + (row.length - 1) * gap;
        let left = at * w - rowW / 2;
        for (const ch of row) {
          if (ch !== " " && STROKES[ch]) {
            const jx = (rnd() - 0.5) * lh * 0.08, jy = (rnd() - 0.5) * lh * 0.1;    // a hand, not a printer
            const tilt = (rnd() - 0.5) * 0.12;
            const strokes = STROKES[ch].map((st) => st.map(([u, v]) => {
              const ux = (u - 0.5) * Math.cos(tilt) - (v - 0.5) * Math.sin(tilt) + 0.5;
              const vy = (u - 0.5) * Math.sin(tilt) + (v - 0.5) * Math.cos(tilt) + 0.5;
              return [left + jx + ux * lw, top + r * lh * 1.25 + jy + vy * lh];
            }));
            const len = strokes.reduce((a, st) => a + st.slice(1).reduce((b, p, j) => b + Math.hypot(p[0] - st[j][0], p[1] - st[j][1]), 0), 0);
            const bottom = strokes.flat().reduce((a, p) => (p[1] > a[1] ? p : a), [0, 0]);
            jobs.push({ strokes, len, bottom });
          }
          left += lw + gap;
        }
      });
      let i = 0;
      let drawn = 0;
      let pause = 0;
      const drips = [];
      const wipe = (strokes, upTo) => {
        // the finger: a clear trail through the fog, its edges a little ragged
        x.globalCompositeOperation = "destination-out";
        x.lineCap = "round";
        x.lineJoin = "round";
        for (const [width, alpha] of [[stroke * 1.25, 0.35], [stroke, 1]]) {
          x.lineWidth = width;
          x.strokeStyle = `rgba(0,0,0,${alpha})`;
          let left2 = upTo;
          x.beginPath();
          for (const st of strokes) {
            if (left2 <= 0) break;
            x.moveTo(st[0][0], st[0][1]);
            for (let j = 1; j < st.length && left2 > 0; j++) {
              const seg = Math.hypot(st[j][0] - st[j - 1][0], st[j][1] - st[j - 1][1]);
              const f = Math.min(1, left2 / seg);
              x.lineTo(st[j - 1][0] + (st[j][0] - st[j - 1][0]) * f, st[j - 1][1] + (st[j][1] - st[j - 1][1]) * f);
              left2 -= seg;
            }
          }
          x.stroke();
        }
        x.globalCompositeOperation = "source-over";
      };
      return {
        step(dt) {
          // the wet running down from the letters already written
          for (const d of drips) {
            if (d.y >= d.end) continue;
            const ny = Math.min(d.end, d.y + dt * d.speed);
            x.globalCompositeOperation = "destination-out";
            x.lineWidth = d.width;
            x.strokeStyle = "rgba(0,0,0,.9)";
            x.beginPath(); x.moveTo(d.x, d.y); x.lineTo(d.x + Math.sin(ny * 0.3) * 0.6, ny); x.stroke();
            x.globalCompositeOperation = "source-over";
            d.y = ny;
          }
          if (i >= jobs.length) {
            texture.needsUpdate = true;
            return drips.every((d) => d.y >= d.end);
          }
          if (pause > 0) { pause -= dt; texture.needsUpdate = true; return false; }
          const job = jobs[i];
          if (drawn === 0 && onLetter) onLetter(i);
          drawn = Math.min(job.len, drawn + (job.len * dt * 1000) / letterMs);
          wipe(job.strokes, drawn);
          texture.needsUpdate = true;
          if (drawn >= job.len) {
            // most letters weep a drip or two
            if (rnd() < 0.8) drips.push({ x: job.bottom[0] + (rnd() - 0.5) * stroke, y: job.bottom[1], end: Math.min(h - 2, job.bottom[1] + lh * (0.25 + rnd() * 0.6)), speed: lh * (0.3 + rnd() * 0.3), width: Math.max(2, stroke * 0.35) });
            i++;
            drawn = 0;
            pause = 0.12 + rnd() * 0.14;
          }
          return false;
        },
      };
    },
  };
  return pane;
}
