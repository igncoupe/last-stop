// NIGHT 1 — "Your first run on Route 9."
// Kindness: wait for Mara (+1), let Jun ride (+1), stop at Canal Row (+1)
import * as THREE from "three";
import { STOPS, route } from "../world/route.js";
import { curb, clockIn, closeDoorsAndGo, openUp, endShift, rheeLateness } from "./common.js";

export async function night1(g) {
  const f = g.flags;
  g.mood("calm");
  g.amb({ engine: 0.3, rain: 0, water: 0 });
  await g.wait(800);
  await g.think("First night on Route 9. Nobody else wanted the shift.");
  await g.think("I asked for it. I didn't tell them why.");
  await clockIn(g, [
    "NIGHT ROUTE 9. DEPOT TO NORTHGATE. 11:40 PM.",
    "DO NOT RUN LATE. NO FREE RIDES. DISPATCH IS WATCHING.",
    "Someone's written underneath in pencil. Stop for them.",
  ]);

  // the old man is already in the back row
  g.spawn("teodor", "oldman");
  g.seat("teodor", "B3");
  await g.wait(600);
  g.sfx("static");
  await g.say("rhee", "Evening, new driver. This is Rhee, night dispatch. You'll be hearing a lot of me.");
  await g.say("rhee", "Route 9 runs forty minutes, depot to Northgate. Two rules. You don't run late. And you don't let anyone ride free.");
  await g.say("rhee", "The cameras see everything. So do I.");

  g.hint("Check your mirror");
  await g.until(() => g.lookingAtMirror() || g.lookingBack(), 15000);
  g.hint(null);
  g.sfx("breath");
  await g.think("There's an old man in the back row. I didn't see him get on.");
  const ask = await g.choose(["“Sir? Where are you headed?”", "[Leave him be]"]);
  if (ask === 0) {
    await g.say("teodor", "End of the line.");
    await g.say("you", "Northgate, then.");
    await g.say("teodor", "If you say so.");
    await g.wait(500);
    await g.say("teodor", "You've got kind eyes. I've seen them before. That's going to make this harder for you.");
  }
  await closeDoorsAndGo(g);
  await g.think("Elm and Fourth is first. Then Market, St. Agnes, Canal Row, Northgate.");

  // ---------- Elm & 4th: someone running for the bus
  let stopped = await g.arrive("Elm & 4th");
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  if (stopped && (await openUp(g))) {
    await g.wait(1200);
    const mara = g.spawn("mara", "mara", { at: curb("Elm & 4th", -55), yaw: route.heading(STOPS["Elm & 4th"]) });
    let reached = false;
    mara.walk([doorOutside()], { speed: 3.3 }).then(() => { reached = true; });
    await g.say("rhee", "You're exactly on schedule, driver. Let's keep it that way.");
    await g.think("Someone's running for the bus. A nurse, I think. She's a long way back.");
    await g.until(() => reached || !g.bus.doorsOpen || g.drive.moving, 30000);
    if (reached && g.bus.doorsOpen && !g.drive.moving) {
      f.maraHelped = true;
      g.kind();
      g.late(2);
      await g.board("mara", "R0");
      g.flags.maraAboard = true;
      await g.say("mara", "Thank you. Oh my god, thank you. I'm Mara. If I'm late one more time they'll take me off nights, and I can't afford days.");
    } else {
      f.maraLeft = true;
      mara.walk([curb("Elm & 4th", -18)], { speed: 1 });
      await g.wait(1500);
      await g.think("She stopped running. She's just standing under the streetlight. Watching me go.");
      await g.say("rhee", "Good. That's how it's done.");
    }
  } else {
    f.maraLeft = true;
    g.spawn("mara", "mara", { at: curb("Elm & 4th", -10), yaw: route.heading(STOPS["Elm & 4th"]) });
    await g.think("Was someone running for the bus back there? Too late now.");
  }
  await closeDoorsAndGo(g);

  // Mara talks while you drive
  const maraChat = f.maraAboard ? (async () => {
    await g.wait(2500);
    await g.say("mara", "St. Agnes. Twelve-hour shifts. You get used to the quiet. Mostly.");
    await g.say("mara", "You're new. The last guy quit after a week. Said the bus was always cold. Said he kept hearing people in the back.");
    await g.say("mara", "He was kind of a weirdo, though.");
    await g.wait(1500);
    await g.say("mara", "You know this route used to go farther? Past Northgate, out to Ashgrove. Before the bridge.");
    const q = await g.choose(["“What happened to the bridge?”", "[Keep your eyes on the road]"]);
    if (q === 0) {
      g.mood("uneasy");
      await g.say("mara", "A storm took it out. Way before I was born. My mom says they never found all the—");
      await g.wait(1200);
      await g.say("mara", "Never mind. It's a sad story for a bus at midnight.");
      await g.think("She was looking past me. At the back row.");
    }
  })() : Promise.resolve();
  if (!f.maraAboard) g.despawn("mara");

  // ---------- Market St: a kid with no fare
  const jun = g.spawn("jun", "jun", { at: curb("Market St", 1), yaw: route.heading(STOPS["Market St"]) + Math.PI / 2 });
  stopped = await g.arrive("Market St");
  await maraChat;
  if (stopped && (await openUp(g))) {
    const stayed = await g.atStop(async (g) => {
      await jun.walk([doorOutside()], { speed: 1.3 });
      await jun.walk([g.bus.boardPath[1]], { speed: 1.3, parent: g.bus.group, ground: g.bus.groundAt });   // up the steps
      await g.say("jun", "I don't... I don't have the fare. I just need to get to Northgate. Please. I'll pay you back tomorrow, I swear.");
      await g.say("rhee", "Reminder, driver. No. Free. Rides.");
      const c = await g.choose(["“Sit down. This one's on me.”", "“Sorry, kid. Rules.”"]);
      if (c === 0) {
        f.junRode = true;
        f.junNamed = true;
        g.kind();
        g.warn();
        await g.board("jun", "R2");
        await g.say("jun", "Thanks. I'm Jun. In case you need it for, like, a report.");
        await g.say("rhee", "I saw that, driver. That's your one warning.");
      } else {
        f.junLeft = true;
        await jun.walk([g.bus.boardPath[0]], { speed: 1, ground: g.bus.groundAt });   // back down the steps
        await jun.walk([curb("Market St", 1)], { speed: 1, parent: jun.scene });
        await g.think("He nodded like he'd heard it before. It's six miles to Northgate.");
      }
    });
    if (!stayed) {
      f.junLeft = true;
      await g.think("There was a kid on the bench at Market. He watched the bus go by.");
    }
  } else {
    f.junLeft = true;
    await g.think("There was a kid on the bench at Market. He watched the bus go by.");
  }
  if (!f.junRode) g.despawn("jun");
  await closeDoorsAndGo(g);

  if (f.junRode) {
    (async () => {
      await g.wait(4000);
      await g.say("jun", "Is he okay? The old guy in the back? He's not blinking.");
      await g.think("I don't look. I don't want to look.");
    })();
  }

  // ---------- St. Agnes
  if (f.maraAboard) {
    await g.until(() => g.d > STOPS["St. Agnes"] - 120);
    g.sfx("bell");
    await g.say("mara", "This is me. St. Agnes.");
  }
  stopped = await g.arrive("St. Agnes");
  if (f.maraAboard) {
    if (stopped && (await openUp(g))) {
      await g.say("mara", "Made it with a minute to spare. You're a lifesaver. Literally, probably. Same bus tomorrow?");
      await g.alight("mara", curb("St. Agnes", 4, 9));
      f.maraAboard = false;
    } else {
      await g.say("mara", "Hey! That was my stop! Great. Now I'm walking back.");
      f.maraMissedStop = true;
    }
  } else if (stopped) {
    await g.think("Every window in the hospital is lit. Someone's standing in a window on the fourth floor.");
  }
  if (g.bus.doorsOpen) await closeDoorsAndGo(g);
  if (f.maraAboard && !g.drive.moving) await g.departed();

  // ---------- the old request stop: something that isn't a passenger
  await g.until(() => g.d > STOPS["St. Agnes"] + 25);
  const rd = Math.max(g.d + 130, STOPS["St. Agnes"] + 150);
  g.props.requestStop.place(rd);
  g.shadeAt(g.props.requestStop.spot());
  await g.until(() => g.d > rd - 95);
  g.mood("dread");
  await g.think("There's someone at the old request stop. The one they took out of service years ago.");
  await g.think("No. Not someone. It's like somebody cut the shape of a man out of the night.");
  await g.say("rhee", "Don't slow down, driver. That stop isn't on the schedule.");
  await g.until(() => g.d > rd - 12 || (g.drive.speed < 0.3 && g.d > rd - 70), 30000);
  g.sfx("whisper");
  g.props.requestStop.light(false);
  g.sfx("lightsout");
  g.shadeHide();
  await g.wait(800);
  g.props.requestStop.light(true);
  await g.think("Its head turned to follow me. Then the light went out. And it was gone.");
  g.mood("uneasy");

  // ---------- Canal Row
  g.amb({ water: 0.25 });
  await g.until(() => g.d > STOPS["Canal Row"] - 140);
  await g.think("Canal Row. The route sheet says nobody ever gets on here.");
  stopped = await g.arrive("Canal Row");
  if (f.maraAboard && stopped && (await openUp(g, 8000))) {
    await g.say("mara", "I'll walk from here. Thanks for nothing.");
    await g.alight("mara", curb("Canal Row", -30));
    f.maraAboard = false;
  }
  if (stopped && (g.bus.doorsOpen || (await openUp(g, 12000)))) {
    const stayed = await g.atStop(async (g) => {
      f.metWet = true;
      g.kind();
      g.late(1);
      g.mood("dread");
      await g.wait(1500);
      await g.think("Nobody. Just water on the road. It hasn't rained all week.");
      // nobody there, so you close up and go. That's when it comes: a hand stops the doors
      await g.doors(false, 14000, "Close the doors  [F]");
      g.spawn("daniel", "daniel", { at: g.bus.group.localToWorld(g.bus.boardPath[0].clone()), yaw: route.heading(STOPS["Canal Row"]) + Math.PI / 2 });
      g.setDoors(true);
      g.sfx("bang");
      await g.scare("face");
      await g.say("daniel", "Ashgrove, please.");
      await g.say("you", "This bus doesn't go to Ashgrove.");
      await g.wait(900);
      await g.say("daniel", "No. I suppose it doesn't. Not anymore.");
      await g.board("daniel", "L0", 1.0);
      g.sfx("drip");
      await g.think("He sat right behind me. I can hear him dripping.");
      await closeDoorsAndGo(g);
      await g.wait(5000);
      g.hint("Check your mirror");
      await g.until(() => g.lookingAtMirror(), 15000);
      g.hint(null);
      await g.think("He's staring at the back of my head.");
      g.interior("flicker");
      g.sfx("lightsout");
      await g.wait(1400);
      g.vanish("daniel");
      g.interior("on");
      await g.think("He's gone. There's just a puddle on his seat, spreading.");
    });
    if (!stayed) g.vanish("daniel");          // drove off on him: he's just not there any more
  } else {
    // drove past: someone was waiting after all
    g.spawn("daniel", "daniel", { at: curb("Canal Row", 2), yaw: route.heading(STOPS["Canal Row"]) + Math.PI / 2 });
    await g.until(() => g.d > STOPS["Canal Row"] + 4, 20000);
    await g.scare("face");
    g.sfx("bang");
    await g.think("A face, pressed against my window. On the inside.");
    g.vanish("daniel");
    await g.say("rhee", "Watch the road, driver. You're drifting.");
    if (g.bus.doorsOpen) await closeDoorsAndGo(g);
  }
  g.amb({ water: 0 });
  g.mood("uneasy");

  // ---------- the shadow again. No warning this time: a quiet stretch, a routine call from dispatch,
  // and somewhere in the middle of it, it comes down off the roof. It's been up there since Canal Row.
  await g.wait(3000 + Math.random() * 4000);
  await g.think("Okay. Breathe. Northgate's not far now. Just drive the bus.");
  const dropAt = Math.min(2240, Math.max(g.d + 60, 1990 + Math.random() * 200));
  await g.until(() => g.d > dropAt, 40000);
  const ahead = () => g.bus.group.localToWorld(new THREE.Vector3(0.7, 1.6, 12));
  await g.until(() => g.drive.speed > 4 && !g.lookingAtMirror() && g.gazing(ahead(), 35), 8000);
  g.say("rhee", "Dispatch to Route 9. Northgate's clear tonight. Pull in, sign the log, and leave the keys in the—").catch(() => {});
  await g.wait(1300 + Math.random() * 1600);
  await g.shadeDrop({ keepParked: true });
  g.dread(true);
  g.mood("terror");
  if (f.junRode) await g.say("jun", "What was that? What WAS that?");
  await g.think("It hit the glass. It was on the glass, pressed flat, looking in at me. It doesn't have a face. It doesn't have anything.");
  await g.think("It came down off the roof. How long was it up there? How long was it riding with me?");
  await g.say("rhee", "Eyes on the road, driver. You'll see all sorts of things on nights.");
  await g.think("There are handprints on the windshield. On the outside. They're not wet. They're ash.");
  g.release();
  g.hint("Drive  ·  W gas");
  await g.departed();
  g.hint(null);
  g.mood("uneasy");

  // ---------- the last stretch: Rhee has opinions
  await g.wait(4000);
  if (g.state.kind >= 2) {
    await g.say("rhee", "You stop a lot, driver. For a lot of people. Teodor used to stop for everyone.");
    await g.say("you", "Who's Teodor?");
    await g.wait(1400);
    await g.say("rhee", "Nobody. A driver who ran late.");
  } else {
    await g.say("rhee", "Not bad for a first night, driver. Keep your eyes on the clock, and off the mirror.");
  }

  // ---------- Northgate
  stopped = await g.arrive("Northgate");
  await openUp(g, 25000);
  if (f.maraAboard) {
    await g.say("mara", "End of the line, huh. Thanks for the scenic route.");
    await g.alight("mara", g.props.terminal.group.localToWorld(new THREE.Vector3(-6, 0, 20)));
  }
  if (f.junRode) {
    await g.say("jun", "Thanks. Seriously. I'll pay you back.");
    await g.alight("jun", g.props.terminal.group.localToWorld(new THREE.Vector3(-6, 0, 20)));
  }
  await g.say("you", "End of the line, sir.");
  await g.wait(1200);
  await g.say("teodor", "Not yet, it isn't.");
  g.sfx("static", 1.4);
  g.route("NEXT: ???", true);
  f.sawMystery = true;
  await g.think("The route display. It's showing a stop after Northgate. There's nothing after Northgate.");
  await g.say("rhee", "Driver. Your display is malfunctioning. Ignore it.");
  await g.say("rhee", "Whatever it shows you. Ignore it.");
  g.vanish("teodor");
  g.sfx("coindrop");                   // something small and metal, hitting the floor at the back, rolling
  await g.wait(1400);
  g.hint("Look at the back row");
  await g.until(() => g.lookingBack(), 15000);
  g.hint(null);
  await g.think("He's gone. I didn't hear the doors. Something fell back there. I heard it hit the floor and roll. His seat is soaking wet.");
  g.dread(false);
  await g.wait(1500);
  g.sfx("whisper");
  await g.say("voices", "You came back.");
  await g.think("I'm alone on the bus. I'm alone on the bus.");
  await rheeLateness(g);
  if (f.junRode) await g.say("rhee", "And no more free rides. I mean it.");
  await g.say("rhee", "Get some sleep. Same time tomorrow.");
  await endShift(g);
}
