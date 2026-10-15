// Pieces every night uses: clocking in at the depot, getting on the bus,
// and ending the shift at Northgate.
// Story rule for voices: every line in g.say / g.think / g.choose must be a
// plain "double-quoted" string, so tools/extract-lines.mjs can find it.
import * as THREE from "three";
import { route, STOPS, CURB } from "../world/route.js";

export const KIND_ENOUGH = 7;

// a point on the sidewalk at a stop; `back` moves it along the road (negative = behind)
export function curb(name, back = 0, side = CURB - 1.6) {
  return route.at(STOPS[name] + back, side, 0);
}
export function mysteryCurb(g, back = 0, side = CURB - 1.6) {
  return route.at(g.props.mystery.d + back, side, 0);
}

let doorTrigger = null;
function busDoor(g) {
  if (!doorTrigger) {
    doorTrigger = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    doorTrigger.position.set(-1.7, 1.2, 4.6);
    g.bus.group.add(doorTrigger);
  }
  return doorTrigger;
}

// walk from the dispatch office, punch the clock, get on the bus
export async function clockIn(g, notice = null) {
  g.hint("Clock in at the time clock");
  await g.interact(g.props.depot.clock, "Clock in");
  g.sfx("punch");
  await g.wait(400);
  if (notice) {
    g.hint("Read the notice board");
    await g.interact(g.props.depot.board, "Read notice");
    for (const line of notice) await g.think(line);
  }
  g.hint("Get on the bus");
  await g.interact(busDoor(g), "Get on");
  await g.fade(1, 400);
  g.sitInBus();
  await g.wait(200);
  g.fade(0, 900);
}

export async function closeDoorsAndGo(g) {
  await g.doors(false);
  g.hint("Drive  ·  W gas  ·  S brake  ·  look around with the mouse");
  await g.departed();
  g.hint(null);
}

// make sure the doors are open at a stop (the player has to do it)
export async function openUp(g, timeoutMs = 20000) {
  if (g.bus.doorsOpen) return true;
  return g.doors(true, timeoutMs);
}

export async function endShift(g) {
  await g.pressKey("KeyE", "End your shift  [E]");
  g.sfx("punch");
  await g.fade(1, 1400);
}

// Rhee's end-of-night line about lateness
export async function rheeLateness(g) {
  const late = g.lateTonight;
  if (late <= 0) await g.say("rhee", "On time, driver. That's what I like to see.");
  else if (late <= 3) await g.say("rhee", "A few minutes late tonight. Don't make it a habit.");
  else await g.say("rhee", "You were late tonight, driver. Very late. People notice.");
}
