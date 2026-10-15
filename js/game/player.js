// The player: walking on foot, sitting in the driver's seat, or being moved
// by a cutscene. Also handles looking at things and pressing E on them.
import * as THREE from "three";
import { ui } from "../core/ui.js";
import { Sound } from "../audio.js";

const WALK_SPEED = 2.4;
const RADIUS = 0.3;
const REACH = 2.4;

export function createPlayer(camera, scene) {
  const s = {
    mode: "walk",           // "walk" | "seat" | "cutscene"
    pos: new THREE.Vector3(0, 1.7, 0),
    yaw: 0,                 // radians; in "seat" mode this is relative to the bus
    pitch: 0,
    bob: 0,
    seatParent: null,
    seatEye: null,
    colliders: [],
    interactables: [],      // { mesh, label(): string|null, use() }
    look: null,             // cutscene look-at target (world point)
    shake: 0,
  };
  const ray = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  let hovered = null;

  function collide(p) {
    for (const b of s.colliders) {
      if (p.y < b.min.y - 0.5 || p.y - 1.6 > b.max.y) continue;
      const cx = THREE.MathUtils.clamp(p.x, b.min.x, b.max.x);
      const cz = THREE.MathUtils.clamp(p.z, b.min.z, b.max.z);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist < RADIUS) {
        if (dist < 1e-5) { p.x += RADIUS; continue; }
        p.x = cx + (dx / dist) * RADIUS;
        p.z = cz + (dz / dist) * RADIUS;
      }
    }
  }

  return {
    state: s,
    get mode() { return s.mode; },
    walkAt(pos, yaw = 0) {
      s.mode = "walk";
      scene.add(camera);
      s.pos.copy(pos);
      s.yaw = yaw;
      s.pitch = 0;
    },
    sitIn(parent, eye, yaw = Math.PI) {
      s.mode = "seat";
      s.seatParent = parent;
      s.seatEye = eye.clone();
      parent.add(camera);
      s.yaw = yaw;
      s.pitch = -0.05;
    },
    // a fixed camera for cinematic shots (the player can't move or look)
    fixed(parent, pos, rot) {
      s.mode = "fixed";
      parent.add(camera);
      camera.position.copy(pos);
      camera.rotation.copy(rot);
    },
    // cutscene: the player can't move or look; the camera turns toward `target`
    cutscene(target = null) { s.locked = true; s.look = target ? target.clone() : null; },
    endCutscene() { s.locked = false; s.look = null; },
    // pull the view toward something without locking the player
    lookAtSoon(target) { s.look = target ? target.clone() : null; },
    shake(amount) { s.shake = Math.max(s.shake, amount); },
    setColliders(list) { s.colliders = list; },
    addInteract(entry) { s.interactables.push(entry); return entry; },
    removeInteract(entry) { s.interactables = s.interactables.filter((e) => e !== entry); },

    update(dt, input) {
      if (s.mode === "fixed") { ui.prompt(null); return; }
      const free = !s.locked;
      const base = s.mode;
      if (free) {
        s.yaw -= input.dx * 0.0022;
        s.pitch -= input.dy * 0.0022;
      }
      // a cutscene (or a scare) can pull your view toward something
      if (s.look) {
        const from = camera.getWorldPosition(new THREE.Vector3());
        const dir = s.look.clone().sub(from).normalize();
        let wantYaw = Math.atan2(-dir.x, -dir.z);
        const wantPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
        if (base === "seat") {
          // seat yaw is relative to the bus, so subtract the bus's own heading
          const q = s.seatParent.getWorldQuaternion(new THREE.Quaternion());
          wantYaw -= new THREE.Euler().setFromQuaternion(q, "YXZ").y;
        }
        let dy = wantYaw - s.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        s.yaw += dy * Math.min(1, dt * 3);
        s.pitch += (wantPitch - s.pitch) * Math.min(1, dt * 3);
      }
      s.pitch = THREE.MathUtils.clamp(s.pitch, -1.35, 1.25);

      if (base === "walk") {
        if (free) {
          const f = (input.down("KeyW") ? 1 : 0) - (input.down("KeyS") ? 1 : 0);
          const r = (input.down("KeyD") ? 1 : 0) - (input.down("KeyA") ? 1 : 0);
          if (f || r) {
            const len = Math.hypot(f, r);
            const sin = Math.sin(s.yaw);
            const cos = Math.cos(s.yaw);
            s.pos.x += ((-sin * f + cos * r) / len) * WALK_SPEED * dt;
            s.pos.z += ((-cos * f - sin * r) / len) * WALK_SPEED * dt;
            const before = Math.sin(s.bob);
            s.bob += dt * 9;
            if (before > 0 && Math.sin(s.bob) <= 0) Sound.sfx("step");   // one step per bob
            if (before < 0 && Math.sin(s.bob) >= 0) Sound.sfx("step");
            collide(s.pos);
          }
        }
        camera.position.set(s.pos.x, s.pos.y + Math.sin(s.bob) * 0.035, s.pos.z);
      } else if (base === "seat") {
        // yaw PI = facing the windshield; you can turn almost all the way round
        const rel = THREE.MathUtils.clamp(Math.atan2(Math.sin(s.yaw - Math.PI), Math.cos(s.yaw - Math.PI)), -2.7, 2.7);
        s.yaw = Math.PI + rel;
        camera.position.copy(s.seatEye);
        // the old engine shakes the whole bus a little
        const v = (s.vibration || 0) * 0.004 + 0.0006;
        camera.position.x += (Math.random() - 0.5) * v;
        camera.position.y += (Math.random() - 0.5) * v * 1.5;
      }
      camera.rotation.set(s.pitch, s.yaw, 0, "YXZ");
      if (s.shake > 0) {
        camera.rotation.x += (Math.random() - 0.5) * s.shake * 0.05;
        camera.rotation.y += (Math.random() - 0.5) * s.shake * 0.05;
        camera.position.y += (Math.random() - 0.5) * s.shake * 0.04;
        s.shake = Math.max(0, s.shake - dt * 2);
      }

      // what are we looking at?
      hovered = null;
      if (free && s.interactables.length) {
        ray.setFromCamera(center, camera);
        ray.far = REACH;
        const meshes = s.interactables.map((e) => e.mesh).filter((m) => m && m.visible !== false);
        const hit = ray.intersectObjects(meshes, true)[0];
        if (hit) {
          hovered = s.interactables.find((e) => e.mesh === hit.object || hit.object.parent === e.mesh || e.mesh.getObjectById(hit.object.id));
          if (hovered && !hovered.label()) hovered = null;
        }
      }
      ui.prompt(hovered ? hovered.label() : null);
      if (hovered && input.hit("KeyE")) hovered.use();
    },
  };
}
