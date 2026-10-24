// In-world jumpscares. Instead of a picture on the screen, a drowned face (or hands, or eyes) appears right in front
// of the camera inside the game, lit by its own cold light, and is gone a moment later. Every face is someone the
// story has you meet (LOOKS), so you know who it is that's coming at you.
import * as THREE from "three";
import { handMesh } from "./hands.js";

// only your own view sees these (never the mirror's)
export const HORROR_LAYER = 6;

// whose face it is: their skin and hair (as they look in the world, people.js), their clothes, and what the water did
const LOOKS = {
  // the man in the dark coat who wants to go to Ashgrove
  daniel: { skin: 0x919a9f, hair: 0x241c16, style: "short", coat: 0x2a2e34, male: true, iris: 0x7d8a8a },
  // the woman from the car, her long black hair plastered across her face
  carwoman: { skin: 0x87939a, hair: 0x0a0a0c, style: "long", coat: 0x2a2c30, lips: 0x2e2e36, iris: 0x8e8a80 },
  // one of the drowned: a woman, her hair hanging over her face, her eyes gone white
  drowned: { skin: 0x8e989c, hair: 0x1d1d1d, style: "long", coat: 0x2f3a40, iris: 0xc2c8c0, milky: true },
  // ...and a man
  drownedman: { skin: 0x8a9498, hair: 0x1d1d1d, style: "short", coat: 0x2f3a40, male: true, iris: 0xbcc2ba, milky: true, stubble: true },
};

const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const g2 = (dx, dy, dz, r) => Math.exp(-(dx * dx + dy * dy + dz * dz) / (r * r));
const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// The head is a sphere pushed in and out into a face: a heavy brow, deep sockets, a nose, cheekbones over hollow
// cheeks, a chin. shape() is how far out (or in) the surface is along a direction from the middle of the head (a unit
// vector, +z the front), so anything that has to lie on the face (hair, eyes) can find it.
function shape(x, y, z, male) {
  let p = 0.06 * g2(x * 0.55, y - 0.3, z - 0.92, 0.2);                     // the brow
  for (const s of [-1, 1]) {
    p -= 0.19 * g2(x - s * 0.36, y - 0.06, z - 0.92, 0.2);                  // eye sockets, deep
    p += 0.05 * g2(x - s * 0.58, y + 0.08, z - 0.76, 0.2);                  // cheekbones
    p -= 0.07 * g2(x - s * 0.5, y + 0.38, z - 0.74, 0.2);                   // the cheeks under them, sunken
    p -= 0.04 * g2(x - s * 0.88, y - 0.22, z - 0.3, 0.25);                  // temples
  }
  if (z > 0) p += 0.17 * Math.exp(-((x / 0.11) ** 2) - ((y + 0.1) / 0.21) ** 2) * z;  // the bridge of the nose
  p += 0.09 * g2(x, y + 0.28, z - 0.97, 0.11);                              // ...and its tip
  p -= 0.035 * g2(x * 0.45, y + 0.5, z - 0.9, 0.1);                         // where the lips meet
  p += 0.07 * g2(x * 0.8, y + 0.86, z - 0.48, 0.24);                        // the chin
  if (male) p += 0.03 * g2(x * 0.5, y + 0.7, z - 0.55, 0.3);                // a heavier jaw
  return p;
}
function surface(n, look, out = new THREE.Vector3(), lift = 0) {
  const k = 1 + shape(n.x, n.y, n.z, look.male) + lift;
  const narrow = 1 - 0.17 * smooth(-0.15, -0.9, n.y);                       // the jaw narrower than the skull
  return out.set(n.x * k * narrow * look.size[0], n.y * k * look.size[1], n.z * k * look.size[2]);
}
const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// where a direction from the middle of the head lands on the skin texture (the sphere's own mapping), in pixels
function onSkin(x, y, z, W, H) {
  const phi = Math.atan2(z, -x);
  return [(((phi / (Math.PI * 2)) % 1) + 1) % 1 * W, (Math.acos(THREE.MathUtils.clamp(y, -1, 1)) / Math.PI) * H];
}
// skin that's been in the water: blotchy, veined, wrinkled; and painted into it, the face: the shadows down either
// side of the nose and from its wings to the corners of the mouth, creases across the forehead, the hollows under
// the cheekbones, split lips, veins at the temples
function skinTexture(seed) {
  const W = 256, H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  const r = rng(seed);
  x.fillStyle = "#d9d9d9";
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 320; i++) {
    const v = (165 + r() * 85) | 0;
    x.fillStyle = `rgba(${v},${v},${v + 8},0.32)`;
    const s = 1 + r() * 4;
    x.fillRect(r() * W, r() * H, s, s * (0.6 + r()));
  }
  x.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    x.strokeStyle = `rgba(${60 + r() * 30},${70 + r() * 20},${115 + r() * 30},${0.3 + r() * 0.25})`;
    let px = r() * W, py = r() * H;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 7; k++) { px += (r() - 0.5) * 12; py += (r() - 0.35) * 7; x.lineTo(px, py); }
    x.stroke();
  }
  x.strokeStyle = "rgba(80,82,90,0.28)";
  for (let i = 0; i < 80; i++) {
    const px = r() * W, py = r() * H, l = 2 + r() * 5;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + l, py + (r() - 0.5) * 1.5);
    x.stroke();
  }
  const at = (dx, dy, dz) => { const v = new THREE.Vector3(dx, dy, dz).normalize(); return onSkin(v.x, v.y, v.z, W, H); };
  const line = (pts, width, color) => {
    x.strokeStyle = color;
    x.lineWidth = width;
    x.beginPath();
    pts.forEach(([a, b, c], i) => { const [px, py] = at(a, b, c); i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke();
  };
  const blot = (a, b, c, rx, ry, color) => { const [px, py] = at(a, b, c); x.fillStyle = color; x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
  for (const s of [-1, 1]) {
    line([[s * 0.1, 0.12, 1], [s * 0.12, -0.05, 1], [s * 0.15, -0.26, 1]], 2.2, "rgba(40,36,44,0.55)");       // beside the nose
    line([[s * 0.17, -0.3, 1], [s * 0.26, -0.42, 0.95], [s * 0.3, -0.55, 0.9]], 1.6, "rgba(40,36,44,0.5)");     // nose to mouth
    blot(s * 0.5, -0.33, 0.8, 7, 6, "rgba(40,40,52,0.35)");                                                     // the hollow cheek
    blot(s * 0.36, -0.08, 0.93, 6, 3, "rgba(30,26,40,0.5)");                                                     // the bag under the eye
    line([[s * 0.75, 0.3, 0.6], [s * 0.82, 0.12, 0.55], [s * 0.78, -0.02, 0.6]], 1, "rgba(60,70,120,0.6)");     // a vein at the temple
  }
  for (const h of [0.42, 0.5, 0.58]) line([[-0.35, h, 0.9], [0, h + 0.02, 1], [0.35, h, 0.9]], 1, "rgba(50,48,56,0.45)");   // the forehead
  line([[-0.3, -0.5, 0.92], [0, -0.52, 1], [0.3, -0.5, 0.92]], 2.5, "rgba(20,14,20,0.8)");                    // where the lips meet
  for (let i = 0; i < 6; i++) { const u = -0.25 + i * 0.1; line([[u, -0.44, 0.96], [u + 0.01, -0.58, 0.95]], 1, "rgba(90,40,50,0.5)"); }   // split lips
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a strip of wet hair lying along `points` (and the way across it, `across` at each), wide at the root, thin at the end
function ribbon(points, across, w0, w1, pos, idx) {
  const base = pos.length / 3;
  points.forEach((p, i) => {
    const w = THREE.MathUtils.lerp(w0, w1, i / (points.length - 1)) / 2;
    const a = across[i];
    pos.push(p.x - a.x * w, p.y - a.y * w, p.z - a.z * w, p.x + a.x * w, p.y + a.y * w, p.z + a.z * w);
    if (i) { const k = base + (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
}

function face(name) {
  const look = { ...LOOKS[name] };
  look.size = look.male ? [0.118, 0.152, 0.13] : [0.108, 0.145, 0.123];
  const r = rng(name.length * 7919 + 17);
  const g = new THREE.Group();
  const skinCol = new THREE.Color(look.skin);
  const skin = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, map: skinTexture(name.length * 31 + 5), flatShading: true, shininess: 26, specular: 0x27323a });
  const plain = new THREE.MeshPhongMaterial({ color: skinCol.clone().multiplyScalar(0.92), flatShading: true, shininess: 20, specular: 0x1d262c });
  const lidMat = new THREE.MeshPhongMaterial({ color: skinCol.clone().lerp(new THREE.Color(0x4a3a4a), 0.35), flatShading: true, shininess: 30, specular: 0x27323a });
  const wet = new THREE.MeshPhongMaterial({ color: look.hair, shininess: 55, specular: 0x2c383e, flatShading: true, side: THREE.DoubleSide });
  const black = new THREE.MeshBasicMaterial({ color: 0x050405 });

  // ---- the head, split at the mouth so the jaw can come away
  // (fine enough that a nose, the sockets and a mouth line actually come out in it; the mouth line is its 28th ring)
  const geo = new THREE.SphereGeometry(1, 56, 42);
  const pos = geo.attributes.position;
  const unit = [];
  const col = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const SOCKET = new THREE.Color(0x0b090d), BRUISE = new THREE.Color(0x3e4552), LIPS = new THREE.Color(look.lips ?? 0x434852);
  const STUBBLE = new THREE.Color(0x4a5054), NOSTRIL = new THREE.Color(0x1e1a1e);
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i);
    unit.push(n.clone());
    surface(n, look, p);
    pos.setXYZ(i, p.x, p.y, p.z);
    c.copy(skinCol).multiplyScalar(1.12);
    for (const s of [-1, 1]) {
      c.lerp(SOCKET, 0.95 * g2(n.x - s * 0.36, n.y - 0.06, n.z - 0.92, 0.25));      // the sockets, black
      c.lerp(BRUISE, 0.45 * g2(n.x - s * 0.36, n.y + 0.13, n.z - 0.9, 0.13));       // ...and under the eyes, blue
      c.lerp(NOSTRIL, 0.7 * g2(n.x - s * 0.07, n.y + 0.33, n.z - 0.94, 0.06));
    }
    c.lerp(LIPS, 0.85 * Math.exp(-((n.x / 0.3) ** 2) - ((n.y + 0.5) / 0.09) ** 2) * smooth(0.6, 0.9, n.z));
    if (look.stubble) c.lerp(STUBBLE, 0.3 * smooth(-0.3, -0.6, n.y) * smooth(0.1, 0.5, n.z));
    c.multiplyScalar(1 - 0.25 * smooth(-0.5, -1, n.y));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const skullIdx = [], jawIdx = [];
  const ix = geo.index.array;
  for (let t = 0; t < ix.length; t += 3) {
    const v = [ix[t], ix[t + 1], ix[t + 2]];
    const jaw = v.every((k) => unit[k].y < -0.49) && (unit[v[0]].z + unit[v[1]].z + unit[v[2]].z) / 3 > -0.3;
    (jaw ? jawIdx : skullIdx).push(...v);
  }
  const part = (list) => { const q = geo.clone(); q.setIndex(list); q.computeVertexNormals(); return q; };
  g.add(new THREE.Mesh(part(skullIdx), skin));
  // inside the mouth: dark
  const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), black);
  cavity.scale.set(1, 0.85, 0.9);
  cavity.position.set(0, -0.062, 0.025);
  g.add(cavity);
  // the jaw swings open about a hinge back by the ears, and slides forward a little as it goes, the way a real one
  // does (so the chin drops instead of tucking back into the neck)
  const hinge = new THREE.Vector3(0, -0.15 * look.size[1], -0.55 * look.size[2]);
  const jaw = new THREE.Group();
  jaw.position.copy(hinge);
  jaw.userData = { hinge, glide: new THREE.Vector3(0, -0.006, 0.034) };
  const jawMesh = new THREE.Mesh(part(jawIdx), skin);
  jawMesh.position.copy(hinge).negate();
  jaw.add(jawMesh);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 5), new THREE.MeshPhongMaterial({ color: 0x2a181d, shininess: 60, flatShading: true }));
  tongue.scale.set(1, 0.3, 1.2);
  tongue.position.set(0, -0.09, 0.025).sub(hinge);
  jaw.add(tongue);
  g.add(jaw);
  // teeth, top and bottom: yellowed, a few gone
  const toothMat = new THREE.MeshPhongMaterial({ color: 0xb7b29a, shininess: 50, flatShading: true });
  const toothGeo = new THREE.BoxGeometry(0.0085, 0.011, 0.005);
  for (const [y, onJaw] of [[-0.46, false], [-0.55, true]]) {
    for (let i = 0; i < 8; i++) {
      if (look.milky && r() < 0.18) continue;
      const xu = -0.27 + (i / 7) * 0.54;
      const at = surface(dir(xu, y, Math.sqrt(Math.max(0.05, 1 - xu * xu - y * y))), look, new THREE.Vector3(), -0.05);
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.position.copy(at);
      tooth.position.y += onJaw ? 0.004 : -0.003;
      tooth.rotation.y = Math.atan2(at.x, at.z);
      tooth.scale.y = 0.8 + r() * 0.4;
      if (onJaw) { tooth.position.sub(hinge); jaw.add(tooth); } else g.add(tooth);
    }
  }

  // ---- eyes: wet, set deep in the sockets, clouded over; the upper lids hang half shut until it comes for you
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.copy(surface(dir(s * 0.36, 0.06, 0.93), look)).multiplyScalar(0.97);
    eye.position.z -= 0.004;
    const R = 0.0145;
    // (the whites gone dull and yellowish in the water, but wet: the light catches them)
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(R, 12, 9), new THREE.MeshPhongMaterial({ color: look.milky ? 0x9c9e92 : 0xa29d88, shininess: 60, specular: 0x343c3e })));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0068, 14), new THREE.MeshPhongMaterial({ color: look.iris, shininess: 80, specular: 0x6a7476 }));
    iris.position.z = R + 0.0003;
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0029, 10), new THREE.MeshBasicMaterial({ color: look.milky ? 0x4a504c : 0x070707 }));
    pupil.position.z = R + 0.0006;
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 6), new THREE.MeshBasicMaterial({ color: 0xf2f0e4 }));
    glint.position.set(0.0028, 0.0028, R + 0.0009);
    // the lid: a shell over the top of the eye, swung down over it (or up, wide open)
    const lid = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), lidMat);
    eye.add(iris, pupil, glint, lid);
    g.add(eye);
    eyes.push({ eye, lid, pupil, iris });
  }
  // ears (the long-haired faces' are under their hair anyway)
  if (look.style === "short") {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 6), plain);
      ear.scale.set(0.45, 1.25, 0.8);
      ear.position.copy(surface(dir(s * 0.98, 0.02, -0.08), look)).multiplyScalar(0.98);
      ear.rotation.y = s * 0.3;
      g.add(ear);
    }
  }

  // ---- hair: a wet cap over the skull, and (long) strands hanging down over the face, the sides and the back
  const capGeo = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, 2.3);
  const cp = capGeo.attributes.position;
  const front = look.style === "long" ? 0.6 : 0.62, back = look.style === "long" ? -0.35 : -0.2;
  for (let i = 0; i < cp.count; i++) {
    n.fromBufferAttribute(cp, i);
    // (below the hairline it's folded up onto the hairline, out of sight)
    const line = THREE.MathUtils.lerp(back, front, smooth(-0.55, 0.8, n.z)) + (r() - 0.5) * 0.05;
    if (n.y < line) {
      const k = Math.sqrt(Math.max(0, 1 - line * line)) / Math.max(1e-4, Math.hypot(n.x, n.z));
      n.set(n.x * k, line, n.z * k);
    }
    surface(n, look, p, 0.04 + r() * 0.04);                 // lumpy: wet hair lies in clumps
    cp.setXYZ(i, p.x, p.y, p.z);
  }
  capGeo.computeVertexNormals();
  g.add(new THREE.Mesh(capGeo, wet));
  const hpos = [], hidx = [];
  const strandAlong = (a, theta0, theta1, drop, w0, w1, drift = 0) => {
    const pts = [], across = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const th = THREE.MathUtils.lerp(theta0, theta1, Math.min(1, k * 1.25));
      const az = a + drift * k;
      const d = dir(Math.sin(th) * Math.sin(az), Math.cos(th), Math.sin(th) * Math.cos(az));
      const pt = surface(d, look, new THREE.Vector3(), 0.05);
      if (k > 0.8) pt.y -= (k - 0.8) / 0.2 * drop;                       // the end hangs free, straight down
      pts.push(pt);
      across.push(new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)));
    }
    ribbon(pts, across, w0, w1, hpos, hidx);
  };
  if (look.style === "long") {
    // over the face: across one eye, down the cheeks (never quite hiding who it is)
    for (const a of [-0.8, -0.52, -0.14, 0.6, 0.84]) strandAlong(a, 0.5, 2.55, 0.12 + r() * 0.08, 0.026, 0.009, (r() - 0.5) * 0.1);
    // and all the way round the sides and the back
    for (let i = 0; i < 18; i++) {
      const a = 0.95 + (i / 17) * (Math.PI * 2 - 1.9) + (r() - 0.5) * 0.1;
      strandAlong(a, 0.35, 2.4, 0.2 + r() * 0.12, 0.06, 0.02, (r() - 0.5) * 0.15);
    }
  } else {
    // short, wet, stuck flat to the forehead in clumps
    for (const a of [-0.45, -0.22, 0.05, 0.3, 0.5]) strandAlong(a, 0.45, 0.86 + r() * 0.12, 0, 0.026, 0.008, (r() - 0.5) * 0.2);
  }
  const hairGeo = new THREE.BufferGeometry();
  hairGeo.setAttribute("position", new THREE.Float32BufferAttribute(hpos, 3));
  hairGeo.setIndex(hidx);
  hairGeo.computeVertexNormals();
  g.add(new THREE.Mesh(hairGeo, wet));

  // ---- neck and shoulders, soaked through
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.13, 9), plain);
  neck.position.set(0, -0.17, -0.018);
  const cloth = new THREE.MeshLambertMaterial({ color: look.coat });
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), cloth);
  shoulders.scale.set(look.male ? 0.24 : 0.21, 0.1, 0.12);
  shoulders.position.set(0, -0.29, -0.035);
  // ...and the rest of it, down into the dark (it's a body, not a head hanging in the air)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(look.male ? 0.2 : 0.17, look.male ? 0.15 : 0.13, 1.4, 10), cloth);
  torso.scale.z = 0.62;
  torso.position.set(0, -0.98, -0.05);
  g.add(neck, shoulders, torso);
  if (look.male) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.085, 0.075, 10, 1, true), new THREE.MeshLambertMaterial({ color: look.coat, side: THREE.DoubleSide }));
    collar.position.set(0, -0.205, -0.02);
    g.add(collar);
  }
  g.userData = { jaw, eyes, look };
  return g;
}

// the same hand that's on every window: pressed white against the glass in front of you
function hand(side) {
  const g = new THREE.Group();
  const h = handMesh("press", 1.35, { lit: false });
  h.material.color.set(0xbcc4c3);       // gray, wrinkled from the water
  h.scale.x = side;                     // a left and a right
  g.add(h);
  return g;
}

export function createHorror(camera) {
  camera.layers.enable(HORROR_LAYER);
  const rig = new THREE.Group();     // follows the camera
  camera.add(rig);
  const faces = {};
  for (const name of Object.keys(LOOKS)) {
    const f = face(name);
    f.visible = false;
    rig.add(f);
    faces[name] = f;
  }
  // its own light, three of them: a hard cold light from above that leaves the eyes in their sockets, a dim sickly
  // one from below, and one behind that picks its outline out of the dark. They live on the rig and only dim, so a
  // scare never changes how many lights there are.
  const key = new THREE.PointLight(0xc9dde6, 0, 1.4, 2);
  const under = new THREE.PointLight(0x9fd8d0, 0, 1.0, 1.6);
  const rim = new THREE.PointLight(0x8fb2d6, 0, 0.9, 2);
  rig.add(key, under, rim);
  const hands = [hand(-1), hand(1)];
  hands.forEach((h) => { h.visible = false; rig.add(h); });
  const eyeGlow = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d6 }));
    e.position.x = s * 0.05;
    eyeGlow.add(e);
  }
  eyeGlow.visible = false;
  rig.add(eyeGlow);
  // Up close, the face is drawn over everything else, so nothing in the world (a seat, the window frame, a pole) can
  // cut through it: the depth buffer is cleared just before it's drawn, and it's drawn last of all.
  let overlay = false;
  const clearer = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0.001, 0, 0), new THREE.Vector3(0, 0.001, 0)]),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true }));
  clearer.position.z = -0.2;
  clearer.frustumCulled = false;
  clearer.renderOrder = 8999;
  clearer.onBeforeRender = (renderer) => { if (overlay) { renderer.state.buffers.depth.setMask(true); renderer.clearDepth(); } };
  rig.add(clearer);
  rig.traverse((o) => {
    if (!o.isMesh) return;
    o.layers.set(HORROR_LAYER);
    if (o === clearer) return;
    o.renderOrder = 9000;
    o.material.transparent = true;          // (drawn with the see-through things: they're the last to be drawn)
  });

  let active = null;   // { kind, t, done, onLunge, f, seed }

  // Where its head is and how it's held, how far its jaw has dropped, how wide its eyes are (lid: 1 half shut, 0
  // wide), how bright its light is.
  function pose(f, { x = 0, y = -0.03, dist, rx = 0, ry = 0, rz = 0, jaw = 0, lid = 0.5, pupil = 1, light = 1 }) {
    f.visible = true;
    f.position.set(x, y, -dist);
    f.rotation.set(rx, ry, rz);
    const J = f.userData.jaw;
    J.rotation.x = jaw;
    J.position.copy(J.userData.hinge).addScaledVector(J.userData.glide, Math.max(0, jaw) / 0.42);
    f.userData.eyes.forEach(({ eye, lid: l, pupil: pu }) => {
      l.rotation.x = THREE.MathUtils.lerp(-0.3, 0.62, lid);
      pu.scale.setScalar(pupil);
      eye.rotation.y = Math.atan2(-eye.position.x, dist);      // both eyes on you: the closer it is, the harder they stare
    });
    key.position.set(x + 0.13, y + 0.24, -dist + 0.2);
    under.position.set(x, y - 0.3, -dist + 0.3);
    rim.position.set(x - 0.12, y + 0.14, -dist - 0.2);
    key.intensity = 0.13 * light;
    under.intensity = 0.11 * Math.max(light, 0.35);
    rim.intensity = 0.16 * light;
  }
  // A twitch of the head now and then (at set moments, a sudden jerk and then held, the way something that isn't
  // alive moves), and a fine shiver all the while.
  const JERKS = [[0, 0, 0, 0], [0.06, 0.16, -0.12, 0.2], [0.22, -0.1, 0.16, -0.24], [0.4, 0.12, -0.08, 0.3], [0.58, -0.14, 0.12, -0.16]];
  function twitch(k, amount = 1) {
    let rx = 0, ry = 0, rz = 0;
    for (const [t0, a, b, c] of JERKS) {
      const e = k < t0 ? 0 : Math.min(1, (k - t0) / 0.035);
      rx += (a - rx) * e;
      ry += (b - ry) * e;
      rz += (c - rz) * e;
    }
    return {
      rx: -0.06 + (rx + Math.sin(k * 83) * 0.012) * amount,
      ry: (ry + Math.sin(k * 61) * 0.012) * amount,
      rz: (rz + Math.sin(k * 57) * 0.016) * amount,
    };
  }
  // the lunge: from `from` to just short of your face in `secs`, then settling a hair back
  // (the middle of its head; its face is a good 13 cm nearer)
  const lungeDist = (k, from, secs, to = 0.35) => (k < secs ? THREE.MathUtils.lerp(from, to, easeOut(k / secs)) : THREE.MathUtils.lerp(to, to + 0.03, Math.min(1, (k - secs) / 0.08)));
  // ...and its light: full on, with one stutter right at the worst moment
  const lungeLight = (k) => (k > 0.14 && k < 0.18 ? 0.12 : 1);
  function hit() { if (!active.lunged) { active.lunged = true; if (active.onLunge) active.onLunge(); } }
  function hide() {
    Object.values(faces).forEach((f) => { f.visible = false; });
    key.intensity = under.intensity = rim.intensity = 0;
    overlay = false;
  }

  function frame(dt) {
    if (!active) return;
    active.t += dt;
    const t = active.t;
    const f = active.f;
    if (active.kind === "face" || active.kind === "eyes") {
      // a glimpse of it first, hanging in the dark, still; then it's in your face, mouth wide, eyes wide
      let start = active.kind === "eyes" ? 1.4 : 0.16;
      if (active.kind === "eyes") {
        // two eyes open in the dark... blink... then it comes at you
        eyeGlow.visible = t < 1.4 && !(t > 0.7 && t < 0.82);
        eyeGlow.position.set(0, -0.02, -1.1 + Math.min(t, 1.4) * 0.15);
      } else if (t < start) {
        pose(f, { dist: 1.55, ...twitch(0, 0.4), jaw: 0.04, lid: 0.55, light: 0.13 });
      }
      if (t >= start) {
        hit();
        const k = t - start;
        eyeGlow.visible = false;
        const dist = lungeDist(k, 1.55, 0.12);
        overlay = dist < 0.9;
        pose(f, { x: Math.sin(k * 41) * 0.006, dist, ...twitch(k), jaw: easeOut(k / 0.16) * 0.42 + Math.sin(k * 190) * 0.018, lid: Math.max(0, 0.55 - k / 0.05), pupil: 1 - 0.4 * Math.min(1, k / 0.1), light: lungeLight(k) });
        if (k > 0.62) { hide(); finish(); }
      }
    } else if (active.kind === "rise") {
      // you've turned round: it comes up from behind the seat, right there, slowly, water running off it... then it lunges
      const T1 = 1.9;
      if (t < T1) {
        const k = t / T1;
        const e = k * k * (3 - 2 * k);
        overlay = false;                       // (the seat in front of it still hides what's still behind it)
        pose(f, { x: 0.02 + Math.sin(t * 2.1) * 0.01, y: THREE.MathUtils.lerp(-0.62, -0.05, e), dist: 0.72, rx: 0.25 - e * 0.3, ry: Math.sin(t * 1.4) * 0.06, rz: Math.sin(t * 1.2) * 0.05, jaw: k * 0.18, lid: 0.7 - k * 0.2, light: 0.12 + e * 0.35 });
      } else {
        hit();
        const k = t - T1;
        const dist = lungeDist(k, 0.72, 0.08, 0.34);
        overlay = true;
        pose(f, { x: Math.sin(k * 41) * 0.007, y: -0.05, dist, ...twitch(k + 0.06), jaw: 0.18 + easeOut(k / 0.15) * 0.24 + Math.sin(k * 190) * 0.018, lid: 0, pupil: 0.6, light: lungeLight(k) });
        if (k > 0.85) { hide(); finish(); }
      }
    } else if (active.kind === "drift") {
      // up out of the murk toward the glass: slow, swaying... then it's on you
      const T1 = 2.7;
      if (t < T1) {
        const k = t / T1;
        const e = k * k * (3 - 2 * k);
        overlay = false;
        pose(f, { x: Math.sin(t * 1.3) * 0.2, y: -0.08 + Math.sin(t * 0.9) * 0.09, dist: THREE.MathUtils.lerp(4.4, 1.2, e), rx: Math.sin(t * 1.1) * 0.08, ry: Math.sin(t * 0.7) * 0.28, rz: Math.sin(t * 0.8) * 0.14, jaw: k * 0.15, lid: 0.6, light: 0.15 + k * 0.35 });
      } else {
        hit();
        const k = t - T1;
        const dist = lungeDist(k, 1.2, 0.1, 0.34);
        overlay = dist < 0.9;
        pose(f, { x: Math.sin(k * 41) * 0.007, y: -0.06, dist, ...twitch(k), jaw: 0.15 + easeOut(k / 0.2) * 0.27, lid: 0, pupil: 0.6, light: lungeLight(k) });
        if (k > 0.95) { hide(); finish(); }
      }
    } else if (active.kind === "hands") {
      // two hands slam onto the glass in front of you, then slide down
      hit();
      overlay = true;
      hands.forEach((h, i) => {
        h.visible = true;
        const s = i ? 1 : -1;
        const slam = easeOut(t / 0.08);
        const slide = Math.max(0, t - 0.35) * 0.35;
        h.position.set(s * 0.17, 0.0 - slide, THREE.MathUtils.lerp(-1.0, -0.42, slam));
        h.rotation.set(0, 0, s * -0.18);
      });
      if (t > 1.3) {
        hands.forEach((h) => { h.visible = false; });
        overlay = false;
        finish();
      }
    }
  }
  function finish() {
    const cb = active && active.done;
    active = null;
    if (cb) cb();
  }

  return {
    // kind: face | eyes | rise | drift | hands; look: whose face (LOOKS); onLunge: called the moment it comes at you
    // (for the sound and the jolt)
    play(kind, { look = "drowned", onLunge = null } = {}) {
      hide();
      return new Promise((done) => {
        active = { kind, t: 0, done, onLunge, f: faces[look] || faces.drowned };
      });
    },
    update: frame,
    get playing() { return !!active; },
    looks: Object.keys(LOOKS),
  };
}
