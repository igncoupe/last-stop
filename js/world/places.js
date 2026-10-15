// Places off the route: the fourth floor of St. Agnes (Room 4B), and the
// broken Ashgrove bridge. They sit far away from the city and you're
// moved there with a fade.
import * as THREE from "three";
import { mat, glow, box, decal } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { radialTexture } from "./city.js";

const put = (parent, mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

export function buildPlaces(scene) {
  return { hospital: buildHospital(scene), bridge: buildBridge(scene) };
}

// a corridor running +z from the elevator to Room 4B (on the right, at the end)
function buildHospital(scene) {
  const X = -2000;
  const g = new THREE.Group();
  g.position.set(X, 0, 0);
  scene.add(g);
  const wall = mat({ color: 0xb9c2b4 });
  const floor = mat({ map: tex.sidewalk(), color: 0x9aa39a });
  const colliders = [];
  const solid = (w, h, d, x, y, z, m = wall) => {
    const b = put(g, box(w, h, d, m, [2, 2]), x, y, z);
    colliders.push(b);
    return b;
  };
  put(g, box(3.2, 0.1, 42, floor, [2, 2]), 0, -0.05, 20);
  put(g, box(3.2, 0.1, 42, mat({ color: 0x8c948a })), 0, 3.05, 20);
  solid(0.2, 3, 42, 1.6, 1.5, 20);                 // left wall (+x)
  solid(0.2, 3, 33, -1.6, 1.5, 16.5);              // right wall up to 4B's door
  solid(0.2, 3, 3.5, -1.6, 1.5, 38.25);            // right wall after the door
  solid(3.2, 3, 0.2, 0, 1.5, 41);                  // end wall
  solid(3.2, 3, 0.2, 0, 1.5, -1);                  // behind you (elevator)
  // doors along the corridor with room numbers
  const rooms = ["4E", "4D", "4C"];
  rooms.forEach((n, i) => {
    const z = 8 + i * 8;
    put(g, box(0.05, 2.1, 1.1, mat({ color: 0x6d5a45 })), -1.48, 1.05, z);
    put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), glow(0xffffff, { map: tex.sign(n, { bg: "#e8e8e0", fg: "#222", w: 32, h: 16, font: 12 }) })), -1.45, 2.3, z).rotation.y = Math.PI / 2;
    put(g, box(0.05, 2.1, 1.1, mat({ color: 0x6d5a45 })), 1.48, 1.05, z + 4);
  });
  put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), glow(0xffffff, { map: tex.sign("4B", { bg: "#e8e8e0", fg: "#222", w: 32, h: 16, font: 12 }) })), -1.45, 2.3, 35.3).rotation.y = Math.PI / 2;
  // fluorescent panels (one flickers)
  const panels = [];
  for (let z = 3; z < 40; z += 6) panels.push(put(g, box(0.8, 0.04, 1.4, glow(0xeef6ea)), 0, 2.98, z));
  const lights = [new THREE.PointLight(0xdfeee0, 10, 14, 1.4), new THREE.PointLight(0xdfeee0, 10, 14, 1.4)];
  put(g, lights[0], 0, 2.7, 10);
  put(g, lights[1], 0, 2.7, 30);

  // Room 4B
  const room = new THREE.Group();
  put(g, room, -4.1, 0, 35);
  put(room, box(5, 0.1, 5, floor, [2, 2]), 0, -0.04, 0);
  put(room, box(5, 0.1, 5, mat({ color: 0x8c948a })), 0, 3.05, 0);
  colliders.push(put(room, box(0.2, 3, 5, wall), -2.5, 1.5, 0));
  colliders.push(put(room, box(5, 3, 0.2, wall), 0, 1.5, -2.5));
  colliders.push(put(room, box(5, 3, 0.2, wall), 0, 1.5, 2.5));
  const bed = put(room, box(1.1, 0.6, 2.1, mat({ color: 0xd7dbd2 })), -0.9, 0.3, 0);
  colliders.push(bed);
  put(room, box(1.1, 0.3, 0.1, mat({ color: 0x9aa0a8 })), -0.9, 0.9, -1.05);
  const monitorTex = tex.live(48, 24);
  const monitor = put(room, new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), glow(0xffffff, { map: monitorTex.texture })), -2.38, 1.6, -0.9);
  monitor.rotation.y = Math.PI / 2;
  // the window shows the street below: your bus, waiting
  const view = tex.live(96, 64);
  drawStreet(view.ctx);
  view.texture.needsUpdate = true;
  const win = put(room, new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), glow(0xffffff, { map: view.texture })), -2.38, 1.7, 1.2);
  win.rotation.y = Math.PI / 2;
  const roomLight = new THREE.PointLight(0xbfd8c8, 4, 7, 1.5);
  put(room, roomLight, 0, 2.6, 0);

  let beat = 0;
  return {
    group: g,
    colliders: colliders.map((c) => new THREE.Box3().setFromObject(c)),
    spawn: new THREE.Vector3(X, 1.7, 1.2),
    bedHead: new THREE.Vector3(X - 4.1 - 0.9, 0.8, 35 - 0.8),
    bed,
    win,
    room,
    roomPos: new THREE.Vector3(X - 4.1, 0, 35),
    flickerPanel: panels[3],
    update(dt, heartRate = 50) {
      beat += dt * heartRate / 60;
      const c = monitorTex.ctx;
      c.fillStyle = "#021006";
      c.fillRect(0, 0, 48, 24);
      c.strokeStyle = "#3fe07a";
      c.beginPath();
      for (let x = 0; x < 48; x++) {
        const ph = (beat * 48 - x) / 48;
        const f = ph - Math.floor(ph);
        const y = f < 0.06 ? 12 - Math.sin(f / 0.06 * Math.PI) * 9 : 12;
        x ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      monitorTex.texture.needsUpdate = true;
      const on = Math.random() > 0.04;
      panels[3].material.color.set(on ? 0xeef6ea : 0x333333);
    },
  };
}

function drawStreet(c) {
  c.fillStyle = "#05070c";
  c.fillRect(0, 0, 96, 64);
  c.fillStyle = "#14161c";
  c.fillRect(0, 40, 96, 24);
  for (const x of [8, 40, 72]) {
    c.fillStyle = "rgba(255,190,110,.35)";
    c.beginPath(); c.arc(x, 42, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffd9a0"; c.fillRect(x - 1, 20, 3, 2);
  }
  c.fillStyle = "#cfc6ae"; c.fillRect(30, 40, 44, 12);
  c.fillStyle = "#dfe8ff"; for (let x = 33; x < 70; x += 6) c.fillRect(x, 42, 4, 4);
  c.fillStyle = "#101010"; c.fillRect(33, 42, 3, 4);   // a figure in the back window
}

// a road that narrows to the broken Ashgrove bridge over black water
function buildBridge(scene) {
  const X = 3000;
  const g = new THREE.Group();
  g.position.set(X, 0, 0);
  g.visible = false;
  scene.add(g);
  put(g, box(10, 0.1, 200, mat({ map: tex.asphalt() }), [5, 5]), 0, 0, 100);
  put(g, box(7, 0.6, 70, mat({ map: tex.concrete(), color: 0x777777 }), [3, 3]), 0, -0.25, 235);
  put(g, box(3.5, 0.6, 9, mat({ map: tex.concrete(), color: 0x777777 })), -1.6, -0.3, 274);
  for (const x of [-3.4, 3.4]) for (let z = 202; z < 268; z += 2.5) put(g, box(0.1, 1, 0.1, mat({ color: 0x3b3f45 })), x, 0.5, z);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 30, 30), new THREE.MeshPhongMaterial({ color: 0x050b10, map: tex.water(), shininess: 60 }));
  water.material.map.repeat.set(40, 40);
  water.rotation.x = -Math.PI / 2;
  put(g, water, 0, -6, 300);
  // painted lines so the road reads in the dark: edges and a dashed center
  const paint = decal(glow(0xb59a52), 2);
  for (const x of [-4.6, 4.6]) put(g, box(0.14, 0.02, 200, paint), x, 0.06, 100);
  for (let z = 4; z < 200; z += 9) put(g, box(0.14, 0.02, 3, paint), 0, 0.06, z);
  for (const x of [-3.2, 3.2]) put(g, box(0.12, 0.02, 66, paint), x, 0.06, 235);
  // streetlights, dying the closer you get to the river (the last ones are dead)
  const pool = decal(new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, map: radialTexture() }), 2);
  for (let z = 20; z < 270; z += 30) {
    const alive = z < 200;
    put(g, box(0.16, 6, 0.16, mat({ color: 0x2a2c30 })), 4.2, 3, z);
    put(g, box(0.5, 0.18, 0.8, glow(alive ? 0xffd9a0 : 0x3a2a10)), 3.2, 5.9, z);
    if (alive) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), pool);
      p.rotation.x = -Math.PI / 2;
      put(g, p, 2.6, 0.07, z);
    }
  }
  // the bridge's lights live in the scene (the bridge is hidden most of the time, and a hidden light
  // would change the light count and recompile every shader the moment the bridge appears)
  const bridgeLights = [];
  for (const [x, y, z, color, intensity, dist, decay] of [[2.6, 5.4, 50, 0xffc27a, 40, 34, 1.5], [2.6, 5.4, 110, 0xffc27a, 40, 34, 1.5],
    [2.6, 5.4, 170, 0xffc27a, 40, 34, 1.5], [0, 8, 262, 0x8fb0c8, 25, 60, 1.2]]) {
    const l = new THREE.PointLight(color, 0, dist, decay);      // a cold light out over the water marks where the bridge ends
    l.position.set(X + x, y, z);
    l.userData.base = intensity;
    scene.add(l);
    bridgeLights.push(l);
  }
  return {
    group: g,
    start: new THREE.Vector3(X + 2.3, 0, 4),
    edge: 268,          // where the deck ends
    origin: X,
    water,
    update(dt) {
      water.material.map.offset.y += dt * 0.01;
      for (const l of bridgeLights) l.intensity = g.visible ? l.userData.base : 0;
    },
  };
}
