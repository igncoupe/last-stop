// Low-poly people: passengers, the drowned, and the old man.
// They can walk paths, get on the bus, sit, look at things, and be ghosts.
import * as THREE from "three";
import { mat, box } from "../core/ps1.js";
import { MIRROR_ONLY } from "./bus.js";

const all = new Set();

// what each character looks like
export const LOOKS = {
  oldman:  { height: 1.66, shirt: 0x2b2a2e, pants: 0x1f1e22, skin: 0xcdb8a4, hair: 0xb8b8b8, cane: true, hunched: true },
  uniform: { height: 1.74, shirt: 0x5a4632, pants: 0x3a2e22, skin: 0xcdb8a4, hair: 0x9a9a9a, cap: 0x4a3a2a },
  mara:    { height: 1.68, shirt: 0x3d6fa8, pants: 0x3d6fa8, skin: 0xa77b5e, hair: 0x1a1210, lanyard: true },
  maraold: { height: 1.66, shirt: 0x3d6fa8, pants: 0x3d6fa8, skin: 0xa07760, hair: 0x9a9792, lanyard: true },   // thirty-one years on
  jun:     { height: 1.66, shirt: 0x3a3f47, pants: 0x22252b, skin: 0xd9b28f, hair: 0x0e0e10, backpack: 0x6b2d2d, hood: true },
  junmom:  { height: 1.6, shirt: 0x5d6e5a, pants: 0x2d3330, skin: 0xd9b28f, hair: 0x15110f },
  daniel:  { height: 1.8, shirt: 0x23262c, pants: 0x1c1f24, skin: 0xb3b9bd, hair: 0x241c16, gift: true, wet: true },
  lena:    { height: 1.67, shirt: 0x7a5a6a, pants: 0x2c2a34, skin: 0xb6b9bc, hair: 0x4a3626, wet: true },
  ivy:     { height: 1.15, shirt: 0xe0b42a, pants: 0x2c3b4d, skin: 0xbfc3c6, hair: 0x3a2a1a, hood: true, wet: true, child: true },
  rosie:   { height: 1.7, shirt: 0x3b2b2b, pants: 0x1f1d22, skin: 0xd6b096, hair: 0x5a3a22 },
  harold:  { height: 1.72, shirt: 0x6b6f72, pants: 0x3a3d40, skin: 0xa9adb0, hair: 0x7a7a7a, wet: true },
  drowned: { height: 1.72, shirt: 0x2f3a40, pants: 0x20262a, skin: 0xa7afb3, hair: 0x1d1d1d, wet: true },
  // five more of the fourteen, the way they were the night they got on
  eddie:   { height: 1.72, shirt: 0xe4e1d8, pants: 0x2a2c30, skin: 0xb8865f, hair: 0x15100c, apron: 0xd8d4c8 },          // diner whites, an apron
  dorothy: { height: 1.58, shirt: 0x6b4f6a, pants: 0x3d3540, skin: 0xd8bfab, hair: 0xd4d0cc, hunched: true, bag: 0x7a5b3a },
  frank:   { height: 1.8, shirt: 0x3f5370, pants: 0x2b3240, skin: 0xd3ad8c, hair: 0x5a4a3c, backpack: 0x5a3f26, mustache: true },   // a mailbag
  carmen:  { height: 1.62, shirt: 0x8a4a5a, pants: 0x2a2a32, skin: 0xc49470, hair: 0x120d0a },
  marcus:  { height: 1.82, shirt: 0x2f4a3a, pants: 0x1f2228, skin: 0x6e4a33, hair: 0x0e0b09 },
  // kids in raincoats, at the end of the driveways
  kidred:   { height: 1.12, shirt: 0xb0302a, pants: 0x2c3342, skin: 0xc9b8aa, hair: 0x3a2a1a, hood: true, child: true },
  kidblue:  { height: 1.18, shirt: 0x2f5f9a, pants: 0x2c2c34, skin: 0xd2b49a, hair: 0x1a120c, hood: true, child: true },
  kidgreen: { height: 1.08, shirt: 0x3e7a44, pants: 0x30302c, skin: 0xbf9c80, hair: 0x5a3a22, hood: true, child: true },
};

export class Person {
  constructor(scene, lookName, { ghost = false } = {}) {
    const look = { ...LOOKS[lookName] };
    this.look = look;
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.userData.person = this;
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);
    this.mats = [];
    const m = (color) => {
      // solid, never see-through: overlapping see-through boxes flickered badly
      const x = mat({ color });
      this.mats.push(x);
      return x;
    };
    const H = look.height;
    const leg = H * 0.47;
    const torso = H * 0.31;
    this.leg = leg;
    const shirt = m(look.shirt);
    const pants = m(look.pants);
    const skin = m(look.skin);
    const hair = m(look.hair);
    this.skinMat = skin;

    // legs: hip pivot -> thigh -> knee pivot -> shin
    this.hips = [];
    this.knees = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.1, leg, 0);
      const thigh = box(0.13, leg / 2, 0.14, pants);
      thigh.position.y = -leg / 4;
      const knee = new THREE.Group();
      knee.position.y = -leg / 2;
      const shin = box(0.12, leg / 2, 0.13, pants);
      shin.position.y = -leg / 4;
      const shoe = box(0.13, 0.07, 0.24, m(0x111111));
      shoe.position.set(0, -leg / 2 + 0.03, 0.04);
      knee.add(shin, shoe);
      hip.add(thigh, knee);
      this.body.add(hip);
      this.hips.push(hip);
      this.knees.push(knee);
    }
    // torso + head
    const chest = box(0.4, torso, 0.24, shirt);
    chest.position.y = leg + torso / 2;
    this.body.add(chest);
    this.neck = new THREE.Group();
    this.neck.position.y = leg + torso;
    this.body.add(this.neck);
    const head = box(0.21, 0.25, 0.23, skin);
    head.position.y = 0.15;
    this.neck.add(head);
    const hairTop = box(0.23, 0.08, 0.25, hair);
    hairTop.position.set(0, 0.29, -0.01);
    const hairBack = box(0.23, 0.2, 0.06, hair);
    hairBack.position.set(0, 0.2, -0.11);
    this.neck.add(hairTop, hairBack);
    this.eyeMat = m(0x111111);
    for (const s of [-1, 1]) {
      const eye = box(0.04, 0.03, 0.02, this.eyeMat);
      eye.position.set(s * 0.05, 0.17, 0.115);
      this.neck.add(eye);
    }
    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.26, leg + torso - 0.04, 0);
      const arm = box(0.1, H * 0.34, 0.1, shirt);
      arm.position.y = -H * 0.17;
      const hand = box(0.09, 0.09, 0.09, skin);
      hand.position.y = -H * 0.34;
      sh.add(arm, hand);
      this.body.add(sh);
      this.arms.push(sh);
    }
    // extras
    if (look.backpack) { const b = box(0.36, 0.45, 0.2, m(look.backpack)); b.position.set(0, leg + torso * 0.55, -0.22); this.body.add(b); }
    if (look.cap) {
      // a driver's cap: crown and a peak
      const c = new THREE.Group();
      const crown = box(0.26, 0.08, 0.28, m(look.cap));
      crown.position.y = 0.01;
      const peak = box(0.22, 0.02, 0.1, m(0x1a140e));
      peak.position.set(0, -0.02, 0.17);
      c.add(crown, peak);
      c.position.set(0, 0.32, 0.01);
      this.neck.add(c);
      this.cap = c;
    }
    if (look.hood) { const h = box(0.27, 0.12, 0.08, shirt); h.position.set(0, 0.06, -0.16); this.neck.add(h); }
    if (look.lanyard) { const l = box(0.05, 0.08, 0.02, m(0xeeeeee)); l.position.set(0.06, leg + torso * 0.55, 0.13); this.body.add(l); }
    if (look.gift) {
      this.gift = box(0.22, 0.16, 0.22, m(0x9fb3c8));
      this.gift.position.set(0, leg + torso * 0.3, 0.24);
      this.body.add(this.gift);
      this.arms.forEach((a) => { a.rotation.x = -0.9; });
    }
    if (look.cane) { const c = box(0.03, 0.9, 0.03, m(0x3a2a1a)); c.position.set(0.3, 0.45, 0.15); this.body.add(c); }
    if (look.apron) { const a = box(0.36, leg * 0.75, 0.02, m(look.apron)); a.position.set(0, leg * 0.72, 0.13); this.body.add(a); }
    if (look.bag) { const b = box(0.24, 0.2, 0.1, m(look.bag)); b.position.set(-0.32, leg * 0.92, 0.04); this.body.add(b); }   // a knitting bag on her arm
    if (look.mustache) { const mu = box(0.12, 0.025, 0.02, hair); mu.position.set(0, 0.08, 0.118); this.neck.add(mu); }
    if (look.hunched) chest.rotation.x = 0.18;

    this.mode = "stand";
    this.path = [];
    this.speed = 1.3;
    this.walkT = 0;
    this.headTarget = null;
    this.onArrive = null;
    this.ghost = false;
    if (ghost || look.wet) this.setGhost(ghost);
    all.add(this);
  }

  // the drowned: washed-out colors, gray-blue skin, black eyes, a faint cold glow
  setGhost(on) {
    this.ghost = on;
    this.mats.forEach((x) => {
      if (on && !x.userData.origColor) {
        x.userData.origColor = x.color.clone();
        x.color.lerp(new THREE.Color(0x56636a), 0.55);      // drained of color
      }
      x.emissive?.set(on ? 0x0b1518 : 0x000000);
    });
    this.eyeMat.color.set(on ? 0x000000 : 0x111111);
    if (on) this.skinMat.color.set(0x8c979b);
    return this;
  }
  setMirrorOnly(on) {
    this.root.traverse((o) => { if (o.isMesh) o.layers.set(on ? MIRROR_ONLY : 0); });
    return this;
  }
  show(on) { this.root.visible = on; return this; }

  placeAt(pos, yaw = 0, parent = null) {
    (parent || this.scene).add(this.root);
    this.root.position.copy(pos);
    this.root.rotation.y = yaw;
    this.stand();
    return this;
  }
  // walk through points given in `parent` space (default: the current parent)
  // ground(x, z), if given, is the height underfoot in the parent's space (the bus steps)
  walk(points, { speed = 1.3, parent = null, ground = null } = {}) {
    if (parent && this.root.parent !== parent) {
      parent.attach(this.root);
      // re-parenting can come back as a flipped rotation (x and z at 180°), and then turning toward
      // where they're going turns them the wrong way: keep just the heading
      const yaw = new THREE.Euler().setFromQuaternion(this.root.quaternion, "YXZ").y;
      this.root.rotation.set(0, yaw, 0);
    }
    this.ground = ground;
    this.stand();
    this.mode = "walk";
    this.speed = speed;
    this.path = points.map((p) => p.clone());
    return new Promise((done) => { this.onArrive = done; });
  }
  sit(parent, seatPos, yaw = 0) {
    parent.attach(this.root);
    this.root.position.copy(seatPos);
    this.root.rotation.set(0, yaw, 0);
    this.mode = "sit";
    this.body.position.set(0, (seatPos.y + 0.47) - seatPos.y - this.leg + 0.02, 0.05);
    this.hips.forEach((h) => { h.rotation.x = -Math.PI / 2; });
    this.knees.forEach((k) => { k.rotation.x = Math.PI / 2; });
    return this;
  }
  stand() {
    this.mode = "stand";
    this.body.position.set(0, 0, 0);
    this.hips.forEach((h) => { h.rotation.x = 0; });
    this.knees.forEach((k) => { k.rotation.x = 0; });
  }
  // stop right where they are; whatever was waiting for them to arrive keeps waiting
  halt() {
    this.path = [];
    this.onArrive = null;
    if (this.mode === "walk") this.stand();
  }
  // hold the right hand out (to give you something), or put it back down
  reachOut(on) {
    this.reaching = on;
    this.arms[1].rotation.set(on ? -1.35 : 0, 0, on ? 0.12 : 0);
  }
  get rightHand() { return this.arms[1].children[1]; }
  // wave: the right hand up over the head, side to side (or flag down a bus); off puts it back down
  wave(on) {
    this.waving = on ? { t: Math.random() * 3 } : null;
    this.reaching = on;
    if (!on) this.arms[1].rotation.set(0, 0, 0);
  }
  // take the cap off: the hand comes up, lifts it, and holds it against the chest
  capOff(seconds = 1.6) {
    if (!this.cap || this.capAnim || this.capHeld) return Promise.resolve();
    return new Promise((done) => { this.capAnim = { t: 0, seconds, done, moved: false }; });
  }
  lookAt(worldPoint) { this.headTarget = worldPoint ? worldPoint.clone() : null; }
  remove() {
    this.root.removeFromParent();
    all.delete(this);
  }

  update(dt) {
    if (this.mode === "walk") {
      const target = this.path[0];
      if (!target) {
        this.stand();
        const cb = this.onArrive;
        this.onArrive = null;
        if (cb) cb();
      } else {
        const p = this.root.position;
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        const dist = Math.hypot(dx, dz);
        const step = this.speed * dt;
        // on steps, the height follows what's underfoot: a quick lift at each edge, not a ramp
        const gy = this.ground ? this.ground(p.x + (dx / (dist || 1)) * 0.12, p.z + (dz / (dist || 1)) * 0.12) : target.y;
        const climbing = gy - p.y;
        p.y += climbing * Math.min(1, dt * (this.ground ? 12 : 8));
        if (dist <= step) {
          p.x = target.x;
          p.z = target.z;
          this.path.shift();
        } else {
          p.x += (dx / dist) * step;
          p.z += (dz / dist) * step;
          const want = Math.atan2(dx, dz);
          let diff = want - this.root.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          this.root.rotation.y += diff * Math.min(1, dt * 10);
        }
        this.walkT += dt * this.speed * 4.2;
        const s = Math.sin(this.walkT);
        this.hips[0].rotation.x = s * 0.5;
        this.hips[1].rotation.x = -s * 0.5;
        this.knees[0].rotation.x = Math.max(0, -s) * 0.6;
        this.knees[1].rotation.x = Math.max(0, s) * 0.6;
        if (Math.abs(climbing) > 0.025) {
          // the leading leg lifts high onto the next step
          const lead = s > 0 ? 0 : 1;
          this.hips[lead].rotation.x = -0.9;
          this.knees[lead].rotation.x = 1.25;
        }
        if (!this.look.gift) {
          this.arms[0].rotation.x = -s * 0.4;
          if (!this.capHeld && !this.reaching) this.arms[1].rotation.x = s * 0.4;
        }
        this.body.position.y = Math.abs(Math.cos(this.walkT)) * 0.03;
      }
    }
    // the cap coming off: arm up to the head (lift), then down to the chest, holding it
    if (this.capAnim) {
      const A = this.capAnim;
      A.t += dt;
      const k = Math.min(1, A.t / A.seconds);
      const arm = this.arms[1];
      if (k < 0.45) {
        arm.rotation.x = -2.7 * (k / 0.45);
        arm.rotation.z = -0.35 * (k / 0.45);
      } else {
        if (!A.moved) {
          // the hand has it: the cap moves from the head to the hand
          A.moved = true;
          const hand = arm.children[1];
          hand.attach(this.cap);
          this.cap.position.set(0, -0.04, 0.12);
          this.cap.rotation.set(-1.2, 0, 0);
        }
        const u = (k - 0.45) / 0.55;
        arm.rotation.x = -2.7 + (2.7 - 0.95) * u;
        arm.rotation.z = -0.35 * (1 - u);
      }
      if (k >= 1) {
        this.capAnim = null;
        this.capHeld = true;
        arm.rotation.set(-0.95, 0, 0);
        A.done();
      }
    }
    if (this.waving) {
      this.waving.t += dt;
      this.arms[1].rotation.set(-2.75, 0, -0.25 + Math.sin(this.waving.t * 7) * 0.35);
    }
    // turn the head toward something
    if (this.headTarget) {
      const local = this.root.worldToLocal(this.headTarget.clone());
      const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.3, 1.3);
      this.neck.rotation.y += (yaw - this.neck.rotation.y) * Math.min(1, dt * 4);
    } else {
      this.neck.rotation.y *= 1 - Math.min(1, dt * 3);
    }
  }
}

export const people = {
  update(dt) { all.forEach((p) => p.update(dt)); },
  clear() { [...all].forEach((p) => p.remove()); },
};
