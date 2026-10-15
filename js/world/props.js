// Things along the route: bus shelters, the stop with no name, the canal,
// the flood, rain, the depot garage (start) and Northgate terminal (end).
import * as THREE from "three";
import { mat, glow, box } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { ribbon, radialTexture } from "./city.js";
import { route, STOPS, CURB, ROAD_HALF } from "./route.js";

const glass = () => new THREE.MeshLambertMaterial({ color: 0x8aa0b0, transparent: true, opacity: 0.18, depthWrite: false });

function place(obj, d, side, y = 0, turn = 0) {
  obj.position.copy(route.at(d, side, y));
  obj.rotation.y = route.heading(d) + turn;
  return obj;
}

// a bus shelter on the right side of the road. Local +x points at the road.
const put = (parent, mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

function shelter(name, { old = false } = {}) {
  const g = new THREE.Group();
  const frame = mat({ color: old ? 0x3a2e22 : 0x2d3036 });
  put(g, box(1.9, 0.12, 4.4, frame), -0.1, 2.6, 0);
  put(g, box(0.05, 2.4, 4.4, glass()), -0.95, 1.3, 0);
  for (const z of [-2.2, 2.2]) put(g, box(1.7, 2.4, 0.05, glass()), -0.1, 1.3, z);
  for (const [x, z] of [[-0.95, -2.2], [-0.95, 2.2], [0.8, -2.2], [0.8, 2.2]]) put(g, box(0.08, 2.6, 0.08, frame), x, 1.3, z);
  put(g, box(0.45, 0.08, 3, mat({ color: 0x4a4038 })), -0.55, 0.5, 0);
  const strip = put(g, box(0.6, 0.04, 3.2, glow(old ? 0xffd27a : 0xdfe8ff)), -0.1, 2.53, 0);
  const plateTex = tex.sign(name, old ? { bg: "#d8b24a", fg: "#1a1206" } : {});
  put(g, box(0.08, 2.8, 0.08, frame), 0.75, 1.4, 2.95);
  const plate = put(g, box(0.06, 0.5, 1.0, [glow(0xffffff, { map: plateTex }), glow(0xffffff, { map: plateTex }), frame, frame, frame, frame]), 0.75, 2.75, 2.95);
  return { group: g, plate, strip };
}

export function buildProps(scene) {
  const props = { stops: {}, colliders: [] };

  // ---- regular stops
  for (const [name, d] of Object.entries(STOPS)) {
    if (name === "Depot" || name === "Northgate") continue;
    const s = shelter(name);
    place(s.group, d, CURB - 1.4);
    scene.add(s.group);
    props.stops[name] = { name, d, group: s.group, wait: route.at(d, CURB - 1.6, 0) };
  }

  // a missing poster on the Market St shelter (shown only on some nights)
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), mat({ map: tex.poster(["MISSING", "JUN PARK, 15", "PLEASE CALL"]), side: THREE.DoubleSide }));
  poster.position.set(-0.9, 1.5, 1.2);
  poster.rotation.y = Math.PI / 2;
  poster.visible = false;
  props.stops["Market St"].group.add(poster);
  props.missingPoster = poster;

  // ---- the stop with no name
  const m = shelter("???", { old: true });
  const mLight = new THREE.PointLight(0xffc860, 30, 16, 1.4);
  mLight.position.set(0, 2.2, 0);
  m.group.add(mLight);
  const mRain = rainBox(260, 1.8, 2.6, 4.4, 0x9fb4d0);
  mRain.position.set(-0.1, 1.3, 0);
  m.group.add(mRain);
  m.group.visible = false;
  scene.add(m.group);
  props.mystery = {
    group: m.group,
    d: null,
    named: false,
    place(d) {
      this.d = d;
      m.group.visible = d !== null;
      if (d !== null) place(m.group, d, CURB - 1.4);
    },
    setName(text) {
      const t = tex.sign(text, { bg: "#d8b24a", fg: "#1a1206" });
      m.plate.material[0].map = t;
      m.plate.material[1].map = t;
    },
    wait() { return route.at(this.d, CURB - 1.6, 0); },
    update(dt) { mRain.userData.tick(dt); },
  };

  // ---- the canal on the left of Canal Row
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x0c1a24, map: tex.water(), shininess: 90, specular: 0x334455 });
  waterMat.map.repeat.set(0.25, 0.25);
  scene.add(ribbon(1560, 2045, -60, -CURB - 1.5, -0.9, waterMat, [8, 8]));
  const rails = new THREE.Group();
  for (let d = 1565; d < 2040; d += 3) rails.add(place(box(0.08, 1, 0.08, mat({ color: 0x3b3f45 })), d, -CURB + 0.2, 0.6));
  scene.add(rails);
  scene.add(ribbon(1565, 2040, -CURB + 0.15, -CURB + 0.25, 1.1, mat({ color: 0x3b3f45 }), [1, 1], 2));

  // ---- flood over the road at Canal Row
  const floodMat = new THREE.MeshPhongMaterial({ color: 0x0d1d29, map: tex.water(), shininess: 120, specular: 0x445566, transparent: true, opacity: 0.88 });
  const flood = ribbon(1690, 1915, -CURB - 0.5, CURB + 0.5, 0.2, floodMat, [6, 6]);
  flood.visible = false;
  scene.add(flood);
  props.flood = {
    mesh: flood,
    set(on, level = 0.2) { flood.visible = on; flood.position.y = level - 0.2; },
    update(dt) { floodMat.map.offset.x += dt * 0.02; },
    covers: (d) => flood.visible && d > 1690 && d < 1915,
  };

  // ---- rain that follows the camera
  const rain = rainBox(1800, 46, 26, 46, 0x8a9bb0);
  rain.visible = false;
  scene.add(rain);
  props.rain = {
    set(on) { rain.visible = on; },
    get on() { return rain.visible; },
    update(dt, cam) { if (!rain.visible) return; rain.position.set(cam.x, cam.y, cam.z); rain.userData.tick(dt); },
  };

  buildDepot(scene, props);
  buildTerminal(scene, props);
  return props;
}

// falling streaks inside a box (w x h x d), centered on the object
function rainBox(count, w, h, d, color) {
  const pos = new Float32Array(count * 6);
  const drops = [];
  for (let i = 0; i < count; i++) drops.push([(Math.random() - 0.5) * w, (Math.random() - 0.5) * h, (Math.random() - 0.5) * d]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }));
  lines.frustumCulled = false;
  const write = () => {
    drops.forEach(([x, y, z], i) => pos.set([x, y, z, x + 0.03, y + 0.45, z], i * 6));
    geo.attributes.position.needsUpdate = true;
  };
  write();
  lines.userData.tick = (dt) => {
    for (const dr of drops) {
      dr[1] -= dt * 14;
      if (dr[1] < -h / 2) dr[1] += h;
    }
    write();
  };
  return lines;
}

// the garage where every night starts. Bus parks inside, facing the doorway (+z).
function buildDepot(scene, props) {
  const g = new THREE.Group();
  const wall = mat({ map: tex.concrete(), color: 0x8a8a8a });
  const add = (w, h, d, x, y, z, m = wall) => {
    const b = box(w, h, d, m, [3, 3]);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  const walls = [
    add(0.4, 7, 52, 10.2, 3.5, -26), add(0.4, 7, 52, -10.2, 3.5, -26), add(20.8, 7, 0.4, 0, 3.5, -52.2),
    add(8, 7, 0.4, 6, 3.5, 0), add(4, 7, 0.4, -8, 3.5, 0),
  ];
  add(8, 2, 0.4, -2, 6, 0);
  add(20.8, 0.3, 52.4, 0, 7.1, -26, mat({ color: 0x1a1b1e }));
  for (let z = -48; z < 0; z += 8) add(0.3, 0.08, 3, -2.3, 6.9, z, glow(0xe8f0ff));
  // dispatch office with a lit window
  const office = add(4, 3.2, 7, -7.6, 1.6, -12, mat({ color: 0x55504a }));
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), glow(0xfff1c8));
  win.position.set(-5.59, 1.9, -12);
  win.rotation.y = Math.PI / 2;
  g.add(win);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.45), glow(0xffffff, { map: tex.sign("DISPATCH", { w: 96, h: 24, font: 16 }) }));
  sign.position.set(-5.58, 2.9, -12);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  // the time clock you punch at the start of every shift
  const clock = add(0.3, 0.5, 0.4, -5.45, 1.4, -9.4, mat({ color: 0x9a9070 }));
  // a notice board for the night's notice
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), mat({ color: 0x6b4a2b }));
  board.position.set(-5.58, 1.6, -14.6);
  board.rotation.y = Math.PI / 2;
  g.add(board);
  const lights = [new THREE.PointLight(0xdfe8ff, 30, 30, 1.5), new THREE.PointLight(0xdfe8ff, 22, 26, 1.5)];
  lights[0].position.set(0, 6, -14);
  lights[1].position.set(0, 6, -38);
  g.add(...lights);
  scene.add(g);

  props.colliders.push(...walls.map((w) => new THREE.Box3().setFromObject(w)), new THREE.Box3().setFromObject(office));
  props.depot = { group: g, clock, board, lights, spawn: new THREE.Vector3(-4.4, 1.7, -5.5) };
}

// Northgate: the end of the line. A lit canopy, a terminal building, a barrier.
function buildTerminal(scene, props) {
  const L = route.length;
  const g = new THREE.Group();
  place(g, L - 20, 0, 0);
  scene.add(g);
  const m = mat({ color: 0x4a4d52 });
  const canopy = box(16, 0.4, 40, m);
  canopy.position.set(0, 5.4, 0);
  g.add(canopy);
  for (const x of [-7.5, 7.5]) for (const z of [-18, 0, 18]) {
    const p = box(0.4, 5.4, 0.4, m);
    p.position.set(x, 2.7, z);
    g.add(p);
  }
  for (let z = -16; z <= 16; z += 8) {
    const strip = box(5, 0.06, 0.3, glow(0xfff0d0));
    strip.position.set(0, 5.18, z);
    g.add(strip);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), glow(0xffffff, { map: tex.sign("NORTHGATE · END OF LINE", { w: 256, h: 40, font: 22 }) }));
  sign.position.set(0, 6.4, -20.1);
  sign.rotation.y = Math.PI;
  g.add(sign);
  const building = box(36, 9, 18, mat({ map: tex.building(2), emissiveMap: tex.windows(3, 0.4), emissive: 0xffffff }), [4, 3]);
  building.position.set(0, 4.5, 31);
  g.add(building);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), glow(0xffe2a8));
  door.position.set(-6, 1.3, 21.9);
  door.rotation.y = Math.PI;
  g.add(door);
  const barrier = box(10, 0.3, 0.3, glow(0xd23a2a));
  barrier.position.set(0, 1, 21);
  g.add(barrier);
  const light = new THREE.PointLight(0xfff0d0, 60, 40, 1.4);
  light.position.set(0, 4.8, 0);
  g.add(light);
  props.terminal = { group: g };
}
