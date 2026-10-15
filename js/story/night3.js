// NIGHT 3 — "A storm is coming in off the river."
// Kindness: comfort Jun (+1), visit Room 4B (+1), let Ivy ride (+1)
import * as THREE from "three";
import { STOPS, route } from "../world/route.js";
import { curb, mysteryCurb, clockIn, closeDoorsAndGo, openUp, endShift, rheeLateness } from "./common.js";

export async function night3(g) {
  const f = g.flags;
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  const terminalDoor = () => g.props.terminal.group.localToWorld(new THREE.Vector3(-6, 0, 20));
  g.sky("storm");
  g.storm(true);
  g.mood("uneasy");
  await g.wait(1000);
  await g.think("The rain is so loud on the depot roof it sounds like applause.");
  await clockIn(g);
  g.spawn("teodor", "oldman");
  g.seat("teodor", "B3");
  if (f.gaveJacket) await g.think("My jacket is hanging behind the driver's seat. I left it soaked on Canal Row. It's dry now. It smells like the river.");
  await g.think("He's back there again. He looks worse tonight. Grayer. Like a photo left in the sun.");
  if (g.state.late === 0) await g.say("rhee", "Two perfect nights, driver. Don't spoil it in the rain.");
  else await g.say("rhee", "You're behind this week, driver. In weather like this, drivers make mistakes. Don't.");
  if (g.state.warn > 0) await g.say("rhee", "And I haven't forgotten about the free ride.");
  await closeDoorsAndGo(g);

  // ---------- Elm & 4th
  if (f.maraHelped) g.spawn("mara", "mara", { at: curb("Elm & 4th", 1), yaw: route.heading(STOPS["Elm & 4th"]) + Math.PI / 2 });
  let stopped = await g.arrive("Elm & 4th");
  if (f.maraHelped && stopped && (await openUp(g))) {
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
  } else if (f.maraHelped) {
    await g.think("Mara was waiting in the rain. I didn't stop.");
    g.despawn("mara");
  } else if (stopped) {
    await g.think("Nobody's here. Someone left a nurse's lanyard hanging on the shelter. It's swinging in the wind.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- Market St
  if (f.junRode) g.spawn("jun", "jun", { at: curb("Market St", 1), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  if (f.calledMom) g.spawn("junmom", "junmom", { at: curb("Market St", 2), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  if (!f.junRode && !f.calledMom) g.props.missingPoster.visible = true;
  stopped = await g.arrive("Market St");
  if (stopped && (f.junRode || f.calledMom) && (await openUp(g))) {
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
      await g.read({ kind: "poster", kicker: "FOUND SAFE · THANK YOU", title: "Missing", photo: "JUN PARK", lines: ["JUN PARK, 15", "Last seen Market Street, around midnight."] }, [
        "The missing poster has a strip pasted across it. FOUND SAFE.",
      ]);
      await g.board("junmom", "R1");
      await g.say("junmom", "You. You're the driver who called.");
      await g.say("junmom", "The police found him on the road to Northgate. Halfway there, in the dark. He was walking to me.");
      await g.say("junmom", "He's home. He's asleep in his bed right now. Because you called.");
    }
  } else if (stopped) {
    await g.think("The poster's pulped by the rain. Someone has put up two more.");
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

  // ---------- the radio plays 1994 (while you drive; St. Agnes waits for it)
  const broadcast = (async () => {
    await g.wait(5000);
    g.radio("CH 9 ????");
    g.sfx("static", 1.6);
    await g.wait(1600);
    await g.say("radio94", "Repeating our top story. At twelve thirty-one this morning, the Ashgrove bridge collapsed during the storm.");
    await g.say("radio94", "A Route 9 city bus was crossing at the time. Divers have recovered fourteen.");
    g.sfx("static", 0.6);
    await g.say("radio94", "The driver, Teodor Varga, fifty-eight, was pulled from the river alive, and is in critical condition at St. Agnes.");
    await g.say("radio94", "Among the dead, a St. Agnes nurse, Lena Marsh, thirty-one, who leaves behind a four-year-old child.");
    await g.say("radio94", "Dispatch records show the bus was running eleven minutes behind sched");
    g.sfx("static", 0.4);
    g.radio("CH 9");
    await g.say("rhee", "That's enough of that.");
    f.knowsVarga = true;
    f.knowsMother = true;
    g.mood("grief");
    await g.wait(1500);
    await g.think("Lena Marsh.");
    await g.think("My mother's name was Lena Marsh. I was four.");
    if (f.knowsLena) await g.think("The woman in the shelter. Lena. She looked at me like she knew me. Because she did.");
    await g.think("Nobody ever told me how. They just said there was an accident. They just said she wasn't coming home.");
    g.mood("dread");
    g.hint("Check your mirror");
    await g.until(() => g.lookingAtMirror(), 9000);
    g.hint(null);
    await g.think("Varga. Teodor Varga. He's looking at the radio. Then at me. He nods. Very slightly.");
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
    await g.think("Up on the fourth floor, a thin figure is pressing one hand against the window glass.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- the stop with no name: two blocks past St. Agnes
  const md = g.mysteryAhead();   // never behind you
  const crowd = [];
  for (let i = 0; i < 10; i++) {
    const look = i === 1 ? "lena" : i === 2 ? "daniel" : "drowned";
    crowd.push(g.spawn(`drowned${i}`, look, { ghost: true, at: mysteryCurb(g, -1.8 + (i % 5) * 0.9, 6.4 + Math.floor(i / 5) * 0.6), yaw: route.heading(md) + Math.PI / 2 }));
  }
  const ivy = g.spawn("ivy", "ivy", { ghost: true, at: mysteryCurb(g, 1, 5.6), yaw: route.heading(md) + Math.PI / 2 });
  await g.until(() => g.d > md - 110);
  g.auto(6, md);
  g.mood("dread");
  await g.until(() => g.drive.speed < 0.3, 25000);
  g.setDoors(true);
  g.lockDoors(true);
  await g.think("The doors opened by themselves.");
  g.sfx("knock", 4);
  await g.wait(1500);
  g.sfx("knock", 6);
  g.shake(1.2);
  await g.think("Knocking. Not on the doors. Under the floor. Under my feet. Like people trapped in something, beating on the walls.");
  await g.say("rhee", "CLOSE THE DOORS. Driver, CLOSE THEM.");
  await g.say("teodor", "She's in there, you know. Your mother. In the cardigan. She sat right behind me every night.");
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
    await g.think("She's gone. The seat is soaking wet. There's a tiny yellow button on it.");
    await g.say("rhee", "You'll regret that, driver.");
    g.setDoors(false);
  } else {
    g.setDoors(false);
    g.mood("terror");
    await g.wait(1600);
    await g.scare("hands");
    g.sfx("bang");
    g.shake(1.6);
    await g.think("Hands. On every window of the bus. Gray. Wrinkled. Pressing.");
    await g.say("rhee", "Good. Good driver.");
    await g.think("I don't feel like a good driver.");
    g.vanish("ivy");
  }
  crowd.forEach((_, i) => g.vanish(`drowned${i}`));
  g.release();
  g.hint("Drive  ·  W gas");
  await g.departed();
  g.hint(null);

  // ---------- something hits the windshield
  g.dread(true);
  await g.wait(7000);
  g.sfx("bang");
  await g.scare("hands");
  g.shake(1.8);
  await g.think("Something hit the windshield. Hands. Two gray hands, pressed flat. Then the rain washed them away.");
  await g.say("rhee", "Keep driving, driver. You don't stop for weather.");

  // ---------- Canal Row is a river (only if it's still ahead of you)
  if (g.d < 1690) {
    g.flood(true, 0.55);
    g.amb({ water: 0.9 });
    await g.until(() => g.d > 1700);
    g.drive.setLimit(5);
    await g.think("Canal Row is a river now. The water's up to the second step.");
    await g.wait(3000);
    await g.think("In the lightning, there are faces under the water. Looking up.");
    await g.until(() => g.d > 1915);
    g.drive.setLimit(14);
    g.flood(false);
    g.amb({ water: 0 });
  }
  g.dread(false);
  g.mood("uneasy");

  // ---------- Northgate
  await g.arrive("Northgate");
  await openUp(g, 60000);
  if (f.junAboard) {
    await g.say("jun", f.junComforted ? "Thanks for believing me." : "Night. Be careful, okay?");
    g.spawn("junmom", "junmom", { at: terminalDoor() });
    await g.alight("jun", terminalDoor());
  }
  if (f.junFound) {
    await g.say("junmom", "This is me. Jun wants to meet you, you know. The driver who called. He thinks you're some kind of hero.");
    await g.alight("junmom", terminalDoor());
  }
  g.vanish("teodor");
  g.sfx("coin");
  await rheeLateness(g);
  await g.think("There's a sheet of paper under my windshield wiper.");
  await g.read({ kind: "notice", kicker: "Metro Transit · Radio", title: "Notice", lines: ["Route 9 radio moves to CHANNEL 4 starting tomorrow.", "Channel 9 has been OUT OF SERVICE since 1994.", "If you hear anything on channel 9, do not answer it.", "- Dana, Night Dispatch"] }, [
    "Notice. Route 9 radio moves to channel 4 starting tomorrow. Channel 9 has been out of service since nineteen ninety-four. Dana, night dispatch.",
  ]);
  await g.say("rhee", "Ignore that.");
  await g.think("The stop with no name moved again. It's right after Market Street now.");
  g.storm(false);
  await endShift(g);
}

// upstairs at St. Agnes: walk to Room 4B
async function ward(g) {
  const H = g.places.hospital;
  await g.fade(1, 900);
  g.storm(false);                      // no rain or lightning indoors
  g.sky("hospital");
  g.amb({ rain: 0.3, engine: 0, hum: 1 });
  g.mood("grief");
  g.walkAt(H.spawn, Math.PI, H.colliders);
  g.despawn("mara");
  const mara = g.spawn("mara", "mara", { at: H.spawn.clone().setY(0).add(new THREE.Vector3(0.4, 0, 2.5)), yaw: 0 });
  const lying = g.spawn("teodor4b", "oldman", { at: H.roomPos.clone().add(new THREE.Vector3(-0.9, 0.62, 0.95)) });
  lying.root.rotation.set(-Math.PI / 2, 0, 0);
  await g.fade(0, 1000);
  mara.walk([H.spawn.clone().setY(0).add(new THREE.Vector3(0, 0, 31)), H.roomPos.clone().add(new THREE.Vector3(2.2, 0, -1.6))], { speed: 1.2 });
  await g.say("mara", "This way. Fourth floor smells like bleach and old flowers. You stop noticing.");
  g.hint("Go to Room 4B");
  g.navTo(H.roomPos.clone().add(new THREE.Vector3(2.4, 2.2, 0)));
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
  await g.scare("hands");
  g.mood("terror");
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
  g.sky("storm");
  g.storm(true);
  g.amb({ rain: 1, engine: 0.3, hum: 0 });
  g.sitInBus();
  await g.fade(0, 1000);
}
