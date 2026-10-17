// Things the story talks about, so they're really there when it does: a soaked backpack on a bench,
// a lanyard swinging on a shelter, posters, a tiny yellow button on a seat, a puddle, your jacket.
import * as THREE from "three";
import { mat, glow, box, decal } from "../core/ps1.js";
import { tex } from "../core/textures.js";

export function makeStoryProp(kind) {
  const g = new THREE.Group();
  if (kind === "backpack") {
    // a kid's backpack, soaked dark, slumped on its side
    const body = box(0.32, 0.4, 0.18, mat({ color: 0x5a2424 }));
    body.position.y = 0.2;
    g.add(body);
    const pocket = box(0.24, 0.16, 0.05, mat({ color: 0x4a1c1c }));
    pocket.position.set(0, 0.12, 0.11);
    g.add(pocket);
    for (const s of [-1, 1]) {
      const strap = box(0.05, 0.36, 0.03, mat({ color: 0xc9a227 }));
      strap.position.set(s * 0.09, 0.2, -0.1);
      g.add(strap);
    }
    g.rotation.set(0, 0.5, -1.2);
  } else if (kind === "lanyard") {
    // a nurse's ID on a lanyard, hanging off the shelter frame; it swings (see update)
    const swing = new THREE.Group();
    for (const s of [-1, 1]) {
      const cord = box(0.012, 0.32, 0.012, mat({ color: 0x3d6fa8 }));
      cord.position.set(s * 0.035, -0.16, 0);
      cord.rotation.z = s * 0.12;
      swing.add(cord);
    }
    const card = box(0.07, 0.1, 0.006, glow(0xf2f2ee));
    card.position.y = -0.37;
    swing.add(card);
    const stripe = box(0.072, 0.02, 0.007, glow(0x2f6fb5));
    stripe.position.y = -0.335;
    swing.add(stripe);
    g.add(swing);
    g.userData.update = (t) => { swing.rotation.z = Math.sin(t * 2.1) * 0.35 + Math.sin(t * 5.3) * 0.08; swing.rotation.x = Math.sin(t * 1.4) * 0.15; };
  } else if (kind === "posters") {
    // two more missing posters, already pulped by the rain
    for (const [z, r] of [[-0.45, 0.05], [0.95, -0.08]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), mat({ map: tex.poster(["MISSING", "JUN PARK", "AGE 15", "555-0143"]), color: 0x9a9a92 }));
      p.position.set(0, 0, z);
      p.rotation.set(0, Math.PI / 2, r);
      g.add(p);
    }
  } else if (kind === "button") {
    // a tiny yellow raincoat button
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 10), glow(0xe8c022));
    g.add(b);
    for (const s of [-1, 1]) {
      const hole = box(0.005, 0.01, 0.005, mat({ color: 0x5a4a10 }));
      hole.position.set(s * 0.005, 0.003, 0);
      g.add(hole);
    }
  } else if (kind === "puddle") {
    // water soaking into a seat, and dripping onto the floor
    const m = decal(new THREE.MeshBasicMaterial({ color: 0x1a2a33, transparent: true, opacity: 0.75, depthWrite: false }), 2);
    const seatPool = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), m);
    seatPool.rotation.x = -Math.PI / 2;
    seatPool.scale.set(1, 1.3, 1);
    g.add(seatPool);
    const floorPool = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), m);
    floorPool.rotation.x = -Math.PI / 2;
    floorPool.position.set(-0.05, -0.43, 0.3);
    g.add(floorPool);
    g.userData.update = (t) => { const k = Math.min(1.6, 1 + t * 0.05); floorPool.scale.set(k, k, k); };
  } else if (kind === "jacketFolded") {
    const j = box(0.34, 0.06, 0.28, mat({ color: 0x1d2532 }));
    g.add(j);
    const wet = box(0.35, 0.01, 0.29, mat({ color: 0x151b24 }));
    wet.position.y = 0.032;
    g.add(wet);
  } else if (kind === "jacketHung") {
    // your jacket, hanging off the back of the driver's seat
    const j = box(0.46, 0.55, 0.05, mat({ color: 0x1d2532 }));
    j.position.y = -0.25;
    g.add(j);
    for (const s of [-1, 1]) {
      const sleeve = box(0.09, 0.45, 0.06, mat({ color: 0x1a212d }));
      sleeve.position.set(s * 0.26, -0.3, 0.01);
      g.add(sleeve);
    }
  }
  return g;
}
