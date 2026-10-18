// NIGHT 4 — "Channel 9 is still broadcasting."
// Kindness: brake at the bridge (+1), keep Daniel's present safe (+1)
import * as THREE from "three";
import { STOPS, route, LANE, CURB } from "../world/route.js";
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
  // they're waiting under the shelter, close together, out of the rain that's only falling there
  const walkers = [["lena", "lena", "L0"], ["daniel", "daniel", "L1"], ["ivy", "ivy", "R0"], ["d0", "drowned", "L2"], ["d11", "drowned", f.carmenRode ? "L3" : "R1"], ["d12", "drowned", "R2"]];
  const under = [[-1.2, 6.9], [0.3, 7.5], [-0.3, 6.7], [1.3, 7.1], [-1.9, 7.6], [0.9, 6.6]];
  walkers.forEach(([key, look], i) => g.spawn(key, look, { ghost: true, at: mysteryCurb(g, under[i][0], under[i][1]), yaw: route.heading(md) + Math.PI / 2 + (Math.random() - 0.5) * 0.5 }));
  await g.autoStop(md);
  g.lockDoors(true);
  g.setDoors(true);
  g.rain(true);
  await g.think("The doors opened by themselves. This time they don't wait for me. They're getting on.");
  // the others are already sitting in the back. Nobody saw them get on.
  // (Carmen, if she's aboard, is one of them: one fewer already sitting there)
  const already = f.carmenRode ? ["R3", "L4", "R4", "L5", "R5", "L6", "B0"] : ["L3", "R3", "L4", "R4", "L5", "R5", "L6", "B0"];
  const theirLooks = ["eddie", "dorothy", "frank", "drowned", "marcus", "drowned", "drowned", f.carmenRode ? "drowned" : "carmen"];
  already.forEach((seat, i) => { g.spawn(`d${i + 1}`, theirLooks[i], { ghost: true }); g.seat(`d${i + 1}`, seat); });
  // one at a time, out from under the shelter and up the steps, each one waiting for the one ahead
  const boarding = [];
  for (const [key, , seat] of walkers) {
    boarding.push(g.board(key, seat, 1.3));
    await g.wait(2100);
  }
  await Promise.all(boarding);
  g.setDoors(false);
  g.sfx("drip");
  g.mood("dread");
  if (f.carmenRode) await g.think("The little girl in the yellow raincoat sat down in front of her mother. Her mother put a hand on her hood, and kept it there.");
  await g.think("Fourteen. They don't pay. They don't look at me. They sit, and they drip.");
  g.bus.setWater(0.1);
  await g.wait(1500);
  g.bus.setWater(0.25);
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
  let speed = 13;
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
  // full speed down the road; only the last stretch before the choice slows to a crawl
  const roll = (until, slowFrom, minSpeed) => g.frames((dt) => {
    const left = until - bus.position.z;
    const want = left > slowFrom ? speed : Math.max(minSpeed, speed * (left / slowFrom));
    bus.position.z += want * dt;
    g.drive.state.speed = want;               // the dash shows what the bus is really doing
    return bus.position.z >= until;
  });
  await roll(edgeZ - 40, 45, 3);
  const options = ["[Stand on the brake]", "[Floor it. Do what he says]"];
  if (f.rheeTruth) options.splice(1, 0, "“You said that to him too.” [Brake, and don't let go]");
  const rolling = roll(edgeZ - 6, 34, 1.2);
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
  await g.say("dana", "Route 9! Route 9, come in. Your bus went dark for six minutes. GPS put you in the middle of the river. Are you okay?");
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

// Over the edge, into the river. The glass cracks, the water comes in through everything, up over the seats, up
// over your head. The lights die. In the dark behind you, all of them are looking at you. And then something comes
// up out of the black, toward the windshield, toward you.
async function sink(g) {
  const bus = g.bus;
  g.shake(2.6);
  g.sfx("crack");
  g.sfx("slam");
  bus.setSmudge(2);
  g.interior("flicker");
  g.amb({ water: 1, engine: 0 });
  g.sfx("gush", 5);
  g.mood("terror");
  let lv = 0.05;
  let under = false;
  const hull = bus.group;
  const rising = g.frames((dt) => {
    lv = Math.min(5.8, lv + dt * (lv < 2 ? 1.1 : 0.8));
    bus.setWater(lv);
    // ...and the bus goes down, nose first, under the river
    hull.position.y = Math.max(-12, hull.position.y - dt * 1.7);
    hull.rotation.x += (0.32 - hull.rotation.x) * Math.min(1, dt * 0.8);
    if (!under && lv > 2.8) { under = true; g.underwater(true); g.sfx("bubbles", 3); }
    return lv >= 5.8;
  });
  await g.think("It's coming in. Through the doors, through the floor. It's so cold. It's so cold.");
  await rising;
  g.interior("off");
  g.sfx("heartbeat", 8, 58);
  await g.wait(1400);
  // behind you, in the last of the light, every one of them has turned to look at you
  for (const k of ["lena", "daniel", "ivy", "d0", "d11", "d12", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"]) g.actor(k)?.watch(g.camera);
  g.look(g.backRow());
  await g.think("They're all looking at me. Every one of them. They're not scared. They've done this before.");
  await g.wait(1200);
  // and out there, in the headlights, in the murk: something coming up toward the glass
  g.look(() => g.bus.group.localToWorld(new THREE.Vector3(0.7, 1.7, 9)));
  await g.wait(1600);
  await g.scare("drift");
  g.bus.setHeadlights(false);
  await g.wait(2600);
  g.bus.setHeadlights(true);
}
