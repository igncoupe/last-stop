// The city along Route 9: road, sidewalks, buildings and streetlights.
// Everything is generated from the route, so the same city appears every night.
import * as THREE from "three";
import { mat, glow, box, decal } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { route, ROAD_HALF, CURB, districtAt, nearCorner, STOPS } from "./route.js";

let seed = 4242;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const range = (a, b) => a + rand() * (b - a);

// a flat strip that follows the road from d0 to d1, between two side offsets
export function ribbon(d0, d1, off0, off1, y, material, uvTile = [4, 4], step = 3) {
  const pos = [];
  const uv = [];
  const idx = [];
  let n = 0;
  for (let d = d0; d <= d1 + 0.01; d += step) {
    const a = route.at(d, off0, y);
    const b = route.at(d, off1, y);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, d / uvTile[1], (off1 - off0) / uvTile[0], d / uvTile[1]);
    if (n > 0) {
      const i = n * 2;
      idx.push(i - 2, i - 1, i, i - 1, i + 1, i);
    }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

function placeOnRoad(obj, d, side, y = 0) {
  obj.position.copy(route.at(d, side, y));
  obj.rotation.y = route.heading(d);
  return obj;
}

export function buildCity(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const L = route.length;

  // ground, road, sidewalks
  const groundMat = mat({ map: tex.concrete(), color: 0x6a6a6a });
  groundMat.map.repeat.set(400, 400);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 100, 100), groundMat);   // tiled, so the PS1 wobble stays small
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(600, -0.15, 800);
  group.add(ground);

  group.add(ribbon(-10, L + 20, -ROAD_HALF, ROAD_HALF, 0.0, mat({ map: tex.asphalt() }), [5, 5]));
  const walk = mat({ map: tex.sidewalk() });
  group.add(ribbon(-10, L + 20, ROAD_HALF, CURB, 0.15, walk, [2, 2]));
  group.add(ribbon(-10, L + 20, -CURB, -ROAD_HALF, 0.15, walk, [2, 2]));

  // dashed center line
  const dashes = [];
  for (let d = 0; d < L; d += 9) if (!nearCorner(d, 22)) dashes.push(d);
  const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.02, 3), decal(glow(0xb59a52)), dashes.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  dashes.forEach((d, i) => {
    q.setFromAxisAngle(route.up, route.heading(d));
    m4.compose(route.at(d, 0, 0.02), q, new THREE.Vector3(1, 1, 1));
    dash.setMatrixAt(i, m4);
  });
  group.add(dash);

  // buildings
  const sideMats = [0, 1, 2, 3, 4].map((s) => mat({ map: tex.building(s), emissiveMap: tex.windows(s), emissive: 0xffffff }));
  const roofMat = mat({ color: 0x141416 });
  const hospitalMat = mat({ map: tex.building(1), emissiveMap: tex.windows(7, 0.55, 0.15), emissive: 0xffffff });
  const keepClear = (d) => nearCorner(d, 34) || d < 45 || d > L - 70 || Object.values(STOPS).some((s) => Math.abs(s - d) < 9);

  // does any part of the road (with its sidewalks) come within a footprint? (local x across, z along)
  const inv = new THREE.Matrix4();
  const tmpP = new THREE.Vector3();
  function hitsRoad(obj, halfX, halfZ) {
    obj.updateMatrixWorld(true);
    inv.copy(obj.matrixWorld).invert();
    for (let dd = 0; dd <= L; dd += 2) {
      route.point(dd, tmpP).applyMatrix4(inv);
      if (Math.abs(tmpP.x) < halfX + CURB + 0.5 && Math.abs(tmpP.z) < halfZ + CURB + 0.5 && Math.abs(tmpP.y) < 50) return true;
    }
    return false;
  }

  function building(d, side, w, h, depth, style, setback = 0) {
    const mats = [sideMats[style], sideMats[style], roofMat, roofMat, sideMats[style], sideMats[style]];
    const b = box(depth, h, w, mats, [4, 3]);              // x: back from the road, z: along it
    const off = side * (CURB + 1 + setback + depth / 2);
    placeOnRoad(b, d, off, h / 2);
    if (hitsRoad(b, depth / 2, w / 2)) return null;         // at a corner it would sit on the next road
    group.add(b);
    footprints.push({ inv: b.matrixWorld.clone().invert(), hx: depth / 2, hz: w / 2 });
    return b;
  }
  const footprints = [];

  for (const side of [1, -1]) {
    let d = 30;
    while (d < L) {
      const kind = districtAt(d);
      let w = 12;
      if (keepClear(d)) { d += 6; continue; }
      if (kind === "canal" && side === -1) { d += 20; continue; }  // the canal is on the left
      if (kind === "industrial") {
        w = range(18, 30);
        building(d + w / 2, side, w, range(6, 9), range(14, 20), 4, range(2, 6));
      } else if (kind === "houses") {
        w = range(8, 11);
        const h = range(5, 7);
        const house = building(d + w / 2, side, w, h, 9, Math.floor(rand() * 3), 5);
        if (house) {
          const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, 9) * 0.72, 2.6, 4), roofMat);
          roof.position.set(0, h / 2 + 1.3, 0);
          roof.rotation.y = Math.PI / 4;
          house.add(roof);
        }
        w += range(3, 6);
      } else if (kind === "shops") {
        w = range(10, 14);
        building(d + w / 2, side, w, range(8, 15), 12, Math.floor(rand() * 5));
      } else if (kind === "hospital") {
        if (side === 1) { d += 20; continue; }               // hospital sits on the right, built below
        w = range(14, 20);
        building(d + w / 2, side, w, range(10, 18), 14, 1, 2);
      } else if (kind === "canal") {
        w = range(20, 28);
        building(d + w / 2, side, w, range(7, 10), 18, 4, 3);
      } else if (kind === "empty") {
        if (rand() < 0.35) building(d + 6, side, 12, range(4, 7), 10, 3, range(8, 20));
        w = 24;
      } else {
        w = range(14, 20);
        building(d + w / 2, side, w, range(6, 10), 14, 2, 4);
      }
      d += w + range(2, 5);
    }
  }

  // St. Agnes Hospital: one huge block on the right
  const hosp = box(34, 26, 110, [hospitalMat, hospitalMat, roofMat, roofMat, hospitalMat, hospitalMat], [4, 3]);
  placeOnRoad(hosp, STOPS["St. Agnes"] + 10, CURB + 24, 13);
  group.add(hosp);
  hosp.updateMatrixWorld(true);
  footprints.push({ inv: hosp.matrixWorld.clone().invert(), hx: 17, hz: 55 });
  const hospSign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), glow(0xffffff, { map: tex.sign("ST. AGNES HOSPITAL", { bg: "#0b2a4a", fg: "#e8f4ff", w: 256, h: 48, font: 26 }) }));
  placeOnRoad(hospSign, STOPS["St. Agnes"] + 4, CURB + 6.9, 9);
  hospSign.rotation.y += Math.PI / 2;   // face the road
  group.add(hospSign);

  // streetlights: real lights are expensive, so a few PointLights follow the bus
  const lamps = [];
  const poleGeo = new THREE.BoxGeometry(0.16, 6, 0.16);
  const armGeo = new THREE.BoxGeometry(0.1, 0.1, 1.8);
  const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.8);
  const poleMat = mat({ color: 0x2a2c30 });
  const headMat = glow(0xffd9a0);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffc078, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const coneGeo = new THREE.CylinderGeometry(0.3, 3.4, 5.6, 10, 1, true);
  const poolMat = decal(new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, map: radialTexture() }), 2);
  const poolGeo = new THREE.PlaneGeometry(11, 11);
  for (const side of [1, -1]) {
    for (let d = side === 1 ? 18 : 36; d < L - 20; d += 36) {
      if (nearCorner(d, 14)) continue;
      if (districtAt(d) === "empty" && rand() < 0.4) continue;   // dead lamps out in the empty lots
      const g = new THREE.Group();
      const off = side * (ROAD_HALF + 0.6);
      placeOnRoad(g, d, off, 0);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3;
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.y = Math.PI / 2;
      arm.position.set(-side * 0.9, 5.95, 0);
      const head = new THREE.Mesh(headGeo, headMat);
      head.rotation.y = Math.PI / 2;
      head.position.set(-side * 1.7, 5.85, 0);
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(-side * 1.7, 2.95, 0);
      g.add(pole, arm, head, cone);
      group.add(g);
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.copy(route.at(d, side * (ROAD_HALF - 1.2), 0.03));
      group.add(pool);
      // some lamps are dying: they buzz on and off
      const flicky = rand() < 0.16;
      if (flicky) {
        const own = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
        head.material = own;
        cone.material = coneMat.clone();
        pool.material = poolMat.clone();
      }
      lamps.push({ d, pos: route.at(d, side * (ROAD_HALF - 1.1), 5.6), group: g, flicky, on: true, head, cone, pool, t: rand() * 3 });
    }
  }

  // trees: mostly bare and dead-looking, some dark pines. Along the sidewalks, in yards and empty lots,
  // never on a road, in a building, at a stop or under a lamp.
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.11, 1, 6).translate(0, 0.5, 0);
  const branchGeo = new THREE.CylinderGeometry(0.02, 0.05, 1, 5).translate(0, 0.5, 0);
  const pineGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
  const barkMat = mat({ color: 0x6a625a });          // weathered grey, so lamplight picks the trees out
  const needleMat = mat({ color: 0x24362a });
  const trunks = [], branches = [], cones = [];
  const M = (pos, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), new THREE.Vector3(sx, sy, sz));
  const tipOf = (m) => new THREE.Vector3(0, 1, 0).applyMatrix4(m);
  function bareTree(base) {
    const h = range(3.2, 5.5);
    const lean = (rand() - 0.5) * 0.12;
    const trunkM = M(base, lean, rand() * 6.28, 0, 2.6, h, 2.6);
    trunks.push(trunkM);
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const at = base.clone().add(new THREE.Vector3(0, h * range(0.45, 0.92), 0));
      const yaw = (i / n) * 6.28 + rand() * 0.8;
      const len = range(1.0, 2.2) * (1.15 - (at.y - base.y) / h * 0.4);
      const bm = M(at, range(0.55, 1.1), yaw, 0, 1.7, len, 1.7);
      branches.push(bm);
      // a crooked twig off the end of each branch
      if (rand() < 0.8) branches.push(M(tipOf(bm), range(0.2, 1.3), yaw + range(-1, 1), 0, 1.1, len * range(0.35, 0.6), 1.1));
    }
  }
  function pine(base) {
    const h = range(4.5, 7.5);
    trunks.push(M(base, 0, 0, 0, 2.4, 1.2, 2.4));
    for (let i = 0; i < 3; i++) {
      const r = (1.7 - i * 0.45) * (h / 6);
      cones.push(M(base.clone().add(new THREE.Vector3(0, 0.9 + i * h * 0.24, 0)), 0, rand() * 6.28, 0, r, h * 0.42, r));
    }
  }
  const lampDs = lamps.map((l) => l.d);
  const mysteryDs = [660, 1085, 1630, 2290];
  const treeOk = (d, side, pos, onSidewalk) => {
    if (d < 50 || d > L - 60 || nearCorner(d, 24)) return false;
    if (Object.values(STOPS).some((s) => Math.abs(s - d) < 14)) return false;
    if (side === 1 && mysteryDs.some((s) => Math.abs(s - d) < 14)) return false;
    if (side === 1 && d > 1450 && d < 1560) return false;                 // the old request stop
    if (side === -1 && districtAt(d) === "canal") return false;           // the canal is on the left
    if (onSidewalk && lampDs.some((ld) => Math.abs(ld - d) < 4)) return false;
    for (const f of footprints) {
      tmpP.copy(pos).applyMatrix4(f.inv);
      if (Math.abs(tmpP.x) < f.hx + 1.5 && Math.abs(tmpP.z) < f.hz + 1.5) return false;
    }
    // not on any road (corners bring other roads close)
    for (let dd = Math.max(0, d - 80); dd <= Math.min(L, d + 80); dd += 3) {
      if (route.point(dd, tmpP).setY(pos.y).distanceTo(pos) < (onSidewalk ? CURB - 1.2 : CURB + 1.5)) return false;
    }
    return true;
  };
  for (const side of [1, -1]) {
    // street trees on the sidewalk
    for (let d = 40; d < L; d += range(14, 24)) {
      const kind = districtAt(d);
      if (kind === "industrial" || kind === "terminal" || (kind === "shops" && rand() < 0.6)) continue;
      const pos = route.at(d, side * (CURB - 0.7), 0.15);
      if (!treeOk(d, side, pos, true)) continue;
      bareTree(pos);
    }
    // yards, empty lots and the edge of the hospital grounds: clumps further back
    for (let d = 50; d < L; d += range(9, 16)) {
      const kind = districtAt(d);
      if (!(kind === "houses" || kind === "empty" || kind === "hospital" || kind === "canal")) continue;
      const back = kind === "houses" ? range(25, 34) : range(13, 45);
      const pos = route.at(d, side * back, 0);
      if (!treeOk(d, side, pos, false)) continue;
      (rand() < 0.35 ? pine : bareTree)(pos);
    }
  }
  for (const [geo, material, list] of [[trunkGeo, barkMat, trunks], [branchGeo, barkMat, branches], [pineGeo, needleMat, cones]]) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.frustumCulled = false;          // the instances span the whole map
    group.add(im);
  }

  const lights = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xffc27a, 40, 24, 1.6);
    scene.add(l);
    lights.push(l);
  }
  const lampsOn = { value: true };

  return {
    group,
    lamps,
    setLampsOn(on) {
      lampsOn.value = on;
      headMat.color.set(on ? 0xffd9a0 : 0x202020);
      coneMat.visible = on;
      poolMat.visible = on;
    },
    update(focus, dt = 0.016) {
      for (const lamp of lamps) {
        if (!lamp.flicky) continue;
        lamp.t -= dt;
        if (lamp.t <= 0) {
          lamp.on = !lamp.on;
          lamp.t = lamp.on ? 0.05 + Math.random() * (Math.random() < 0.2 ? 3 : 0.4) : 0.04 + Math.random() * 0.25;
          const lit = lamp.on && lampsOn.value;
          lamp.head.material.color.set(lit ? 0xffd9a0 : 0x1a1a1a);
          lamp.cone.visible = lit;
          lamp.pool.visible = lit;
        }
      }
      // move the real lights to the lamps nearest the camera
      const near = lamps
        .map((lamp) => ({ lamp, dist: lamp.pos.distanceToSquared(focus) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, lights.length);
      lights.forEach((l, i) => {
        const n = near[i];
        l.intensity = lampsOn.value && n && n.lamp.on ? 40 : 0;     // dim, never hide (hiding recompiles shaders)
        if (n) l.position.copy(n.lamp.pos);
      });
    },
  };
}

// soft round glow used for light pools on the road
export function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}
