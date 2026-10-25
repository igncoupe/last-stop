// NIGHT 4 — "Channel 9 is still broadcasting."
// Kindness: brake at the bridge (+1), keep Daniel's present safe (+1)
import * as THREE from "three";
import { STOPS, route, LANE, CURB } from "../world/route.js";
import { makeGift } from "../world/depotProps.js";
import { buildApproach, handOverOk } from "../world/approach.js";
import { curb, curbAt, flagStop, mysteryCurb, clockIn, closeDoorsAndGo, openUp, endShift, rheeLateness } from "./common.js";

export async function night4(g) {
  const f = g.flags;
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  g.mood("uneasy");
  g.amb({ rain: 0.2 });
  await g.wait(800);
  await clockIn(g);
  await g.muse("The back row is empty tonight. Just a dark stain on the seat that never dries.");

  // ---------- Channel 4
  g.hint("Turn the radio to channel 4");
  await g.interact(g.bus.radioMesh, "Switch to channel 4");
  g.sfx("click");
  g.radio("CH 4");
  g.sfx("static", 0.8);
  await g.wait(900);
  await g.say("dana", "Route 9? Route 9, is that you? Oh thank god. This is Dana, night dispatch.");
  await g.say("dana", "Where have you been all week? We've had zero contact from your bus. Your GPS keeps dropping out at a spot that isn't on any map.");
  await g.say("you", "I've been checking in every night. With Rhee. Night dispatch.");
  await g.wait(1800);
  await g.say("dana", "Rhee?");
  await g.say("dana", "Harold Rhee was dispatch here in the nineties. He ran Route 9 the night the bridge went down.");
  await g.say("dana", "He died in ninety-five. After the inquiry. They found him in the dispatch office with the radio still on.");
  g.mood("dread");
  g.sfx("static", 0.5);
  await g.say("rhee", "Hello, Dana.");
  await g.say("dana", "Who is th");
  g.sfx("static", 1.2);
  g.radio("CH 9");
  await g.wait(1300);
  await g.say("rhee", "You don't need channel 4, driver. You've got me.");
  const off = await g.choose(["[Turn the radio off]", "[Leave it. Don't make him angry]"]);
  if (off === 0) {
    f.radioOff = true;
    g.sfx("click");
    g.radio("");
    await g.wait(1600);
    await g.say("rhee", "That doesn't work, driver.");
    await g.think("The radio is off. The light is off. His voice is still coming out of it.");
    await g.say("rhee", "It didn't work for Teodor either.");
  }
  await closeDoorsAndGo(g);

  // ---------- a young woman with no coat, waving the bus down. She's looking for someone.
  const carmenAt = 422;
  g.spawn("carmen", "carmen", { at: curbAt(carmenAt), yaw: route.heading(carmenAt) + Math.PI / 2 });
  if (await flagStop(g, "carmen", carmenAt, "A young woman at the curb, waving me down. No coat. She's soaked.")) {
    const stayed = await g.atStop(async (g) => {
      await g.actor("carmen").walk([doorOutside()], { speed: 1.5 });
      await g.say("carmen", "Thank you. I'm sorry. Have you seen a little girl? She's six. A yellow raincoat. She always runs ahead, and I lose her.");
      await g.board("carmen", "R1", 1.4);
      f.carmenRode = true;
      g.kind();
    });
    if (!stayed) g.actor("carmen")?.walk([curbAt(carmenAt)], { speed: 1, parent: g.actor("carmen").scene });
  } else {
    await g.muse("She ran a few steps after the bus. Then she stopped, and stood in the road, looking up and down it.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);
  if (!f.carmenRode) g.despawn("carmen");
  const carmenChat = f.carmenRode ? (async () => {
    await g.wait(1500);
    const opts = f.ivyRode ? ["“She rode up front with me. She rang the bell.”", "“I'm sorry. I haven't.”"] : ["“I'll keep an eye out for her.”", "“I haven't seen anyone.”"];
    const c = await g.choose(opts);
    f.metCarmen = true;
    if (c === 0 && f.ivyRode) await g.say("carmen", "She did? She loves that bell. Mr. Varga lets her ring it at every stop. I'm Carmen. She's Ivy. She's all I've got.");
    else if (c === 0) await g.say("carmen", "Thank you. I'm Carmen. She's Ivy. She's all I've got.");
    else await g.say("carmen", "Okay. Okay. She'll turn up. She always turns up.");
    await g.muse("She sat with her purse on her knees, and looked out of the window at every corner.");
  })() : Promise.resolve();

  // ---------- Elm & 4th: Mara, and the sun visor
  if (f.maraHelped) g.spawn("mara", "mara", { at: curb("Elm & 4th", 1), yaw: route.heading(STOPS["Elm & 4th"]) + Math.PI / 2 });
  let stopped = await g.arrive("Elm & 4th");
  await carmenChat;
  if (f.maraHelped && stopped && (await openUp(g))) {
    const stayed = await g.atStop(async (g) => {
      await g.actor("mara").walk([doorOutside()], { speed: 1.2 });
      await g.say("mara", "I'm not riding. I'm walking in. It's Mr. Varga. They think it's tonight. Maybe tomorrow.");
      if (f.visitedVarga) {
        const give = g.handOver("mara", "badge");
        await g.say("mara", "He woke up for about a minute after you left. He said, give this to the driver.");
        await give;
        await g.think("A brass name badge. The pin's bent. The letters are worn soft by a thumb. T. Varga. Route 9.");
        f.hasBadge = true;
      } else {
        await g.say("mara", "He keeps saying fourteen. Just the number. Over and over.");
      }
      await g.say("mara", "I'll be with him. He won't be alone. I promise.");
      g.actor("mara").walk([g.bus.group.localToWorld(g.bus.boardPath[0].clone()), curb("Elm & 4th", 40)], { speed: 1.2, parent: g.actor("mara").scene });
    });
    if (!stayed && g.actor("mara")) g.actor("mara").walk([curb("Elm & 4th", 40)], { speed: 1.2, parent: g.actor("mara").scene });
  }
  // a block past Elm, the engine dies under you: it coughs, the lights stutter, and the bus coasts to a stop
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);
  await g.until(() => g.d > STOPS["Elm & 4th"] + 120, 40000);
  g.sfx("sputter");
  g.interior("flicker");
  const dying = g.think("The engine's coughing. It's dying under me. The bus is rolling to a stop by itself, in the middle of the block.");
  await g.wait(650);
  g.sfx("sputter");
  g.amb({ engine: 0 });
  g.drive.coast();
  await g.wait(500);
  g.interior("on");
  await g.until(() => g.drive.speed < 0.15, 15000);
  g.park();
  await dying;
  if (f.carmenRode) await g.say("carmen", "It does this. Right here. It did this that night too.");
  await g.wait(1500);
  await g.muse("A streetlight glare, right in my eyes.");
  g.hint("Pull down the sun visor");
  await g.interact(g.bus.interactables[2], "Pull down the visor");
  g.visor(true);
  g.bus.setClipping(false);
  g.sfx("click");
  await g.muse("Something fell out of the visor into my lap. A newspaper clipping, folded small. Someone kept it a long time.");
  const read = await g.choose(["[Read it]", "[Put it back]"]);
  if (read === 0) {
    f.rheeTruth = true;
    g.mood("dread");
    g.paper({
      kind: "clipping", kicker: "The Harbor Ledger · March 1994", title: "Inquiry: dispatcher ordered bus onto bridge",
      lines: [
        "Route 9 driver Teodor Varga radioed dispatch at 12:19 a.m., asking permission to wait out the storm at Northgate.",
        "Dispatcher Harold Rhee refused. Recordings show Rhee told Varga, eleven minutes behind schedule, to make up the time by taking the Ashgrove bridge.",
        "\"The schedule always comes first,\" Rhee said. \"That's the job.\"",
      ],
      photo: "THE 14 VICTIMS",
      scrawl: "stop stop stop stop stop stop",
    });
    await g.wait(500);
    await g.muse("Inquiry. Dispatcher ordered bus onto bridge.");
    await g.muse("Teodor asked to wait out the storm. Rhee told him to make up the time. Take the bridge.");
    await g.think("There's a photo of the victims. Fourteen faces. A woman in a cardigan, holding a little kid on her hip.");
    await g.think("The kid is me.");
    await g.think("Under the article, in shaky pencil, one word, over and over, until the paper tore. Stop. Stop. Stop. Stop.");
    g.paper(null);
    await g.wait(300);
    await g.say("rhee", "Put that away, driver. Teodor kept that for thirty years. Look where it got him.");
  }
  g.visor(false);
  // and it starts again, first try, like nothing happened
  g.sfx("ignition");
  await g.wait(1500);
  g.amb({ engine: 0.3 });
  g.release();
  await closeDoorsAndGo(g);

  // ---------- Market St
  const junOk = f.junRode || f.junFound;
  if (junOk) g.spawn("jun", "jun", { at: curb("Market St", 1), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  else g.prop("backpack", { stop: "Market St", at: [-0.55, 0.62, 0.7] });       // on the bench, nobody's
  stopped = await g.arrive("Market St");
  if (junOk && stopped && (await openUp(g))) {
    const stayed = await g.atStop(async (g) => {
      f.junNamed = true;
      await g.actor("jun").walk([doorOutside()], { speed: 1.2 });
      const give = g.handOver("jun", "soup");
      await g.say("jun", "From my mom. Soup. She says you look like you don't eat.");
      await give;
      await g.say("jun", "Don't go past Market tonight. Please. I had a dream. The bus was in the river, and you were driving, and all the windows were full of faces.");
      await g.say("jun", "Just. If something tells you to go faster? Don't.");
      g.actor("jun").walk([g.bus.group.localToWorld(g.bus.boardPath[0].clone()), curb("Market St", 3)], { speed: 1, parent: g.actor("jun").scene });
    });
    if (!stayed && g.actor("jun")) g.actor("jun").walk([curb("Market St", 3)], { speed: 1, parent: g.actor("jun").scene });
  } else if (stopped) {
    await g.muse("The posters are gone. Washed off, or torn down. There's a soaked backpack on the bench nobody's claimed.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- the stop with no name: they get on
  const md = g.mysteryAhead();   // never behind you
  await g.until(() => g.d > md - 90);
  g.despawn("jun");
  g.despawn("mara");
  // All fourteen are already there as you pull in: some under the shelter, close together, out of the rain that's
  // only falling there, the rest along the curb behind it in the dark, standing in the rain. (Carmen, if she's aboard
  // already, is one of the fourteen: one fewer waiting.) Who, how they look, where they'll sit, and where they're
  // standing [along the road from the stop, out from the middle of it], in the order they'll queue.
  const more = f.carmenRode ? ["R3", "L4", "R4", "L5", "R5", "L6", "B0"] : ["L3", "R3", "L4", "R4", "L5", "R5", "L6", "B0"];
  const moreLooks = ["eddie", "dorothy", "frank", "drowned", "marcus", "drowned", "drowned", "carmen"];
  const moreAt = [[-3.3, 6.1], [-4.5, 7.3], [-5.6, 5.9], [-6.8, 7.0], [-8.0, 6.2], [-9.1, 7.4], [-10.3, 6.0], [-11.4, 7.1]];
  const waiting = [
    ["d0", "drowned", "L2", [1.2, 6.5]], ["d12", "drowned", "R2", [0.4, 6.8]], ["daniel", "daniel", "L1", [-0.4, 6.5]],
    ["ivy", "ivy", "R0", [-1.2, 6.4]], ["d11", "drowned", f.carmenRode ? "L3" : "R1", [-2.0, 6.8]],
    ...more.map((seat, i) => [`d${i + 1}`, moreLooks[i], seat, moreAt[i]]),
  ];
  const facing = route.heading(md) + Math.PI / 2;           // facing the road
  waiting.forEach(([key, look, , [back, side]]) => g.spawn(key, look, { ghost: true, at: mysteryCurb(g, back, side), yaw: facing + (Math.random() - 0.5) * 0.5 }));
  // your mother, at the back of the shelter. She'll be the last on.
  g.spawn("lena", "lena", { ghost: true, at: mysteryCurb(g, -0.8, 7.5), yaw: facing });
  await g.autoStop(md);
  g.lockDoors(true);
  g.setDoors(true);
  g.rain(true);
  const opened = g.think("The doors opened by themselves. This time they don't wait for me. They're getting on.");
  await getOn(g, waiting.map(([key, , seat]) => ({ key, seat })), { key: "lena", seat: "L0" });
  await opened;
  g.setDoors(false);
  g.sfx("drip");
  g.mood("dread");
  if (f.carmenRode) await g.think("The little girl in the yellow raincoat sat down in front of her mother. Her mother put a hand on her hood, and kept it there.");
  // the water, from the moment the doors shut: a film on the floor, then around your shoes, and it keeps coming
  // (from here on the river has the bus)
  riseWater(g, 0.3, 10);
  await g.think("Fourteen. They don't pay. They don't look at me. They sit, and they drip.");
  await g.think("Water. Around my shoes. Rising.");
  g.sfx("breath");
  await g.think("Someone sat down right behind me. I can feel cold coming off her, like an open freezer.");
  g.actor("lena")?.watch(g.camera);              // she's looking right at you
  await g.say("lena", "You grew up.");
  await g.wait(1500);
  await g.think("Mom.");
  g.hint("Turn around");
  await g.until(() => g.lookingAtActor("lena", 30), 10000);
  g.hint(null);
  await g.say("lena", "Don't look at me, sweetheart. Look at the road. He's going to make you drive.");
  await g.say("rhee", "There we go. Full bus. Just like the old days.");
  await g.say("rhee", "You're eleven minutes late, driver.");
  await g.think("I'm not. The clock says I'm not.");
  await g.say("rhee", "MAKE UP THE TIME.");
  g.mood("terror");
  g.auto(RUNAWAY);
  g.shake(1);
  const brakes = deadBrakes(g);
  const road = toTheBridge(g, md);
  await g.think("The pedal's going down by itself. No. No, no, no. Shit.");
  await bridge(g, road, brakes);
  g.lockDoors(false);
  g.rain(false);
}

// From MAKE UP THE TIME to the bridge, the bus drives itself, at one speed, all the way: m/s
const RUNAWAY = 12;

// ...and the brakes are gone. Stand on the pedal and it goes to the floor with nothing behind it; you hear it, and
// nothing happens. (Until off(): the choice at the end of the bridge is the brake that works.)
function deadBrakes(g) {
  let on = true;
  g.frames(() => {
    if (!on) return true;
    if (g.keyHit("KeyS") || g.keyHit("ArrowDown") || g.keyHit("Space")) { g.sfx("brakefail"); g.shake(0.3); }
    return false;
  });
  return { off() { on = false; } };
}

// The last night's road out to the bridge: no cut, no fade, the bus driving itself the whole way. The streetlights go
// out ahead of it, one after another; the fog comes down, and the city goes into it, until there's only the street in
// the headlights. Somewhere in there, on a straight with nothing in sight, the street becomes a copy of itself laid
// down at the bridge (approach.js), and the bus drives on: the sidewalks end, the road goes dark and narrow, bends
// round to the left, and runs out onto the bridge road as the fog lifts off the river. Resolves, once it's there,
// with the bridge's own motion (and cleanUp, for when it's all over).
async function toTheBridge(g, md) {
  const B = g.places.bridge;
  const bus = g.bus.group;
  const city = g.city;
  const eye = () => g.camera.getWorldPosition(new THREE.Vector3());
  const stops = [...Object.values(STOPS), md];
  g.holdTraffic(600);
  g.sky("fogwall", 7);
  // the streetlights, out one at a time as you come up on them (and the ones you've passed, the same)
  const lamps = g.streetlights.filter((l) => l.d > g.d - 90).sort((a, b) => a.d - b.d);
  let lampT = 0;
  let d = null;
  let waited = 0;
  await g.frames((dt) => {
    waited += dt;
    lampT -= dt;
    const next = lamps.find((l) => !l.out && l.d < g.d + 70);
    if (next && lampT <= 0) {
      g.lampOut(next, true);
      if (next.pos.distanceTo(eye()) < 45) g.sfxAt("lightsout", next.pos, { gain: 0.35, range: 60 });
      lampT = 0.3;
    }
    // and everything farther off than you can see is gone, for good
    city.dissolve(eye(), 2.6 / g.fogDensity);
    // (and if the road never gives it a place, and it's running out of road, it goes in the dark: see below)
    if (waited > 30 || g.d > route.length - 160) return true;
    if (g.fogDensity < 0.085 || g.carsOnRoad || lamps.some((l) => !l.out && Math.abs(l.d - g.d) < 60)) return false;
    if (!handOverOk(g.d, stops)) return false;
    d = g.d;
    return true;
  });
  // (the way it used to go: a moment of black, and it's there)
  const blind = d === null;
  if (blind) {
    await g.fade(1, 500);
    d = g.d;
  }
  // ---- the hand-over: in the same moment, the street at the bridge, and the bus on it
  const ap = buildApproach(city, B, d);
  B.group.parent.add(ap.group);
  g.drive.detach(true);
  B.group.visible = true;
  B.wreckage.visible = true;
  const turn = -Math.PI / 2 - route.heading(d);
  bus.position.applyMatrix4(ap.toBridge);
  bus.rotation.y += turn;
  // ---- and on, at the same speed, along its way to the bridge road
  let s = blind ? ap.path.bendFrom - 40 : 0;
  if (blind) g.fade(0, 700);
  let roll = 0;
  let said = false, lifting = false;
  const tmp = new THREE.Vector3();
  await g.frames((dt) => {
    s = Math.min(ap.path.length, s + RUNAWAY * dt);
    const { pos, heading } = ap.path.at(s, tmp);
    const ahead = ap.path.at(Math.min(ap.path.length, s + 6)).heading;
    const turning = Math.atan2(Math.sin(ahead - heading), Math.cos(ahead - heading));
    roll += (THREE.MathUtils.clamp(turning * RUNAWAY * 0.02, -0.04, 0.04) - roll) * Math.min(1, dt * 3);
    bus.position.set(pos.x, 0, pos.z);
    bus.rotation.set(0, heading, roll, "YXZ");
    g.drive.state.speed = RUNAWAY;
    g.drive.state.steer = turning;
    // the bits of the city that came along go into the fog behind you, and stay gone
    const e = eye(), far = 2.6 / g.fogDensity;
    for (const sc of ap.scenery) if (sc.o.visible && sc.c.distanceTo(e) - sc.r > far) sc.o.visible = false;
    if (!said && s > ap.path.bendFrom - 50) { said = true; g.think("The street's gone. The buildings are gone. The road is getting narrower."); }
    // round the bend, the fog lifts off the river, and there's the bridge
    if (!lifting && s > ap.path.bendFrom + 15) { lifting = true; g.sky("void", 9); }
    return s >= ap.path.length;
  });
  // on the bridge road now: straight on, the same speed, onto the bridge
  bus.position.set(B.start.x, 0, 0);
  bus.rotation.set(0, 0, 0);
  g.drive.state.steer = 0;
  const motion = bridgeMotion(g, { speed: RUNAWAY, stopZ: B.edge - 6 });
  motion.cleanUp = () => {
    ap.dispose();
    city.dissolve(null);
    city.clearOuts();
  };
  return motion;
}

// the bus drives itself onto the broken Ashgrove bridge (road: toTheBridge, on its way there; brakes: deadBrakes)
async function bridge(g, road, brakes) {
  const f = g.flags;
  const B = g.places.bridge;
  const bus = g.bus.group;
  const edgeZ = B.edge;
  // it never stopped: it's on the bridge road, doing what it's been doing all along
  const motion = await road;
  // the storm, out over the river: in every flash, the bridge ahead, and where it just stops
  let storming = true;
  (async () => {
    await g.wait(2600);
    while (storming) {
      g.flash();
      await g.wait(3000 + Math.random() * 2400);
    }
  })();
  // under the last good streetlight: the shadow, pointing the way onto the bridge
  g.shadeAt(new THREE.Vector3(B.origin + 4.1, 0.05, 170), "point", new THREE.Vector3(B.origin + 4.1, 0, 500));
  await g.say("rhee", "Faster. FASTER. The schedule always comes first.");
  g.sfx("heartbeat", 10, 120);
  const pointing = (async () => {
    await g.until(() => bus.position.z > 112, 30000);
    await g.think("Under the last streetlight. The shadow. It's pointing at the bridge.");
    await g.until(() => bus.position.z > 178, 30000);
    g.shadeHide();
  })();
  // full speed down the road; the last stretch of deck it eases down toward a crawl, so there's time to choose
  await g.until(() => bus.position.z >= edgeZ - 40, 40000);
  const options = ["[Stand on the brake]", "[Floor it. Do what he says]"];
  if (f.rheeTruth) options.splice(1, 0, "“You said that to him too.” [Brake, and don't let go]");
  await pointing;
  brakes.off();
  const c = await g.choose(options, { silent: true });
  storming = false;
  const obey = c === options.length - 1;
  if (!obey) {
    f.brakedN4 = true;
    g.kind();
    // the brakes go on the moment you choose; on the wet deck it slides, and stops on the very last slab
    motion.brake();
    g.sfx("brake");
    g.shake(2);
    if (c === 1 && f.rheeTruth) {
      f.defiedRhee = true;
      await g.say("you", "You said that to him too.");
    }
    await g.until(() => motion.stopped, 15000);
    await g.wait(450);
    g.flash();                                     // and in the flash: the drop, right under the front wheels
    await g.wait(500);
    g.mood("dread");
    await g.think("It stopped. The front wheels are on the last slab of the bridge. Under me there's nothing. Just the river, waiting.");
    g.sfx("whisper");
    await g.say("voices", "He stopped. He stopped this time.");
    await g.think("Behind me, fourteen people let out a breath they've been holding for thirty years.");
    await g.say("lena", "That's my kid. That's my kid.");
    g.hint("Look in the mirror");
    await g.until(() => g.lookingAtMirror(), 12000);
    g.hint(null);
    await g.scare("face", { look: "drownedman", sound: "mirror_drowned" });
  } else {
    // the pedal goes to the floor from whatever the bus is doing: no pause, no lurch, it just goes. (They say their
    // piece on the way over; nobody waits for anybody.)
    motion.floor();
    (async () => {
      await g.say("rhee", "GOOD. GOOD DRIVER.");
      await g.say("lena", "No. No, no, no. Not you too.");
    })();
    await plunge(g, edgeZ, motion.speed);
    await sink(g);
    f.obeyedN4 = true;
  }
  // wake up outside St. Agnes
  await g.fade(1, 900);
  g.underwater(false);
  B.group.visible = false;
  motion.cleanUp();              // (the road out there gone, the city back as it was)
  g.sky("night");
  g.despawnAll();
  g.bus.setWater(0);
  g.bus.setSmudge(0);
  g.interior("on");
  g.amb({ water: 0, engine: 0.3 });
  g.drive.detach(false);
  g.drive.d = STOPS["St. Agnes"] - 2;
  g.park();                      // parked until this scene is over
  await g.fade(0, 1200);
  g.mood("uneasy");
  let gift = null;
  if (f.obeyedN4) {
    await g.think("I'm parked outside St. Agnes. The bus is bone dry. My clothes are soaked through. I can taste the river.");
    await g.think("And the seats are empty. All fourteen of them. Like nobody was ever there.");
    await g.say("rhee", "That's how it's done. You'll do it properly next time.");
  } else {
    await g.think("I'm parked outside St. Agnes. The bus is dry. The engine ticks as it cools.");
    await g.think("The seats are empty. All of them. They stopped, and then they were just gone.");
    gift = makeGift();
    gift.position.set(0.3, 1.43, 5.45);
    gift.rotation.y = 0.3;
    g.bus.group.add(gift);
  }
  await g.peekWindow("finger", "Up on the fourth floor, the window of four B is lit. Dimmer now. The thin figure is holding up one finger.", { dim: true });
  await g.think("One more night.");
  g.release();
  await closeDoorsAndGo(g);
  // a little way on: the present on the dash
  if (gift) {
    await g.wait(2500);
    g.look(gift.getWorldPosition(new THREE.Vector3()));
    g.paper({ kind: "note", kicker: "the gift tag", lines: ["For Rosie.", "Love, Dad. x"], scrawl: "she waits at Elm and 4th. she doesn't know why." });
    await g.wait(500);
    await g.muse("There's a little box on the dashboard, wrapped in soggy paper with balloons on it. For Rosie. Love, Dad.");
    await g.think("Underneath, newer, in shaky handwriting: she waits at Elm and Fourth. She doesn't know why.");
    g.paper(null);
    const keep = await g.choose(["[Keep it safe. Find her]", "[Leave it. Not my problem]"]);
    if (keep === 0) { f.keptPresent = true; g.kind(); gift.removeFromParent(); }
    f.hasPresent = true;
  }

  // ---------- the long way to Northgate: Dana breaks through, and something rides in the back
  await g.wait(1500);
  g.sfx("static", 1.4);
  await g.wait(600);
  await g.say("dana", "Route 9, if you can hear this, it's Dana. Don't answer. Just listen.");
  await g.say("dana", "I pulled Harold Rhee's file. After the inquiry he never went home. He slept in the dispatch office.");
  await g.say("dana", "Every night at twelve nineteen he read out the Route 9 stops on channel 9. To nobody. Elm and Fourth. Market. St. Agnes. Canal Row. Northgate. Ashgrove.");
  await g.say("dana", "The night he died, he got as far as Ashgrove and stopped. Like he couldn't say what came after.");
  g.sfx("static", 0.8);
  await g.say("rhee", "That's enough, Dana.");
  g.mood("dread");
  // (only with enough road left: Northgate's doors are never waiting on this)
  if (g.d < STOPS["Northgate"] - 650) {
    await g.wait(2000);
    await g.think("Someone's standing at the back of the bus. I can see them in the mirror.");
    await g.shadeCreep();
    await g.muse("Nobody. Nothing. But the air back here smells like a struck match.");
    await g.say("rhee", "Eyes front, driver. You've got a schedule to keep.");
  }
  g.mood("uneasy");

  // ---------- out in the empty lots, the payphones ring as the bus goes by
  await payphones(g);

  // the rest of the run, then Northgate
  await g.arrive("Northgate");
  await openUp(g, 25000);
  g.sfx("static", 0.6);
  await g.say("dana", "Route 9! Route 9, come in. Jesus Christ. Your bus went dark for six minutes. GPS put you in the middle of the river. Are you okay?");
  await g.say("you", "I'm okay. I think.");
  await g.say("dana", "Listen to me. Whatever you're hearing on channel 9, it isn't us. Nobody's been on that channel since");
  g.sfx("static", 1);
  await g.say("rhee", "Since me.");
  await rheeLateness(g);
  await g.say("rhee", "Tomorrow's the last run, driver. The stop is coming to you.");
  g.route("NEXT: ???", true);
  g.sfx("whisper");
  await g.muse("The stop with no name is right after Elm and Fourth now. Tomorrow, it'll be waiting.");
  await endShift(g);
}

// three payphones on the corners of empty lots, a block apart. Each one starts ringing as the bus comes up
// to it, and stops when it's gone by. After the third, they all stop at once.
async function payphones(g) {
  const first = Math.max(2088, g.d + 80);
  if (first > 2300) return;                          // not enough road left before Northgate
  const at = [first, first + 96, first + 192].filter((d) => d < 2400);
  const phones = at.map((d) => g.prop("payphone", { at: route.at(d, CURB - 1.3, 0), yaw: route.heading(d) - Math.PI / 2 }));
  const ringing = (i) => g.d > at[i] - 110;          // (and it keeps on, behind you, until they all stop)
  // Each one rings the way a real one does: a ring, four seconds' quiet, another ring, from the moment you come in
  // earshot of it. The bell is out there in its lot (louder as you come up on it, heard through the bus); a ring
  // never starts on top of the last one, and when it's over they all stop dead.
  const bellAt = phones.map((ph) => ph.localToWorld(new THREE.Vector3(0, 1.5, 0.3)));
  const rings = [];
  const next = phones.map(() => 0);
  let done = false;
  const bells = g.frames((dt) => {
    phones.forEach((_, i) => {
      next[i] -= dt;
      if (!ringing(i) || next[i] > 0) return;
      next[i] = 6;
      if (rings[i]) rings[i].stop(0.05);
      rings[i] = g.ring(bellAt[i]);
    });
    return done;
  });
  await g.until(() => g.d > at[0] - 80, 30000);
  g.mood("dread");
  await g.think("A payphone's ringing. Out here, in the empty lots. Nobody's lived out here in years.");
  if (at[1]) {
    await g.until(() => g.d > at[1] - 80, 30000);
    await g.muse("Another one. Ringing as I go by. Like it's handing me on to the next.");
  }
  if (at[2]) {
    await g.until(() => g.d > at[2] - 80, 30000);
    await g.say("rhee", "You should pick up, driver. It's for you.");
  }
  await g.until(() => g.d > at[at.length - 1] + 14, 30000);
  done = true;
  rings.forEach((r) => r && r.stop(0.04));
  await bells;
  await g.think("And then they all stopped. At the same time.");
  g.mood("uneasy");
}

// Off the end of the bridge, the way a twelve-ton bus really goes: the pedal floored from whatever speed it was doing
// (v0), the front
// wheels dropping off the deck and the frame grinding over the broken edge, then, once its weight is past the edge,
// the whole bus tipping over it nose first and falling, still moving forward. It hits the river nose-first and hard
// (spray thrown up and ahead, a ring of foam), the back slaps down, and it floats for a moment, nose low, rocking,
// before the water takes it.
async function plunge(g, edge, v0 = 0) {
  const B = g.places.bridge;
  const bus = g.bus.group;
  const water = B.waterY;
  const FRONT_AXLE = 3.9, REAR = -6.15, NOSE = 6.2, K2 = 13;       // bus space; K2: how hard it is to tip (radius of gyration²)
  let z = bus.position.z, y = 0, p = 0, vz = v0, vy = 0, w = 0, t = 0;
  let phase = "drive";
  let hitT = 0, slapped = false;
  const fwd = new THREE.Vector3(0, 0, 1);
  g.sfx("ignition");
  g.shake(0.9);
  // (in small fixed steps: the same fall at any frame rate)
  const step = (dt) => {
    t += dt;
    const y0 = y;
    if (phase === "drive" || phase === "scrape") {
      vz = Math.min(10, vz + dt * 4.2);                             // floored: it pulls, hard
      if (phase === "scrape") vz *= 1 - dt * 0.15;
      z += vz * dt;
      if (phase === "drive" && z + FRONT_AXLE > edge) {
        phase = "scrape";                                           // the front wheels go: the frame lands on the edge
        g.sfx("scrape", 1.1);
        g.sfx("bang");
        g.shake(1.2);
      }
      if (phase === "scrape") {
        // the nose sags as more of it hangs out over nothing; the frame rides on the edge
        const sag = 0.07 * Math.min(1, (z + FRONT_AXLE - edge) / 1.5);
        p += (sag - p) * Math.min(1, dt * 10);
        y = (edge - z) * Math.tan(p);
      }
      if (z > edge) phase = "tip";
    } else if (phase === "tip") {
      // its weight is past the edge: it pivots over the concrete, nose going down faster and faster
      w += (9.81 * (z - edge) / K2) * Math.cos(p) * dt;
      p += w * dt;
      z += vz * dt;
      y = (edge - z) * Math.tan(p);                                // the floor stays on the edge as it turns
      if (z + REAR * Math.cos(p) > edge) {                          // the back end clears it: falling free
        phase = "fall";
        vy = (y - y0) / Math.max(dt, 1e-3);
      }
    } else if (phase === "fall") {
      vy -= 9.81 * dt;
      y += vy * dt;
      z += vz * dt;
      w *= 1 - dt * 0.1;
      p += w * dt;
    }
    if (phase === "tip" || phase === "fall") {
      // (a slow roll off a high deck can put the nose in the river before the back has left the bridge)
      const noseY = y + 0.3 * Math.cos(p) - NOSE * Math.sin(p);
      if (noseY <= water) {
        if (phase === "tip") vy = (y - y0) / Math.max(dt, 1e-3);
        // in, nose first
        phase = "water";
        hitT = t;
        const at = new THREE.Vector3(bus.position.x, water, z + NOSE * Math.cos(p));
        B.splash.burst(at, { power: Math.min(1.3, 0.55 + Math.hypot(vz, vy) / 14), dir: fwd });
        g.sfx("plunge");
        g.sfx("slam");
        g.shake(2.8);
        vz *= 0.35;
        vy *= 0.3;
        w *= 1.3;                                                   // the nose digs in
      }
    } else if (phase === "water") {
      // in the water: it bobs up to float, nose low, rocks back, and slows to a stop
      const floatY = water - 1.05;
      vy += ((floatY - y) * 7 - vy * 2.4) * dt;
      y += vy * dt;
      vz *= Math.max(0, 1 - dt * 2.2);
      z += vz * dt;
      w += ((0.3 - p) * 4.5 - w * 2.2) * dt;
      p += w * dt;
      if (!slapped && w < -0.2) {                                   // the back comes down hard
        slapped = true;
        B.splash.burst(new THREE.Vector3(bus.position.x, water, z + REAR * Math.cos(p) * 0.8), { power: 0.45, dir: fwd.clone().negate(), spread: 0.8 });
        g.sfx("splash");
      }
    }
  };
  await g.frames((frameDt) => {
    for (let left = frameDt; left > 1e-9; left -= 1 / 120) step(Math.min(left, 1 / 120));
    bus.position.y = y;
    bus.position.z = z;
    bus.rotation.x = p;
    bus.rotation.z = phase === "water" ? Math.sin((t - hitT) * 1.7) * 0.025 * Math.exp(-(t - hitT) * 0.5) : 0;
    g.drive.state.speed = vz;
    return phase === "water" && t - hitT > 1.9;
  });
}

// Over the edge, into the river. The glass cracks, the water comes in through everything, up over the seats, up
// over your head. The lights die. The doors won't open. Your air is running out. And when you turn round, they're
// not in their seats any more: they're right behind you, all of them, drifting in the aisle, their faces at yours.
// Your mother's closest. She reaches for you. Then she comes for you, the last of the way, and they all come with
// her, and there's nothing.
async function sink(g) {
  const bus = g.bus;
  g.shake(1.4);
  g.sfx("crack");                                             // the windshield gives under the water's weight
  bus.setSmudge(2);
  g.interior("flicker");
  g.amb({ water: 1, engine: 0 });
  g.sfx("gush", 5);
  g.mood("terror");
  g.drive.state.speed = 0;
  // the emergency lamp up over the windshield: soon the only thing lighting their faces (off for now; it's added
  // here, in the crash, so the moment it comes on doesn't stutter)
  const lamp = new THREE.PointLight(0x8fd6c4, 0, 8, 2);
  lamp.position.set(0.35, 2.25, 5.6);
  bus.group.add(lamp);
  let lv = Math.max(0.05, bus.water);                         // it's been coming in since they got on
  let under = false;
  let sinkV = 0;
  const hull = bus.group;
  const rising = g.frames((dt) => {
    lv = Math.min(5.8, lv + dt * (lv < 2 ? 1.1 : 0.8));
    bus.setWater(lv);
    // ...and the bus goes down, nose first, under the river: slowly at first, then faster as it fills
    sinkV = Math.min(1.6, sinkV + dt * 0.55);
    hull.position.y = Math.max(-12, hull.position.y - dt * sinkV);
    hull.rotation.x += (0.34 - hull.rotation.x) * Math.min(1, dt * 0.5);
    hull.rotation.z *= 1 - Math.min(1, dt * 0.8);
    if (!under && lv > 2.8) { under = true; g.underwater(true); g.sfx("bubbles", 3); }
    return lv >= 5.8;
  });
  await g.think("Oh shit. Oh shit. It's coming in. Through the doors, through the floor. It's so cold.");
  await rising;
  // the lights go. Just the emergency light now, and the hull groaning
  g.interior("flicker");
  g.sfx("groan", 4);
  await g.wait(700);
  g.interior("dim");
  g.sfx("heartbeat", 18, 118);
  g.drowning(true);
  // the doors: you hit the button, again and again. Nothing.
  g.look(() => bus.group.localToWorld(new THREE.Vector3(-1.1, 1.3, 4.8)));
  g.hint("Open the doors  [F]");
  let tries = 0;
  let gaveUp = false;
  g.frames(() => {
    if (g.keyHit("KeyF")) { tries++; g.sfx("click"); g.sfx("bang"); g.shake(0.9); g.sfx("bubbles", 0.6); }
    return tries >= 3 || gaveUp;
  });
  await g.until(() => tries >= 3, 5000);
  gaveUp = true;
  g.hint(null);
  await g.think("Come on. Come on! They won't open. Fuck! I can't get out.");
  // all of them, out of their seats. Floating in the aisle and over the seats behind you, filling the bus back
  // into the dark, every face turned to yours. Your mother nearest, reaching for you.
  const order = ["lena", "carmen", "daniel", "d0", "d11", "ivy", "d12", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"];
  // bus space: x, z, and how high their face is (yours is at 1.75, right in front of the windshield at z 4.8)
  const spots = [[0.25, 3.1, 1.74], [-0.2, 3.3, 1.62], [0.0, 2.45, 1.86], [0.8, 2.95, 2.0], [-0.74, 2.9, 1.9],
    [0.3, 1.85, 1.5], [0.82, 2.15, 2.06], [-0.8, 2.1, 1.96], [-0.2, 1.3, 1.92], [0.9, 1.35, 2.08], [-0.9, 1.25, 2.0],
    [0.15, 0.55, 1.84], [0.9, 0.45, 2.04], [-0.9, 0.4, 1.96], [-0.05, -0.35, 1.9], [0.5, -1.0, 1.95]];
  const v = new THREE.Vector3();
  const eye = bus.group.worldToLocal(g.camera.getWorldPosition(new THREE.Vector3()));
  const floating = order.map((k) => g.actor(k)).filter(Boolean).map((p, i) => {
    p.stand();
    bus.group.attach(p.root);
    const [x, z, face] = spots[i] || [(Math.random() - 0.5) * 1.6, -1.2 - i * 0.3, 1.9];
    // limp: knees bent, legs hanging, arms lifted and drifting, leaning toward you
    const lean = i === 0 ? 0.08 : 0.1 + Math.random() * 0.14;
    p.root.rotation.set(lean, 0, 0);
    p.hips.forEach((h) => { h.rotation.x = -0.3 + Math.random() * 0.35; });
    p.knees.forEach((n) => { n.rotation.x = 0.35 + Math.random() * 0.5; });
    const arms = p.arms.map((a, j) => {
      const r = [-0.45 - Math.random() * 0.5, (j ? -1 : 1) * (0.3 + Math.random() * 0.35)];
      a.rotation.set(r[0], 0, r[1]);
      return r;
    });
    // how high to float them so the face ends up where it should (the little ones lower down)
    p.root.position.set(x, 0, z);
    p.root.updateMatrixWorld(true);
    const headY = bus.group.worldToLocal(p.head.getWorldPosition(v)).y;
    const base = (p.look.child ? Math.min(face, 1.5) : face) - headY;
    p.root.position.y = base;
    p.watch(g.camera);
    p.slack(true);
    // when they come for you, they come straight at your eyes (so wherever they are on screen, they just get
    // bigger). Your mother comes right up to your face; the rest close in behind her, never nearer than 3/4 m.
    p.root.updateMatrixWorld(true);
    const toEye = eye.clone().sub(bus.group.worldToLocal(p.head.getWorldPosition(v)));
    const len = toEye.length();
    const most = i === 0 ? Math.max(0, 1 - 0.42 / len) : Math.max(0, Math.min(0.45, 1 - 0.75 / len));
    return { p, from: p.root.position.clone(), toEye, len, most, arms, k: Math.random() * 6 };
  });
  const mom = g.actor("lena");
  if (mom) mom.reachOut(true);                       // reaching for you
  let t = 0;
  let closer = 0;
  let sinking = true;
  const drift = g.frames((dt) => {
    t += dt;
    // the lamp follows the bus's lights: steady-ish when it's dim, stuttering, or dead
    const mode = bus.interiorMode;
    lamp.intensity = mode === "dim" ? (Math.random() < 0.04 ? 0.6 : 3.2) : mode === "flicker" ? (Math.random() < 0.5 ? 0.4 : 3.2) : 0;
    for (const f of floating) {
      const r = f.p.root;
      r.position.copy(f.from).addScaledVector(f.toEye, f.most * closer);
      if (f.lunge) r.position.addScaledVector(f.lunge.by, f.lunge.e);
      r.position.y += Math.sin(t * 0.9 + f.k) * 0.05;
      r.position.z += Math.sin(t * 0.6 + f.k) * 0.03;
      r.rotation.z = Math.sin(t * 0.7 + f.k) * 0.06;
      f.p.arms.forEach((a, j) => {
        if (j === 1 && f.p.reaching) return;
        a.rotation.x = f.arms[j][0] + Math.sin(t * 0.8 + f.k + j) * 0.12;
        a.rotation.z = f.arms[j][1] + Math.sin(t * 0.5 + f.k * 2 + j) * 0.08;
      });
    }
    return !sinking;
  });
  const behind = () => bus.group.localToWorld(new THREE.Vector3(0.3, 1.75, 3.2));
  const facing = () => g.lookingBack() || g.gazing(behind(), 32);
  g.sfx("knock", 2);                                 // something behind your seat
  await g.wait(900);
  g.hint("Turn around");
  await g.until(facing, 8000);
  if (!facing()) { g.look(behind); await g.until(facing, 3000); }   // you turn round anyway
  g.hint(null);
  g.sfx("sting");
  g.sfx("moan", 7);
  g.shake(0.8);
  await g.wait(1500);
  await g.think("Mom.");
  await g.wait(500);
  // the emergency light dies. In the dark there's just their eyes, all of them, coming closer.
  // When the light comes back, they're right there.
  const blackout = async (to, ms) => {
    g.interior("off");
    g.sfx("lightsout");
    g.sfx("bubbles", ms / 1000);
    floating.forEach((f) => f.p.eyeshine(true));
    const from = closer;
    let e = 0;
    await g.frames((dt) => { e = Math.min(1, e + dt * 1000 / ms); closer = from + (to - from) * e * e; return e >= 1; });
    floating.forEach((f) => f.p.eyeshine(false));
    g.interior("dim");
    g.sfx("click");
  };
  await blackout(0.5, 1300);
  await g.say("voices", "Stay with us.");
  await g.wait(400);
  await blackout(1, 800);
  await g.wait(250);
  // and then she's on you: your mother comes the last of the way, mouth open, right into your face, and all of them
  // surge in behind her. Their own faces, coming the way they've been coming, never a stranger's popping out of
  // nowhere.
  g.scareHit({ scream: 1.7, shake: 2.6, sound: "underwater_scream", close: true });
  {
    // she comes to right in front of your face, whichever way you're looking (her face a hand's width from yours);
    // the rest come in behind her
    const mom = floating.find((f) => f.p === g.actor("lena"));
    if (mom) {
      const eyeW = g.camera.getWorldPosition(new THREE.Vector3());
      const want = bus.group.worldToLocal(eyeW.addScaledVector(g.camera.getWorldDirection(new THREE.Vector3()), 0.3));
      // (less the bit the surge below carries her anyway)
      const by = want.sub(bus.group.worldToLocal(mom.p.head.getWorldPosition(new THREE.Vector3()))).addScaledVector(mom.toEye, -mom.most * 0.25);
      mom.lunge = { by, e: 0 };
    }
    const from = closer;
    let e = 0;
    await g.frames((dt) => {
      e = Math.min(1, e + dt / 0.2);
      const k = 1 - Math.pow(1 - e, 3);
      closer = from + 0.25 * k;
      if (mom) mom.lunge.e = k;
      return e >= 1;
    });
    await g.wait(140);
  }
  // and then there's nothing at all
  sinking = false;
  await drift;
  g.fade(1, 60);
  g.silence(true);
  g.drowning(false);
  await g.wait(200);
  lamp.removeFromParent();
  await g.wait(1600);
  g.silence(false);
  g.sfx("gasp");
}

// Everyone waiting gets on the way people do: they come out to the curb and make a line along the bus, in the order
// they're standing, shuffle up each time the one in front climbs aboard, and nobody starts up the steps until the
// one before is already on them. `last` stays where they are until everyone else is on, then gets on too.
// Resolves when they're all sitting down.
async function getOn(g, riders, last) {
  const bus = g.bus.group;
  const SPACE = 0.85;                                   // between people in the line
  const GAP = 1.1;                                      // at least this long between one starting up and the next
  const slot = (i) => mysteryCurb(g, -SPACE * i, 5.3);  // the front of the line is just behind the door
  // joining it, they come up alongside, a little out from the line, and step into their place: never brushing past
  // the people already standing in it
  const beside = (i) => mysteryCurb(g, -SPACE * i, 5.95);
  const out = beside(0).sub(slot(0)).normalize();
  const offLine = (p) => p.root.getWorldPosition(new THREE.Vector3()).sub(slot(0)).dot(out);   // how far out from it
  const path = (r, i) => (offLine(r.p) > 0.35 ? [beside(i), slot(i)] : [slot(i)]);
  const ahead = mysteryCurb(g, 1, 5.3).sub(mysteryCurb(g, 0, 5.3));
  const faceDoor = Math.atan2(ahead.x, ahead.z);
  // they don't all move at once: the front of the line first, then each one after, so the line builds back from
  // the door as they come
  const line = riders.map((r, i) => ({ ...r, p: g.actor(r.key), state: "waiting", at: -1, go: 0.3 + i * 0.3, pace: 0.9 + Math.random() * 0.3 }));
  const seated = [];
  let t = 0, lastGo = -GAP, prev = null, lastGone = false;
  const aboard = (p) => p.root.parent === bus;          // board() hands them to the bus at the bottom step
  await g.frames((dt) => {
    t += dt;
    const queue = line.filter((r) => r.state !== "boarding");
    queue.forEach((r, i) => {
      if (r.state === "waiting") {
        if (t < r.go) return;
        r.state = "walking";
        r.at = i;
        r.p.walk(path(r, i), { speed: r.pace });
        return;
      }
      if (r.state === "walking" && r.p.mode !== "walk") r.state = "inline";
      if (r.at !== i) {                                 // the line has moved up, and so do they
        const inLine = r.state === "inline";
        r.at = i;
        r.state = "walking";
        r.p.walk(inLine ? [slot(i)] : path(r, i), { speed: inLine ? 0.95 : r.pace });
      }
      if (r.state === "inline") {                       // standing in line, turned toward the door
        let d = faceDoor - r.p.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        r.p.root.rotation.y += d * Math.min(1, dt * 3);
      }
    });
    const front = queue[0];
    if (front && front.state === "inline" && front.at === 0 && t - lastGo >= GAP && (!prev || aboard(prev.p))) {
      front.state = "boarding";
      lastGo = t;
      prev = front;
      seated.push(g.board(front.key, front.seat, 1.2));
    }
    if (!front && last && !lastGone && prev && aboard(prev.p) && t - lastGo >= GAP) {
      lastGone = true;
      seated.push(g.board(last.key, last.seat, 1.05));
    }
    return !front && (!last || lastGone);
  });
  await Promise.all(seated);
}

// The water in the bus comes up to `to` over `seconds`, steadily: eased, so it starts as a film, comes on, and slows.
// It only ever rises (if something has it higher already, that wins).
function riseWater(g, to, seconds) {
  const from = g.bus.water;
  let t = 0;
  return g.frames((dt) => {
    t = Math.min(seconds, t + dt);
    const k = t / seconds;
    g.bus.setWater(Math.max(g.bus.water, from + (to - from) * k * k * (3 - 2 * k)));
    return t >= seconds;
  });
}

// The bus on the bridge has one driver, this, from the moment the bridge appears until it has stopped or gone over.
// It holds its speed, eases off over the last stretch of deck so there's time to choose (and stops on the last slab
// if you never do), and then does what you chose from whatever speed it's doing: brake() slides it to a stop on the
// last slab; floor() hands it straight to the plunge, which pulls away from that same speed. Small fixed steps, so
// it moves the same at any frame rate; the speed only ever changes smoothly, never by a jump.
function bridgeMotion(g, { speed, stopZ }) {
  const bus = g.bus.group;
  const CRUISE = speed, CRAWL = 1.2, EASE = 1.2, ACCEL = 2.5, DECEL = 3.5, STEP = 1 / 120;
  const m = { speed, mode: "drive", stopped: false };
  m.brake = () => {
    m.mode = "brake";
    m.decel = (m.speed * m.speed) / (2 * Math.max(0.25, stopZ - bus.position.z));
  };
  m.floor = () => { m.mode = "floor"; };
  g.drive.state.speed = speed;
  g.frames((dt) => {
    if (m.mode === "floor") return true;                // the plunge has it from here
    for (let left = dt; left > 1e-9; left -= STEP) {
      const h = Math.min(left, STEP);
      const z = bus.position.z;
      const room = Math.max(0, stopZ - z);
      let v = m.speed;
      if (m.mode === "brake") v = Math.max(0, v - m.decel * h);
      else {
        // as fast as it can go and still ease down to a crawl by the end of the deck (and stop right at the end)
        const want = Math.min(CRUISE, Math.max(Math.sqrt(2 * EASE * room), room > 0.6 ? CRAWL : 0));
        v += THREE.MathUtils.clamp(want - v, -DECEL * h, ACCEL * h);
      }
      let nz = z + (m.speed + v) * 0.5 * h;
      if (nz >= stopZ) { nz = stopZ; v = 0; }
      bus.position.z = nz;
      m.speed = v;
    }
    g.drive.state.speed = m.speed;                      // the dash shows what the bus is really doing
    m.stopped = m.speed === 0;
    return m.mode === "brake" && m.stopped;
  });
  return m;
}
