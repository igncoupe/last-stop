// The last night's road out to the Ashgrove bridge, with no cut and no fade. The bridge is a long way from the city
// (places.js), so the bus is handed from one to the other inside a wall of fog: at the bridge there's an exact copy
// of the street it's on (city.streetCopy), and in the fog, with nothing else in sight, the two are the same. The copy
// runs on: the sidewalks end, the road gets darker and narrower, bends round to the left, and runs out onto the
// bridge road. The bus drives all of it.
import * as THREE from "three";
import { box, decal, glow } from "../core/ps1.js";
import { route, LANE, ROAD_HALF, DIP } from "./route.js";

const RC = 48;            // the bend's radius, at the middle of the road
const LB = 45;            // the road between the end of the street and the bend
const AHEAD = 40;         // how much of the street's copy is still ahead of the bus at the hand-over
export const BEHIND = 100;   // ...and behind it (it's still in the mirror for a while)
export const VISIBLE = 30;   // in the fog, nothing past this is seen
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// can the bus be handed over at d? The street around it has to be straight and level as far as can be seen, and
// straight on ahead (the copy carries straight on), with no shelter in sight
export function handOverOk(d, stops) {
  const straight = (a, b) => route.corners.every((c) => c < a - 18 || c > b + 18);
  return straight(d - VISIBLE, d + AHEAD) && route.length - d > AHEAD + 60
    && stops.every((s) => Math.abs(s - d) > VISIBLE + 8)
    && (DIP.from > d + AHEAD || DIP.to < d - VISIBLE);
}

// Built for a hand-over at `d` (the bus's distance along the route at that moment): the copy of the street, and the
// road on from it to the bridge. Returns the group to add to the scene, where a point on the street goes (toBridge),
// and the bus's way from there to the start of the bridge road (path).
export function buildApproach(city, bridge, d) {
  const X = bridge.origin;
  const zW = -(RC + 10);                                  // the road in runs west along here, then bends north
  // (the copy of the road ends on one of the street's own 2 m steps, and the new road starts right there)
  const ahead = -10 + Math.floor((d + AHEAD + 10) / 2) * 2 - d;
  const walkEnd = -10 + Math.floor((d + ahead + 10) / 3) * 3;
  const swap = V(X + RC + LB + ahead, 0, zW);             // where the middle of the street is, at d
  const group = new THREE.Group();
  // ---- the copy, moved: the street at d lands on `swap`, heading west
  const T = new THREE.Matrix4().makeRotationY(-Math.PI / 2 - route.heading(d));
  T.setPosition(swap.clone().sub(route.at(d, 0, 0).applyMatrix4(T)));
  const Tinv = T.clone().invert();
  const copy = city.streetCopy(d - BEHIND, d + ahead);
  const { roadMat, walkMat, groundMat } = copy.userData;
  copy.matrixAutoUpdate = false;
  copy.matrix.copy(T);
  group.add(copy);
  // where the sidewalks stop
  for (const s of [-1, 1]) {
    const cap = box(3, 0.3, 0.08, walkMat);
    cap.position.copy(route.at(walkEnd, s * 6.5, 0));
    cap.rotation.y = route.heading(walkEnd);
    copy.add(cap);
  }

  // ---- the middle of the road on from there, a point every meter: west, the bend, and north to the bridge road
  const mid = [];
  for (let x = X + RC + LB; x > X + RC; x -= 1) mid.push({ p: V(x, 0, zW), dir: V(-1, 0, 0) });
  const ARC = Math.ceil((RC * Math.PI) / 2);
  for (let i = 0; i <= ARC; i++) {
    const a = (i / ARC) * (Math.PI / 2);
    mid.push({ p: V(X + RC - RC * Math.sin(a), 0, -10 - RC * Math.cos(a)), dir: V(-Math.cos(a), 0, Math.sin(a)), bend: i / ARC });
  }
  for (let z = -9; z <= 0; z += 1) mid.push({ p: V(X, 0, z), dir: V(0, 0, 1) });
  let run = 0;
  mid.forEach((m, i) => { if (i) run += m.p.distanceTo(mid[i - 1].p); m.s = run; m.right = V(-m.dir.z, 0, m.dir.x); });
  // a strip along it, from off0 to off1 (right of the middle), its texture carrying on from the street's
  const sStart = d + ahead;
  const strip = (off0, off1, y, material, tile) => {
    const pos = [], uv = [], idx = [];
    mid.forEach((m, i) => {
      const a = m.p.clone().addScaledVector(m.right, off0).setY(y), b = m.p.clone().addScaledVector(m.right, off1).setY(y);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      uv.push(0, (sStart + m.s) / tile[1], (off1 - off0) / tile[0], (sStart + m.s) / tile[1]);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  };
  group.add(strip(-ROAD_HALF, ROAD_HALF, 0, roadMat, [5, 5]));
  // no more sidewalks: painted edges, and the reflective studs, like the bridge road
  const paint = decal(glow(0xb59a52), 2);
  group.add(strip(-4.67, -4.53, 0.06, paint, [1, 1]), strip(4.53, 4.67, 0.06, paint, [1, 1]));
  const along = (s) => {
    let i = 1;
    while (i < mid.length - 1 && mid[i].s < s) i++;
    const a = mid[i - 1], b = mid[i];
    const k = THREE.MathUtils.clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
    return { p: a.p.clone().lerp(b.p, k), dir: a.dir.clone().lerp(b.dir, k).normalize() };
  };
  const end = mid[mid.length - 1].s;
  const stud = glow(0xffe0a0);
  const dashBox = new THREE.BoxGeometry(0.14, 0.02, 3);
  // (in step with the bridge road's: its first dash is 4 m on, its first stud 3 m)
  for (let s = end - 5; s > 2; s -= 9) {
    const { p, dir } = along(s);
    const m = new THREE.Mesh(dashBox, paint);
    m.position.copy(p).setY(0.06);
    m.rotation.y = Math.atan2(dir.x, dir.z);
    group.add(m);
  }
  for (let s = end - 3; s > 0; s -= 6) {
    const { p, dir } = along(s);
    const right = V(-dir.z, 0, dir.x);
    for (const off of [-4.4, 4.4]) {
      const m = box(0.12, 0.04, 0.12, stud);
      m.position.copy(p).addScaledVector(right, off).setY(0.07);
      group.add(m);
    }
  }
  // the ground goes down to the river as it gets near it (but not under the road itself)
  const bank = (x, z) => smooth(-12, 2, z) * smooth(5, 12, Math.abs(x - X));
  // the copy's own ground, too: out of the copy and into place, so it can go down to the river with the rest
  const patch = copy.children.find((o) => o.material === groundMat);
  patch.updateMatrix();
  patch.geometry.applyMatrix4(T.clone().multiply(patch.matrix));
  patch.position.set(0, 0, 0);
  patch.rotation.set(0, 0, 0);
  copy.remove(patch);
  group.add(patch);
  const pp = patch.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setY(i, pp.getY(i) - 6.2 * bank(pp.getX(i), pp.getZ(i)));
  patch.geometry.computeVertexNormals();
  // ---- the ground: the same concrete as the city's, carrying straight on from it, until it drops away to the river
  // at the bridge (and it ends a little short of the copy's, under it, so they never fight over the same spot)
  const gx0 = X - 70, gx1 = X + RC + LB + ahead + BEHIND, gz0 = zW - 70, gz1 = 0.5;
  const ground = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0, Math.ceil((gx1 - gx0) / 5), Math.ceil((gz1 - gz0) / 5));
  ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position, guv = ground.attributes.uv, c = V(0, 0, 0);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i) + (gx0 + gx1) / 2, z = gp.getZ(i) + (gz0 + gz1) / 2;
    gp.setXYZ(i, x, -0.16 - 6.2 * bank(x, z), z);
    c.set(x, 0, z).applyMatrix4(Tinv);
    guv.setXY(i, (c.x + 1400) / 4000, (2800 - c.z) / 4000);
  }
  ground.computeVertexNormals();
  group.add(new THREE.Mesh(ground, groundMat));

  // ---- the bus's way: on along the street in its lane, and on round the bend, where it drifts across the middle
  // and cuts the corner, so it comes out in the lane the bridge road has it in (left of the middle)
  const way = [];
  const pushWay = (p, dir) => way.push({ p, dir });
  for (let s = 0; s < ahead; s += 0.5) pushWay(swap.clone().add(V(-s, 0, -LANE)), V(-1, 0, 0));
  mid.forEach((m) => {
    const lat = m.bend === undefined ? (m.dir.z > 0.5 ? -LANE : LANE) : LANE - 2 * LANE * smooth(0.12, 0.88, m.bend);
    pushWay(m.p.clone().addScaledVector(m.right, lat), m.dir.clone());
  });
  let len = 0;
  way.forEach((w, i) => { if (i) len += w.p.distanceTo(way[i - 1].p); w.s = len; });
  const path = {
    length: len,
    // where the bus is, s meters on from the hand-over, and which way it's heading (rotation.y); turn: how hard it's
    // turning there (for the wheel)
    at(s, out = new THREE.Vector3()) {
      let i = 1;
      while (i < way.length - 1 && way[i].s < s) i++;
      const a = way[i - 1], b = way[i];
      const k = THREE.MathUtils.clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
      out.lerpVectors(a.p, b.p, k);
      const ahead = way[Math.min(way.length - 1, i + 4)].p, back = way[Math.max(0, i - 5)].p;
      const heading = Math.atan2(ahead.x - back.x, ahead.z - back.z);
      return { pos: out, heading };
    },
    // the bend starts here, and ends here (meters on from the hand-over)
    bendFrom: ahead + LB,
    bendTo: ahead + LB + (RC * Math.PI) / 2,
  };
  // (and what of the city came with it: where each piece is now)
  const scenery = copy.userData.scenery.map((k) => ({ o: k.o, c: k.c.clone().applyMatrix4(T), r: k.r }));
  // (gone again: what was made for it is thrown away; what it shares with the city isn't)
  const dispose = () => {
    group.removeFromParent();
    group.traverse((o) => { if (o.isMesh && o.userData.own) o.geometry.dispose(); });
    dashBox.dispose();
  };
  group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !copy.userData.scenery.some((k) => k.o === o) && o.geometry !== dashBox) o.userData.own = true; });
  copy.userData.scenery.forEach((k) => k.o.traverse((o) => { o.userData.own = false; }));
  return { group, toBridge: T, path, swap, scenery, dispose };
}
