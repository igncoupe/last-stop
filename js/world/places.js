// Places off the route: the broken Ashgrove bridge, far away from the city (you're moved there with a
// fade). The fourth floor of St. Agnes is in hospital.js, inside the real hospital on the route.
import * as THREE from "three";
import { mat, glow, box, decal } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { radialTexture } from "./city.js";
import { buildHospital } from "./hospital.js";

const put = (parent, mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

export function buildPlaces(scene) {
  return { hospital: buildHospital(scene), bridge: buildBridge(scene) };
}

// a road that narrows to the broken Ashgrove bridge over black water
function buildBridge(scene) {
  const X = 3000;
  const g = new THREE.Group();
  g.position.set(X, 0, 0);
  g.visible = false;
  scene.add(g);
  put(g, box(10, 0.1, 200, mat({ map: tex.asphalt() }), [5, 5]), 0, 0, 100);
  put(g, box(9, 0.6, 70, mat({ map: tex.concrete(), color: 0x777777 }), [3, 3]), 0, -0.25, 235);
  put(g, box(3.5, 0.6, 9, mat({ map: tex.concrete(), color: 0x777777 })), -1.6, -0.3, 274);
  // posts and a rail along both edges, well clear of the bus (which drives 2.3 m right of center)
  for (const x of [-4.3, 4.3]) {
    for (let z = 202; z < 268; z += 2.5) put(g, box(0.12, 1, 0.12, mat({ color: 0x3b3f45 })), x, 0.5, z);
    put(g, box(0.08, 0.08, 66, mat({ color: 0x4a4e55 })), x, 1.0, 235);
    put(g, box(0.06, 0.06, 66, mat({ color: 0x3b3f45 })), x, 0.55, 235);
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 30, 30), new THREE.MeshPhongMaterial({ color: 0x050b10, map: tex.water(), shininess: 60 }));
  water.material.map.repeat.set(40, 40);
  water.rotation.x = -Math.PI / 2;
  put(g, water, 0, -6, 300);
  // painted lines so the road reads in the dark: edges and a dashed center
  const paint = decal(glow(0xb59a52), 2);
  for (const x of [-4.6, 4.6]) put(g, box(0.14, 0.02, 200, paint), x, 0.06, 100);
  for (let z = 4; z < 200; z += 9) put(g, box(0.14, 0.02, 3, paint), 0, 0.06, z);
  for (const x of [-3.9, 3.9]) put(g, box(0.12, 0.02, 66, paint), x, 0.06, 235);
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
