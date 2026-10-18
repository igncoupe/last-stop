// The depot's time clock (with a punch card that really goes in and comes out)
// and the cork notice board (with notices you can actually read).
// Both are built facing +z; the depot turns them to face the room.
import * as THREE from "three";
import { mat, glow, box } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { drawPhoto } from "../core/portraits.js";

const put = (parent, mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, canvas: c, ctx: x };
}

/* ---------------- time clock ---------------- */
export function makeTimeClock() {
  const g = new THREE.Group();
  const beige = mat({ color: 0xb4a77f });
  const dark = mat({ color: 0x1d1d1f });
  // body with a bevelled top
  put(g, box(0.34, 0.46, 0.2, beige), 0, 0, 0);
  put(g, box(0.3, 0.05, 0.18, beige), 0, 0.255, -0.01);
  // clock face
  const face = canvasTexture(128, 128, () => {});
  const drawFace = (minutes) => {
    const x = face.ctx;
    x.fillStyle = "#efe9d8";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "#222";
    x.lineWidth = 3;
    x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      x.beginPath();
      x.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48);
      x.lineTo(64 + Math.sin(a) * 55, 64 - Math.cos(a) * 55);
      x.stroke();
    }
    x.fillStyle = "#222";
    x.font = "bold 11px monospace";
    x.textAlign = "center";
    x.fillText("TIME", 64, 86);
    const hand = (len, angle, width) => {
      x.lineWidth = width;
      x.beginPath();
      x.moveTo(64, 64);
      x.lineTo(64 + Math.sin(angle) * len, 64 - Math.cos(angle) * len);
      x.stroke();
    };
    hand(30, ((minutes / 60) % 12) / 12 * Math.PI * 2, 4);
    hand(44, (minutes % 60) / 60 * Math.PI * 2, 3);
    x.strokeStyle = "#a01818";
    hand(48, ((Date.now() / 1000) % 60) / 60 * Math.PI * 2, 1);
    face.texture.needsUpdate = true;
  };
  drawFace(23 * 60 + 38);
  const bezel = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.03, 20).rotateX(Math.PI / 2), dark), 0, 0.09, 0.1);
  put(g, new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), new THREE.MeshBasicMaterial({ map: face.texture })), 0, 0.09, 0.117);
  void bezel;
  // the card slot and a label plate
  const slot = put(g, box(0.14, 0.014, 0.06, dark), 0, -0.1, 0.09);
  put(g, box(0.16, 0.03, 0.02, mat({ color: 0x8a8f94 })), 0, -0.08, 0.105);
  const label = tex.sign("TIME RECORDER", { bg: "#2a2a2a", fg: "#e9e2c8", w: 128, h: 20, font: 11 });
  put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.04), new THREE.MeshBasicMaterial({ map: label })), 0, -0.18, 0.101);

  // card rack to the right, with a row of cards
  const rack = put(g, new THREE.Group(), 0.33, -0.02, 0);
  put(rack, box(0.2, 0.46, 0.05, mat({ color: 0x6e7378 })), 0, 0, 0);
  const cardTex = (name) => tex.sign(name, { bg: "#f1ead6", fg: "#2b2b2b", w: 40, h: 64, font: 7 });
  const names = ["HALE", "RHEE", "VARGA", "YOU", "OKAFOR"];
  names.forEach((n, i) => {
    put(rack, box(0.18, 0.012, 0.06, mat({ color: 0x55595d })), 0, 0.17 - i * 0.085, 0.03);     // pocket lip
    if (n === "YOU") return;
    put(rack, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.11), new THREE.MeshBasicMaterial({ map: cardTex(n) })), 0, 0.2 - i * 0.085, 0.056);
  });
  // your card: this one moves
  const card = put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.11), new THREE.MeshBasicMaterial({ map: cardTex("NIGHT\nROUTE 9"), side: THREE.DoubleSide })), 0.33, 0.2 - 3 * 0.085 - 0.02, 0.056);
  const home = card.position.clone();
  const above = new THREE.Vector3(0, 0.0, 0.12);
  const inside = new THREE.Vector3(0, -0.13, 0.095);

  // a short animation: rack -> in front of the slot -> down into it -> punch -> back
  let anim = null;
  let faceT = 0;
  const lerp3 = (a, b, t) => a.clone().lerp(b, t);
  return {
    group: g,
    hit: g.children[0],                  // the body, for looking at / pressing E
    slotWorld() { return slot.getWorldPosition(new THREE.Vector3()); },
    punch(onStamp) {
      return new Promise((done) => { anim = { t: 0, done, onStamp, stamped: false, baseY: g.position.y }; });
    },
    update(dt, minutes) {
      faceT -= dt;
      if (faceT <= 0) { faceT = 0.25; drawFace(minutes); }
      if (!anim) return;
      anim.t += dt;
      const t = anim.t;
      if (t < 0.5) card.position.copy(lerp3(home, above, t / 0.5));
      else if (t < 0.8) card.position.copy(lerp3(above, inside, (t - 0.5) / 0.3));
      else if (t < 1.3) {
        card.position.copy(inside);
        if (!anim.stamped) { anim.stamped = true; if (anim.onStamp) anim.onStamp(); }
        g.position.y = anim.baseY + Math.sin(t * 90) * 0.003;   // the clock shudders
      } else if (t < 1.6) { g.position.y = anim.baseY; card.position.copy(lerp3(inside, above, (t - 1.3) / 0.3)); }
      else if (t < 2.1) card.position.copy(lerp3(above, home, (t - 1.6) / 0.5));
      else {
        card.position.copy(home);
        const cb = anim.done;
        anim = null;
        cb();
      }
    },
  };
}

/* ---------------- notice board ---------------- */
function wrap(x, text, maxW) {
  const words = text.split(" ");
  const out = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function makeNoticeBoard() {
  const g = new THREE.Group();
  put(g, box(1.34, 0.98, 0.05, mat({ color: 0x3b2716 })), 0, 0, 0);
  const board = canvasTexture(512, 360, () => {});
  const draw = (main) => {
    const x = board.ctx;
    // cork
    x.fillStyle = "#9b7246";
    x.fillRect(0, 0, 512, 360);
    for (let i = 0; i < 2500; i++) {
      x.fillStyle = `rgba(${60 + Math.random() * 60},${40 + Math.random() * 30},${20},${0.25})`;
      x.fillRect(Math.random() * 512, Math.random() * 360, 2, 2);
    }
    const paper = (px, py, w, h, rot, bg, title, lines, opts = {}) => {
      x.save();
      x.translate(px + w / 2, py + h / 2);
      x.rotate(rot);
      x.fillStyle = "rgba(0,0,0,.35)";
      x.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
      x.fillStyle = bg;
      x.fillRect(-w / 2, -h / 2, w, h);
      x.fillStyle = "#1c1c1c";
      x.textAlign = "left";
      let y = -h / 2 + 18;
      if (opts.kicker) {
        x.font = "8px monospace";
        x.fillStyle = "#6a5e48";
        x.fillText(opts.kicker.toUpperCase(), -w / 2 + 8, y);
        x.fillStyle = "#1c1c1c";
        y += 13;
      }
      if (title) {
        x.font = `bold ${opts.titleSize || 13}px monospace`;
        for (const ln of wrap(x, title, w - 16)) { x.fillText(ln, -w / 2 + 8, y); y += (opts.titleSize || 13) + 3; }
        y += 4;
      }
      x.font = `${opts.size || 10}px monospace`;
      for (const l of lines) {
        for (const ln of wrap(x, l, w - 16)) { if (y < h / 2 - 6) x.fillText(ln, -w / 2 + 8, y); y += (opts.size || 10) + 3; }
      }
      if (opts.photo) drawPhoto(x, opts.photo === true ? "varga" : opts.photo, -w / 2 + 12, -h / 2 + 30, w - 24, h - 70);
      // push pin
      x.fillStyle = opts.pin || "#c0262c";
      x.beginPath(); x.arc(0, -h / 2 + 6, 5, 0, Math.PI * 2); x.fill();
      x.restore();
    };
    paper(14, 14, 230, 200, -0.03, "#f3eedf", (main.title || "").toUpperCase(), main.lines, { titleSize: 15, size: 11, kicker: main.kicker });
    if (main.scrawl) {
      // someone's written underneath in pencil, fast, like they were being chased
      x.save();
      x.translate(36, 196);
      x.rotate(-0.09);
      let cx = 0;
      [...main.scrawl].forEach((ch, i, all) => {
        const k = i / Math.max(1, all.length - 1);
        const size = 15 + Math.random() * (4 + k * 5);
        x.font = `italic ${size.toFixed(0)}px 'Segoe Print', cursive`;
        x.save();
        x.translate(cx, k * 7 + (Math.random() - 0.5) * (2 + k * 4));
        x.rotate((Math.random() - 0.5) * (0.25 + k * 0.4));
        x.fillStyle = Math.random() < 0.2 ? "rgba(25,25,30,.95)" : "rgba(45,45,52,.8)";
        x.fillText(ch, 0, 0);
        x.restore();
        cx += x.measureText(ch).width * (0.85 + Math.random() * 0.3);
      });
      x.strokeStyle = "rgba(45,45,52,.55)";
      x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(cx + 2, 6); x.lineTo(cx + 30, 13); x.stroke();      // the pencil skids off
      x.restore();
    }
    paper(262, 18, 230, 118, 0.025, "#fdf6c8", "ROUTE 9 - NIGHT TIMETABLE", [
      "DEPOT ........ 11:40", "ELM & 4TH .... 11:46", "MARKET ST .... 11:52", "ST. AGNES .... 11:58", "CANAL ROW .... 12:06", "NORTHGATE .... 12:20",
    ], { size: 10, pin: "#2a5fb0" });
    paper(262, 150, 112, 120, -0.05, "#e9f0f6", "SAFETY FIRST", ["Check your mirrors.", "Never stop at unmarked stops."], { size: 9, pin: "#2a8a3c" });
    paper(384, 150, 110, 150, 0.04, "#d8d2c0", "EMPLOYEE OF THE MONTH", ["", "", "", "", "", "", "T. VARGA  -  MARCH 1994"], { size: 8, photo: true, pin: "#c0a020" });
    paper(18, 232, 226, 112, 0.02, "#fbe3e3", "LOST & FOUND", ["1 umbrella (black)", "1 child's yellow raincoat button", "1 gift, wrapped (balloons). Unclaimed since 1994."], { size: 10 });
    board.texture.needsUpdate = true;
  };
  draw({ title: "Notice", lines: ["Route 9 night service."] });
  const cork = put(g, new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.88), new THREE.MeshBasicMaterial({ map: board.texture })), 0, 0, 0.027);
  // a little lamp above it so you can read it
  put(g, box(0.4, 0.05, 0.12, mat({ color: 0x2a2c30 })), 0, 0.56, 0.08);
  put(g, box(0.34, 0.02, 0.06, glow(0xfff2cc)), 0, 0.53, 0.1);
  const lamp = new THREE.PointLight(0xfff2cc, 1.6, 2.2, 1.5);
  put(g, lamp, 0, 0.45, 0.35);
  return {
    group: g,
    hit: cork,
    setNotice(doc) { draw(doc); },
  };
}

/* ---------------- Rosie's present ---------------- */
// a small box in soggy balloon paper, with a ribbon, a bow and a tag
export function makeGift() {
  const g = new THREE.Group();
  g.name = "gift";
  const paper = canvasTexture(64, 64, (x) => {
    x.fillStyle = "#8fa9c4";
    x.fillRect(0, 0, 64, 64);
    const cols = ["#e45a5a", "#f2c84b", "#6cc07a", "#f08cc0"];
    for (let i = 0; i < 9; i++) {
      const bx = (i % 3) * 22 + 8 + (Math.floor(i / 3) % 2) * 8;
      const by = Math.floor(i / 3) * 22 + 8;
      x.fillStyle = cols[i % 4];
      x.beginPath(); x.ellipse(bx, by, 5, 6.5, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "#ddd";
      x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(bx, by + 6.5); x.quadraticCurveTo(bx + 3, by + 11, bx, by + 15); x.stroke();
    }
    // water stains
    x.fillStyle = "rgba(40,50,60,.25)";
    x.beginPath(); x.ellipse(40, 46, 20, 12, 0.4, 0, Math.PI * 2); x.fill();
  });
  paper.texture.magFilter = THREE.NearestFilter;
  const wrapMat = mat({ map: paper.texture });
  put(g, box(0.22, 0.14, 0.22, wrapMat), 0, 0, 0);
  const ribbon = mat({ color: 0xc8283a });
  put(g, box(0.226, 0.146, 0.035, ribbon), 0, 0, 0);
  put(g, box(0.035, 0.146, 0.226, ribbon), 0, 0, 0);
  // bow: two loops and a knot
  for (const s of [-1, 1]) {
    const loop = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 10), ribbon), s * 0.03, 0.09, 0);
    loop.rotation.set(0, Math.PI / 2, s * 0.6);
  }
  put(g, box(0.025, 0.022, 0.025, ribbon), 0, 0.078, 0);
  // the tag on a string
  const tag = tex.sign("ROSIE", { bg: "#f3ead2", fg: "#283068", w: 40, h: 20, font: 9 });
  const t = put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.035), new THREE.MeshBasicMaterial({ map: tag, side: THREE.DoubleSide })), 0.1, 0.03, 0.115);
  t.rotation.set(-0.2, 0.2, -0.25);
  return g;
}

// Teodor Varga's old locker, at the end of a row of them in the depot: the others padlocked and dented, his door
// hanging open. Inside: his uniform jacket on its hook, a thermos and a lunch tin on the shelf, his shoes, photos
// and a kid's drawing of the bus taped inside the door, and tonight's clipping taped to the back wall.
function lockerTexture({ name = null, seed: s0 = 1 } = {}) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 192;
  const x = c.getContext("2d");
  let s = s0 * 977 + 13;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // old army-green enamel, worn through to grey steel at the edges and round the handle
  x.fillStyle = "#4f5a52";
  x.fillRect(0, 0, 64, 192);
  for (let i = 0; i < 600; i++) {
    const v = 70 + Math.floor(r() * 30);
    x.fillStyle = `rgba(${v},${v + 10},${v},${0.15 + r() * 0.2})`;
    x.fillRect(Math.floor(r() * 64), Math.floor(r() * 192), 1 + Math.floor(r() * 2), 1);
  }
  x.fillStyle = "rgba(150,155,150,.35)";
  for (let i = 0; i < 30; i++) x.fillRect(r() < 0.5 ? 0 : 61, Math.floor(r() * 192), 3, 2 + r() * 6);
  // rust: blooms low down, and streaks running from the vents
  for (let i = 0; i < 14; i++) {
    const px = r() * 64, py = 120 + r() * 72, rr = 2 + r() * 8;
    const g = x.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, "rgba(120,62,28,.75)");
    g.addColorStop(1, "rgba(120,62,28,0)");
    x.fillStyle = g;
    x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 6; i++) { x.fillStyle = "rgba(110,58,26,.45)"; x.fillRect(14 + r() * 36, 34, 1, 10 + r() * 30); }
  // scratches, a dent
  x.strokeStyle = "rgba(170,175,168,.4)";
  for (let i = 0; i < 8; i++) { x.beginPath(); const px = r() * 64, py = r() * 192; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 20, py + (r() - 0.5) * 8); x.stroke(); }
  const dy = 80 + r() * 60;
  const dg = x.createRadialGradient(30, dy, 1, 30, dy, 12);
  dg.addColorStop(0, "rgba(20,24,20,.45)"); dg.addColorStop(0.6, "rgba(120,130,122,.25)"); dg.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = dg;
  x.fillRect(16, dy - 12, 28, 24);
  // the louvers at the top and bottom
  for (const y0 of [12, 164]) for (let i = 0; i < 6; i++) { x.fillStyle = "#1c211d"; x.fillRect(16, y0 + i * 4, 32, 2); x.fillStyle = "rgba(160,170,160,.35)"; x.fillRect(16, y0 + i * 4 + 2, 32, 1); }
  // the name slot
  x.fillStyle = "#2a2f2b";
  x.fillRect(18, 44, 28, 9);
  x.fillStyle = name ? "#d9d2bc" : "#8f8a78";
  x.fillRect(19, 45, 26, 7);
  if (name) { x.fillStyle = "#2a2418"; x.font = "bold 6px monospace"; x.textAlign = "center"; x.fillText(name, 32, 51); }
  else if (r() < 0.6) { x.fillStyle = "rgba(40,36,28,.7)"; x.fillRect(22, 47, 10 + r() * 10, 2); }
  // the latch, and a sticker half scraped off
  x.fillStyle = "#9aa09a";
  x.fillRect(50, 90, 6, 22);
  x.fillStyle = "#3a3e3a";
  x.fillRect(51, 96, 4, 8);
  if (r() < 0.5) { x.fillStyle = "rgba(200,60,40,.6)"; x.fillRect(10, 120, 12, 8); x.fillStyle = "rgba(240,230,210,.6)"; x.fillRect(11, 121, 6, 2); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// inside his door: photos, a route map, and the drawing Lena's kid did of the bus with him in a big hat
function doorInsideTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 160;
  const x = c.getContext("2d");
  x.fillStyle = "#59615a";
  x.fillRect(0, 0, 64, 160);
  for (let i = 0; i < 300; i++) { const v = 60 + Math.random() * 30; x.fillStyle = `rgba(${v},${v + 8},${v},.3)`; x.fillRect(Math.random() * 64, Math.random() * 160, 1, 1); }
  const tape = (px, py) => { x.fillStyle = "rgba(220,210,170,.75)"; x.fillRect(px, py, 9, 3); };
  // the drawing: crayon, a yellow bus, a big man in a big hat at the wheel, a sun, his name
  x.save(); x.translate(8, 12); x.rotate(-0.06);
  x.fillStyle = "#f4f0e2"; x.fillRect(0, 0, 46, 36);
  x.fillStyle = "#e8b52a"; x.fillRect(5, 14, 34, 13);
  x.fillStyle = "#3a6ab0"; for (let i = 0; i < 4; i++) x.fillRect(8 + i * 8, 16, 5, 5);
  x.fillStyle = "#222"; x.beginPath(); x.arc(12, 28, 3, 0, 7); x.arc(32, 28, 3, 0, 7); x.fill();
  x.fillStyle = "#6a3e1e"; x.fillRect(8, 9, 9, 3); x.fillRect(10, 6, 5, 4);
  x.fillStyle = "#f0a020"; x.beginPath(); x.arc(39, 7, 4, 0, 7); x.fill();
  x.fillStyle = "#c03030"; x.font = "bold 5px sans-serif"; x.fillText("TEODOR", 4, 34);
  x.restore();
  tape(10, 9); tape(42, 10);
  // a photo: him and the bus, years ago
  x.save(); x.translate(10, 58); x.rotate(0.05);
  x.fillStyle = "#e9e3d2"; x.fillRect(0, 0, 30, 32);
  x.fillStyle = "#6c6a5c"; x.fillRect(2, 2, 26, 22);
  x.fillStyle = "#d9cfae"; x.fillRect(4, 12, 22, 8);
  x.fillStyle = "#3a2d24"; x.fillRect(6, 8, 3, 6);
  x.restore();
  tape(18, 56);
  // a second one, older, a woman laughing
  x.save(); x.translate(30, 96); x.rotate(-0.1);
  x.fillStyle = "#e9e3d2"; x.fillRect(0, 0, 26, 30);
  x.fillStyle = "#7a6650"; x.fillRect(2, 2, 22, 20);
  x.fillStyle = "#c9a888"; x.fillRect(9, 6, 8, 8);
  x.fillStyle = "#3a2a1e"; x.fillRect(8, 4, 10, 3);
  x.restore();
  tape(35, 94);
  // a route map, folded, its corner curling
  x.fillStyle = "#d8d0b4"; x.fillRect(6, 130, 24, 20);
  x.strokeStyle = "#a02020"; x.beginPath(); x.moveTo(8, 146); x.lineTo(14, 136); x.lineTo(22, 140); x.lineTo(28, 132); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeLockers() {
  const g = new THREE.Group();
  const frame = mat({ color: 0x3e4740 });
  const dark = mat({ color: 0x15171a });
  const W = 0.55, H = 1.9, D = 0.6, STEP = 0.62;
  for (let i = 0; i < 5; i++) {
    const z = i * STEP;
    const last = i === 4;
    // the carcass: sides, top, a kick plate, the dark inside
    put(g, box(D, H, 0.02, frame), 0, H / 2, z - W / 2 - 0.02);
    put(g, box(D, H, 0.02, frame), 0, H / 2, z + W / 2 + 0.02);
    put(g, box(D, 0.03, W + 0.06, frame), 0, H + 0.015, z);
    put(g, box(0.03, 0.12, W + 0.06, dark), D / 2 - 0.01, 0.06, z);
    if (!last) put(g, box(D - 0.04, H - 0.14, W, dark), -0.02, H / 2 + 0.06, z);
    else {
      // his is open: a back wall and a floor, grey steel, so you can see what's in it
      put(g, box(0.02, H - 0.14, W, mat({ color: 0x3a403c })), -D / 2 + 0.02, H / 2 + 0.06, z);
      put(g, box(D - 0.04, 0.02, W, mat({ color: 0x2a2e2c })), -0.02, 0.13, z);
    }
    if (!last) {
      // a closed door, and a padlock on most of them
      const door = put(g, new THREE.Mesh(new THREE.PlaneGeometry(W, H - 0.14), mat({ map: lockerTexture({ seed: i + 2 }) })), D / 2 + 0.005, H / 2 + 0.06, z);
      door.rotation.y = Math.PI / 2;
      if (i !== 3) {
        put(g, box(0.03, 0.06, 0.05, mat({ color: 0x8a8c80 })), D / 2 + 0.03, 0.98, z + 0.2);
        const lock = put(g, box(0.04, 0.06, 0.045, mat({ color: 0xb08a3c })), D / 2 + 0.05, 0.92, z + 0.2);
        put(lock, new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.004, 4, 8, Math.PI), mat({ color: 0x9a9c90 })), 0, 0.035, 0);
      }
    }
  }
  // the last one is his: the door swung open, his name still in the slot
  const z = 4 * STEP;
  const doorPivot = new THREE.Group();
  doorPivot.position.set(D / 2, 0, z + W / 2);
  doorPivot.rotation.y = -1.9;                 // swung open, out into the room
  const outside = put(doorPivot, new THREE.Mesh(new THREE.PlaneGeometry(W, H - 0.14), mat({ map: lockerTexture({ seed: 9, name: "T. VARGA" }) })), 0.012, H / 2 + 0.06, -W / 2);
  outside.rotation.y = Math.PI / 2;
  const inside = put(doorPivot, new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, H - 0.3), mat({ map: doorInsideTexture() })), -0.012, H / 2 + 0.06, -W / 2);
  inside.rotation.y = -Math.PI / 2;
  put(doorPivot, box(0.02, H - 0.14, W, mat({ color: 0x404842 })), 0, H / 2 + 0.06, -W / 2);
  put(doorPivot, box(0.05, 0.12, 0.03, mat({ color: 0x9aa09a })), 0.03, 1.0, -W + 0.05);   // the latch
  g.add(doorPivot);
  // inside: the shelf with a thermos and a lunch tin, a hook with his jacket on it, his shoes
  put(g, box(D - 0.06, 0.02, W - 0.02, frame), -0.02, 1.58, z);
  const thermos = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 10), mat({ color: 0x3a6a4a })), 0.05, 1.73, z - 0.15);
  put(thermos, new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.06, 10), mat({ color: 0x9aa0a0 })), 0, 0.16, 0);
  put(g, box(0.18, 0.09, 0.22, mat({ color: 0x8a2a20 })), -0.02, 1.635, z + 0.12);                              // the lunch tin
  put(g, box(0.19, 0.012, 0.23, mat({ color: 0xb08a3c })), -0.02, 1.68, z + 0.12);
  put(g, box(0.03, 0.03, 0.1, mat({ color: 0x9aa09a })), -0.15, 1.5, z - 0.15);                                // the hook
  // his jacket on it: brown, Route 9, hanging off its shoulders
  const jacket = new THREE.Group();
  put(jacket, box(0.14, 0.62, 0.42, mat({ color: 0x5a4632 })), 0, -0.32, 0);
  for (const s2 of [-1, 1]) put(jacket, box(0.1, 0.55, 0.09, mat({ color: 0x4e3c2a })), 0.01, -0.33, s2 * 0.24);
  put(jacket, box(0.15, 0.08, 0.3, mat({ color: 0x4a3a2a })), 0, 0, 0);                                         // the collar
  put(jacket, box(0.01, 0.05, 0.07, mat({ color: 0xb08a3c })), 0.075, -0.16, 0.1);                                // the Route 9 patch
  jacket.position.set(-0.06, 1.48, z - 0.15);
  jacket.rotation.y = 1.15;                    // hanging sideways off the hook, to one side
  g.add(jacket);
  for (const s2 of [-1, 1]) put(g, box(0.24, 0.07, 0.1, mat({ color: 0x1a1612 })), 0.05, 0.16, z + s2 * 0.08);   // his shoes
  // the clipping, taped to the back wall, where the light from the room reaches it
  const clipCanvas = document.createElement("canvas");
  clipCanvas.width = 64;
  clipCanvas.height = 84;
  const clipTex = new THREE.CanvasTexture(clipCanvas);
  clipTex.magFilter = THREE.NearestFilter;
  const clip = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), mat({ map: clipTex }));
  clip.position.set(-D / 2 + 0.04, 1.22, z + 0.12);
  clip.rotation.y = Math.PI / 2;
  g.add(clip);
  // what you press E on: the open locker, door and all
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.set(0.45, 0.95, z);
  g.add(hit);
  return {
    group: g,
    hit,
    setClipping(title) {
      clip.visible = !!title;
      if (!title) return;
      const x = clipCanvas.getContext("2d");
      x.fillStyle = "#d9cba3"; x.fillRect(0, 0, 64, 84);
      x.fillStyle = "#1d1b17"; x.font = "bold 7px serif";
      // the headline, wrapped
      const words = title.split(" ");
      let line = "";
      let y = 10;
      for (const w of words) {
        if (x.measureText(line + w).width > 58 && line) { x.fillText(line.trim(), 3, y); y += 8; line = ""; }
        line += w + " ";
      }
      x.fillText(line.trim(), 3, y);
      x.fillStyle = "#6b6450"; x.fillRect(4, y + 5, 26, 20);                                   // a photo
      x.fillStyle = "rgba(40,36,28,.55)";
      for (let r = y + 5; r < 80; r += 4) x.fillRect(33, r, 27, 1.5);                           // columns of print
      for (let r = y + 29; r < 80; r += 4) x.fillRect(4, r, 26, 1.5);
      x.fillStyle = "rgba(200,190,140,.6)"; x.fillRect(22, 0, 20, 4);                           // tape
      clipTex.needsUpdate = true;
    },
  };
}
