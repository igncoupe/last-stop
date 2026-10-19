// Something heavy going into the water: a burst of spray, and a ring of white foam
// spreading out over the surface. burst() at the point of impact; update(dt) every frame.
import * as THREE from "three";

const N = 900;      // droplets

export function makeSplash(scene, waterY) {
  const group = new THREE.Group();
  scene.add(group);

  const drops = particles(N, new THREE.PointsMaterial({ color: 0xd8e6ea, size: 0.13, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }));
  group.add(drops.points);

  // foam: a broken ring of it spreading and thinning, and churned water where it went in (both speckled, never solid)
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xe4eef0, map: foam(true), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), foamMat);
  const patchMat = new THREE.MeshBasicMaterial({ color: 0xdbe6e8, map: foam(false), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), patchMat);
  ring.position.y = patch.position.y = waterY + 0.04;
  group.add(ring, patch);
  let foamT = -1;
  let foamPower = 1;

  return {
    // power ~1 for a bus nose-first at speed; dir: the way it was going (spray is thrown that way)
    burst(at, { power = 1, dir = new THREE.Vector3(0, 0, 1), spread = 1 } = {}) {
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      emit(drops, Math.round(N * 0.55 * Math.min(1, power)), (p, v) => {
        // a crown: thrown up and out all round, most of it forward and to the sides
        const a = Math.random() * Math.PI * 2;
        const out = (2 + Math.random() * 5.5) * power * spread;
        p.copy(at).addScaledVector(side, (Math.random() - 0.5) * 2.2).addScaledVector(dir, (Math.random() - 0.3) * 1.5);
        p.y = waterY + 0.1;
        v.set(Math.cos(a) * out, (4 + Math.random() * 8) * power, Math.sin(a) * out).addScaledVector(dir, (2 + Math.random() * 6) * power);
      });
      ring.position.x = patch.position.x = at.x;
      ring.position.z = patch.position.z = at.z;
      foamT = 0;
      foamPower = power;
    },
    update(dt) {
      step(drops, dt, 9.81, 0.25, waterY);
      if (foamT >= 0) {
        foamT += dt;
        const r = 1.5 + foamT * 4.5 * Math.sqrt(foamPower);
        ring.scale.set(r, 1, r);
        foamMat.opacity = Math.max(0, 0.6 - foamT * 0.16) * Math.min(1, foamT * 6);
        const pr = 2.5 + foamT * 1.4;
        patch.scale.set(pr, 1, pr);
        patchMat.opacity = Math.max(0, 0.5 - foamT * 0.07) * Math.min(1, foamT * 4);
        if (foamMat.opacity <= 0 && patchMat.opacity <= 0) foamT = -1;
      }
    },
    clear() {
      for (const s of [drops]) { s.alive.fill(0); s.pos.fill(-1000); s.geo.attributes.position.needsUpdate = true; }
      foamMat.opacity = patchMat.opacity = 0;
      foamT = -1;
    },
  };
}

// foam, drawn: hundreds of little flecks of white, thick in a band near the edge (a ring) or in the middle (a patch),
// with streaks; transparent everywhere else
function foam(ring) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  for (let i = 0; i < (ring ? 2600 : 2200); i++) {
    const a = Math.random() * Math.PI * 2;
    const r = ring ? 0.8 + Math.pow(Math.random(), 0.6) * 0.19 * (Math.random() < 0.5 ? 1 : -0.6) : Math.pow(Math.random(), 0.7) * 0.92;
    const px = 128 + Math.cos(a) * r * 124;
    const py = 128 + Math.sin(a) * r * 124;
    x.fillStyle = `rgba(255,255,255,${0.12 + Math.random() * (ring ? 0.55 : 0.4)})`;
    x.beginPath();
    x.ellipse(px, py, 0.8 + Math.random() * 2.2, 0.6 + Math.random() * 1.4, a, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}
function particles(n, material) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(-1000);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return { geo, pos, vel: new Float32Array(n * 3), alive: new Uint8Array(n), points, next: 0, n };
}

const tmpP = new THREE.Vector3();
const tmpV = new THREE.Vector3();
function emit(s, count, init) {
  for (let k = 0; k < count; k++) {
    const i = s.next;
    s.next = (s.next + 1) % s.n;
    init(tmpP, tmpV);
    s.pos[i * 3] = tmpP.x; s.pos[i * 3 + 1] = tmpP.y; s.pos[i * 3 + 2] = tmpP.z;
    s.vel[i * 3] = tmpV.x; s.vel[i * 3 + 1] = tmpV.y; s.vel[i * 3 + 2] = tmpV.z;
    s.alive[i] = 1;
  }
  s.geo.attributes.position.needsUpdate = true;
}

function step(s, dt, gravity, drag, floor) {
  if (!s.alive.some((a) => a)) return;
  const k = Math.max(0, 1 - drag * dt);
  for (let i = 0; i < s.n; i++) {
    if (!s.alive[i]) continue;
    const j = i * 3;
    s.vel[j] *= k;
    s.vel[j + 2] *= k;
    s.vel[j + 1] = s.vel[j + 1] * k - gravity * dt;
    s.pos[j] += s.vel[j] * dt;
    s.pos[j + 1] += s.vel[j + 1] * dt;
    s.pos[j + 2] += s.vel[j + 2] * dt;
    if (s.pos[j + 1] < floor) { s.alive[i] = 0; s.pos[j + 1] = -1000; }
  }
  s.geo.attributes.position.needsUpdate = true;
}
