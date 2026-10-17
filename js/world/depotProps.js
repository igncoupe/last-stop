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
