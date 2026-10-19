// NIGHT 3 — "A storm is coming in off the river."
// Kindness: comfort Jun (+1), visit Room 4B (+1), let Ivy ride (+1)
import * as THREE from "three";
import { STOPS, route, LANE, roadY } from "../world/route.js";
import { curb, mysteryCurb, clockIn, closeDoorsAndGo, openUp, endShift, rheeLateness, teodorGone } from "./common.js";

export async function night3(g) {
  const f = g.flags;
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  const terminalDoor = () => g.props.terminal.group.localToWorld(new THREE.Vector3(-6, 0, 20));
  g.sky("storm");
  g.storm(true);
  g.flood(true, 0.55);              // the river's over the road at Canal Row, and it's there all night
  g.mood("uneasy");
  await g.wait(1000);
  await g.muse("The rain is so loud on the depot roof it sounds like applause.");
  await clockIn(g);
  g.spawn("teodor", "oldman");
  g.seat("teodor", "B3");
  if (f.gaveJacket) g.prop("jacketHung", { bus: [0.7, 1.46, 4.38] });
  if (f.gaveJacket) await g.think("My jacket is hanging behind the driver's seat. I left it soaked on Canal Row. It's dry now. It smells like the river.");
  await g.muse("He's back there again. He looks worse tonight. Grayer. Like a photo left in the sun.");
  if (g.state.late === 0) await g.say("rhee", "Two perfect nights, driver. Don't spoil it in the rain.");
  else await g.say("rhee", "You're behind this week, driver. In weather like this, drivers make mistakes. Don't.");
  if (g.state.warn > 0) await g.say("rhee", "And I haven't forgotten about the free ride.");
  await closeDoorsAndGo(g);

  // ---------- someone on your tail, leaning on the horn. You let them know what you think of that.
  await g.until(() => g.d > 30, 30000);
  if (g.d < STOPS["Elm & 4th"] - 330) await honker(g);

  // ---------- Elm & 4th
  if (f.maraHelped) g.spawn("mara", "mara", { at: curb("Elm & 4th", 1), yaw: route.heading(STOPS["Elm & 4th"]) + Math.PI / 2 });
  else g.prop("lanyard", { stop: "Elm & 4th", at: [0.8, 1.95, -2.2] });          // hanging off the shelter's front post
  let stopped = await g.arrive("Elm & 4th");
  if (f.maraHelped && stopped && (await openUp(g))) {
    const stayed = await g.atStop(async (g) => {
      await g.board("mara", "L0");
      f.maraAboard = true;
      await g.say("mara", "It's like the sky is falling. Thank you.");
      await g.say("mara", "Can I ask you something, and you don't think I'm crazy? Mr. Varga, in four B. He's getting worse. Tonight or tomorrow, the doctors say.");
      await g.say("mara", "He's stopped asking if Route 9 is running. Now he asks for the driver. The new driver. By name.");
      await g.wait(1300);
      await g.say("mara", "I never told him your name.");
      await g.say("mara", "Would you come up? When we get to St. Agnes? Just for a minute. I think he's waiting for you.");
      const c = await g.choose(["“I'll try.”", "“I don't get breaks on Route 9.”"]);
      f.maraAsked = true;
      if (c === 1) await g.say("mara", "Right. The schedule.");
    });
    if (!stayed) {
      await g.muse("Mara was waiting in the rain. I didn't stop.");
      g.despawn("mara");
    }
  } else if (f.maraHelped) {
    await g.muse("Mara was waiting in the rain. I didn't stop.");
    g.despawn("mara");
  } else if (stopped) {
    await g.muse("Nobody's here. Someone left a nurse's lanyard hanging on the shelter. It's swinging in the wind.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- the windshield fogs up from the inside, and something writes in it
  await g.until(() => g.d > STOPS["Elm & 4th"] + 45, 30000);
  if (g.d < STOPS["Market St"] - 230) {
    g.mood("dread");
    const writing = g.fogWrite("STOP");
    await g.think("The windshield's fogging up. From the inside.");
    await writing;
    g.sfx("breath");
    await g.think("Somebody wrote in it. From the inside. Right in front of my face.");
    if (f.maraAboard) await g.say("mara", "You didn't do that. Your hands are on the wheel. Your hands are on the wheel.");
    await g.say("rhee", "Wipers, driver. You can't see the road like that.");
    g.mood("uneasy");
  }

  // ---------- Market St
  if (f.junRode) g.spawn("jun", "jun", { at: curb("Market St", 1), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  if (f.calledMom) g.spawn("junmom", "junmom", { at: curb("Market St", 2), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  if (!f.junRode && !f.calledMom) {
    g.props.missingPoster.visible = true;
    g.prop("posters", { stop: "Market St", at: [-0.89, 1.42, -0.4] });            // two more, already pulped
  }
  stopped = await g.arrive("Market St");
  if (stopped && (f.junRode || f.calledMom) && (await openUp(g))) {
    const stayed = await g.atStop(async (g) => {
      if (f.junRode) {
        await g.board("jun", "R1");
        f.junAboard = true;
        await g.say("jun", "I almost didn't come. I didn't want to ride tonight. But Mom's working, and the trains are down.");
        await g.say("jun", "Are they real? The people in the back? Please don't tell me I'm crazy.");
        const c = await g.choose(["“They're real. Sit up front with me. You're safe up here.”", "“It's just the storm. Sit down.”"]);
        if (c === 0) {
          f.junComforted = true;
          g.kind();
          g.seat("jun", "R0");
          await g.say("jun", "Okay. Real. That's better than being crazy, actually.");
          await g.say("jun", "They don't look mean. They look sad. Like when you wait for someone at the airport and they never come out.");
        }
      } else {
        f.junFound = true;
        await g.readQuiet({ kind: "poster", kicker: "FOUND SAFE · THANK YOU", title: "Missing", photo: "JUN PARK", lines: ["JUN PARK, 15", "Last seen Market Street, around midnight."] }, [
          "The missing poster has a strip pasted across it. FOUND SAFE.",
        ]);
        await g.board("junmom", "R1");
        g.actor("junmom")?.watch(g.camera);
        await g.say("junmom", "You. You're the driver who called.");
        await g.say("junmom", "The police found him on the road to Northgate. Halfway there, in the dark. He was walking to me.");
        await g.say("junmom", "He's home. He's asleep in his bed right now. Because you called.");
      }
    });
    if (!stayed) {
      g.despawn("jun");
      g.despawn("junmom");
    }
  } else if (stopped) {
    await g.muse("The poster's pulped by the rain. Someone has put up two more.");
    const ghostJun = g.spawn("ghostjun", "jun", { ghost: true, mirrorOnly: true });
    g.seat("ghostjun", "B1");
    g.hint("Check your mirror");
    await g.until(() => g.lookingAtMirror(), 10000);
    g.hint(null);
    g.sfx("whisper");
    await g.think("There's a kid with a huge backpack in the back row.");
    g.hint("Turn around");
    await g.until(() => g.lookingBack(), 8000);
    g.hint(null);
    g.vanish("ghostjun");
    await g.think("Nobody. It was nobody.");
    void ghostJun;
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- the radio plays 1994 the moment you pull away from Market, all the way to St. Agnes (whatever's
  // left of what it does to you, you're still thinking as the bus pulls in at the hospital where she worked)
  const broadcast = (async () => {
    await g.wait(200);
    g.radio("CH 9 ????");
    g.sfx("static", 1.0);
    await g.wait(800);
    await g.say("radio94", "Repeating our top story. At twelve thirty-one this morning, the Ashgrove bridge collapsed during the storm.");
    await g.say("radio94", "A Route 9 city bus was crossing at the time. Divers have recovered fourteen.");
    g.sfx("static", 0.6);
    await g.say("radio94", "The driver, Teodor Varga, fifty-eight, was pulled from the river alive, and is in critical condition at St. Agnes.");
    await g.say("radio94", "Among the dead, a St. Agnes nurse, Lena Marsh, thirty-one, who leaves behind a four-year-old child.", { after: 0 });
    g.sfx("static", 0.4);
    g.radio("CH 9");
    await g.say("rhee", "That's enough of that.");
    f.knowsVarga = true;
    f.knowsMother = true;
    g.mood("grief");
    await g.wait(500);
    await g.think("Lena Marsh.");
    await g.think("My mother's name was Lena Marsh. I was four.");
    if (f.knowsLena) await g.think("The woman in the shelter. Lena. She looked at me like she knew me. Because she did.");
    await g.think("Nobody ever told me how. They just said there was an accident. They just said she wasn't coming home.");
    g.mood("dread");
    // (only while there's road left: St. Agnes never waits on this)
    if (g.d < STOPS["St. Agnes"] - 110) {
      g.hint("Check your mirror");
      await g.until(() => g.lookingAtMirror() || g.d > STOPS["St. Agnes"] - 60, 7000);
      g.hint(null);
      await g.muse("Varga. Teodor Varga. He's looking at the radio. Then at me. He nods. Very slightly.");
    }
  })();

  // ---------- St. Agnes, and Room 4B
  if (f.maraAboard) {
    await g.until(() => g.d > STOPS["St. Agnes"] - 120);
    g.sfx("bell");
  }
  stopped = await g.arrive("St. Agnes");
  await broadcast;
  if (f.maraAboard && stopped && (await openUp(g))) {
    await g.say("mara", "Fourth floor. Room four B. Please.");
    await g.say("rhee", "Driver. You have no scheduled break at St. Agnes.");
    const go = await g.choose(["[Go up to Room 4B]", "[Stay on schedule]"]);
    if (go === 0) {
      f.visitedVarga = true;
      g.kind();
      g.late(6);
      await ward(g);
    } else {
      await g.say("mara", "Okay. Okay. I'll tell him you're coming tomorrow.");
      await g.alight("mara", curb("St. Agnes", 4, 9));
    }
    f.maraAboard = false;
  } else if (stopped) {
    await g.peekWindow("hand", "Up on the fourth floor, a thin figure is pressing one hand against the window glass.");
  }
  // a mailman in the rain, under the shelter, with his bag held against his chest
  if (stopped && (g.bus.doorsOpen || (await openUp(g, 15000)))) {
    g.spawn("frank", "frank", { at: curb("St. Agnes", 3), yaw: route.heading(STOPS["St. Agnes"]) + Math.PI / 2 });
    const stayed = await g.atStop(async (g) => {
      await g.actor("frank").walk([doorOutside()], { speed: 1.4 });
      await g.say("frank", "Room for one more? I'm drowned out here.");
      await g.board("frank", "L1");
      f.frankRode = true;
      f.metFrank = true;
      await g.say("frank", "Frank Doyle. I carry the mail on Route 12. Thirty years, and they still won't give me a damn truck.");
      await g.say("frank", "Found something on your bus, by the way. On the seat right behind you. It's got your name on it.");
      const give = g.handOver("frank", "letter");
      await g.wait(800);
      await give;
      await g.read({ kind: "note", lines: ["To my little one,", "Be good for Grandma. I'm on the last bus.", "I'll be home before you wake up.", "I love you to the moon and back."], scrawl: "- Mom", neat: true }, [
        "It's addressed to me. At my grandmother's house. The postmark says March fourteenth, nineteen ninety-four.",
        "Be good for Grandma. I'm on the last bus. I'll be home before you wake up. I love you to the moon and back. Mom.",
        "I've never seen her handwriting before. I know it's hers.",
      ]);
      f.hasLetter = true;
      await g.say("frank", "Everything gets delivered eventually. That's the job.");
    });
    if (!stayed && !f.frankRode) g.despawn("frank");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- the stop with no name: two blocks past St. Agnes
  const md = g.mysteryAhead();   // never behind you
  const crowd = [];
  for (let i = 0; i < 10; i++) {
    const look = ["drowned", "lena", "daniel", "eddie", "dorothy", "drowned", "drowned", "drowned", "drowned", "drowned"][i];
    crowd.push(g.spawn(`drowned${i}`, look, { ghost: true, at: mysteryCurb(g, -1.8 + (i % 5) * 0.9, 6.4 + Math.floor(i / 5) * 0.6), yaw: route.heading(md) + Math.PI / 2 }));
  }
  const ivy = g.spawn("ivy", "ivy", { ghost: true, at: mysteryCurb(g, 1, 5.6), yaw: route.heading(md) + Math.PI / 2 });
  await g.until(() => g.d > md - 110);
  g.mood("dread");
  await g.autoStop(md);
  g.setDoors(true);
  g.lockDoors(true);
  await g.think("The doors opened by themselves.");
  if (f.frankRode && g.actor("frank")) {
    await g.say("frank", "Well. This is me.");
    await g.alight("frank", mysteryCurb(g, 2.3, 6.9), { vanish: false });
    await g.muse("He walked into the shelter and stood with them, in the rain. Like he'd been there the whole time.");
  }
  g.sfx("knock", 4);
  await g.wait(1500);
  g.sfx("knock", 6);
  g.shake(1.2);
  await g.think("Knocking. Not on the doors. Under the floor. Under my feet. Like people trapped in something, beating on the walls.");
  await g.say("rhee", "CLOSE THE DOORS. Driver, close the goddamn DOORS.");
  await g.say("teodor", "She's in there, you know. Your mother. In the cardigan. She sat right behind me every night.");
  g.actor("drowned1")?.watch(g.camera);
  g.hint("Look at the shelter");
  await g.until(() => g.lookingAtActor("drowned1", 25), 12000);
  g.hint(null);
  await g.think("She's looking right at me. She's soaking wet. She's younger than I am now.");
  await ivy.walk([doorOutside()], { speed: 0.8 });
  await g.say("ivy", "Is it time yet?");
  await g.say("teodor", "Not tonight, Ivy. Soon. I promise. Soon.");
  await g.say("ivy", "Can I sit up front? Mister Teodor always let me ring the bell.");
  const c = await g.choose(["“Just for a minute. Go ahead.”", "[Close the doors]"]);
  g.lockDoors(false);
  if (c === 0) {
    f.ivyRode = true;
    g.kind();
    g.mood("grief");
    await g.board("ivy", "R0", 0.8);
    await g.wait(1200);
    g.sfx("bell");
    await g.say("ivy", "That's my stop. That's always my stop.");
    await g.wait(1200);
    g.vanish("ivy");
    g.prop("button", { seat: "R0" });
    await g.think("She's gone. The seat is soaking wet. There's a tiny yellow button on it.");
    await g.say("rhee", "You'll regret that, driver.");
    g.setDoors(false);
  } else {
    g.setDoors(false);
    g.mood("terror");
    await g.wait(1600);
    g.bus.setHands("windows");
    await g.scare("hands");
    g.sfx("bang");
    g.sfx("knock", 8);
    g.shake(1.6);
    await g.think("Hands. On every window of the bus. Gray. Wrinkled. Pressing.");
    await g.say("rhee", "Good. Good driver.");
    g.interior("flicker");
    g.sfx("lightsout");
    await g.wait(350);
    g.bus.setHands(null);
    g.interior("on");
    await g.think("I don't feel like a good driver.");
    g.vanish("ivy");
  }
  crowd.forEach((_, i) => g.vanish(`drowned${i}`));
  g.vanish("frank");
  g.release();
  await g.think("And the shelter's empty. All of them, gone. Like the rain took them back.");
  g.hint("Drive  ·  W gas");
  await g.departed();
  g.hint(null);

  g.dread(true);

  // ---------- Canal Row is a river (only if it's still ahead of you)
  if (g.d < 1690) {
    g.amb({ water: 0.9 });
    await g.until(() => g.d > 1700);
    await g.muse("Canal Row is a river now. The water's up to the second step.");
    await g.wait(3000);
    await g.think("In the lightning, there are faces under the water. Looking up.");
    await g.until(() => g.d > 1915);
    g.amb({ water: 0 });
  }

  // ---------- in the lightning: something in the road, closer every flash
  await g.wait(3500);
  await g.muse("Every time the lightning goes, the whole road lights up for a second.");
  for (const ahead of [85, 55, 32]) {
    await g.wait(1400 + Math.random() * 900);
    await g.shadeFlash(ahead);
    if (ahead === 85) await g.think("There's something standing in the road.");
  }
  // the next flashes show an empty road. It's gone. You stop looking for it.
  for (let i = 0; i < 2; i++) {
    await g.wait(1600 + Math.random() * 1400);
    g.flash();
  }
  await g.wait(2500 + Math.random() * 4000);
  await g.until(() => g.drive.speed > 3, 8000);
  await g.shadeWindow({ hold: 1700 });
  g.mood("terror");
  if (f.junAboard) await g.say("jun", "Oh shit! It's on the glass! It's ON the glass!");
  await g.think("Oh, hell no. It's back. The thing from the first night. Spread across the glass like it's trying to get in.");
  g.shadeHide();
  await g.muse("Then the lights went, and it was gone. Only the handprints stayed. The rain won't wash them off.");
  g.release();
  await g.say("rhee", "Keep driving, driver. You don't stop for weather.");
  g.dread(false);
  g.mood("uneasy");

  // ---------- Northgate
  await g.arrive("Northgate");
  await openUp(g, 25000);
  if (f.junAboard) {
    await g.say("jun", f.junComforted ? "See you tomorrow." : "Night. Be careful, okay?");
    g.spawn("junmom", "junmom", { at: terminalDoor() });
    await g.alight("jun", terminalDoor());
  }
  if (f.junFound) {
    g.actor("junmom")?.watch(g.camera);
    await g.say("junmom", "This is me. Jun wants to meet you, you know. The driver who called. He thinks you're some kind of hero.");
    await g.alight("junmom", terminalDoor());
  }
  await teodorGone(g, "He's gone again. Just the coin rolling, and a wet seat. He looked so tired tonight.");
  await rheeLateness(g);
  await g.muse("There's a sheet of paper under my windshield wiper.");
  await g.readQuiet({ kind: "notice", kicker: "Metro Transit · Radio", title: "Notice", lines: ["Route 9 radio moves to CHANNEL 4 starting tomorrow.", "Channel 9 has been OUT OF SERVICE since 1994.", "If you hear anything on channel 9, do not answer it.", "- Dana, Night Dispatch"] }, [
    "Notice. Route 9 radio moves to channel 4 starting tomorrow. Channel 9 has been out of service since nineteen ninety-four. Dana, night dispatch.",
  ]);
  await g.say("rhee", "Ignore that.");
  await g.muse("The stop with no name moved again. It's right after Market Street now.");
  g.storm(false);
  await endShift(g);
}

// upstairs at St. Agnes: walk to Room 4B
async function ward(g) {
  const H = g.places.hospital;
  await g.fade(1, 900);
  // up on 4 West. The rain stays outside, on the windows; no lightning in here
  g.storm(false);
  g.rain(true);
  g.sky("ward");
  g.amb({ rain: 0.25, engine: 0, hum: 1 });
  g.mood("grief");
  H.setActive(true);
  g.walkAt(H.spawn, H.spawnYaw, H.colliders);
  g.despawn("mara");
  const mara = g.spawn("mara", "mara", { at: H.maraStart, yaw: H.spawnYaw + Math.PI });
  const lying = g.spawn("teodor4b", "patient");
  H.layInBed(lying);
  // and down in the street, on the bus: the old man has moved to the back seat on this side. He's looking up.
  if (g.actor("teodor")) {
    g.seat("teodor", "B0");
    g.actor("teodor").lookAt(H.win.getWorldPosition(new THREE.Vector3()));
  }
  await g.fade(0, 1000);
  mara.walk(H.maraPath, { speed: 1.2 });
  await g.say("mara", "This way. Fourth floor smells like bleach and old flowers. You stop noticing.");
  g.hint("Go to Room 4B");
  g.navTo(H.navPoint);
  await g.until(() => g.camera.getWorldPosition(new THREE.Vector3()).distanceTo(H.roomPos) < 3.4);
  g.navTo(null);
  g.hint(null);
  g.sfx("heartbeat", 6, 52);
  await g.think("It's him. The old man from the back row. Same hands. Same wet-looking eyes. Tubes in his arm.");
  await g.say("mara", "He hasn't moved in three days.");
  g.hint("Look out the window");
  await g.until(() => g.gazing(H.win.getWorldPosition(new THREE.Vector3()), 14), 20000);
  g.hint(null);
  await g.think("My bus is down there in the rain. And someone's sitting in the back row. Looking up at me.");
  g.hint("Turn back to the bed");
  await g.until(() => g.gazing(H.bedHead, 22), 20000);
  g.hint(null);
  await g.wait(900);
  // the cold comes off the glass behind you. It fogs over, edge to middle, and a finger writes in it
  g.mood("dread");
  const writing = g.fogWrite("MAKE UP THE TIME", { glass: "4B", letterMs: 420 });
  await g.wait(1600);
  g.sfx("squeak", 2);
  await g.think("Something's squeaking. Behind me. On the window.");
  g.hint("Look at the window");
  await g.until(() => g.gazing(H.win.getWorldPosition(new THREE.Vector3()), 20), 12000);
  g.hint(null);
  await writing;
  g.sfx("breath");
  g.mood("terror");
  await g.think("Make up the time. Written in the fog, from the inside. Nobody's touched that glass.");
  if (g.actor("mara")) await g.say("mara", "That's not. I didn't. Oh my god. What the fuck.");
  g.look(H.bedHead);
  await g.say("teodor", "You came back. Lena's child. You came back for her.");
  await g.say("teodor", "Don't let him make you late.");
  await g.say("teodor", "The man on the radio. Don't listen to him. He told me to make up the time, and I listened.");
  await g.say("teodor", "Fourteen. I listened, and it was fourteen.");
  g.mood("grief");
  await g.wait(1500);
  await g.think("His hand let go. The monitor keeps counting. Slow.");
  await g.say("mara", "He's been waiting thirty years for somebody to stop.");
  await g.fade(1, 1200);
  g.despawn("teodor4b");
  g.despawn("mara");
  H.setActive(false);
  if (g.actor("teodor")) { g.seat("teodor", "B3"); g.actor("teodor").lookAt(null); }
  g.sky("storm");
  g.storm(true);
  g.amb({ rain: 1, engine: 0.3, hum: 0 });
  g.sitInBus();
  await g.fade(0, 1000);
}

// A car comes up behind with its high beams on and sits on your bumper, leaning on the horn. An old car, filthy,
// rusted. It pulls out and comes up alongside, still honking. You flip them off. The horn stops, and the light comes
// on inside it: nobody at the wheel. The shape you took for the driver is a drowned woman in the passenger seat,
// and she turns, slowly, to look at you. You look away, back at the road. She's in the road. Then she's on the glass.
async function honker(g) {
  const car = g.tailgater();                 // (it drives itself: up behind you, then beside your window)
  const done = () => car.gone || g.d > STOPS["Elm & 4th"] - 110;
  await g.until(() => car.phase === "tail" || done(), 9000);
  if (done()) return car.leave();
  g.look(() => g.mirrorPoint());
  await g.muse("Headlights in the mirror. High beams, right on my bumper.");
  await g.until(() => car.honks >= 2 || done(), 6000);
  await g.say("you", "Yeah, yeah. I see you.");
  car.pass();
  await g.until(() => car.phase === "beside" || done(), 9000);
  if (done()) return car.leave();
  g.look(() => car.window());
  await g.wait(400);
  await g.say("you", "Okay! You wanna go around? Then go the fuck around!", { after: 100 });
  // you take one hand off the wheel and show them exactly what you think of that
  g.gesture("bird", true);
  await g.wait(400);
  await g.say("you", "Yeah. Fuck you too. Have a great night.", { after: 100 });
  // the horn stops. The light comes on inside the car.
  car.quiet();
  await g.wait(800);
  car.domeOn();
  g.sfx("whisper");
  g.mood("dread");
  await g.wait(300);
  g.gesture("bird", false);
  await g.think("Oh, shit. Oh my god. There's nobody driving it.", { after: 100 });
  // ...and you look away from her, back at the road. (If you can't, the bus makes you.)
  const ahead = () => g.bus.group.localToWorld(new THREE.Vector3(0.7, 1.6, 14));
  const roadLeft = () => g.d < STOPS["Elm & 4th"] - 170;
  const lookedAway = await g.until(() => g.gazing(ahead(), 26) || !roadLeft(), 3500);
  if (!lookedAway) { g.look(ahead); await g.until(() => g.gazing(ahead(), 26), 2500); }
  // the car's gone. She's in the road, in the headlights, right in front of you. Then she's on the glass.
  car.leave(true);
  const d0 = g.d + 6 + 7;
  const her = g.spawn("roadwoman", "carwoman", { ghost: true, at: route.at(d0, LANE, roadY(d0)), yaw: route.heading(d0) + Math.PI });
  her.watch(g.camera);
  her.reachOut(true);
  g.sfx("shriek");
  await g.wait(240);
  g.despawn("roadwoman");
  g.sfx("slam");
  g.sfx("crack");
  g.bus.setSmudge(2);                        // her hands, and the crack where her head hit
  const wasDriving = g.drive.state.control === "player";
  if (wasDriving) g.park();                  // you stand on the brake without meaning to
  g.sfx("brake");
  await g.scare("face");
  if (wasDriving) g.release();
  g.mood("terror");
  // (said on the way to Elm: the stop never waits on these)
  (async () => {
    await g.think("She was in the car. Then she was in the road. Then she was on the glass.");
    await g.think("And the car's gone. Not ahead. Not behind. Just gone.");
    await g.say("rhee", "Both hands on the wheel, driver. You never know who's watching.");
    g.mood("uneasy");
  })();
}
