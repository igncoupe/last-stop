// Camera moves for the trailer's shots (used with capture.js inside a test run).
import * as C from "./capture.js";
import { route } from "../../js/world/route.js";

const L = () => window.__lastStop;
export { C, route };
export const V3 = (x, y, z) => new (L().camera.position.constructor)(x, y, z);
export const busPoint = (x, y, z) => L().bus.group.localToWorld(V3(x, y, z));
export const ease = (t) => t * t * (3 - 2 * t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));

// from the driver's seat, turn to a point in the world (the same way the playtester aims)
export function aimAt(p) {
  const { player, camera } = L();
  const st = player.state;
  camera.updateMatrixWorld();
  const from = V3(0, 0, 0).setFromMatrixPosition(camera.matrixWorld);
  const d = p.clone().sub(from);
  let yaw = Math.atan2(-d.x, -d.z);
  if (st.mode === "seat") {
    const q = st.seatParent.getWorldQuaternion(new (L().camera.quaternion.constructor)());
    const e = new (L().camera.rotation.constructor)().setFromQuaternion(q, "YXZ");
    yaw -= e.y;
  }
  return { yaw, pitch: Math.asin(d.y / d.length()) };
}
// the seat view, eased from one aim to another over the shot (a, b: {yaw, pitch} or world points)
export function seatPan(a, b, t) {
  const A = a.isVector3 ? aimAt(a) : a;
  const B = b.isVector3 ? aimAt(b) : b;
  let dy = B.yaw - A.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  C.seatLook(A.yaw + dy * t, lerp(A.pitch, B.pitch, t));
}
// a seat camera that glides: each frame it eases toward wherever it's told to look (never snaps)
export function glider(rate = 2.4) {
  let cur = null;
  return (target, dt = 1 / 60, extra = { yaw: 0, pitch: 0 }) => {
    const T = target.isVector3 ? aimAt(target) : target;
    if (!cur) cur = { ...T };
    const k = 1 - Math.exp(-rate * dt);
    let dy = T.yaw - cur.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    cur.yaw += dy * k;
    cur.pitch += (T.pitch - cur.pitch) * k;
    C.seatLook(cur.yaw + extra.yaw, cur.pitch + extra.pitch);
    return cur;
  };
}
// a little handheld drift, so a held shot breathes
export function breathe(t, amt = 0.006) {
  return { yaw: Math.sin(t * 0.9) * amt + Math.sin(t * 2.3) * amt * 0.4, pitch: Math.sin(t * 1.3) * amt * 0.6 };
}
// hide what the shot shouldn't have in it: the subtitle and hints are the page's, never in the frame anyway
export function hold(on = true) { window.__botPaused = on; }
