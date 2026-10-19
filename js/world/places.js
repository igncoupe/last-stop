// Places off the route: the broken Ashgrove bridge, far away from the city (you're moved there with a
// fade). The fourth floor of St. Agnes is in hospital.js, inside the real hospital on the route.
import * as THREE from "three";
import { mat, glow, box, decal } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { radialTexture } from "./city.js";
import { buildHospital } from "./hospital.js";
import { waterMaterial } from "./water.js";
import { makeSplash } from "./splash.js";

const put = (parent, mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

export function buildPlaces(scene) {
  return { hospital: buildHospital(scene), bridge: buildBridge(scene) };
}

// a small, repeatable random (the wreck is the same every time)
function seeded(n) {
  return () => {
    n = (n * 16807) % 2147483647;
    return (n - 1) / 2147483646;
  };
}

// Where the bridge broke, thirty years ago. The deck doesn't end, it snaps: strips of it reaching different lengths,
// chunks of concrete hanging off the raw edge, the reinforcing bars sticking out and bent down toward the water. One
// whole slab tore loose on the left and hangs from its last bars, down into the river. The railings are wrenched off
// the end. Out in the water: the piers that held the fallen span, broken off at different heights, and slabs of it
// sticking up at angles; and far off across the river, the other half of the bridge still standing, its own broken
// end facing this one. The lane the bus drives in (x 0.9..3.8) still reaches z 268, the edge the story uses, and
// nothing in the water is in the way of the bus going in.
function wreck(g, concrete) {
  const rnd = seeded(1994);
  const raw = mat({ map: tex.concrete(), color: 0x55554f });           // the faces where it broke
  const dark = mat({ map: tex.concrete(), color: 0x3c3d3a });          // under the water line, and the undersides
  const rebar = mat({ color: 0x4a2a1a });
  const rail = mat({ color: 0x4a4e55 });
  const post = mat({ color: 0x3b3f45 });
  const r = (a, b) => a + rnd() * (b - a);
  const lane = (x0, x1) => x1 > 0.9 && x0 < 3.8;
  // the strips of deck, snapped off at different lengths
  const strips = [[-4.5, -3.3, 265.9], [-3.3, -0.4, 269.6], [-0.4, 0.9, 265.4], [0.9, 2.0, 268.4], [2.0, 3.0, 267.9], [3.0, 3.8, 268.3], [3.8, 4.5, 264.8]];
  for (const [x0, x1, end] of strips) {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    put(g, box(w, 0.6, end - 262, concrete, [3, 3]), cx, -0.25, 262 + (end - 262) / 2);
    // the break itself: a ragged, lower lip under the edge, and chunks hanging off it
    put(g, box(w * 0.94, 0.28, 0.5, raw), cx + r(-0.05, 0.05), -0.62, end - 0.2).rotation.x = r(-0.15, 0.15);
    for (let i = 0; i < 3; i++) {
      const cw = w * r(0.25, 0.5);
      const c = lane(x0, x1)
        ? put(g, box(cw, r(0.18, 0.3), r(0.25, 0.45), raw), x0 + cw / 2 + rnd() * (w - cw), r(-0.95, -0.7), end - r(0.1, 0.35))   // (tucked under: the bus goes over this edge)
        : put(g, box(cw, r(0.3, 0.6), r(0.3, 0.8), raw), x0 + cw / 2 + rnd() * (w - cw), r(-0.75, -0.3), end + r(-0.1, 0.4));
      c.rotation.set(r(-0.35, 0.35), r(-0.3, 0.3), r(-0.4, 0.4));
    }
    // the bars, sticking out of the break and bent down toward the water
    for (let i = 0; i < Math.round(w * 4); i++) {
      const len = r(0.6, 1.9);
      const bar = put(g, new THREE.Group(), x0 + r(0.05, w - 0.05), r(-0.45, -0.1), end - 0.02);
      bar.rotation.set(lane(x0, x1) ? r(1.25, 1.5) : r(0.35, 1.3), r(-0.4, 0.4), r(-0.25, 0.25));
      put(bar, box(0.035, 0.035, len, rebar), 0, 0, len / 2);
    }
  }
  // the slab that tore loose on the left and hangs from its last bars, down into the river (its foot is under water)
  const hinge = put(g, new THREE.Group(), -1.85, 0.05, 269.6);
  hinge.rotation.set(0.95, 0.06, -0.07);
  put(hinge, box(2.8, 0.55, 9, concrete, [3, 3]), 0, -0.3, 4.6);
  put(hinge, box(2.6, 0.2, 8.6, dark), 0, -0.62, 4.6);
  for (let i = 0; i < 9; i++) {
    const bar = put(hinge, box(0.035, 0.035, r(0.5, 1.1), rebar), r(-1.3, 1.3), -0.3, r(-0.2, 0.25));
    bar.rotation.x = r(-0.5, 0.3);
  }
  // the railings, torn off the end: the left one hangs down the slab, the right one bent out over the water
  const left = put(g, new THREE.Group(), -4.3, 1.0, 264);
  left.rotation.set(0.9, 0.12, 0.1);
  put(left, box(0.08, 0.08, 5.5, rail), 0, 0, 2.75);
  put(left, box(0.12, 1, 0.12, post), 0, -0.5, 1.6).rotation.x = -0.4;
  const right = put(g, new THREE.Group(), 4.3, 1.0, 264);
  right.rotation.set(0.5, -0.55, 0);
  put(right, box(0.08, 0.08, 3.6, rail), 0, 0, 1.8);
  put(right, box(0.06, 0.06, 3.2, post), 0, -0.45, 1.6);
  // out in the river, and across it (its own group: on the last night the bus drives on over all of this, on starlight)
  const far = put(g, new THREE.Group(), 0, 0, 0);
  // the piers of the fallen span, broken off at different heights (all well past where the bus goes in)
  const pier = (x, z, top) => {
    const h = top + 9;
    put(far, box(1.3, h, 1.8, concrete, [2, 2]), x, top - h / 2, z);
    for (let i = 0; i < 4; i++) {                                         // a jagged top
      const cw = r(0.4, 0.8);
      put(far, box(cw, r(0.3, 0.9), r(0.6, 1.4), raw), x + r(-0.4, 0.4), top + r(0.0, 0.25), z + r(-0.4, 0.4)).rotation.set(r(-0.4, 0.4), r(-0.5, 0.5), r(-0.4, 0.4));
    }
    for (let i = 0; i < 5; i++) {
      const bar = put(far, box(0.04, 0.04, r(0.8, 1.6), rebar), x + r(-0.5, 0.5), top + r(0.3, 0.8), z + r(-0.7, 0.7));
      bar.rotation.set(r(-0.7, 0.7), 0, r(-0.7, 0.7));
    }
  };
  pier(-3, 296, -1.6);
  pier(3, 296, -3.4);
  pier(-3, 330, -4.8);
  pier(3, 330, -2.6);
  // slabs of the fallen span, sticking up out of the river at angles
  const slab = (x, z, y, rx, ry, rz, len) => {
    const s = put(far, new THREE.Group(), x, y, z);
    s.rotation.set(rx, ry, rz);
    put(s, box(4.2, 0.55, len, concrete, [3, 3]), 0, 0, 0);
    put(s, box(4.0, 0.2, len - 0.4, dark), 0, -0.36, 0);
    for (let i = 0; i < 6; i++) put(s, box(0.035, 0.035, r(0.6, 1.4), rebar), r(-2, 2), 0, len / 2 + r(0.1, 0.5)).rotation.x = r(0.2, 0.9);
  };
  slab(-2.2, 309, -6.4, -0.32, 0.12, 0.08, 14);
  slab(2.6, 318, -6.8, 0.28, -0.08, -0.12, 12);
  slab(-6.5, 280, -6.6, -0.5, 0.6, 0.3, 6);                               // a corner of one, off to the left
  slab(8.0, 287, -6.7, 0.42, -0.4, -0.2, 5);
  // and the other half of the bridge, still standing on the far side, snapped off facing this one
  put(far, box(9, 0.6, 80, concrete, [3, 3]), 0, -0.25, 392);
  for (const x of [-3, 3]) for (const z of [370, 410]) put(far, box(1.3, 6, 1.8, concrete), x, -3.3, z);
  for (let i = 0; i < 6; i++) {
    const cw = r(0.8, 1.8);
    put(far, box(cw, r(0.3, 0.6), r(0.4, 1.2), raw), r(-4, 4), r(-0.6, -0.2), 352 - r(0, 0.5)).rotation.set(r(-0.4, 0.4), r(-0.4, 0.4), r(-0.3, 0.3));
  }
  for (const x of [-4.3, 4.3]) {
    for (let z = 356; z < 430; z += 2.5) put(far, box(0.12, 1, 0.12, post), x, 0.5, z);
    put(far, box(0.08, 0.08, 74, rail), x, 1.0, 393);
  }
  for (let z = 360; z < 430; z += 30) put(far, box(0.16, 6, 0.16, mat({ color: 0x2a2c30 })), 4.2, 3, z);
  return far;
}

// a road that narrows to the broken Ashgrove bridge over black water
function buildBridge(scene) {
  const X = 3000;
  const g = new THREE.Group();
  g.position.set(X, 0, 0);
  g.visible = false;
  scene.add(g);
  put(g, box(10, 0.1, 200, mat({ map: tex.asphalt() }), [5, 5]), 0, 0, 100);
  const concrete = mat({ map: tex.concrete(), color: 0x777777 });
  put(g, box(9, 0.6, 62, concrete, [3, 3]), 0, -0.25, 231);            // the deck, whole as far as 262...
  const wreckage = wreck(g, concrete);                                   // ...and then it isn't
  // posts and a rail along both edges, well clear of the bus (which drives 2.3 m right of center), as far as they go
  for (const x of [-4.3, 4.3]) {
    for (let z = 202; z < 264; z += 2.5) put(g, box(0.12, 1, 0.12, mat({ color: 0x3b3f45 })), x, 0.5, z);
    put(g, box(0.08, 0.08, 62, mat({ color: 0x4a4e55 })), x, 1.0, 233);
    put(g, box(0.06, 0.06, 62, mat({ color: 0x3b3f45 })), x, 0.55, 233);
  }
  // the river: wide, black, moving, the bridge's last lights broken up on it
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), waterMaterial({ deep: 0x050f14, scale: 0.55, chop: 1.1, horizon: 0x1a2430 }));
  water.rotation.x = -Math.PI / 2;
  put(g, water, 0, -6, 300);
  // painted lines so the road reads in the dark: edges and a dashed center
  const paint = decal(glow(0xb59a52), 2);
  for (const x of [-4.6, 4.6]) put(g, box(0.14, 0.02, 200, paint), x, 0.06, 100);
  for (let z = 4; z < 200; z += 9) put(g, box(0.14, 0.02, 3, paint), 0, 0.06, z);
  // reflective road studs along both edges: they catch the headlights and flick past
  const stud = glow(0xffe0a0);
  for (let z = 3; z < 266; z += 6) for (const x of [-4.4, 4.4]) put(g, box(0.12, 0.04, 0.12, stud), z < 200 ? x : x * 0.86, 0.07, z);
  for (const x of [-3.9, 3.9]) put(g, box(0.12, 0.02, 64, paint), x, 0.06, 232);
  // streetlights, dying the closer you get to the river (the last ones are dead)
  const pool = decal(new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, map: radialTexture() }), 2);
  for (let z = 20; z < 270; z += 30) {
    const alive = z < 200;
    // (the last one, nearest the break, was wrenched over when the span went)
    const lamp = put(g, new THREE.Group(), 4.2, 0, z);
    if (z > 250) lamp.rotation.set(0.22, 0, -0.32);
    put(lamp, box(0.16, 6, 0.16, mat({ color: 0x2a2c30 })), 0, 3, 0);
    put(lamp, box(0.5, 0.18, 0.8, glow(alive ? 0xffd9a0 : 0x3a2a10)), -1, 5.9, 0);
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
    [2.6, 5.4, 170, 0xffc27a, 40, 34, 1.5], [0, 8, 262, 0x8fb0c8, 25, 60, 1.2],
    [7, 2.5, 273, 0x9ab4c8, 60, 26, 1.3], [-1, 6, 302, 0x8fb0c8, 80, 45, 1.2]]) {
    const l = new THREE.PointLight(color, 0, dist, decay);      // a cold light out over the water marks where the bridge ends
    l.position.set(X + x, y, z);
    l.userData.base = intensity;
    scene.add(l);
    bridgeLights.push(l);
  }
  // the river surface, in the world, and what's thrown up when something goes into it
  const waterY = -6;
  const splash = makeSplash(scene, waterY);
  return {
    group: g,
    start: new THREE.Vector3(X + 2.3, 0, 4),
    edge: 268,          // where the deck ends
    origin: X,
    water,
    wreckage,
    waterY,
    splash,
    lights: bridgeLights,
    update(dt = 0) {
      for (const l of bridgeLights) l.intensity = g.visible ? l.userData.base : 0;
      splash.update(dt);
    },
  };
}
