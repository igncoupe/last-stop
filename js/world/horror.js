// In-world jumpscares. Instead of a picture on the screen, a drowned face
// (or hands, or eyes) appears right in front of the camera inside the game,
// lit by its own cold light, twitching, and is gone a moment later.
import * as THREE from "three";
import { mat } from "../core/ps1.js";

function face() {
  const g = new THREE.Group();
  const skin = mat({ color: 0x6f7a74, emissive: 0x0a100e, flatShading: true });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const wet = new THREE.MeshPhongMaterial({ color: 0x0a0b0c, shininess: 80, specular: 0x334044 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), skin);
  head.scale.set(1, 1.28, 1.02);
  g.add(head);
  // a heavy brow that throws the eyes into shadow
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), skin);
  brow.scale.set(1.9, 0.35, 0.6);
  brow.position.set(0, 0.058, 0.098);
  g.add(brow);
  // hollow eyes with a tiny glint deep inside
  const eyes = [];
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.036, 7, 6), black);
    socket.position.set(s * 0.048, 0.015, 0.105);
    socket.scale.set(1, 1.25, 0.6);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.005, 4, 3), new THREE.MeshBasicMaterial({ color: 0xf4efd8 }));
    glint.position.set(s * 0.046, 0.012, 0.124);
    const tear = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.09, 0.006), wet);
    tear.position.set(s * 0.05, -0.05, 0.118);
    g.add(socket, glint, tear);
    eyes.push(socket, glint);
  }
  // the mouth hangs open; the jaw drops during the scare
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.085, 0.104);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 6), black);
  mouth.scale.set(0.9, 1.6, 0.5);
  jaw.add(mouth);
  g.add(jaw);
  // wet hair hanging over the face
  for (let i = 0; i < 16; i++) {
    const x = -0.12 + (i / 15) * 0.24;
    if (Math.abs(x) < 0.03 && i % 2) continue;
    const len = 0.22 + Math.random() * 0.22;
    const strand = new THREE.Mesh(new THREE.BoxGeometry(0.014, len, 0.012), wet);
    const front = Math.abs(x) < 0.09 ? 0.115 : 0.07;
    strand.position.set(x + (Math.random() - 0.5) * 0.02, 0.15 - len / 2, front);
    strand.rotation.z = (Math.random() - 0.5) * 0.25;
    g.add(strand);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), wet);
  cap.position.y = 0.04;
  cap.scale.set(1.04, 1.3, 1.06);
  g.add(cap);
  // shoulders, soaked
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.2), mat({ color: 0x1b2226 }));
  body.position.set(0, -0.32, -0.02);
  g.add(body);
  // dim, cold light from below: like a flashlight held under a chin
  const light = new THREE.PointLight(0x9fd8d0, 0.55, 1.2, 1.6);
  light.position.set(0, -0.3, 0.3);
  g.add(light);
  g.userData = { jaw, eyes, light };
  return g;
}

function hand(side) {
  const g = new THREE.Group();
  const skin = mat({ color: 0xb7bfb9, emissive: 0x0b100e, flatShading: true });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.02), skin);
  g.add(palm);
  const fingers = [[-0.04, 0.09, 0.09], [-0.013, 0.1, 0.105], [0.014, 0.1, 0.1], [0.04, 0.085, 0.085]];
  for (const [x, y, len] of fingers) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, len, 0.018), skin);
    f.position.set(x, y, 0);
    g.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.018), skin);
  thumb.position.set(-side * 0.065, 0.0, 0);
  thumb.rotation.z = side * 0.9;
  g.add(thumb);
  g.scale.setScalar(1.15);
  return g;
}

export function createHorror(camera) {
  const rig = new THREE.Group();     // follows the camera
  camera.add(rig);
  const f = face();
  f.visible = false;
  rig.add(f);
  // the face's under-light lives on the rig and only dims, so showing the face never changes the light count
  const faceLight = f.userData.light;
  f.remove(faceLight);
  rig.add(faceLight);
  faceLight.intensity = 0;
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

  let active = null;   // { kind, t, done }

  const ease = (x) => 1 - Math.pow(1 - Math.min(1, x), 3);

  function frame(dt) {
    if (!active) return;
    active.t += dt;
    const t = active.t;
    if (active.kind === "face" || active.kind === "eyes") {
      let start = 0;
      if (active.kind === "eyes") {
        // two eyes open in the dark... blink... then it comes at you
        eyeGlow.visible = t < 1.4 && !(t > 0.7 && t < 0.82);
        eyeGlow.position.set(0, -0.02, -1.1 + Math.min(t, 1.4) * 0.15);
        start = 1.4;
      }
      if (t >= start) {
        const k = t - start;
        f.visible = true;
        eyeGlow.visible = false;
        const dist = THREE.MathUtils.lerp(1.4, 0.3, ease(k / 0.13));
        f.position.set(Math.sin(k * 61) * 0.012, -0.06 + Math.sin(k * 47) * 0.01, -dist);
        // facing the camera (its front is +z), twitching
        f.rotation.set(-0.08 + (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.3);
        f.userData.jaw.scale.y = 1 + Math.min(1, k / 0.25) * 1.6;
        faceLight.position.set(f.position.x, f.position.y - 0.3, f.position.z + 0.3);
        faceLight.intensity = 0.55 * (Math.random() < 0.15 ? 0.15 : 1);
        if (k > 0.75) {
          f.visible = false;
          faceLight.intensity = 0;
          finish();
        }
      }
    } else if (active.kind === "hands") {
      // two hands slam onto the glass in front of you, then slide down
      hands.forEach((h, i) => {
        h.visible = true;
        const s = i ? 1 : -1;
        const slam = ease(t / 0.08);
        const slide = Math.max(0, t - 0.35) * 0.35;
        h.position.set(s * 0.17, 0.0 - slide, THREE.MathUtils.lerp(-1.0, -0.42, slam));
        h.rotation.set(0, Math.PI, s * -0.18);
      });
      if (t > 1.3) {
        hands.forEach((h) => { h.visible = false; });
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
    play(kind) {
      return new Promise((done) => {
        f.visible = false;
        active = { kind, t: 0, done };
      });
    },
    update: frame,
    get playing() { return !!active; },
  };
}
