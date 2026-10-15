// NIGHT 4 — "Channel 9 is still broadcasting."
// Kindness: brake at the bridge (+1), keep Daniel's present safe (+1)
import * as THREE from "three";
import { STOPS, route, LANE } from "../world/route.js";
import { makeGift } from "../world/depotProps.js";
import { curb, mysteryCurb, clockIn, closeDoorsAndGo, openUp, endShift, rheeLateness } from "./common.js";

export async function night4(g) {
  const f = g.flags;
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  g.mood("uneasy");
  g.amb({ rain: 0.2 });
  await g.wait(800);
  await clockIn(g);
  await g.think("The back row is empty tonight. Just a dark stain on the seat that never dries.");

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

  // ---------- Elm & 4th: Mara, and the sun visor
  if (f.maraHelped) g.spawn("mara", "mara", { at: curb("Elm & 4th", 1), yaw: route.heading(STOPS["Elm & 4th"]) + Math.PI / 2 });
  let stopped = await g.arrive("Elm & 4th");
  if (f.maraHelped && stopped && (await openUp(g))) {
    await g.actor("mara").walk([doorOutside()], { speed: 1.2 });
    await g.say("mara", "I'm not riding. I'm walking in. It's Mr. Varga. They think it's tonight. Maybe tomorrow.");
    if (f.visitedVarga) {
      await g.say("mara", "He woke up for about a minute after you left. He said, give this to the driver.");
      await g.think("A brass name badge. The pin's bent. The letters are worn soft by a thumb. T. Varga. Route 9.");
      f.hasBadge = true;
    } else {
      await g.say("mara", "He keeps saying fourteen. Just the number. Over and over.");
    }
    await g.say("mara", "I'll be with him. He won't be alone. I promise.");
    g.actor("mara").walk([curb("Elm & 4th", 40)], { speed: 1.2 });
  }
  // the clipping happens while the bus is parked (if you drove past Elm, the bus stops itself)
  if (g.drive.moving) {
    g.auto(5, g.d + 30);
    await g.until(() => g.drive.speed < 0.3, 15000);
    await g.think("The bus coughed and rolled to a stop on its own. The engine's still running.");
  }
  g.park();
  await g.wait(1500);
  await g.think("A streetlight glare, right in my eyes.");
  g.hint("Pull down the sun visor");
  await g.interact(g.bus.interactables[2], "Pull down the visor");
  g.visor(true);
  g.bus.setClipping(false);
  g.sfx("click");
  await g.think("Something fell out of the visor into my lap. A newspaper clipping, folded small. Someone kept it a long time.");
  const read = await g.choose(["[Read it]", "[Put it back]"]);
  if (read === 0) {
    f.rheeTruth = true;
    g.mood("dread");
    await g.read({
      kind: "clipping", kicker: "The Harbor Ledger · March 1994", title: "Inquiry: dispatcher ordered bus onto bridge",
      lines: [
        "Route 9 driver Teodor Varga radioed dispatch at 12:19 a.m., asking permission to wait out the storm at Northgate.",
        "Dispatcher Harold Rhee refused. Recordings show Rhee told Varga, eleven minutes behind schedule, to make up the time by taking the Ashgrove bridge.",
        "\"The schedule always comes first,\" Rhee said. \"That's the job.\"",
      ],
      photo: "THE 14 VICTIMS",
      scrawl: "stop stop stop stop stop stop",
    }, [
      "Inquiry. Dispatcher ordered bus onto bridge.",
      "Route 9 driver Teodor Varga radioed dispatch at twelve nineteen, asking permission to wait out the storm at Northgate.",
      "Dispatcher Harold Rhee refused. Recordings show Rhee told Varga, eleven minutes behind schedule, to make up the time by taking the Ashgrove bridge.",
      "Asked if he regretted the order, Rhee said: the schedule always comes first. That's the job.",
      "There's a photo of the victims. Fourteen faces. A woman in a cardigan, holding a little kid on her hip.",
      "The kid is me.",
      "Under the article, in shaky pencil, one word, over and over, until the paper tore. Stop. Stop. Stop. Stop.",
    ]);
    await g.say("rhee", "Put that away, driver. Teodor kept that for thirty years. Look where it got him.");
  }
  g.visor(false);
  g.release();
  await closeDoorsAndGo(g);

  // ---------- Market St
  const junOk = f.junRode || f.junFound;
  if (junOk) g.spawn("jun", "jun", { at: curb("Market St", 1), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  stopped = await g.arrive("Market St");
  if (junOk && stopped && (await openUp(g))) {
    f.junNamed = true;
    await g.actor("jun").walk([doorOutside()], { speed: 1.2 });
    await g.say("jun", "From my mom. Soup. She says you look like you don't eat.");
    await g.say("jun", "Don't go past Market tonight. Please. I had a dream. The bus was in the river, and you were driving, and all the windows were full of faces.");
    await g.say("jun", "Just. If something tells you to go faster? Don't.");
    g.actor("jun").walk([curb("Market St", 3)], { speed: 1 });
  } else if (stopped) {
    await g.think("The posters are gone. Washed off, or torn down. There's a soaked backpack on the bench nobody's claimed.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- the stop with no name: they get on
  const md = g.mysteryAhead();   // never behind you
  await g.until(() => g.d > md - 90);
  g.despawn("jun");
  g.despawn("mara");
  g.auto(7, md);
  await g.until(() => g.drive.speed < 0.3, 25000);
  g.lockDoors(true);
  g.setDoors(true);
  g.rain(true);
  const walkers = [["lena", "lena", "L0"], ["daniel", "daniel", "L1"], ["ivy", "ivy", "R0"], ["d0", "drowned", "L2"]];
  for (const [key, look, seat] of walkers) {
    g.spawn(key, look, { ghost: true, at: mysteryCurb(g, 0, 6.6), yaw: route.heading(md) + Math.PI / 2 });
  }
  await g.think("The doors opened by themselves. This time they don't wait for me. They're getting on.");
  for (const [key, , seat] of walkers) g.board(key, seat, 1.6);
  await g.wait(6000);
  for (let i = 1; i <= 10; i++) {
    const seat = ["L3", "R3", "L4", "R4", "L5", "R5", "L6", "B0", "B1", "B2"][i - 1];
    g.spawn(`d${i}`, "drowned", { ghost: true });
    g.seat(`d${i}`, seat);
  }
  g.setDoors(false);
  g.sfx("drip");
  g.mood("dread");
  await g.think("Fourteen. They don't pay. They don't look at me. They sit, and they drip.");
  g.bus.setWater(0.1);
  await g.wait(1500);
  g.bus.setWater(0.25);
  await g.think("Water. Around my shoes. Rising.");
  g.sfx("breath");
  await g.think("Someone sat down right behind me. I can feel cold coming off her, like an open freezer.");
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
  g.auto(14);
  g.shake(1);
  await g.think("The pedal is going down by itself.");
  await g.wait(2500);
  await bridge(g);
  g.lockDoors(false);
  g.rain(false);
}

// the bus drives itself onto the broken Ashgrove bridge
async function bridge(g) {
  const f = g.flags;
  const B = g.places.bridge;
  const bus = g.bus.group;
  await g.fade(1, 500);
  g.drive.detach(true);
  B.group.visible = true;
  g.sky("void");
  bus.position.copy(B.start);
  bus.rotation.set(0, 0, 0);
  let speed = 11;
  await g.fade(0, 700);
  await g.think("The street's gone. The buildings are gone. The road is getting narrower.");
  // under the last good streetlight: the shadow, pointing the way onto the bridge
  g.shadeAt(new THREE.Vector3(B.origin + 4.1, 0.05, 170), "point", new THREE.Vector3(B.origin + 4.1, 0, 500));
  await g.say("rhee", "Faster. FASTER. The schedule always comes first.");
  g.sfx("heartbeat", 10, 120);
  const edgeZ = B.edge;
  const pointing = (async () => {
    await g.until(() => bus.position.z > 112, 30000);
    await g.think("Under the last streetlight. The shadow. It's pointing at the bridge.");
    await g.until(() => bus.position.z > 178, 30000);
    g.shadeHide();
  })();
  // roll toward the edge; slow to a crawl near it so there's time to choose
  const roll = (until) => g.frames((dt) => {
    const left = until - bus.position.z;
    const want = left > 60 ? speed : Math.max(1.2, left * 0.1);
    bus.position.z += want * dt;
    return bus.position.z >= until;
  });
  await roll(edgeZ - 40);
  const options = ["[Stand on the brake]", "[Floor it. Do what he says]"];
  if (f.rheeTruth) options.splice(1, 0, "“You said that to him too.” [Brake, and don't let go]");
  const rolling = roll(edgeZ - 6);
  await pointing;
  const c = await g.choose(options, { silent: true });
  const obey = c === options.length - 1;
  if (!obey) {
    f.brakedN4 = true;
    g.kind();
    if (c === 1 && f.rheeTruth) {
      f.defiedRhee = true;
      await g.say("you", "You said that to him too.");
    }
    g.sfx("brake");
    g.shake(2);
    await g.frames((dt) => true);
    speed = 0;
    await g.wait(1200);
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
    await rolling;
    speed = 16;
    await g.say("rhee", "GOOD. GOOD DRIVER.");
    await g.say("lena", "No. No, no, no. Not you too.");
    await g.frames((dt) => {
      bus.position.z += speed * dt;
      if (bus.position.z > edgeZ) {
        bus.position.y -= dt * 9;
        bus.rotation.x = Math.min(0.5, bus.rotation.x + dt * 0.6);
      }
      return bus.position.y < -5;
    });
    g.sfx("splash");
    await g.scare("face");
    g.interior("off");
    g.bus.setWater(1);
    g.amb({ water: 1, engine: 0 });
    g.sfx("heartbeat", 4, 40);
    await g.wait(3000);
    f.obeyedN4 = true;
  }
  // wake up outside St. Agnes
  await g.fade(1, 900);
  B.group.visible = false;
  g.sky("night");
  g.despawnAll();
  g.bus.setWater(0);
  g.interior("on");
  g.amb({ water: 0, engine: 0.3 });
  g.drive.detach(false);
  g.drive.d = STOPS["St. Agnes"] - 2;
  g.park();                      // parked until this scene is over
  await g.fade(0, 1200);
  g.mood("uneasy");
  if (f.obeyedN4) {
    await g.think("I'm parked outside St. Agnes. The bus is bone dry. My clothes are soaked through. I can taste the river.");
    await g.say("rhee", "That's how it's done. You'll do it properly next time.");
  } else {
    await g.think("I'm parked outside St. Agnes. The bus is dry. The engine ticks as it cools.");
    const gift = makeGift();
    gift.position.set(0.3, 1.43, 5.45);
    gift.rotation.y = 0.3;
    g.bus.group.add(gift);
    g.look(gift.getWorldPosition(new THREE.Vector3()));
    await g.wait(900);
    await g.read({ kind: "note", kicker: "the gift tag", lines: ["For Rosie.", "Love, Dad. x"], scrawl: "she waits at Elm and 4th. she doesn't know why." }, [
      "There's a little box on the dashboard, wrapped in soggy paper with balloons on it. For Rosie. Love, Dad.",
      "Underneath, newer, in shaky handwriting: she waits at Elm and Fourth. She doesn't know why.",
    ]);
    const keep = await g.choose(["[Keep it safe. Find her]", "[Leave it. Not my problem]"]);
    if (keep === 0) { f.keptPresent = true; g.kind(); gift.removeFromParent(); }
    f.hasPresent = true;
  }
  await g.think("Up on the fourth floor, the window of four B is lit. Dimmer now. The thin figure is holding up one finger.");
  await g.think("One more night.");
  g.release();
  await closeDoorsAndGo(g);

  // ---------- the long way to Northgate: Dana breaks through, and something rides in the back
  await g.wait(5000);
  g.sfx("static", 1.4);
  await g.wait(800);
  await g.say("dana", "Route 9, if you can hear this, it's Dana. Don't answer. Just listen.");
  await g.say("dana", "I pulled Harold Rhee's file. After the inquiry he never went home. He slept in the dispatch office.");
  await g.say("dana", "Every night at twelve nineteen he read out the Route 9 stops on channel 9. To nobody. Elm and Fourth. Market. St. Agnes. Canal Row. Northgate. Ashgrove.");
  await g.say("dana", "The night he died, he got as far as Ashgrove and stopped. Like he couldn't say what came after.");
  g.sfx("static", 0.8);
  await g.say("rhee", "That's enough, Dana.");
  g.mood("dread");
  await g.wait(2500);
  await g.think("Someone's standing at the back of the bus. I can see them in the mirror.");
  await g.shadeCreep();
  await g.think("Nobody. Nothing. But the air back here smells like a struck match.");
  await g.say("rhee", "Eyes front, driver. You've got a schedule to keep.");
  g.mood("uneasy");

  // the rest of the run, then Northgate
  await g.arrive("Northgate");
  await openUp(g, 25000);
  g.sfx("static", 0.6);
  await g.say("dana", "Route 9! Route 9, come in. Your bus went dark for six minutes. GPS put you in the middle of the river. Are you okay?");
  await g.say("you", "I'm okay. I think.");
  await g.say("dana", "Listen to me. Whatever you're hearing on channel 9, it isn't us. Nobody's been on that channel since");
  g.sfx("static", 1);
  await g.say("rhee", "Since me.");
  await rheeLateness(g);
  await g.say("rhee", "Tomorrow's the last run, driver. The stop is coming to you.");
  g.route("NEXT: ???", true);
  g.sfx("whisper");
  await g.think("The stop with no name is right after Elm and Fourth now. Tomorrow, it'll be waiting.");
  await endShift(g);
}
