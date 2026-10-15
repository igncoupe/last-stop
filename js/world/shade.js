// The shadow. Not one of the drowned: no face, no clothes, no light lands on
// it. A hole in the night in the shape of a tall, thin man, with edges that
// won't hold still. It stands at stops and watches. It runs. It jumps.
// (It's what's left of Harold Rhee. Dispatch is watching.)
import * as THREE from "three";

const VOID = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });

function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(0,0,0,0.95)");
  grd.addColorStop(0.45, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
// a soft white glow (tinted by the material): the haze behind it that makes its outline readable
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// a limb hanging down from its joint
function limb(len, r0, r1) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 6).translate(0, -len / 2, 0), VOID);
}
function joint(parent, x, y, z) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

// joint angles for each pose (radians). s = side: -1 left, +1 right
const POSES = {
  stand:  { hipY: 1.02, lean: 0.14, neck: 0.3, tilt: 0.38, sh: [0.06, 0], el: [0, 0.05], th: 0, kn: 0, spread: 0.08 },
  crouch: { hipY: 0.5, lean: 0.95, neck: -0.5, tilt: 0.15, sh: [0.25, -1.1], el: [0, -0.2], th: -1.45, kn: 2.3, spread: 0.22 },
  leap:   { hipY: 1.02, lean: 0.35, neck: -0.2, tilt: 0.1, sh: [2.3, -0.4], el: [-0.3, 0], th: -0.5, kn: 0.9, spread: 0.3 },
  glass:  { hipY: 1.02, lean: 0.06, neck: 0.28, tilt: 0.42, sh: [1.75, 0], el: [0.5, 0], th: 0, kn: 0.15, spread: 0.32 },
  bar:    { hipY: 1.02, lean: 0.05, neck: 0.2, tilt: 0.3, sh: [1.45, 0], el: [0, 0], th: 0, kn: 0, spread: 0.16 },
  point:  { hipY: 1.02, lean: 0.1, neck: 0.15, tilt: 0.25, sh: [0.06, 0], el: [0, 0], th: 0, kn: 0, spread: 0.08, pointArm: true },
};

export function createShade(scene) {
  const root = new THREE.Group();
  root.visible = false;
  root.name = "shade";
  scene.add(root);

  // ---- skeleton: 2.05 m, too thin, arms that hang past its knees
  const hips = joint(root, 0, 1.02, 0);
  const legs = [-1, 1].map((s) => {
    const hip = joint(hips, s * 0.09, 0, 0);
    hip.add(limb(0.5, 0.07, 0.05));
    const knee = joint(hip, 0, -0.5, 0);
    knee.add(limb(0.5, 0.05, 0.032));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.2).translate(0, -0.515, 0.06), VOID);
    knee.add(foot);
    return { hip, knee, s };
  });
  const spine = joint(hips, 0, 0, 0);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.12, 0.62, 10).translate(0, 0.31, 0), VOID);
  torso.scale.z = 0.55;
  spine.add(torso);
  const arms = [-1, 1].map((s) => {
    const sh = joint(spine, s * 0.2, 0.58, 0);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), VOID));
    sh.add(limb(0.48, 0.052, 0.04));
    const el = joint(sh, 0, -0.48, 0);
    el.add(limb(0.46, 0.04, 0.03));
    const hand = joint(el, 0, -0.46, 0);
    hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.03).translate(0, -0.055, 0), VOID));
    // long fingers, slightly spread
    for (let i = 0; i < 4; i++) {
      const f = limb(0.16, 0.011, 0.006);
      f.position.set((i - 1.5) * 0.022, -0.1, 0);
      f.rotation.z = (i - 1.5) * 0.12;
      hand.add(f);
    }
    const thumb = limb(0.09, 0.008, 0.005);
    thumb.position.set(-s * 0.04, -0.03, 0);
    thumb.rotation.z = -s * 0.7;
    hand.add(thumb);
    return { sh, el, hand, s };
  });
  const neck = joint(spine, 0, 0.6, 0.015);
  neck.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.15, 6).translate(0, 0.075, 0), VOID));
  const head = joint(neck, 0, 0.15, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), VOID);
  skull.scale.set(0.82, 1.28, 0.95);
  skull.position.y = 0.11;
  head.add(skull);

  // ---- smoke around the edges, so it never quite holds its shape
  const smokeMat = new THREE.SpriteMaterial({ map: smokeTexture(), color: 0x000000, transparent: true, depthWrite: false, fog: false, opacity: 0.75 });
  const wisps = [];
  const wispAt = [[spine, 0, 0.45, 0, 0.55], [spine, 0, 0.15, 0, 0.5], [head, 0, 0.12, 0, 0.42], [hips, 0, -0.3, 0, 0.45],
    [arms[0].el, 0, -0.2, 0, 0.26], [arms[1].el, 0, -0.2, 0, 0.26], [legs[0].knee, 0, -0.25, 0, 0.3], [legs[1].knee, 0, -0.25, 0, 0.3]];
  for (const [parent, x, y, z, size] of wispAt) {
    const sp = new THREE.Sprite(smokeMat);
    sp.position.set(x, y, z);
    sp.scale.setScalar(size);
    sp.userData = { base: size, phase: Math.random() * 10, x, y };
    parent.add(sp);
    wisps.push(sp);
  }

  // a cold haze behind it, so its outline reads against the dark
  const hazeMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7f8c96, transparent: true, depthWrite: false, fog: false, opacity: 0.3, blending: THREE.AdditiveBlending });
  const haze = new THREE.Sprite(hazeMat);
  haze.position.set(0, 1.15, -0.9);
  haze.scale.set(2.6, 3.4, 1);
  root.add(haze);

  // ---- posing
  let pose = { ...POSES.stand };
  let target = POSES.stand;
  let blend = 1;               // 1 = snap, smaller = ease toward the target pose
  const lerp = THREE.MathUtils.lerp;
  function setPose(name, ease = 1) { target = POSES[name]; blend = ease; }
  function applyPose(k) {
    for (const key of ["hipY", "lean", "neck", "tilt", "th", "kn", "spread"]) pose[key] = lerp(pose[key], target[key], k);
    pose.sh = [lerp(pose.sh[0], target.sh[0], k), lerp(pose.sh[1], target.sh[1], k)];
    pose.el = [lerp(pose.el[0], target.el[0], k), lerp(pose.el[1], target.el[1], k)];
    pose.pointArm = target.pointArm;
    hips.position.y = pose.hipY;
    spine.rotation.x = pose.lean;
    neck.rotation.x = pose.neck;
    head.rotation.z = pose.tilt;
    for (const a of arms) {
      a.sh.rotation.set(pose.sh[1], 0, a.s * pose.sh[0]);
      a.el.rotation.set(pose.el[1], 0, a.s * pose.el[0]);
    }
    if (pose.pointArm) arms[1].sh.rotation.set(-1.45, 0, 0.12);   // right arm straight out, pointing
    for (const l of legs) {
      l.hip.rotation.set(pose.th, 0, l.s * pose.spread * 0.5);
      l.knee.rotation.x = pose.kn;
    }
  }
  applyPose(1);

  // ---- behaviour
  const camPos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let mode = "hidden";          // hidden | still | run | leap | glass | dissolve
  let watch = null;             // world point its head turns toward
  let twitchT = 1.5;
  let runPos = null;            // () => { pos, yaw } while running
  let runT = 0;
  let leapState = null;
  let glassT = 0;
  let dissolveState = null;

  function toScene() { if (root.parent !== scene) scene.attach(root); }
  function show(pos, yaw) {
    toScene();
    root.position.copy(pos);
    root.rotation.set(0, yaw, 0);
    root.scale.setScalar(1);
    root.visible = true;
    smokeMat.opacity = 0.75;
    hazeMat.opacity = 0.3;
  }
  const faceYaw = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  return {
    root,
    get visible() { return root.visible; },
    get mode() { return mode; },
    hide() { root.visible = false; mode = "hidden"; toScene(); leapState = null; dissolveState = null; },
    // stand somewhere, facing a point (usually the bus), head following the camera
    standAt(pos, faceTo, poseName = "stand") {
      show(pos, faceYaw(pos, faceTo));
      setPose(poseName);
      applyPose(1);
      mode = "still";
      watch = true;
    },
    crouchAt(pos, faceTo) { this.standAt(pos, faceTo, "crouch"); },
    // run, impossibly fast; place(dt) returns { pos, yaw } each frame
    runWith(place) {
      const p = place(0);
      show(p.pos, p.yaw);
      mode = "run";
      runPos = place;
      watch = true;
    },
    // jump from where it is onto something that moves (the windshield), landing in `endLocal` of `parent`
    leap(parent, endLocal, duration = 0.45) {
      return new Promise((done) => {
        const start = root.getWorldPosition(new THREE.Vector3());
        leapState = { t: 0, duration, start, parent, endLocal, done };
        setPose("leap", 0.25);
        mode = "leap";
        watch = null;
      });
    },
    // hold a pose against the glass (after a leap), slowly sliding down
    get onGlass() { return mode === "glass"; },
    // come apart like smoke, then gone
    dissolve(seconds = 2.2) {
      return new Promise((done) => {
        if (!root.visible) { done(); return; }
        dissolveState = { t: 0, seconds, done };
        mode = "dissolve";
      });
    },
    setPose,
    update(dt, camera) {
      if (!root.visible) return;
      camera.getWorldPosition(camPos);
      // smoke at the edges: always moving, never the same shape twice
      const time = performance.now() / 1000;
      for (const w of wisps) {
        const u = w.userData;
        const s = u.base * (0.85 + 0.3 * Math.sin(time * 2.3 + u.phase) + (Math.random() - 0.5) * 0.08);
        w.scale.set(s, s * 1.15, 1);
        w.position.x = u.x + Math.sin(time * 1.7 + u.phase) * 0.03;
        w.position.y = u.y + Math.cos(time * 1.3 + u.phase) * 0.03;
      }
      if (blend < 1) applyPose(Math.min(1, dt * (1 / blend) * 3));
      else applyPose(1);

      if (mode === "run" && runPos) {
        runT += dt * 11;
        const p = runPos(dt);
        root.position.copy(p.pos);
        root.rotation.y = p.yaw;
        // long, loping strides; arms swing wide
        setPose("stand");
        pose.lean = 0.5;
        hips.position.y = 0.98 + Math.abs(Math.sin(runT)) * 0.08;
        spine.rotation.x = 0.5;
        for (const l of legs) {
          const ph = Math.sin(runT + (l.s > 0 ? Math.PI : 0));
          l.hip.rotation.x = -0.2 + ph * 0.95;
          l.knee.rotation.x = 0.4 + Math.max(0, -ph) * 1.4;
        }
        for (const a of arms) {
          const ph = Math.sin(runT + (a.s > 0 ? 0 : Math.PI));
          a.sh.rotation.set(ph * 1.1, 0, a.s * 0.25);
          a.el.rotation.set(-0.5, 0, 0);
        }
      }
      if (mode === "leap" && leapState) {
        const L = leapState;
        L.t += dt;
        const k = Math.min(1, L.t / L.duration);
        const end = L.parent.localToWorld(L.endLocal.clone());
        tmp.lerpVectors(L.start, end, k * k * (3 - 2 * k));
        tmp.y += Math.sin(Math.PI * k) * 1.3;
        root.position.copy(tmp);
        root.rotation.set(-0.5 * Math.sin(Math.PI * k), faceYaw(tmp, camPos), 0);
        if (k >= 1) {
          L.parent.attach(root);
          root.position.copy(L.endLocal);
          root.rotation.set(0, Math.PI, 0);       // facing into the bus
          setPose("glass");
          applyPose(1);
          mode = "glass";
          glassT = 0;
          leapState = null;
          L.done();
        }
      }
      if (mode === "glass") {
        glassT += dt;
        // sliding down the glass, a few centimetres a second; fingers splayed
        root.position.y -= dt * 0.05;
        head.rotation.z = pose.tilt + Math.sin(glassT * 31) * (glassT % 0.9 < 0.12 ? 0.25 : 0.0);
      }
      if (mode === "dissolve" && dissolveState) {
        const D = dissolveState;
        D.t += dt;
        const k = Math.min(1, D.t / D.seconds);
        root.scale.set(1 + k * 0.6, 1 + k * 0.25, 1 + k * 0.6);
        root.position.y += dt * 0.25;
        smokeMat.opacity = 0.75 * (1 - k);
        hazeMat.opacity = 0.3 * (1 - k);
        for (const w of wisps) w.scale.multiplyScalar(1 + k * 2.5);
        torso.visible = skull.visible = k < 0.55;
        for (const a of arms) a.sh.visible = k < 0.35;
        for (const l of legs) l.hip.visible = k < 0.45;
        if (k >= 1) {
          torso.visible = skull.visible = true;
          for (const a of arms) a.sh.visible = true;
          for (const l of legs) l.hip.visible = true;
          root.visible = false;
          mode = "hidden";
          const cb = D.done;
          dissolveState = null;
          cb();
        }
      }
      // the head turns to follow you, then snaps, like it heard something
      if (watch && (mode === "still" || mode === "run")) {
        const local = root.worldToLocal(camPos.clone());
        const want = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.3, 1.3);
        twitchT -= dt;
        if (twitchT <= 0) {
          twitchT = 0.8 + Math.random() * 2.5;
          head.rotation.y = want + (Math.random() - 0.5) * 0.6;    // a jerk
        }
        head.rotation.y = lerp(head.rotation.y, want, Math.min(1, dt * 1.6));
      }
    },
  };
}
