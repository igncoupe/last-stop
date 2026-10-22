// NIGHT 4 — "Channel 9 is still broadcasting."
// Kindness: brake at the bridge (+1), keep Daniel's present safe (+1)
import * as THREE from "three";
import { STOPS, route, LANE, CURB } from "../world/route.js";
import { bridgeMotion } from "../game/bridgeMotion.js";
import { makeGift } from "../world/depotProps.js";
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
    if (!stayed) g.actor("carmen")?.walk([curbAt(carmenAt)], { speed: 1 });
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
    if (!stayed && g.actor("mara")) g.actor("mara").walk([curb("Elm & 4th", 40)], { speed: 1.2 });
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
    if (!stayed && g.actor("jun")) g.actor("jun").walk([curb("Market St", 3)], { speed: 1 });
  } else if (stopped) {
    await g.muse("The posters are gone. Washed off, or torn down. There's a soaked backpack on the bench nobody's claimed.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- the stop with no name: they get on
  const md = g.mysteryAhead();   // never behind you
  await g.until(() => g.d > md - 90);
  g.despawn("jun");
  g.despawn("mara");
  const walkers = spawnBoardingCrowd(g, md);
  await g.autoStop(md);
  g.lockDoors(true);
  g.setDoors(true);
  g.rain(true);
  const boarding = boardQueue(g, walkers);
  await g.think("The doors opened by themselves. This time they don't wait for me. They're getting on.");
  await boarding;
  g.setDoors(false);
  g.sfx("drip");
  g.mood("dread");
  if (f.carmenRode) await g.think("The little girl in the yellow raincoat sat down in front of her mother. Her mother put a hand on her hood, and kept it there.");
  await g.think("Fourteen. They don't pay. They don't look at me. They sit, and they drip.");
  const risingWater = riseCabinWater(g);
  await g.wait(1500);
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
  await risingWater;
  g.auto(14);
  g.shake(1);
  await g.think("The pedal's going down by itself. No. No, no, no. Shit.");
  await g.wait(2500);
  await bridge(g);
  g.lockDoors(false);
  g.rain(false);
}

function riseCabinWater(g) {
  let waterTime = 0;
  return g.frames((dt) => {
    waterTime = Math.min(5, waterTime + dt);
    const t = waterTime / 5;
    g.bus.setWater(0.25 * t * t * (3 - 2 * t));
    return t >= 1;
  });
}

function spawnBoardingCrowd(g, md) {
  const f = g.flags;
  // Everyone is present outside before the bus arrives. Carmen, if she rode
  // earlier, is already one of the fourteen; never duplicate or teleport her.
  const walkers = [["lena", "lena", "L0"], ["daniel", "daniel", "L1"], ["ivy", "ivy", "R0"], ["d0", "drowned", "L2"], ["d11", "drowned", f.carmenRode ? "L3" : "R1"], ["d12", "drowned", "R2"]];
  const seats = f.carmenRode ? ["R3", "L4", "R4", "L5", "R5", "L6", "B0"] : ["L3", "R3", "L4", "R4", "L5", "R5", "L6", "B0"];
  const looks = ["eddie", "dorothy", "frank", "drowned", "marcus", "drowned", "drowned", "carmen"];
  seats.forEach((seat, i) => walkers.push([`d${i + 1}`, looks[i], seat]));
  // Along the open curb side of the shelter, clear of its glass and bench.
  walkers.forEach(([key, look], i) => g.spawn(key, look, {
    ghost: true, at: mysteryCurb(g, -i * 1.15, 5.25 + (i % 3) * 0.12),
    yaw: route.heading(md) + Math.PI / 2,
  }));
  return walkers;
}

// A shared route with physical headway: followers can advance while the person
// ahead climbs the steps, but cannot overtake them at the door or in the aisle.
async function boardQueue(g, walkers) {
  const bus = g.bus.group;
  const front = bus.localToWorld(new THREE.Vector3(-3.05, 0, 4.6));
  const outside = bus.localToWorld(g.bus.boardPath[0].clone());
  const entries = walkers.map(([key], i) => ({ p: g.actor(key), done: false, speed: 1.25 + (i % 3) * 0.03 }));
  let finished = false;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const spacing = g.frames((dt) => {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.done || e.p.mode !== "walk") continue;
      let speed = e.speed;
      // Also check seated passengers only while they settle; once seated their
      // window seats are outside the shared walking route.
      for (let j = 0; j < i; j++) {
        if (entries[j].done) continue;
        const distance = e.p.root.getWorldPosition(a).distanceTo(entries[j].p.root.getWorldPosition(b));
        speed = Math.min(speed, Math.max(0, (distance - 1.05) / Math.max(dt, 1e-4)));
      }
      e.p.speed = speed;
    }
    return finished;
  });
  await Promise.all(entries.map(async (e, i) => {
    await e.p.walk([front, outside], { speed: e.speed, parent: e.p.scene });
    await g.board(walkers[i][0], walkers[i][2], e.speed, { smoothSeat: true });
    e.done = true;
  }));
  finished = true;
  await spacing;
}

// the bus drives itself onto the broken Ashgrove bridge
async function bridge(g) {
  const f = g.flags;
  const B = g.places.bridge;
  const bus = g.bus.group;
  await g.fade(1, 500);
  g.drive.detach(true);
  B.group.visible = true;
  B.wreckage.visible = true;
  g.sky("void");
  bus.position.copy(B.start);
  bus.rotation.set(0, 0, 0);
  const edgeZ = B.edge;
  const motion = bridgeMotion(bus.position.z, 13, edgeZ);
  g.drive.state.speed = motion.speed;
  let driving = true;
  const rolling = g.frames((dt) => {
    if (!driving) return true;
    motion.update(dt);
    bus.position.z = motion.z;
    g.drive.state.speed = motion.speed;
    return false;
  });
  await g.fade(0, 700);
  // the storm, out over the river: in every flash, the bridge ahead, and where it just stops
  let storming = true;
  (async () => {
    await g.wait(2600);
    while (storming) {
      g.flash();
      await g.wait(3000 + Math.random() * 2400);
    }
  })();
  await g.think("The street's gone. The buildings are gone. The road is getting narrower.");
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
  await g.until(() => bus.position.z >= edgeZ - 100);
  const options = ["[Stand on the brake]", "[Floor it. Do what he says]"];
  if (f.rheeTruth) options.splice(1, 0, "“You said that to him too.” [Brake, and don't let go]");
  await pointing;
  const c = await g.choose(options, { silent: true });
  storming = false;
  const obey = c === options.length - 1;
  if (!obey) {
    motion.brake();
    g.sfx("brake");
    await g.until(() => motion.speed === 0);
    driving = false;
    await rolling;
    f.brakedN4 = true;
    g.kind();
    if (c === 1 && f.rheeTruth) {
      f.defiedRhee = true;
      await g.say("you", "You said that to him too.");
    }
    g.shake(2);
    await g.wait(700);
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
    await g.faceScare("drowned", 0.5);
  } else {
    // Change the running controller immediately, even while the voices play.
    motion.mode = "floor";
    const response = (async () => {
      await g.say("rhee", "GOOD. GOOD DRIVER.");
      await g.say("lena", "No. No, no, no. Not you too.");
    })();
    await g.until(() => bus.position.z >= edgeZ - 10);
    driving = false;
    // No await between owners: plunge inherits velocity and begins this frame.
    const falling = plunge(g, edgeZ, motion.speed);
    await rolling;
    await falling;
    await response;
    await sink(g);
    f.obeyedN4 = true;
  }
  // wake up outside St. Agnes
  await g.fade(1, 900);
  g.underwater(false);
  B.group.visible = false;
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
  const ringing = (i) => g.d > at[i] - 85 && g.d < at[i] + 12;
  let t = 0;
  let done = false;
  const bells = g.frames((dt) => {
    t -= dt;
    if (t <= 0) {
      t = 3;
      phones.forEach((ph, i) => { if (ringing(i)) g.sfxAt("ring", ph.localToWorld(new THREE.Vector3(0, 1.5, 0.3)), { gain: 0.9, range: 110 }); });
    }
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
  await bells;
  await g.think("And then they all stopped. At the same time.");
  g.mood("uneasy");
}

// Off the end of the bridge, preserving the approach velocity: the front
// wheels dropping off the deck and the frame grinding over the broken edge, then, once its weight is past the edge,
// the whole bus tipping over it nose first and falling, still moving forward. It hits the river nose-first and hard
// (spray thrown up and ahead, a ring of foam), the back slaps down, and it floats for a moment, nose low, rocking,
// before the water takes it.
async function plunge(g, edge, initialSpeed) {
  const B = g.places.bridge;
  const bus = g.bus.group;
  const water = B.waterY;
  const FRONT_AXLE = 3.9, REAR = -6.15, NOSE = 6.2, K2 = 13;       // bus space; K2: how hard it is to tip (radius of gyration²)
  let z = bus.position.z, y = 0, p = 0, vz = initialSpeed, vy = 0, w = 0, t = 0;
  let phase = "drive";
  let hitT = 0, slapped = false;
  const fwd = new THREE.Vector3(0, 0, 1);
  g.sfx("ignition");
  g.shake(0.6);
  await g.frames((dt) => {
    t += dt;
    const y0 = y;
    if (phase === "drive" || phase === "scrape") {
      vz = Math.min(16, vz + dt * 3.6);                              // floored, from a crawl
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
    bus.position.y = y;
    bus.position.z = z;
    bus.rotation.x = p;
    bus.rotation.z = phase === "water" ? Math.sin((t - hitT) * 1.7) * 0.025 * Math.exp(-(t - hitT) * 0.5) : 0;
    g.drive.state.speed = vz;
    return phase === "water" && t - hitT > 1.9;
  });
}

// Over the edge, into the river. The glass cracks, the water comes in through everything, up over the seats, up
// over your head. The lights die. The doors won't open. Your air is running out.
// Their voices stay with you as the cabin fades into darkness.
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
  let lv = 0.25;
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
  // Keep the passengers in their established seats. The old floating crowd
  // teleported them through the cabin and lunged their rigid models at the eye.
  // Preserve the story and voices as an atmospheric drowning sequence.
  const mom = g.actor("lena");
  if (mom) g.look(() => mom.head.getWorldPosition(new THREE.Vector3()));
  await g.think("Mom.");
  g.sfx("groan", 4);
  await g.say("voices", "Stay with us.");
  // and then there's nothing at all
  await g.fade(1, 900);
  g.silence(true);
  g.drowning(false);
  await g.wait(200);
  await g.wait(1600);
  g.silence(false);
  g.sfx("gasp");
}
