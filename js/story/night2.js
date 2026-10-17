// NIGHT 2 — "The stop with no name has moved."
// Kindness: apologize to Mara (+1), talk to Jun OR call his mom (+1),
//           jacket for Daniel (+1), open the doors at ??? (+1)
import * as THREE from "three";
import { STOPS, route } from "../world/route.js";
import { curb, mysteryCurb, clockIn, closeDoorsAndGo, openUp, endShift, rheeLateness } from "./common.js";

export async function night2(g) {
  const f = g.flags;
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  const terminalDoor = () => g.props.terminal.group.localToWorld(new THREE.Vector3(-6, 0, 20));
  g.mood("uneasy");
  await g.wait(800);
  await g.think("I barely slept. Every time I closed my eyes I heard dripping.");
  await g.think("Mom took the last bus home every night. That's most of what I remember about her. Her keys in the door, at one in the morning.");
  await g.think("And then one night, the keys didn't come.");
  await clockIn(g, [
    "NOTICE: DEPOT CAMERAS SHOW NO PASSENGERS BOARDING ROUTE 9 AT THE DEPOT.",
    "I checked the tape before my shift. It shows me getting on alone.",
  ]);
  g.spawn("teodor", "oldman");
  g.seat("teodor", "B3");
  g.route("NEXT: ???  (BEFORE NORTHGATE)", true);
  await g.wait(800);
  await g.think("He's back. Same seat. Same wet shoes.");
  await g.think("And the stop with no name moved. It's before Northgate now.");
  await g.say("rhee", "Evening, driver. Northgate by twelve twenty. And your display is still broken, so don't look at it.");
  g.route(null);
  const ask = await g.choose(["“That stop on the display. What is it?”", "[Don't look at him. Just drive]"]);
  if (ask === 0) {
    f.knowsAshgrove = true;
    await g.say("teodor", "You saw it, then.");
    await g.say("teodor", "There was a stop past Northgate once. Ashgrove. Little houses by the river. Kids who'd wave at the bus.");
    await g.say("teodor", "The bridge went down in March of ninety-four. In a storm. With the last bus of the night on it.");
    await g.say("you", "Which route?");
    await g.wait(1600);
    await g.say("teodor", "This one.");
  }
  await closeDoorsAndGo(g);

  // ---------- an old tape comes over the radio, on the drive to Elm (as soon as you pull out, so it's
  // over before you get there; Elm still waits for it, just in case)
  const tape = (async () => {
    await g.wait(1200);
    g.sfx("static", 1.2);
    g.radio("CH 9 ····");
    await g.wait(900);
    await g.say("teodor94", "Dispatch, this is Route 9. The river's coming over the road at Canal. I want to hold at Northgate till it passes.");
    await g.say("rhee94", "Negative, Nine. You're eleven minutes down. Make up the time.");
    await g.say("teodor94", "Harold, I've got kids on this bus.");
    await g.say("rhee94", "Then get them home on schedule.");
    g.sfx("static", 0.8);
    g.radio("CH 9");
    await g.wait(1200);
    await g.say("rhee", "Old tapes, driver. The system plays them back sometimes. Ignore it.");
    // only if there's still road before Elm: never while you're pulling in for Mara
    if (g.d < STOPS["Elm & 4th"] - 170) {
      g.hint("Check your mirror");
      await g.until(() => g.lookingAtMirror() || g.d > STOPS["Elm & 4th"] - 90, 9000);
      g.hint(null);
      if (g.d < STOPS["Elm & 4th"] - 90) await g.think("The old man in the back row is crying. He isn't making a sound.");
    }
  })();

  // ---------- Elm & 4th: Mara again
  const mara = g.spawn("mara", "mara", { at: curb("Elm & 4th", 2), yaw: route.heading(STOPS["Elm & 4th"]) + Math.PI / 2 });
  let stopped = await g.arrive("Elm & 4th");
  await tape;
  if (stopped && (await openUp(g))) {
    const stayed = await g.atStop(async (g) => {
      if (f.maraHelped) {
        // she comes up the steps and hands you a coffee before she sits down
        const give = g.handOver("mara", "coffee");
        await g.say("mara", "Figured I owe you a coffee. It's terrible. Hospital coffee always is.");
        await give;
      }
      await g.board("mara", "R0");
      f.maraAboard = true;
      if (f.maraHelped) {
        await g.say("mara", "Heads up. A water main burst on Canal Row. It's deep. Take it slow, or you'll stall out in the middle of it.");
        f.maraTip = true;
      } else {
        await g.say("mara", "I got written up. One more and I'm off nights. So thanks for that.");
        const c = await g.choose(["“I'm sorry. I should have waited.”", "[Say nothing]"]);
        if (c === 0) {
          g.kind();
          f.maraHelped = true;
          f.maraForgave = true;
          await g.wait(1500);
          await g.say("mara", "Yeah. Okay. Everybody's got a schedule. I get it.");
          await g.say("mara", "Canal Row's flooded tonight. Go slow or you'll stall in it.");
          f.maraTip = true;
        }
      }
    });
    if (!stayed) {
      await g.think("Mara was at the stop. I didn't pick her up. Again.");
      f.maraLeft = true;
      g.despawn("mara");
    }
  } else {
    await g.think("Mara was at the stop. I didn't pick her up. Again.");
    f.maraLeft = true;
    g.despawn("mara");
  }
  await closeDoorsAndGo(g);

  const chat = f.maraAboard && f.maraHelped ? (async () => {
    await g.wait(3000);
    g.mood("grief");
    await g.say("mara", "There's a man on my ward. Room four B. Ninety-one years old. No visitors. Ever.");
    await g.say("mara", "He barely talks. But every night, right around this time, he opens his eyes and asks me two things.");
    await g.say("mara", "What time is it. And is Route 9 running yet.");
    await g.wait(1200);
    await g.say("mara", "I always tell him yes. It seems to help.");
    await g.say("mara", "My mom was a nurse at St. Agnes back then too. She lost a friend on that bus. She never really talked about it.");
    g.hint("Check your mirror");
    await g.until(() => g.lookingAtMirror(), 9000);
    g.hint(null);
    await g.think("The old man has his eyes closed. He might be smiling.");
    g.mood("uneasy");
  })() : Promise.resolve();

  // ---------- Market St: Jun, or a poster
  if (f.junRode) g.spawn("jun", "jun", { at: curb("Market St", 1), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  else g.props.missingPoster.visible = true;
  stopped = await g.arrive("Market St");
  await chat;
  if (f.junRode) {
    if (stopped && (await openUp(g))) {
      const stayed = await g.atStop(async (g) => {
        await g.board("jun", "R2");
        f.junAboard = true;
        await g.say("jun", "I'm paying tonight. And here's yesterday's. Don't want you getting in trouble.");
        const c = await g.choose(["“Why do you ride to Northgate every night?”", "[Nod]"]);
        if (c === 0) {
          f.junTalked = true;
          g.kind();
          await g.say("jun", "My mom cleans the Northgate depot. Nights. She works two jobs, so nights are kind of the only time I see her.");
          await g.say("jun", "She gets off at twelve thirty. If I'm there before then, we walk home together.");
          await g.wait(1200);
          await g.say("jun", "Can I ask you something weird? Last night, when we got to Northgate. Did you count how many people got off?");
          await g.say("you", "Just you.");
          await g.wait(1200);
          await g.say("jun", "There were six people in the back when I got off. All wet. All looking at you.");
        }
      });
      if (!stayed) {
        await g.think("Jun was waiting with exact change. I left him there.");
        g.despawn("jun");
      }
    } else {
      await g.think("Jun was waiting with exact change. I left him there.");
      g.despawn("jun");
    }
  } else if (stopped) {
    await g.read({ kind: "poster", title: "Missing", photo: "JUN PARK", lines: ["JUN PARK, 15", "Last seen Market Street, around midnight.", "Black hoodie. Yellow backpack.", "PLEASE CALL 555-0143"], scrawl: "please. anything." }, [
      "There's a poster on the shelter. MISSING. Jun Park, fifteen. Last seen Market Street, around midnight.",
      "It's the kid from last night. There's a phone number. Underneath, someone wrote: please. anything.",
    ]);
    const c = await g.choose(["[Call the number]", "[It's not my business]"]);
    if (c === 0) {
      f.calledMom = true;
      g.kind();
      g.late(2);
      g.sfx("ring");
      await g.wait(2600);
      await g.say("momcall", "Hello? Jun? Jun, is that you?");
      await g.say("you", "No, I'm sorry. I'm the Route 9 driver. I saw him last night at Market Street. He was trying to get to Northgate.");
      await g.wait(1400);
      await g.say("momcall", "Northgate. He was coming to me. I work at the Northgate depot. He was walking to me.");
      await g.say("momcall", "Thank you. I'll call the police. Thank you.");
      await g.say("rhee", "Driver. Personal calls are not on the schedule.");
    }
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- something keeping pace with the bus
  await g.until(() => g.d > STOPS["Market St"] + 90);
  if (g.d < STOPS["St. Agnes"] - 160) {
    g.mood("dread");
    const run = g.shadeRun(6);
    g.look(() => (g.shade.visible ? g.shade.root.localToWorld(new THREE.Vector3(0, 1.7, 0)) : null));
    await g.think("Something's moving on the sidewalk. Out of the corner of my eye. Keeping up with the bus.");
    await run;
    if (f.junAboard) await g.say("jun", "Okay. I saw that. I definitely saw that.");
    await g.think("The thing from the windshield. It ran beside the bus. I was doing thirty.");
    await g.say("rhee", "You're drifting, driver. Eyes front.");
    g.mood("uneasy");
  }

  // ---------- St. Agnes
  if (f.maraAboard) {
    await g.until(() => g.d > STOPS["St. Agnes"] - 120);
    g.sfx("bell");
  }
  stopped = await g.arrive("St. Agnes");
  if (f.maraAboard && stopped && (await openUp(g))) {
    if (f.maraHelped) {
      await g.say("mara", "Hey. Weird question. If you ever see a stop that isn't supposed to be there...");
      await g.say("mara", "My mom used to say the drowned don't want to scare you. They just want a ride home.");
      await g.say("mara", "Forget it. I'm tired. See you tomorrow.");
    }
    await g.alight("mara", curb("St. Agnes", 4, 9));
    f.maraAboard = false;
  } else if (f.maraAboard) {
    await g.say("mara", "Seriously? That was my stop.");
  }
  if (g.bus.doorsOpen || !g.drive.moving) await closeDoorsAndGo(g);

  // ---------- Canal Row: the flood
  g.flood(true, 0.45);
  g.amb({ water: 0.6 });
  g.mood("dread");
  await g.until(() => g.d > 1690);
  const fast = g.drive.speed > 6;
  if (fast) {
    g.sfx("splash");
    g.shake(1.4);
    g.park();
    g.amb({ engine: 0 });
    await g.think("Too fast. The engine's drowned. It won't turn over.");
    g.late(4);
    await g.wait(3500);
  } else {
    g.auto(2.5, Math.min(STOPS["Canal Row"], g.d + 25));
    await g.until(() => g.drive.speed < 0.4, 15000);
  }
  g.spawn("daniel", "daniel", { at: doorOutside(), yaw: route.heading(g.d) + Math.PI / 2 });
  g.sfx("knock");
  await g.think("Someone's knocking on the doors.");
  g.release();
  if (fast) g.park();
  g.hint("Open the doors  [F]  ·  or drive on");
  const opened = await g.until(() => g.bus.doorsOpen || g.drive.moving, 20000);
  g.hint(null);
  if (opened && g.bus.doorsOpen) {
    const stayed = await g.atStop(async (g) => {
      f.knowsDaniel = true;
      await g.say("daniel", "Ashgrove, please.");
      if (f.knowsAshgrove) await g.say("you", "The bridge is gone. It's been gone a long time.");
      else await g.say("you", "This bus doesn't go there.");
      await g.say("daniel", "Everyone keeps telling me.");
      await g.board("daniel", "L0", 1.0);
      await g.say("daniel", "I'm Daniel. My daughter's Rosie. She turns six tonight. I promised her I'd be home before she fell asleep.");
      await g.say("daniel", "I think I'm very late.");
      await g.think("He's shivering so hard his teeth click.");
      const c = await g.choose(["[Give him your jacket]", "[Leave him be]"]);
      if (c === 0) {
        f.gaveJacket = true;
        g.kind();
        await g.say("daniel", "You're kind. He was kind too. The driver.");
        await g.say("daniel", "He wanted to wait out the storm. But the man on the radio kept saying make up the time. Make up the time.");
      } else {
        await g.say("daniel", "The man on the radio told him to make up the time. Did you know that? He wanted to wait.");
      }
      await g.wait(800);
      g.interior("off");
      g.sfx("lightsout");
      g.amb({ engine: 0 });
      g.mood("terror");
      await g.wait(1500);
      g.sfx("breath");
      await g.wait(2200);
      await g.think("Something wet is touching the back of my neck.");
      await g.scare("eyes");
      g.vanish("daniel");
      g.interior("on");
      g.amb({ engine: 0.3 });
      await g.think(f.gaveJacket ? "The lights are back. He's gone. My jacket is folded on his seat. Soaked through. Still warm." : "The lights are back. His seat is empty, and dark with water.");
      if (g.bus.doorsOpen) g.setDoors(false);
    });
    if (!stayed) {
      g.vanish("daniel");
      g.interior("on");
      g.amb({ engine: 0.3 });
    }
  } else {
    await g.think("I'm not opening those doors.");
    await g.wait(1500);
    await g.scare("hands");
    g.sfx("bang");
    g.shake(1.5);
    await g.think("Hands. All over the door glass. Gray and wrinkled from the water.");
    g.vanish("daniel");
  }
  g.release();
  g.hint("Drive  ·  W gas");
  await g.departed();
  g.hint(null);
  await g.until(() => g.d > 1915);
  g.flood(false);
  g.amb({ water: 0 });

  // ---------- something in the aisle
  g.dread(true);
  await g.wait(3000);
  await g.think("I can hear someone breathing. Somewhere behind me.");
  await g.creepMirror("drowned");
  await g.think("There's nothing there. There's nothing there. There's nothing there.");
  g.dread(false);

  // ---------- the stop with no name
  const md = g.mysteryAhead();   // never behind you
  const crowd = [];
  for (let i = 0; i < 8; i++) {
    crowd.push(g.spawn(`drowned${i}`, i === 0 ? "lena" : i === 3 ? "ivy" : "drowned", { ghost: true, at: mysteryCurb(g, -1.8 + (i % 4) * 1.2, 6.4 + Math.floor(i / 4) * 0.6), yaw: route.heading(md) + Math.PI / 2 }));
  }
  await g.until(() => g.d > md - 120);
  g.auto(6, md);
  await g.think("I'm slowing down. I'm not touching the brake.");
  await g.until(() => g.drive.speed < 0.3, 25000);
  g.rain(true);
  await g.think("There's a shelter where there's never been a shelter. Lit up yellow. It's raining inside it. Only inside it.");
  await g.say("rhee", "Driver. Do NOT open those doors. They are not on the manifest.");
  await g.say("teodor", "It's not their night yet. But you could let them see you.");
  g.release();
  g.hint("Open the doors  [F]  ·  or drive on");
  const open2 = await g.until(() => g.bus.doorsOpen || g.drive.moving, 25000);
  g.hint(null);
  if (open2 && g.bus.doorsOpen) {
    f.openedN2 = true;
    f.knowsLena = true;
    g.kind();
    g.late(1);
    g.mood("grief");
    await g.wait(1500);
    await g.think("Nobody's getting on.");
    await g.say("lena", "Not yet. Not tonight.");
    await g.say("lena", "I'm Lena. You're the first one who's opened the doors in a very long time.");
    await g.wait(1200);
    await g.say("lena", "Have we met? You look so much like someone I");
    await g.wait(1500);
    await g.think("She stopped. She's looking at me like she knows me.");
    await g.say("lena", "He's still riding, isn't he? Every night. Tell him we don't blame him. We never did.");
    await g.say("rhee", "Driver. Close. The. Doors.");
    await g.doors(false);
  } else {
    await g.say("rhee", "Good. Good driver.");
    await g.think("A little girl at the front of the shelter waved at the bus. The way kids used to wave at buses.");
  }
  crowd.forEach((_, i) => g.vanish(`drowned${i}`));
  g.rain(false);
  if (!g.drive.moving) await closeDoorsAndGo(g);
  g.mood("uneasy");

  // ---------- Northgate
  await g.arrive("Northgate");
  await openUp(g, 25000);
  if (f.junAboard) {
    await g.say("jun", "Night, driver.");
    if (f.junTalked) g.spawn("junmom", "junmom", { at: terminalDoor() });
    await g.alight("jun", terminalDoor());
    f.junAboard = false;
  }
  g.vanish("teodor");
  g.sfx("coindrop");
  await g.wait(1300);
  await g.think("The back row is empty again. Something hit the floor back there and rolled. Another wet seat.");
  await rheeLateness(g);
  await g.say("rhee", "Storm's coming in off the river tomorrow. A big one. Like the old days.");
  await g.say("rhee", "You'll want to make up the time.");
  g.route("NEXT: ???", true);
  g.sfx("static", 1);
  await g.think("The display flickered. The stop with no name moved again. It's after St. Agnes now. It's getting closer.");
  await endShift(g);
}
