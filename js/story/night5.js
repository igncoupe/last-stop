// NIGHT 5 — "Last stop." Rosie. Teodor's confession. Ashgrove. The endings.
// Kindness: give Rosie the present / tell her about her dad (+1)
import * as THREE from "three";
import { STOPS, route } from "../world/route.js";
import { curb, mysteryCurb, clockIn, closeDoorsAndGo, openUp, KIND_ENOUGH } from "./common.js";

export async function night5(g) {
  const f = g.flags;
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  g.mood("dread");
  g.amb({ rain: 0.4 });
  await g.wait(900);
  await g.think("Last night. I reached into my pocket for my keys and found coins instead. Four of them. Heavy. Worn smooth.");
  if (f.hasBadge) await g.think("And the brass badge. T. Varga. It's warm, like someone was just holding it.");
  await g.think("Thirty-two years. Tonight I find out if she ever gets home.");
  await clockIn(g);
  await g.think("The stain on the back seat has spread across three seats now.");
  g.sfx("static", 0.8);
  await g.say("rhee", "Last run, driver. Big night. Full bus.");
  await g.say("rhee", "You know what to do. You make up the time.");
  await closeDoorsAndGo(g);

  // ---------- Elm & 4th: Rosie, and Teodor in uniform
  const elm = STOPS["Elm & 4th"];
  g.spawn("rosie", "rosie", { at: curb("Elm & 4th", -1, 7.1), yaw: route.heading(elm) + Math.PI / 2 });
  const teo = g.spawn("teodor", "uniform", { at: curb("Elm & 4th", 3, 6.2), yaw: route.heading(elm) + Math.PI / 2 });
  await g.until(() => g.d > elm - 120 || g.drive.stoppedNear(elm));
  // tonight the bus knows where it's stopping
  if (!g.drive.stoppedNear(elm)) g.auto(7, elm - 4);
  await g.think("Two people at Elm and Fourth. A woman on the bench. And a man under the streetlight in an old brown driver's uniform.");
  await g.until(() => g.drive.speed < 0.3, 25000);
  g.release();
  await openUp(g, 60000);
  f.knowsVarga = true;
  await g.actor("rosie").walk([doorOutside()], { speed: 1 });
  await g.say("rosie", "Sorry. I'm not riding. I just come here. Every year, on this night. I don't even really know why.");
  await g.say("rosie", "My dad took the last bus home on this night. I was six. It was my birthday. He promised he'd be home before I fell asleep.");
  f.metRosie = true;
  await g.say("rosie", "I stayed awake all night. I'm Rosie, by the way. Sorry. You don't need my life story.");
  const opts = [];
  if (f.keptPresent) opts.push("[Give her the box]");
  else if (f.knowsDaniel) opts.push("“Your dad's name was Daniel. He was trying to get home to you.”");
  opts.push("“Happy birthday, Rosie.”");
  const pick = await g.choose(opts);
  if (pick === 0 && opts.length === 2) {
    g.kind();
    if (f.keptPresent) {
      f.gaveRosie = true;
      g.mood("silence");
      await g.say("rosie", "That's his handwriting.");
      await g.think("Her hands are shaking so much I have to help her with the paper. Inside is a music box. Cheap. Painted. A little dancer with a chipped arm.");
      g.mood("hope");
      await g.wait(5000);
      await g.say("rosie", "He remembered. He got it for me. He was bringing it home.");
      await g.think("It's playing the same notes I've been hearing in my head all week.");
    } else {
      f.toldRosie = true;
      await g.say("rosie", "How do you know his name?");
      await g.say("you", "He rides this bus. He talks about you. He was bringing you a present.");
      await g.say("rosie", "I always felt like he was trying. Like he was out there, still trying to get home.");
    }
  }
  g.actor("rosie").walk([curb("Elm & 4th", -1, 7.1)], { speed: 0.8 });
  g.mood("grief");
  await g.think("The man in the uniform took off his cap. He's getting on.");
  await g.board("teodor", "L0", 1.1);
  g.sfx("coin");
  await g.say("teodor", "March fourteenth, nineteen ninety-four. I was eleven minutes late.");
  await g.say("teodor", "I asked to wait out the storm. Harold said no. Harold said make up the time. And I was scared of losing my job, and I had a schedule, and I did what I was told.");
  await g.say("teodor", "Fourteen people. Lena. Daniel. Little Ivy. Eleven more. I knew every one of their faces. I used to wave.");
  await g.say("teodor", "Your mother sat right behind me, every night. She talked about her kid the whole way home. You. She talked about you.");
  await g.wait(1200);
  await g.say("teodor", "They pulled me out of the river alive. Everyone said I survived.");
  await g.say("teodor", "I didn't. I've been riding this bus every night since. Waiting for a driver who would stop.");
  if (f.maraHelped) await g.say("teodor", "Right now there's a nurse holding my hand in Room four B. She's very kind. She tells me Route 9 is running.");
  await g.say("teodor", "It's my last night too. Tonight they get on, or they never do.");
  const q = await g.choose(["“What do I have to do?”", "“Why me?”"]);
  if (q === 0) {
    await g.say("teodor", "Stop for them. That's all. That's all it ever was. Stop for people.");
  } else if (g.state.kind >= KIND_ENOUGH) {
    await g.say("teodor", "Because you stop. I've watched you all week. You stop for people when it costs you.");
  } else {
    await g.say("teodor", "Because you're who's driving. And because I'm out of nights.");
  }
  await g.say("rhee", "Don't listen to him, driver. He's the one who drowned them.");
  await closeDoorsAndGo(g);

  // ---------- Ashgrove
  const md = g.mysteryAhead();   // never behind you
  const crowd = [];
  for (let i = 0; i < 14; i++) {
    const look = i === 0 ? "lena" : i === 1 ? "daniel" : i === 2 ? "ivy" : "drowned";
    crowd.push(g.spawn(`g${i}`, look, { ghost: true, at: mysteryCurb(g, -2.4 + (i % 7) * 0.8, 6.0 + Math.floor(i / 7) * 0.8), yaw: route.heading(md) + Math.PI / 2 }));
  }
  await g.until(() => g.d > md - 80);
  g.sky("storm");
  g.storm(true);
  g.mood("terror");
  g.auto(6, md);
  await g.until(() => g.drive.speed < 0.3, 25000);
  g.props.mystery.named = true;
  g.mysteryName("ASHGROVE");
  g.route("ASHGROVE", false);
  g.sfx("thunder");
  await g.think("The display stopped flickering. For the first time, the stop has a name. Ashgrove.");
  await g.think("Fourteen of them. Standing in a rain that isn't falling anywhere else. They're not knocking. They're just waiting. Like they always have.");
  await g.say("lena", "Hi, sweetheart.");
  await g.think("Mom.");
  g.sfx("static", 1.4);
  await g.say("rhee", "DRIVER.");
  await g.say("rhee", "You are ELEVEN MINUTES LATE. You will MAKE. UP. THE. TIME.");
  g.sfx("spark");
  g.shake(1.4);
  await g.say("rhee", "The schedule ALWAYS comes first. That's the JOB.");
  await g.say("teodor", "Please.");
  g.release();

  let ripped = false;
  let rip = null;
  if (f.rheeTruth) {
    rip = g.interact(g.bus.radioMesh, "Tear the radio out");
    rip.then(() => { ripped = true; });
  }
  g.hint(f.rheeTruth ? "Open the doors  [F]   ·   tear out the radio  [E]   ·   or drive away  [W]" : "Open the doors  [F]   ·   or drive away  [W]");
  await g.until(() => g.bus.doorsOpen || g.drive.moving || ripped);
  g.hint(null);
  if (rip && !ripped) rip.cancel();

  if (ripped) {
    await ripRadio(g);
    g.hint("Open the doors  [F]");
    await g.until(() => g.bus.doorsOpen);
    g.hint(null);
    return g.state.kind >= KIND_ENOUGH ? endHome(g, crowd, true) : endNotYet(g);
  }
  if (g.bus.doorsOpen) return g.state.kind >= KIND_ENOUGH ? endHome(g, crowd, false) : endNotYet(g);
  return endOnTime(g);
}

async function ripRadio(g) {
  g.park();                 // the bus stays at Ashgrove until you open the doors
  g.lockDoors(true);
  g.sfx("rip");
  await g.say("rhee", "DON'T YOU");
  g.sfx("bang");
  g.shake(2);
  await g.say("rhee", "I DID MY JOB. I DID MY JOB. THE SCHEDULE");
  g.sfx("spark");
  g.sfx("static", 2);
  g.shake(2);
  await g.wait(1200);
  g.radio("");
  g.mood("silence");
  g.storm(false);
  g.amb({ rain: 0.2 });
  await g.wait(2600);
  await g.think("Dead air. It's the best sound I've ever heard.");
  g.spawn("harold", "harold", { ghost: true });
  g.seat("harold", "B2");
  g.sfx("breath");
  await g.think("Someone's crying in the back row. A thin, gray man in a dispatcher's cardigan, with a headset around his neck.");
  g.flags.ripped = true;
  g.lockDoors(false);
}

// they get on; Teodor drives them home
async function endHome(g, crowd, deadAir) {
  const f = g.flags;
  g.mood("hope");
  g.storm(false);
  g.rain(false);
  g.lockDoors(true);
  await g.wait(1500);
  await g.think("For a moment, nobody moves. Then Daniel climbs the steps. He isn't dripping anymore.");
  const order = [["g1", "L1"], ["g0", "R1"], ["g2", "R0"], ["g3", "L2"]];
  for (const [k, seat] of order) g.board(k, seat, 1.5);
  await g.wait(5000);
  ["L3", "R3", "L4", "R4", "L5", "R5", "L6", "R6", "B0", "B1"].forEach((seat, i) => { g.despawn(`g${i + 4}`); g.spawn(`s${i}`, "drowned", { ghost: true }); g.seat(`s${i}`, seat); });
  g.sfx("bell");
  await g.think("Fourteen fares. Fourteen old coins in the box. Ivy rang the bell and giggled.");
  await g.say("lena", "Thank you for stopping.");
  if (deadAir) {
    await g.say("harold", "I'm sorry. I'm so sorry. I thought the schedule was the job.");
    await g.wait(1500);
    await g.say("lena", "Everyone gets a ride home. That's the job.");
  }
  await g.say("lena", "You don't have to keep driving for me anymore. I'm going home now. Then you go home too.");
  await g.say("you", "I missed you.");
  await g.say("lena", "I know. I was always on my way back. Always.");
  await g.say("teodor", "Mind if I drive the last bit?");
  // you give him the seat
  await g.fade(1, 1000);
  const P = g.places.bridge;
  g.drive.detach(true);
  P.group.visible = true;
  g.sky("void");
  g.bus.group.position.copy(P.start);
  g.bus.group.rotation.set(0, 0, 0);
  g.despawn("teodor");
  g.spawn("teodor", "uniform");
  g.actor("teodor").sit(g.bus.group, new THREE.Vector3(0.7, 0.5, 4.75), 0);
  // you stand in the aisle behind him, looking out through the windshield
  g.fixedCamera(g.bus.group, new THREE.Vector3(0.0, 1.78, 3.75), new THREE.Euler(-0.07, Math.PI + 0.08, 0, "YXZ"));
  const stars = starField();
  P.group.add(stars);
  P.water.visible = false;           // tonight the river is made of stars
  await g.fade(0, 1400);
  await g.think("He drives like he never left. The road ends. The bridge isn't there anymore. We just keep going.");
  await g.frames((dt) => {
    g.bus.group.position.z += 9 * dt;
    return g.bus.group.position.z > P.edge + 120;
  });
  await g.think("Below us, the river is full of stars.");
  await g.fade(1, 2500, true);
  await dawn(g, deadAir);
  return deadAir ? "deadair" : "home";
}

// stars above, and stars in the river below: the bus drives through them
function starField() {
  const group = new THREE.Group();
  const layer = (n, size, color, yMin, yMax) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 420;
      pos[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
      pos[i * 3 + 2] = 60 + Math.random() * 700;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.95 })));
  };
  layer(3000, 3, 0xfff4d8, -45, -4);     // the river
  layer(1200, 2, 0xd8e4ff, 8, 120);      // the sky
  layer(250, 5, 0xffe2a8, -30, 60);      // a few bright ones
  return group;
}

// morning at Northgate. The bus is empty.
async function dawn(g, deadAir) {
  const f = g.flags;
  g.despawnAll();
  g.places.bridge.group.visible = false;
  g.places.bridge.water.visible = true;
  g.drive.detach(false);
  g.drive.d = route.length - 32;
  g.setDoors(true);
  g.lamps(false);
  g.sky("dawn");
  g.amb({ engine: 0, rain: 0, water: 0 });
  const busDoor = g.bus.group.localToWorld(new THREE.Vector3(-3.2, 1.7, 3.5));
  g.walkAt(busDoor, route.heading(route.length - 32) + Math.PI);
  g.mood("grief");
  await g.fade(0, 3000, true);
  await g.think("Northgate. Morning. The bus is empty, and dry.");
  await g.think("For the first time in thirty-two years, I think she made it home.");
  if (f.maraHelped) {
    await g.read({ kind: "note", lines: ["Mr. Varga passed at 12:31.", "Peacefully.", "He asked if Route 9 was running, and I said yes, and he smiled."], scrawl: "- Mara" }, [
      "There's a note taped to the driver's window. Mr. Varga passed at twelve thirty-one. Peacefully. He asked if Route 9 was running, and I said yes, and he smiled. Mara.",
    ]);
  }
  if (f.gaveRosie) await g.think("Somewhere across town, a music box is playing on a kitchen table. And a woman is finally asleep.");
  if (f.junRode || f.junFound) {
    const jun = g.spawn("jun", "jun", { at: g.props.terminal.group.localToWorld(new THREE.Vector3(-6, 0, 20)) });
    jun.walk([busDoor.clone().setY(0).add(new THREE.Vector3(1.2, 0, 0))], { speed: 1.1 });
    await g.wait(5000);
    await g.think("Jun is here with two coffees. He doesn't say anything. He just hands me one.");
  }
  if (deadAir) {
    g.sfx("static", 0.8);
    await g.say("dana", "Route 9, this is Dana on channel 4. You okay? I've got you back on GPS. Clean signal for the first time all week.");
    await g.think("I tuned the spare radio to channel 9, just to check. Nothing. Just static. Just dead air.");
    await g.think("I'm keeping Route 9. Nobody else wants it anyway. And I always stop.");
    await g.wait(2500);
  } else {
    await g.think("I'm keeping Route 9. Somebody has to stop.");
    await g.fade(1, 2500);
    await g.think("Three weeks later. A new driver starts on Route 7. First night. Last bus.");
    g.sfx("static", 1);
    await g.say("rhee", "Evening, new driver. This is Rhee, night dispatch. You'll be hearing a lot of me.");
  }
  await g.fade(1, 2000);
}

async function endNotYet(g) {
  g.mood("grief");
  g.lockDoors(true);
  await g.wait(1600);
  await g.think("Nobody moves.");
  await g.say("daniel", "It isn't enough to stop once. You have to be the kind of driver who stops.");
  await g.say("lena", "We'll know when you are.");
  await g.say("lena", "Not yet, sweetheart. Not yet.");
  g.setDoors(false);
  await g.say("teodor", "Tomorrow, then. And the night after. As long as it takes.");
  await g.think("But tonight is his last night. We both know it.");
  g.auto(8);
  await g.wait(4000);
  await g.fade(1, 2500);
  await g.think("Ashgrove is still on my route display when I clock out. It'll be there tomorrow, too.");
  return "notyet";
}

async function endOnTime(g) {
  await g.say("rhee", "Good. GOOD. Back on schedule.");
  g.vanish("teodor");
  g.storm(false);
  g.mood("dread");
  for (let i = 0; i < 14; i++) {
    g.despawn(`g${i}`);
    g.spawn(`m${i}`, i === 0 ? "lena" : i === 1 ? "daniel" : "drowned", { ghost: true, mirrorOnly: true });
    g.seat(`m${i}`, ["L0", "R1", "L2", "R2", "L3", "R3", "L4", "R4", "L5", "R5", "B0", "B1", "B2", "B3"][i]);
  }
  await g.wait(4000);
  g.hint("Check your mirror");
  await g.until(() => g.lookingAtMirror(), 12000);
  g.hint(null);
  await g.think("Every seat is full. Fourteen people, soaked to the bone, staring straight ahead.");
  await g.think("Mom is in the seat right behind me.");
  await g.say("lena", "You didn't stop.");
  g.bus.setWater(0.2);
  await g.wait(2000);
  g.bus.setWater(0.5);
  await g.think("Water is creeping across the floor. I can't feel my feet.");
  g.auto(14);
  await g.arrive("Northgate", { hint: false });
  g.mood("terror");
  await g.think("Northgate. The clock on the dash settles on twelve twenty. Exactly on time.");
  await g.think("My hands on the wheel are gray. Wrinkled. Like they've been underwater for a very long time.");
  await g.say("rhee", "Evening, driver. See you tomorrow night.");
  await g.say("rhee", "And the night after that.");
  await g.scare("face");
  await g.fade(1, 600);
  return "ontime";
}
