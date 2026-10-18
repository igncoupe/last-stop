// The Route 9 bus as it was in 1994: brown and cream, lit up warm inside, "9 ASHGROVE" on the front, a
// full load of people in the windows. Built facing +z, like the real bus. Teodor drives it (a Person
// added by the story).
import * as THREE from "three";
import { mat, glow, box } from "../core/ps1.js";
import { tex } from "../core/textures.js";

const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

// a strip of lit windows, with the people sitting behind them
function windowStrip() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const x = c.getContext("2d");
  x.fillStyle = "#ffd28a"; x.fillRect(0, 0, 128, 16);
  for (let i = 0; i < 8; i++) {
    x.fillStyle = "#3a2a1a"; x.fillRect(i * 16, 0, 2, 16);                              // window pillars
    if (i % 3 !== 2) {
      x.fillStyle = "rgba(30,22,16,.85)";
      x.fillRect(i * 16 + 6, 7, 6, 9);                                                    // someone's shoulders
      x.fillRect(i * 16 + 7, 3, 4, 4);                                                    // and head
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

// a soft glow for the headlights
const haloTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d");
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();

export function makeGhostBus() {
  const g = new THREE.Group();
  const cream = mat({ color: 0xcfc3a0 });
  const brown = mat({ color: 0x5a3b22 });
  const black = mat({ color: 0x141414 });
  const strip = windowStrip();
  put(g, box(2.5, 1.15, 11.6, cream), 0, 0.95, 0);                    // lower body
  put(g, box(2.5, 0.25, 11.6, brown), 0, 1.6, 0);                     // the brown band
  // its lights carry through the fog: you see them long before the bus
  put(g, box(2.44, 0.95, 11.4, glow(0xffffff, { map: strip, fog: false })), 0, 2.2, -0.1);   // lit windows, both sides
  put(g, box(2.5, 0.22, 11.6, brown), 0, 2.78, 0);                    // roof line
  put(g, box(2.3, 0.12, 11.2, cream), 0, 2.94, 0);                    // roof
  put(g, box(2.4, 1.0, 0.04, glow(0xffe0a8, { transparent: true, opacity: 0.55 })), 0, 2.15, 5.81);   // windshield, lit from inside
  const sign = tex.sign("9  ASHGROVE", { bg: "#120c02", fg: "#ffb54a", w: 128, h: 20, font: 15 });
  put(g, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), glow(0xffffff, { map: sign, fog: false })), 0, 2.78, 5.82);
  for (const sx of [-0.85, 0.85]) {
    put(g, box(0.32, 0.18, 0.04, glow(0xfff1d0, { fog: false })), sx, 0.75, 5.81);    // headlights
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xfff1d8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(1.6, 1.1, 1);
    put(g, halo, sx, 0.75, 5.95);
    put(g, box(0.28, 0.16, 0.04, glow(0x8a0f0c)), sx, 0.8, -5.81);    // tail lights
  }
  put(g, box(2.56, 0.2, 0.14, black), 0, 0.35, 5.8);                  // bumpers
  put(g, box(2.56, 0.2, 0.14, black), 0, 0.35, -5.8);
  for (const sx of [-1.15, 1.15]) for (const z of [3.6, -3.4]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12).rotateZ(Math.PI / 2), black), sx, 0.48, z);
  // light thrown on the road ahead of it
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 12), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  put(g, pool, 0, 0.04, 12);
  g.visible = false;
  return { group: g, driverSeat: new THREE.Vector3(0.7, 0.5, 4.75) };
}
