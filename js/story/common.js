// Pieces every night uses: clocking in at the depot, getting on the bus,
// and ending the shift at Northgate.
// Story rule for voices: every line in g.say / g.think / g.choose must be a
// plain "double-quoted" string, so tools/extract-lines.mjs can find it.
import * as THREE from "three";
import { route, STOPS, CURB } from "../world/route.js";

// how kind you have to have been for them to get on at Ashgrove (about half of every chance there is)
export const KIND_ENOUGH = 9;

// a point on the sidewalk at a stop; `back` moves it along the road (negative = behind)
export function curb(name, back = 0, side = CURB - 1.6) {
  return route.at(STOPS[name] + back, side, 0);
}
export function mysteryCurb(g, back = 0, side = CURB - 1.6) {
  return route.at(g.props.mystery.d + back, side, 0);
}
// ...and anywhere along the road
export function curbAt(d, side = CURB - 1.6) {
  return route.at(d, side, 0);
}

// someone at the curb where there's no stop, flagging the bus down (they're already standing there).
// The bus pulls in by itself, like at any stop, and W drives past. True if you stopped with the doors open.
export async function flagStop(g, key, d, thought = null) {
  await g.until(() => g.d > d - 115);
  const p = g.actor(key);
  if (p) p.wave(true);
  const arriving = g.arrive("Flag stop", { at: d });
  if (thought) await g.think(thought);
  const stopped = await arriving;
  if (p) p.wave(false);
  return stopped && (await openUp(g, 15000));
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

// what's pinned on the depot notice board each night
const RHEE_SIG = "- H. Rhee, Night Dispatch";
export const BOARD = {
  1: { kicker: "Metro Transit · Depot 3", title: "Night Route 9", lines: ["Depot to Northgate. First departure 11:40 PM.", "DO NOT RUN LATE.", "NO FREE RIDES.", "DISPATCH IS WATCHING.", RHEE_SIG], scrawl: "stop for them" },
  2: { kicker: "Metro Transit · Depot 3", title: "Notice", lines: ["Depot cameras show NO PASSENGERS boarding Route 9 at the depot.", "Drivers are reminded the logbook is a legal record. Write down what happened, not what you think happened.", RHEE_SIG], scrawl: "stop for them" },
  3: { kicker: "Metro Transit · Depot 3", title: "Storm Warning", lines: ["Heavy rain all night. Flooding reported on Canal Row.", "Drive slow. Keep to the schedule anyway.", "Report anything in the road to dispatch.", RHEE_SIG], scrawl: "they're cold" },
  4: { kicker: "Metro Transit · Depot 3", title: "Ashgrove Bridge", lines: ["The old Ashgrove bridge is CLOSED to all traffic.", "Route 9 does not cross it. Route 9 has never crossed it.", "Do not take the bridge.", RHEE_SIG], scrawl: "he made us" },
  5: { kicker: "Metro Transit · Depot 3", title: "Route 9", lines: ["Final night of Route 9 night service.", "Last bus. Last stop.", "Thank you for your years of service.", "  "], scrawl: "bring them home" },
};

// walk from the dispatch office, punch the clock, get on the bus
export async function clockIn(g, notice = null) {
  const board = BOARD[g.state.night] || BOARD[1];
  g.props.depot.boardObj.setNotice(board);
  g.hint("Clock in at the time clock");
  await g.interact(g.props.depot.clock, "Clock in");
  g.hint(null);
  g.look(g.props.depot.clockObj.slotWorld());
  await g.props.depot.clockObj.punch(() => g.sfx("punch"));
  await g.wait(300);
  if (notice) {
    g.hint("Read the notice board");
    await g.interact(g.props.depot.board, "Read notice");
    g.hint(null);
    await g.read({ kind: "notice", ...board }, notice);
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
  if (g.state.night >= 2) g.dread(true);   // from night 2 on, the bus is never quite empty
}

// make sure the doors are open at a stop (the player has to do it)
export async function openUp(g, timeoutMs = 20000) {
  if (g.bus.doorsOpen) return true;
  return g.doors(true, timeoutMs);
}

export async function endShift(g) {
  await g.pressKey("KeyE", "End your shift  [E]", 30000);
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
