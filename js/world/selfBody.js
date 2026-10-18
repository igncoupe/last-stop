// Your own body: look down in the driver's seat and there you are, hands on the wheel (they turn with
// it), feet at the pedals. On foot, your legs walk under you. Only your camera sees it: it's on its own
// layer, so the rear-view mirror never shows a body with no head.
import * as THREE from "three";
import { mat, box } from "../core/ps1.js";

export const SELF_LAYER = 5;

export function createSelfBody(scene, bus, player, camera) {
  camera.layers.enable(SELF_LAYER);
  const jacket = mat({ color: 0x1d2532 });       // a transit authority work jacket
  const cuff = mat({ color: 0x141a24 });
  const pants = mat({ color: 0x2a2c31 });
  const shoe = mat({ color: 0x0e0e10 });
  const skin = mat({ color: 0x5b3c2a });
  const watch = mat({ color: 0x9a9fa3 });
  const patch = mat({ color: 0xb08a3c });
  const onLayer = (o) => o.traverse((c) => { if (c.isMesh) c.layers.set(SELF_LAYER); });
  const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  // a limb segment that can be stretched between two points every frame
  const unitBox = (m, w, d) => {
    const geo = new THREE.BoxGeometry(w, 1, d);
    geo.translate(0, 0.5, 0);
    return new THREE.Mesh(geo, m);
  };
  const up = new THREE.Vector3(0, 1, 0);
  const span = (mesh, a, b) => {
    mesh.position.copy(a);
    const dir = b.clone().sub(a);
    mesh.scale.set(1, dir.length(), 1);
    mesh.quaternion.setFromUnitVectors(up, dir.normalize());
  };

  // ---------------------------------------------------------------- in the driver's seat (bus space)
  const seat = new THREE.Group();
  bus.group.add(seat);
  put(seat, box(0.4, 0.18, 0.34, pants), 0.7, 1.1, 4.7);                       // hips on the cushion
  const torso = put(seat, box(0.44, 0.48, 0.25, jacket), 0.7, 1.35, 4.6);
  torso.rotation.x = -0.12;                                                       // leaning back a little
  put(seat, box(0.07, 0.06, 0.02, patch), 0.82, 1.48, 4.735).rotation.x = -0.12; // the route patch on your chest
  put(seat, box(0.2, 0.08, 0.2, jacket), 0.7, 1.6, 4.58);                        // collar
  for (const s of [-1, 1]) {
    put(seat, box(0.15, 0.15, 0.46, pants), 0.7 + s * 0.11, 1.08, 4.98);         // thighs, along the seat
    const shin = put(seat, box(0.13, 0.5, 0.14, pants), 0.7 + s * 0.11, 0.8, 5.28);
    shin.rotation.x = -0.35;
    put(seat, box(0.12, 0.08, 0.27, shoe), 0.7 + s * 0.11, 0.56, 5.45);
  }
  const arms = [-1, 1].map((s) => {
    const upper = unitBox(jacket, 0.1, 0.1);
    const fore = unitBox(jacket, 0.09, 0.09);
    seat.add(upper, fore);
    const sleeve = put(seat, box(0.1, 0.03, 0.1, cuff), 0, 0, 0);
    const hand = put(seat, box(0.085, 0.05, 0.11, skin), 0, 0, 0);
    const band = s < 0 ? put(seat, box(0.095, 0.025, 0.06, watch), 0, 0, 0) : null;   // a watch on the left wrist
    return { s, upper, fore, sleeve, hand, band, shoulder: new THREE.Vector3(0.7 + s * 0.21, 1.52, 4.64) };
  });
  // the window-side hand, doing something else for a moment: "bird" (the middle finger, held up at the glass)
  const bird = new THREE.Group();
  put(bird, box(0.085, 0.075, 0.07, skin), 0, 0, 0);                              // the fist
  put(bird, box(0.082, 0.028, 0.03, skin), 0, 0.03, 0.035);                       // curled fingers, knuckles out
  put(bird, box(0.021, 0.088, 0.023, skin), 0.004, 0.078, 0.006);                 // ...and the one that isn't
  put(bird, box(0.012, 0.012, 0.024, mat({ color: 0x8a6a58 })), 0.004, 0.118, 0.012);   // its nail
  const thumb = put(bird, box(0.055, 0.022, 0.024, skin), -0.012, 0.004, 0.048);  // the thumb, tucked across
  thumb.rotation.z = 0.25;
  put(bird, box(0.1, 0.035, 0.1, cuff), 0, -0.06, 0);                             // the jacket cuff
  bird.visible = false;
  seat.add(bird);
  onLayer(seat);
  seat.visible = false;
  const gesture = { name: null, k: 0, on: false };
  const raised = new THREE.Vector3(1.08, 1.56, 4.95);           // up at the window, where they can see it
  const eyeWorld = new THREE.Vector3();

  // ---------------------------------------------------------------- on foot (world space)
  const walk = new THREE.Group();
  scene.add(walk);
  const wTorso = put(walk, box(0.42, 0.55, 0.24, jacket), 0, 1.22, 0.0);
  void wTorso;
  put(walk, box(0.38, 0.2, 0.24, pants), 0, 0.88, 0.0);
  const legs = [-1, 1].map((s) => {
    const hip = put(walk, new THREE.Group(), s * 0.1, 0.86, 0);
    put(hip, box(0.14, 0.44, 0.15, pants), 0, -0.22, 0);
    const knee = put(hip, new THREE.Group(), 0, -0.44, 0);
    put(knee, box(0.13, 0.4, 0.14, pants), 0, -0.2, 0);
    put(knee, box(0.12, 0.07, 0.27, shoe), 0, -0.4, 0.05);
    return { hip, knee, s };
  });
  const wArms = [-1, 1].map((s) => {
    const sh = put(walk, new THREE.Group(), s * 0.27, 1.45, 0);
    put(sh, box(0.1, 0.56, 0.1, jacket), 0, -0.28, 0);
    put(sh, box(0.08, 0.09, 0.09, skin), 0, -0.6, 0);
    return { sh, s };
  });
  onLayer(walk);
  walk.visible = false;

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const grips = [Math.PI + 0.55, -0.55];          // ten and two on the rim (the wheel is mounted flipped)

  return {
    // a gesture with the window-side hand: gesture("bird", true) ... gesture("bird", false)
    gesture(name, on) { gesture.name = name; gesture.on = on; },
    update(dt) {
      const st = player.state;
      const driving = st.mode === "seat" && st.seatParent === bus.group && st.seatEye && st.seatEye.distanceTo(bus.driverEye) < 0.05;
      seat.visible = driving;
      walk.visible = st.mode === "walk";
      if (driving) {
        // the hands follow the rim as the wheel turns
        const wheel = bus.steeringWheel;
        gesture.k += ((gesture.on ? 1 : 0) - gesture.k) * Math.min(1, dt * (gesture.on ? 7 : 5));
        for (const a of arms) {
          const ang = grips[a.s < 0 ? 0 : 1];
          tmpA.set(Math.cos(ang) * 0.23, Math.sin(ang) * 0.23, 0.01);
          wheel.localToWorld(tmpA);
          seat.worldToLocal(tmpA);                            // the hand, in bus space
          const up = a.s > 0 && gesture.k > 0.01;
          if (up) {
            // off the wheel and up to the window
            const e = gesture.k * gesture.k * (3 - 2 * gesture.k);
            tmpA.lerp(raised, e);
            a.hand.visible = e < 0.6;
            bird.visible = e >= 0.6;
            if (bird.visible) {
              bird.position.copy(tmpA).add(new THREE.Vector3(0, 0.06, 0));
              eyeWorld.copy(bus.driverEye);
              bird.up.set(0, 1, 0);
              bird.lookAt(seat.localToWorld(eyeWorld.clone()));   // the palm to you, the back of the hand to them
            }
          } else if (a.s > 0) {
            a.hand.visible = true;
            bird.visible = false;
          }
          // the elbow drops and goes out to the side
          elbow.copy(a.shoulder).lerp(tmpA, 0.5);
          elbow.x += a.s * 0.09;
          elbow.y -= up ? 0.26 : 0.13;
          if (up) elbow.z -= 0.08;
          span(a.upper, a.shoulder, elbow);
          tmpB.copy(tmpA).lerp(elbow, 0.12);
          span(a.fore, elbow, tmpB);
          a.sleeve.position.copy(tmpB);
          a.sleeve.quaternion.copy(a.fore.quaternion);
          a.hand.position.copy(tmpA);
          a.hand.quaternion.copy(a.fore.quaternion);
          if (a.band) { a.band.position.copy(tmpB).lerp(tmpA, 0.4); a.band.quaternion.copy(a.fore.quaternion); }
        }
      }
      if (walk.visible) {
        // under the camera, facing where you face; legs and arms swing with your steps
        walk.position.set(st.pos.x, st.pos.y - 1.7, st.pos.z);
        walk.rotation.y = st.viewYaw + Math.PI;
        const s = Math.sin(st.bob);
        const moving = Math.abs(s) > 1e-3;
        for (const l of legs) {
          l.hip.rotation.x = moving ? s * 0.42 * l.s : 0;
          l.knee.rotation.x = moving ? Math.max(0, -s * l.s) * 0.55 : 0;
        }
        for (const a of wArms) a.sh.rotation.x = moving ? -s * 0.3 * a.s : 0;
      }
    },
  };
}
