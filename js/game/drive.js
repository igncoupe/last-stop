// Driving the bus along Route 9. The road steers for you; you handle the
// gas (W), the brake (S) and the doors. Scripts can take the wheel.
import * as THREE from "three";
import { route, LANE } from "../world/route.js";

export const MAX_SPEED = 14;      // m/s (about 31 mph)
const ACCEL = 2.4;
const BRAKE = 7;
const DRAG = 0.35;
// a stop counts when the bus is stopped with its door near the shelter
export const STOP_BEFORE = 18;
export const STOP_AFTER = 7;      // a little forgiving if you roll past the box

export function createDrive(bus) {
  const s = {
    d: 14,
    speed: 0,
    control: "player",    // "player" | "auto" | "parked"
    autoSpeed: 0,
    autoStopAt: null,
    limit: MAX_SPEED,
    endD: route.length - 29,      // the road ends inside the Northgate stop zone (stop at length - 30)
    pitch: 0,
    roll: 0,
  };
  const pos = new THREE.Vector3();

  function place() {
    pos.copy(route.at(s.d, LANE, 0));
    bus.group.position.copy(pos);
    bus.group.rotation.set(s.pitch, route.heading(s.d), s.roll, "YXZ");
  }
  place();

  return {
    state: s,
    get d() { return s.d; },
    set d(v) { s.d = v; s.speed = 0; place(); },
    get speed() { return s.speed; },
    get moving() { return s.speed > 0.3; },
    stoppedNear(stopD) {
      return s.speed < 0.35 && s.d > stopD - STOP_BEFORE && s.d < stopD + STOP_AFTER;
    },
    inZone(stopD) { return s.d > stopD - STOP_BEFORE && s.d < stopD + STOP_AFTER; },
    passed(stopD) { return s.d >= stopD + STOP_AFTER; },    // no gap: you are always at a stop, short of it, or past it
    // scripts: drive yourself at a speed, optionally stopping at a distance
    auto(speed, stopAt = null) { s.control = "auto"; s.autoSpeed = speed; s.autoStopAt = stopAt; },
    release() { s.control = "player"; s.autoStopAt = null; },
    park() { s.control = "parked"; },
    setLimit(v) { s.limit = v; },
    // a scene can take the bus off the route (the bridge); the script moves it
    detach(on) { s.detached = on; if (!on) place(); },

    update(dt, input, seated) {
      if (s.detached) return;
      const prev = s.speed;
      if (s.control === "player") {
        const gas = seated && (input.down("KeyW") || input.down("ArrowUp"));
        const brake = seated && (input.down("KeyS") || input.down("ArrowDown") || input.down("Space"));
        if (bus.doorsOpen) {
          s.speed = Math.max(0, s.speed - BRAKE * dt);
        } else if (brake) {
          s.speed = Math.max(0, s.speed - BRAKE * dt);
        } else if (gas) {
          s.speed = Math.min(s.limit, s.speed + ACCEL * dt * (1 - s.speed / (s.limit + 4)));
        } else {
          s.speed = Math.max(0, s.speed - DRAG * dt);
        }
      } else if (s.control === "auto") {
        let target = s.autoSpeed;
        if (s.autoStopAt !== null) {
          const left = s.autoStopAt - s.d;
          target = Math.min(target, Math.max(0, Math.sqrt(Math.max(0, left) * 2 * 2.2)));
          if (left < 0.3) target = 0;
        }
        const rate = target > s.speed ? ACCEL * 1.4 : BRAKE * 0.6;
        s.speed += Math.sign(target - s.speed) * Math.min(Math.abs(target - s.speed), rate * dt);
      } else {
        s.speed = Math.max(0, s.speed - BRAKE * dt);
      }
      // the road ends at Northgate
      if (s.d > s.endD - 30) s.speed = Math.min(s.speed, Math.max(1.5, (s.endD - s.d) * 0.6));
      if (s.d >= s.endD) s.speed = 0;
      s.d += s.speed * dt;

      // lean when braking and accelerating, sway a little in corners
      const acc = (s.speed - prev) / Math.max(dt, 1e-4);
      s.pitch += (THREE.MathUtils.clamp(-acc * 0.004, -0.03, 0.02) - s.pitch) * Math.min(1, dt * 4);
      const turn = route.heading(s.d + 6) - route.heading(s.d);
      const turnRate = Math.atan2(Math.sin(turn), Math.cos(turn));
      s.steer = turnRate;
      s.roll += (THREE.MathUtils.clamp(turnRate * s.speed * 0.02, -0.04, 0.04) - s.roll) * Math.min(1, dt * 3);
      place();
    },
  };
}
