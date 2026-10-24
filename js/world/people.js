// Low-poly people: passengers, the drowned, and the old man.
// They can walk paths, get on the bus, sit, look at things (or right at you), and be ghosts.
// Everyone is built from the same blocks, but no two are the same shape: build, shoulders, hips, head, face and
// hair all change from person to person, and the women have their own hair (long, braided, in a bun).
import * as THREE from "three";
import { mat, box } from "../core/ps1.js";
import { makeGift } from "./depotProps.js";
import { MIRROR_ONLY } from "./bus.js";

const all = new Set();

// what each character looks like.
//   build: 0.85 (slight) .. 1.2 (heavy)   f: a woman (narrower shoulders, wider hips)
//   hairStyle: short | long | braids | bun | ponytail | pigtails | balding | curly | buzz
export const LOOKS = {
  oldman:  { height: 1.66, build: 0.86, shirt: 0x2b2a2e, pants: 0x1f1e22, skin: 0xcdb8a4, hair: 0xb8b8b8, hairStyle: "balding", cane: true, hunched: true, coat: 0x37332f, brows: 0xd8d8d8, nose: 1.25 },
  // Teodor in Room 4B: a hospital gown, no cane (he's in bed)
  patient: { height: 1.66, build: 0.82, shirt: 0xa9c4d6, pants: 0xa9c4d6, skin: 0xc9b4a2, hair: 0xc4c4c4, hairStyle: "balding", gown: true, brows: 0xd8d8d8, nose: 1.25 },
  uniform: { height: 1.74, build: 1.02, shirt: 0x5a4632, pants: 0x3a2e22, skin: 0xcdb8a4, hair: 0x6a5642, hairStyle: "short", cap: 0x4a3a2a, mustache: true, tie: 0x2a1f16, nose: 1.15 },
  mara:    { height: 1.68, f: true, build: 0.96, shirt: 0x3d6fa8, pants: 0x3d6fa8, skin: 0x5b3a26, hair: 0x120c0a, hairStyle: "braids", lanyard: true, scrubs: true, lips: 0x4a2a22 },
  maraold: { height: 1.66, f: true, build: 1.02, shirt: 0x3d6fa8, pants: 0x3d6fa8, skin: 0x5b3a26, hair: 0xa9a6a0, hairStyle: "bun", lanyard: true, scrubs: true, glasses: 0x2a2a2a, lips: 0x4a2a22 },
  jun:     { height: 1.66, build: 0.86, shirt: 0x3a3f47, pants: 0x22252b, skin: 0xd9b28f, hair: 0x0e0e10, hairStyle: "short", backpack: 0x6b2d2d, hood: true, young: true },
  junmom:  { height: 1.6, f: true, build: 0.92, shirt: 0x5d6e5a, pants: 0x2d3330, skin: 0xd9b28f, hair: 0x15110f, hairStyle: "ponytail", coat: 0x4a5a48 },
  daniel:  { height: 1.8, build: 1.04, shirt: 0x23262c, pants: 0x1c1f24, skin: 0xb3b9bd, hair: 0x241c16, hairStyle: "short", gift: true, wet: true, coat: 0x2a2e34 },
  lena:    { height: 1.67, f: true, build: 0.94, shirt: 0x8a7a9a, pants: 0x2c2a34, skin: 0xb6b9bc, hair: 0x14100c, hairStyle: "long", wet: true, cardigan: 0xb7a6c4 },
  ivy:     { height: 1.15, f: true, build: 0.9, shirt: 0xe0b42a, pants: 0x2c3b4d, skin: 0xbfc3c6, hair: 0x3a2a1a, hairStyle: "pigtails", hood: true, wet: true, child: true, buttons: 0xf2d24a },
  rosie:   { height: 1.7, f: true, build: 0.98, shirt: 0x3b2b2b, pants: 0x1f1d22, skin: 0xd6b096, hair: 0x5a3a22, hairStyle: "long", coat: 0x4a3434 },
  harold:  { height: 1.72, build: 0.9, shirt: 0x6b6f72, pants: 0x3a3d40, skin: 0xa9adb0, hair: 0x7a7a7a, hairStyle: "short", wet: true, cardigan: 0x5a5f62, headset: true, glasses: 0x1a1a1a },
  // you, the driver, the way someone outside the bus would see you (the trailer's outside shots): the same work
  // jacket, pants and hands as your own body in the driver's seat (selfBody.js)
  driver:  { height: 1.78, build: 1.04, shirt: 0x1d2532, pants: 0x2a2c31, skin: 0x5b3c2a, hair: 0x0e0b09, hairStyle: "short" },
  // the woman in the car on your tail (night 3)
  carwoman: { height: 1.64, f: true, build: 0.9, shirt: 0x2a2c30, pants: 0x1c1e22, skin: 0x9aa5a8, hair: 0x0a0a0c, hairStyle: "long", wet: true, lips: 0x3a3a40 },
  // the rest of the fourteen look different every time (see variant()), these are the defaults
  drowned: { height: 1.72, build: 1, shirt: 0x2f3a40, pants: 0x20262a, skin: 0xa7afb3, hair: 0x1d1d1d, hairStyle: "short", wet: true, random: true },
  // five more of the fourteen, the way they were the night they got on
  eddie:   { height: 1.72, build: 0.9, shirt: 0xe4e1d8, pants: 0x2a2c30, skin: 0xb8865f, hair: 0x15100c, hairStyle: "curly", apron: 0xd8d4c8, young: true, paperHat: true },
  dorothy: { height: 1.56, f: true, build: 0.96, shirt: 0x6b4f6a, pants: 0x3d3540, skin: 0xd8bfab, hair: 0xd8d4d0, hairStyle: "bun", hunched: true, bag: 0x7a5b3a, glasses: 0x8a7a5a, cardigan: 0x7d5f7b },
  frank:   { height: 1.8, build: 1.2, shirt: 0x3f5370, pants: 0x2b3240, skin: 0xd3ad8c, hair: 0x5a4a3c, hairStyle: "short", mailbag: 0x5a3f26, mustache: true, cap: 0x2f4058 },
  carmen:  { height: 1.62, f: true, build: 0.9, shirt: 0x8a4a5a, pants: 0x2a2a32, skin: 0xc49470, hair: 0x120d0a, hairStyle: "long", lips: 0x7a3a3a },
  marcus:  { height: 1.82, build: 1.06, shirt: 0x2f4a3a, pants: 0x1f2228, skin: 0x6e4a33, hair: 0x0e0b09, hairStyle: "buzz", coat: 0x3a5a46 },
  // kids in raincoats, at the end of the driveways
  kidred:   { height: 1.12, f: true, shirt: 0xb0302a, pants: 0x2c3342, skin: 0xc9b8aa, hair: 0x3a2a1a, hairStyle: "pigtails", hood: true, child: true },
  kidblue:  { height: 1.18, shirt: 0x2f5f9a, pants: 0x2c2c34, skin: 0xd2b49a, hair: 0x1a120c, hairStyle: "short", hood: true, child: true },
  kidgreen: { height: 1.08, f: true, shirt: 0x3e7a44, pants: 0x30302c, skin: 0xbf9c80, hair: 0x5a3a22, hairStyle: "long", hood: true, child: true },
};

// a seeded random, so the same person always looks the same
function rng(seedText) {
  let h = 2166136261;
  for (const ch of String(seedText)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
}
// one of the drowned: a stranger, made up from their name
const SHIRTS = [0x2f3a40, 0x4a3a32, 0x3a4a5a, 0x5a4a5e, 0x2e3e34, 0x6a5a48, 0x3e3e46, 0x55423c, 0x34465a];
const SKINS = [0xa7afb3, 0x9aa3a7, 0x8f989c, 0xb3babd, 0x858d90];
const HAIRS = [0x1d1d1d, 0x3a2a1e, 0x5a4632, 0x7a7068, 0x2a2018, 0x8a6a3a];
function variant(base, seedText) {
  const r = rng(seedText);
  const f = r() < 0.5;
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    ...base, f,
    height: f ? 1.58 + r() * 0.14 : 1.68 + r() * 0.16,
    build: 0.86 + r() * 0.3,
    shirt: pick(SHIRTS), pants: pick([0x20262a, 0x2a2622, 0x23232a, 0x302a26]), skin: pick(SKINS), hair: pick(HAIRS),
    hairStyle: f ? pick(["long", "long", "bun", "ponytail", "braids", "curly"]) : pick(["short", "short", "balding", "curly", "buzz"]),
    coat: r() < 0.4 ? pick([0x2a2e34, 0x3a3430, 0x2e3a36]) : null,
    glasses: r() < 0.15 ? 0x1a1a1a : null,
    hunched: r() < 0.12,
  };
}

export class Person {
  constructor(scene, lookName, { ghost = false, variant: v = null } = {}) {
    let look = { ...LOOKS[lookName] };
    if (look.random) look = variant(look, v || `${lookName}${Math.random()}`);
    this.look = look;
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.userData.person = this;
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);
    this.mats = [];
    const cache = new Map();
    const m = (color) => {
      // solid, never see-through: overlapping see-through boxes flickered badly
      if (cache.has(color)) return cache.get(color);
      const x = mat({ color });
      this.mats.push(x);
      cache.set(color, x);
      return x;
    };
    const add = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    const H = look.height;
    const kid = !!look.child;
    const B = look.build || 1;
    const F = !!look.f;
    const leg = H * (kid ? 0.44 : 0.47);
    const torso = H * 0.31;
    this.leg = leg;
    // the shape of them
    const shoulderW = (F ? 0.34 : 0.4) * B * (kid ? 0.78 : 1);
    const hipW = (F ? 0.36 : 0.33) * Math.sqrt(B) * (kid ? 0.8 : 1);
    const depth = (F ? 0.21 : 0.24) * B * (kid ? 0.85 : 1);
    const headW = (kid ? 0.22 : F ? 0.2 : 0.21) * (0.96 + (B - 1) * 0.25);
    const headH = kid ? 0.24 : F ? 0.24 : 0.26;
    const shirt = m(look.shirt);
    const pants = m(look.pants);
    const skin = m(look.skin);
    const hair = m(look.hair);
    const dark = m(0x111111);
    this.skinMat = skin;

    // legs: hip pivot -> thigh -> knee pivot -> shin
    this.hips = [];
    this.knees = [];
    const legW = (F ? 0.12 : 0.13) * Math.sqrt(B) * (kid ? 0.85 : 1);
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * hipW * 0.29, leg, 0);
      add(hip, box(legW + 0.01, leg / 2, legW + 0.02, look.gown ? skin : pants), 0, -leg / 4, 0);
      const knee = new THREE.Group();
      knee.position.y = -leg / 2;
      add(knee, box(legW, leg / 2, legW + 0.01, look.gown ? skin : pants), 0, -leg / 4, 0);
      add(knee, box(legW + 0.01, 0.07, 0.24, look.gown ? skin : m(F ? 0x241c1a : 0x111111)), 0, -leg / 2 + 0.03, 0.04);   // shoes
      hip.add(knee);
      this.body.add(hip);
      this.hips.push(hip);
      this.knees.push(knee);
    }
    // the pelvis, and the torso on it (a little narrower at the waist; a woman's hips wider than her shoulders)
    add(this.body, box(hipW, 0.14, depth * 0.95, look.gown ? shirt : pants), 0, leg + 0.02, 0);
    const chest = add(this.body, new THREE.Group(), 0, leg + torso / 2, 0);
    add(chest, box(shoulderW * (F ? 0.86 : 0.9), torso * 0.5, depth * 0.94, shirt), 0, -torso * 0.24, 0);       // waist
    add(chest, box(shoulderW, torso * 0.52, depth, shirt), 0, torso * 0.24, 0);                                // chest
    this.chest = chest;
    // clothes over it
    const front = depth / 2 + 0.006;
    if (look.coat) {
      const coat = m(look.coat);
      for (const s of [-1, 1]) add(chest, box(shoulderW * 0.47, torso * 1.02, depth * 1.06, coat), s * shoulderW * 0.27, 0, 0);   // open, over the shirt
      add(chest, box(shoulderW * 0.9, 0.06, depth * 0.6, coat), 0, torso * 0.5, -depth * 0.12);                                  // collar at the back
    }
    if (look.cardigan) {
      const cd = m(look.cardigan);
      for (const s of [-1, 1]) add(chest, box(shoulderW * 0.42, torso * 0.98, depth * 1.04, cd), s * shoulderW * 0.29, -0.01, 0);
      for (let i = 0; i < 4; i++) add(chest, box(0.015, 0.015, 0.01, m(0xe8e0d0)), shoulderW * 0.09, torso * 0.36 - i * torso * 0.22, front + 0.012);
    }
    if (look.scrubs) add(chest, box(0.09, 0.08, 0.01, skin), 0, torso * 0.44, front);                         // the V of the neckline
    if (look.tie) add(chest, box(0.045, torso * 0.62, 0.012, m(look.tie)), 0, torso * 0.14, front);
    if (look.buttons) for (let i = 0; i < 3; i++) add(chest, box(0.03, 0.03, 0.012, m(look.buttons)), 0, torso * 0.3 - i * 0.12, front);
    if (look.gown) for (let i = 0; i < 9; i++) add(chest, box(0.02, 0.02, 0.006, m(0x6f8fa8)), (i % 3 - 1) * shoulderW * 0.3, torso * 0.35 - Math.floor(i / 3) * torso * 0.3, front);   // the print
    if (look.hunched) chest.rotation.x = 0.18;

    // neck and head
    this.neck = new THREE.Group();
    this.neck.position.y = leg + torso;
    this.body.add(this.neck);
    add(this.neck, box(headW * 0.42, 0.08, headW * 0.42, skin), 0, 0.02, 0);
    const head = new THREE.Group();
    head.position.y = 0.06;
    this.neck.add(head);
    this.head = head;
    add(head, box(headW, headH * 0.66, headW * 1.08, skin), 0, headH * 0.6, 0);                // cranium
    add(head, box(headW * (F ? 0.82 : 0.88), headH * 0.36, headW * 0.98, skin), 0, headH * 0.2, 0.005);   // jaw
    if (!F && !kid && !look.young) add(head, box(headW * 0.9, 0.035, 0.02, m(shade(look.skin, 0.88))), 0, headH * 0.08, headW * 0.5);   // stubble
    const faceZ = headW * 0.54;
    add(head, box(0.032, 0.05 * (look.nose || 1), 0.035 * (look.nose || 1), m(shade(look.skin, 0.94))), 0, headH * 0.42, faceZ + 0.012);   // nose
    for (const s of [-1, 1]) add(head, box(0.025, 0.05, 0.035, skin), s * headW * 0.52, headH * 0.48, 0);                                // ears
    // eyes: whites, and dark irises (they go black on the drowned)
    this.eyeMat = m(0x161210);
    this.whites = m(0xd8d2c8);
    for (const s of [-1, 1]) {
      add(head, box(0.044, 0.024, 0.01, this.whites), s * headW * 0.23, headH * 0.56, faceZ);
      add(head, box(0.022, 0.024, 0.012, this.eyeMat), s * headW * 0.23, headH * 0.56, faceZ + 0.002);
      const brow = add(head, box(0.05, 0.014, 0.012, m(look.brows || look.hair)), s * headW * 0.23, headH * 0.66, faceZ + 0.004);
      brow.rotation.z = s * (F ? -0.12 : 0.05);
    }
    this.mouth = add(head, box(headW * 0.32, 0.014, 0.01, m(look.lips || shade(look.skin, 0.62))), 0, headH * 0.24, faceZ + 0.002);   // mouth
    this.mouthY = headH * 0.24;
    if (look.glasses) {
      const gm = m(look.glasses);
      for (const s of [-1, 1]) {
        add(head, box(0.06, 0.008, 0.008, gm), s * headW * 0.23, headH * 0.6, faceZ + 0.015);
        add(head, box(0.06, 0.008, 0.008, gm), s * headW * 0.23, headH * 0.52, faceZ + 0.015);
        add(head, box(0.008, 0.045, 0.008, gm), s * headW * 0.38, headH * 0.56, faceZ + 0.015);
        add(head, box(0.006, 0.006, headW * 0.9, gm), s * headW * 0.5, headH * 0.58, faceZ * 0.2);
      }
      add(head, box(0.025, 0.008, 0.008, gm), 0, headH * 0.58, faceZ + 0.015);
    }
    if (look.mustache) add(head, box(0.1, 0.022, 0.02, hair), 0, headH * 0.32, faceZ + 0.008);
    this.buildHair(head, look, hair, headW, headH, m);
    // extras on the head
    if (look.cap) {
      // a cap: crown and a peak
      const c = new THREE.Group();
      add(c, box(headW * 1.2, 0.08, headW * 1.3, m(look.cap)), 0, 0.01, 0);
      add(c, box(headW * 1.05, 0.02, 0.1, m(0x1a140e)), 0, -0.02, headW * 0.75);
      c.position.set(0, headH * 0.95, 0.01);
      head.add(c);
      this.cap = c;
    }
    if (look.paperHat) add(head, box(headW * 1.05, 0.06, headW * 0.6, m(0xf2f0ea)), 0, headH * 0.98, 0);
    if (look.headset) {
      add(head, box(headW * 1.15, 0.02, 0.03, dark), 0, headH * 0.98, 0);
      for (const s of [-1, 1]) add(head, box(0.03, 0.06, 0.06, dark), s * headW * 0.58, headH * 0.5, 0);
    }
    if (look.hood) add(this.neck, box(headW * 1.3, 0.13, 0.09, shirt), 0, 0.06, -headW * 0.7);

    // arms: a sleeve, the forearm, a hand (with a thumb)
    this.arms = [];
    const armW = (F ? 0.085 : 0.1) * Math.sqrt(B) * (kid ? 0.85 : 1);
    const sleeveMat = look.cardigan ? m(look.cardigan) : look.coat ? m(look.coat) : shirt;
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * (shoulderW / 2 + armW * 0.4), leg + torso - 0.04, 0);
      const arm = box(armW, H * 0.34, armW, sleeveMat);
      arm.position.y = -H * 0.17;
      const hand = box(armW * 0.85, 0.09, armW, skin);
      hand.position.y = -H * 0.34 - 0.01;
      sh.add(arm, hand);
      add(hand, box(0.02, 0.04, 0.025, skin), -s * armW * 0.45, 0.01, armW * 0.3);     // thumb
      if (look.scrubs || look.gown || kid) add(sh, box(armW * 1.02, H * 0.15, armW * 1.02, skin), 0, -H * 0.26, 0);   // bare forearm
      this.body.add(sh);
      this.arms.push(sh);
    }
    // extras
    if (look.backpack) add(this.body, box(0.34 * B, 0.44, 0.18, m(look.backpack)), 0, leg + torso * 0.55, -depth / 2 - 0.09);
    if (look.mailbag) {
      // a mailbag on a strap across the chest, at his hip
      add(this.body, box(0.12, 0.3, 0.32, m(look.mailbag)), -hipW * 0.7, leg + 0.05, 0.02);
      const strap = add(chest, box(0.05, torso * 1.3, 0.012, m(0x3a2a18)), 0, 0, front + 0.004);
      strap.rotation.z = 0.7;
    }
    if (look.lanyard) {
      add(chest, box(0.012, torso * 0.35, 0.01, m(0x2a4a8a)), -0.03, torso * 0.25, front);
      add(chest, box(0.012, torso * 0.35, 0.01, m(0x2a4a8a)), 0.03, torso * 0.25, front);
      add(chest, box(0.05, 0.075, 0.012, m(0xeeeeee)), 0, torso * 0.02, front + 0.004);
    }
    if (look.gift) {
      // Rosie's birthday present, held out in front of him in both hands (the same one that turns up later)
      const lift = 0.9;
      const inward = 0.12;
      this.arms.forEach((a, i) => { a.rotation.set(-lift, 0, i === 0 ? inward : -inward); });
      this.gift = makeGift();
      this.gift.name = "held-gift";                // (not the one on the dashboard)
      this.gift.scale.setScalar(1.55);
      const reach = H * 0.34;
      this.gift.position.set(0, leg + torso - 0.04 - reach * Math.cos(lift) + 0.02, reach * Math.sin(lift) - 0.04);
      this.body.add(this.gift);
    }
    if (look.cane) { const c = box(0.03, 0.9, 0.03, m(0x3a2a1a)); c.position.set(0.3, 0.45, 0.15); this.body.add(c); this.cane = c; }
    if (look.apron) {
      const a = m(look.apron);
      add(this.body, box(hipW * 1.02, leg * 0.75, 0.02, a), 0, leg * 0.72, depth / 2 + 0.02);
      add(chest, box(shoulderW * 0.62, torso * 0.5, 0.02, a), 0, -torso * 0.08, front + 0.01);
      add(chest, box(0.02, torso * 0.4, 0.012, a), -shoulderW * 0.22, torso * 0.32, front + 0.01);
      add(chest, box(0.02, torso * 0.4, 0.012, a), shoulderW * 0.22, torso * 0.32, front + 0.01);
    }
    if (look.bag) {
      // a knitting bag on her arm: it hangs from her hand and swings as she walks
      const bag = new THREE.Group();
      add(bag, box(0.24, 0.2, 0.1, m(look.bag)), 0, -0.13, 0);
      add(bag, box(0.2, 0.02, 0.02, m(0x5a3f26)), 0, 0.0, 0);
      for (const s of [-1, 1]) add(bag, box(0.015, 0.06, 0.015, m(0x5a3f26)), s * 0.09, -0.03, 0);
      for (const [x, c] of [[-0.05, 0xc0392b], [0.04, 0xe2c26a]]) add(bag, new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), m(c)), x, -0.03, 0.02);   // yarn
      add(bag, box(0.005, 0.18, 0.005, m(0xcfc8b8)), 0.02, 0.02, 0.03).rotation.z = 0.5;     // a needle
      this.bag = bag;
      this.carryBag();
    }
    if (look.hunched) chest.position.z = 0.02;

    this.mode = "stand";
    this.path = [];
    this.speed = 1.3;
    this.walkT = 0;
    this.headTarget = null;
    this.watching = null;
    this.onArrive = null;
    this.ghost = false;
    if (ghost || look.wet) this.setGhost(ghost);
    all.add(this);
  }

  // hair, for every style. Built on the head, so it turns with it.
  buildHair(head, look, hair, w, h, m) {
    const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); head.add(mesh); return mesh; };
    const style = look.hairStyle || "short";
    const top = h * 0.95;
    if (style === "buzz") { add(box(w * 1.03, 0.025, w * 1.1, hair), 0, top, 0); add(box(w * 1.03, h * 0.35, 0.03, hair), 0, h * 0.72, -w * 0.53); return; }
    if (style === "balding") {
      // a fringe round the back and the sides, nothing on top
      add(box(w * 1.05, h * 0.25, 0.04, hair), 0, h * 0.55, -w * 0.54);
      for (const s of [-1, 1]) add(box(0.03, h * 0.2, w * 0.7, hair), s * w * 0.52, h * 0.58, -w * 0.15);
      return;
    }
    // a cap of hair over the top, and the back of the head
    const puff = style === "curly" ? 1.12 : 1.04;
    add(box(w * puff * 1.04, style === "curly" ? 0.1 : 0.07, w * 1.14 * puff, hair), 0, top + (style === "curly" ? 0.02 : 0), -0.008);
    add(box(w * 1.06, h * 0.45, 0.05, hair), 0, h * 0.68, -w * 0.55);
    for (const s of [-1, 1]) add(box(0.03, h * 0.3, w * 0.8, hair), s * w * 0.53, h * 0.72, -w * 0.1);   // over the temples
    if (style === "short" || style === "curly") return;
    // a fringe, swept to one side
    add(box(w * 0.7, 0.05, 0.03, hair), w * 0.12, h * 0.86, w * 0.55);
    if (style === "long" || style === "braids") {
      // down past the shoulders at the back, and framing the face at the sides
      const len = look.child ? 0.26 : 0.42;
      add(box(w * 1.1, len, 0.06, hair), 0, h * 0.62 - len / 2 + 0.08, -w * 0.58);
      for (const s of [-1, 1]) add(box(0.04, len * 0.8, w * 0.42, hair), s * w * 0.56, h * 0.62 - len * 0.4 + 0.08, w * 0.12);
      if (style === "braids") {
        // braids: ropes of hair hanging down the back, each with a bead at the end
        for (let i = 0; i < 5; i++) {
          const bx = (i - 2) * w * 0.22;
          add(box(0.035, len * 1.25, 0.035, hair), bx, h * 0.6 - len * 0.62, -w * 0.62);
          add(box(0.04, 0.03, 0.04, this.beadMat || (this.beadMat = m(0xc89a3a))), bx, h * 0.6 - len * 1.25, -w * 0.62);
        }
      }
    } else if (style === "bun") {
      add(box(w * 0.5, w * 0.45, w * 0.5, hair), 0, h * 0.92, -w * 0.52);
    } else if (style === "ponytail") {
      add(box(0.07, 0.07, 0.07, m(0x6a2a2a)), 0, h * 0.78, -w * 0.62);       // the tie
      add(box(0.08, 0.32, 0.06, hair), 0, h * 0.6, -w * 0.68).rotation.x = 0.15;
    } else if (style === "pigtails") {
      for (const s of [-1, 1]) {
        add(box(0.05, 0.05, 0.05, m(0xd04040)), s * w * 0.58, h * 0.66, -w * 0.25);
        add(box(0.06, 0.2, 0.06, hair), s * w * 0.66, h * 0.52, -w * 0.25).rotation.z = s * 0.25;
      }
    }
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
    this.eyeMat.color.set(on ? 0x000000 : 0x161210);
    this.whites.color.set(on ? 0x2a3134 : 0xd8d2c8);          // no whites to their eyes
    if (on) this.skinMat.color.set(0x8c979b);
    return this;
  }
  // eyes that catch what little light there is: in the dark, a pale pair of them, looking at you
  eyeshine(on) { this.eyeMat.emissive?.set(on ? 0x8fd8c6 : this.ghost ? 0x0b1518 : 0x000000); }
  // the jaw hanging open, the way the drowned look
  slack(on) {
    if (!this.mouthShut) this.mouthShut = this.mouth.material;
    if (!this.mouthOpen) this.mouthOpen = mat({ color: 0x050707 });
    this.mouth.material = on ? this.mouthOpen : this.mouthShut;
    this.mouth.scale.set(on ? 0.8 : 1, on ? 3.4 : 1, 1);
    this.mouth.position.y = this.mouthY - (on ? 0.014 : 0);
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
    // hands in the lap, and anything carried in them on the knees
    if (!this.look.gift && !this.reaching) this.arms.forEach((a, i) => a.rotation.set(-0.55, 0, i ? -0.12 : 0.12));
    if (this.bag) this.lapBag();
    if (this.cane) this.cane.visible = false;
    return this;
  }
  stand() {
    this.mode = "stand";
    this.body.position.set(0, 0, 0);
    this.hips.forEach((h) => { h.rotation.x = 0; });
    this.knees.forEach((k) => { k.rotation.x = 0; });
    if (!this.look.gift && !this.reaching && !this.capHeld) this.arms.forEach((a) => a.rotation.set(0, 0, 0));
    if (this.bag) this.carryBag();
    if (this.cane) this.cane.visible = true;
  }
  // the knitting bag: hanging from her left hand (it swings with the arm), or on her knees when she sits
  carryBag() {
    const hand = this.arms[0].children[1];
    hand.add(this.bag);
    this.bag.position.set(0, -0.02, 0.02);
    this.bag.rotation.set(0, Math.PI / 2, 0);
  }
  lapBag() {
    this.body.add(this.bag);
    this.bag.position.set(0, this.leg + 0.2, 0.26);
    this.bag.rotation.set(0, 0, 0);
  }
  // keep walking to wherever to() says, every frame (a point in the parent's space), no faster than `speed`, facing
  // face() (a point) if it's given, else the way they're going: for walking something along with them, like a door
  // they're shutting. null stops them where they are.
  follow(to, { speed = 1.2, face = null } = {}) {
    this.stand();
    this.following = to ? { to, face } : null;
    this.speed = speed;
    if (to) this.mode = "follow";
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
  lookAt(worldPoint) { this.headTarget = worldPoint ? worldPoint.clone() : null; this.watching = null; }
  // keep looking right at you (or anything that moves): pass the camera; null stops
  watch(target) { this.watching = target || null; }
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
          this.arms[0].rotation.x = -s * (this.bag ? 0.32 : 0.4);
          if (!this.capHeld && !this.reaching) this.arms[1].rotation.x = s * 0.4;
        }
        // the bag swings a beat behind the arm
        if (this.bag && this.bag.parent !== this.body) this.bag.rotation.x = Math.sin(this.walkT - 0.6) * 0.35;
        this.body.position.y = Math.abs(Math.cos(this.walkT)) * 0.03;
      }
    }
    if (this.mode === "follow" && this.following) {
      const p = this.root.position;
      const target = this.following.to();
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = Math.min(dist, this.speed * dt);
      if (dist > 1e-4) { p.x += (dx / dist) * step; p.z += (dz / dist) * step; }
      const f = this.following.face && this.following.face();
      const want = f ? Math.atan2(f.x - p.x, f.z - p.z) : dist > 0.01 ? Math.atan2(dx, dz) : this.root.rotation.y;
      const diff = Math.atan2(Math.sin(want - this.root.rotation.y), Math.cos(want - this.root.rotation.y));
      this.root.rotation.y += diff * Math.min(1, dt * 8);
      // stepping while they move (forward or back), standing still when they don't
      const pace = step / Math.max(dt, 1e-4);
      this.walkT += dt * pace * 4.2;
      const s = Math.sin(this.walkT) * Math.min(1, pace / 0.35);
      this.hips[0].rotation.x = s * 0.5;
      this.hips[1].rotation.x = -s * 0.5;
      this.knees[0].rotation.x = Math.max(0, -s) * 0.6;
      this.knees[1].rotation.x = Math.max(0, s) * 0.6;
      if (!this.look.gift && !this.reaching) this.arms[0].rotation.x = -s * 0.4;
      this.body.position.y = Math.abs(Math.cos(this.walkT)) * 0.03 * Math.min(1, pace / 0.35);
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
    // turn the head toward something: left and right, and up and down too, so they really look at it
    const target = this.watching ? this.watching.getWorldPosition(tmpW) : this.headTarget;
    if (target) {
      const local = this.root.worldToLocal(tmpL.copy(target));
      const neckY = this.neck.position.y + this.body.position.y;
      const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.35, 1.35);
      const pitch = THREE.MathUtils.clamp(-Math.atan2(local.y - neckY - 0.15, Math.hypot(local.x, local.z)), -0.6, 0.5);
      const k = Math.min(1, dt * (this.turnRate || (this.watching ? 6 : 4)));
      this.neck.rotation.order = "YXZ";
      this.neck.rotation.y += (yaw - this.neck.rotation.y) * k;
      this.neck.rotation.x += (pitch - this.neck.rotation.x) * k;
    } else {
      this.neck.rotation.y *= 1 - Math.min(1, dt * 3);
      this.neck.rotation.x *= 1 - Math.min(1, dt * 3);
    }
  }
}
const tmpW = new THREE.Vector3();
const tmpL = new THREE.Vector3();

// a little lighter or darker than a color (for a nose, a mouth)
function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}

export const people = {
  update(dt) { all.forEach((p) => p.update(dt)); },
  clear() { [...all].forEach((p) => p.remove()); },
};
