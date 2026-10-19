// NIGHT 5 — "Last stop." Rosie. Teodor's confession. Ashgrove. The endings.
// Kindness: give Rosie the present / tell her about her dad (+1)
import * as THREE from "three";
import { STOPS, route, LANE, CURB } from "../world/route.js";
import { SELF_LAYER } from "../world/selfBody.js";
import { makeGhostBus } from "../world/ghostBus.js";
import { curb, mysteryCurb, clockIn, closeDoorsAndGo, openUp, KIND_ENOUGH } from "./common.js";

export async function night5(g) {
  const f = g.flags;
  const doorOutside = () => g.bus.group.localToWorld(g.bus.boardPath[0].clone());
  g.mood("dread");
  g.amb({ rain: 0.4 });
  await g.wait(900);
  await g.think("Last night. I reached into my pocket for my keys and found coins instead. Four of them. Heavy. Worn smooth.");
  if (f.hasBadge) await g.muse("And the brass badge. T. Varga. It's warm, like someone was just holding it.");
  await g.think("Thirty-two years. Tonight I find out if she ever gets home.");
  await clockIn(g);
  await g.muse("The stain on the back seat has spread across three seats now.");
  g.sfx("static", 0.8);
  await g.say("rhee", "Last run, driver. Big night. Full bus.");
  await g.say("rhee", "You know what to do. You make up the time.");

  // ---------- someone in from the rain, at the depot doors
  const marcus = g.spawn("marcus", "marcus", { at: new THREE.Vector3(-4.9, 0, -12.6), yaw: Math.PI });
  await marcus.walk([doorOutside()], { speed: 1.5 });
  await g.say("marcus", "Hey, sir. Is this the 9? Does it still go out to Ashgrove?");
  const ride = await g.choose(["“Get on.”", "“Not in service. Sorry.”"]);
  if (ride === 0) {
    g.kind();
    f.marcusRode = true;
    f.metMarcus = true;
    await g.board("marcus", "L2", 1.5);
    await g.think("He paid with a token. They stopped making tokens before I was born.");
    await g.say("marcus", "Sorry, sir. I'm Marcus. I'm a little nervous. I'm going to ask her tonight. I've had the ring a month.");
  } else {
    await g.say("marcus", "Right. Course not, sir. Not anymore.");
    marcus.walk([new THREE.Vector3(-4.9, 0, -6)], { speed: 1.2 }).then(() => g.vanish("marcus"));
  }
  await closeDoorsAndGo(g);

  // ---------- the other Route 9, going the other way
  await g.until(() => g.d > 85, 40000);
  if (g.d < 190) await oldNine(g);

  // ---------- Elm & 4th: Rosie, and Teodor in uniform
  const elm = STOPS["Elm & 4th"];
  g.spawn("rosie", "rosie", { at: curb("Elm & 4th", -1, 7.1), yaw: route.heading(elm) + Math.PI / 2 });
  const teo = g.spawn("teodor", "uniform", { at: curb("Elm & 4th", 3, 6.2), yaw: route.heading(elm) + Math.PI / 2 });
  await g.until(() => g.d > elm - 120 || g.drive.stoppedNear(elm));
  // tonight the bus knows where it's stopping
  const pulled = g.drive.stoppedNear(elm) ? Promise.resolve() : g.autoStop(elm);
  // ...and you only say what you see once they come out of the fog, under the streetlight
  await g.until(() => g.d > elm - 38 || g.drive.stoppedNear(elm));
  g.look(() => teo.root.localToWorld(new THREE.Vector3(0, 1.5, 0)));
  await g.muse("Two people at Elm and Fourth. A woman on the bench. And a man under the streetlight in an old brown driver's uniform.");
  await pulled;
  g.release();
  await openUp(g, 60000);
  g.lockDoors(true);           // the doors stay open until they're done
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
  // he takes his cap off before he gets on, the way you would at a door you've come back to
  const cap = g.actor("teodor").capOff(1.8);
  await g.muse("The man in the uniform took off his cap. He's getting on.");
  await cap;
  await g.board("teodor", "L0", 1.1);
  g.sfx("coin");
  await g.say("teodor", "March fourteenth, nineteen ninety-four. I was eleven minutes late.");
  await g.say("teodor", "I asked to wait out the storm. Harold said no. Harold said make up the time. And I was scared of losing my job, and I had a schedule, and I did what I was told.");
  await g.say("teodor", "Fourteen people. Lena. Daniel. Little Ivy. Eleven more. I knew every one of their faces. I used to wave.");
  if (f.eddieRode || f.dorothyRode || f.frankRode || f.carmenRode || f.marcusRode) {
    await g.say("teodor", "Eddie. Mrs. Kessler. Frank, with his mail. Carmen. Marcus. You've met them. They've been riding with you all week.");
  }
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
  g.lockDoors(false);
  await closeDoorsAndGo(g);

  // ---------- Ashgrove
  const md = g.mysteryAhead();   // never behind you
  const crowd = [];
  for (let i = 0; i < 14; i++) {
    const look = ["lena", "daniel", "ivy", "eddie", "dorothy", "frank", "carmen", "marcus"][i] || "drowned";
    crowd.push(g.spawn(`g${i}`, look, { ghost: true, at: mysteryCurb(g, -2.4 + (i % 7) * 0.8, 6.0 + Math.floor(i / 7) * 0.8), yaw: route.heading(md) + Math.PI / 2 }));
  }
  await g.until(() => g.d > md - 80);
  g.sky("storm");
  g.storm(true);
  g.mood("terror");
  await g.autoStop(md);
  g.props.mystery.named = true;
  g.mysteryName("ASHGROVE");
  g.route("ASHGROVE", false);
  g.sfx("thunder");
  await g.think("The display stopped flickering. For the first time, the stop has a name. Ashgrove.");
  await g.think("Fourteen of them. Standing in a rain that isn't falling anywhere else. They're not knocking. They're just waiting. Like they always have.");
  if (f.marcusRode && g.actor("marcus")) {
    g.vanish("marcus");
    await g.think("Marcus's seat is empty. He's out there with them, in the rain. He's still smiling.");
  }
  g.actor("g0")?.watch(g.camera);             // your mother, at the front of the shelter, looking right at you
  await g.say("lena", "Hi, sweetheart.");
  await g.think("Mom.");
  f.knowsMother = true;
  g.sfx("static", 1.4);
  // between the drowned and the doors: the shadow, arms out, keeping them off the bus
  g.shadeAt(mysteryCurb(g, 0.7, 4.7), "bar", route.at(md + 0.7, LANE, 1.6));
  g.sfx("thunder");
  await g.say("rhee", "DRIVER.");
  await g.say("rhee", "You are ELEVEN MINUTES LATE. You will MAKE. UP. THE. TIME.");
  g.sfx("spark");
  g.shake(1.4);
  await g.say("rhee", "The schedule ALWAYS comes first. That's the JOB.");
  await g.say("teodor", "Please.");
  await g.think("And between them and my doors, the shadow. Arms out. Keeping them off my bus. It's been keeping them off for thirty-two years.");
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
  const gone = g.shadeDissolve(2.6);
  await g.think("The shadow at the doors is coming apart. Like smoke. Like it was only ever his voice.");
  await gone;
  g.storm(false);
  g.amb({ rain: 0.2 });
  await g.wait(2600);
  await g.think("Dead air. It's the best sound I've ever heard.");
  g.spawn("harold", "harold", { ghost: true });
  g.seat("harold", "B2");
  g.sfx("breath");
  await g.muse("Someone's crying in the back row. A thin, gray man in a dispatcher's cardigan, with a headset around his neck.");
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
  if (!deadAir && g.shade.visible) {
    // one step back and to the side, out of their way, arms down. It doesn't leave.
    const sh = g.shade.root;
    const from = sh.position.clone();
    const to = mysteryCurb(g, 0.7 + 2.6, 6.3);
    g.sfx("skitter", 0.5);
    let t = 0;
    await g.frames((dt) => {
      t = Math.min(1, t + dt / 0.7);
      sh.position.lerpVectors(from, to, t * t * (3 - 2 * t));
      return t >= 1;
    });
    g.shadeAt(to, "stand", g.bus.group.localToWorld(new THREE.Vector3(-1.2, 1.6, 4.6)));
    await g.muse("The shadow stepped back from the doors. Just one step. Enough to let them through. It's still watching.");
  }
  // they come aboard one at a time: Daniel first, while you watch
  const order = [["g1", "L1"], ["g0", "R1"], ["g2", "R0"], ["g3", "L2"], ["g4", "R2"], ["g5", "L3"], ["g6", "R3"],
    ["g7", "L4"], ["g8", "R4"], ["g9", "L5"], ["g10", "R5"], ["g11", "L6"], ["g12", "B0"], ["g13", "B1"]];
  const first = g.board("g1", "L1", 1.3);
  await g.wait(400);
  await g.think("For a moment, nobody moves. Then Daniel climbs the steps. He isn't dripping anymore.");
  await first;
  const boarded = [];
  for (const [k, seat] of order.slice(1)) {
    boarded.push(g.board(k, seat, 1.6));
    await g.wait(k === "g2" ? 1900 : 1100);          // a little gap after Ivy, who takes her time on the steps
  }
  await Promise.all(boarded);
  g.sfx("bell");
  await g.wait(500);
  await g.think("Fourteen fares. Fourteen old coins in the box. Ivy rang the bell and giggled.");
  if (g.file && g.file.allPosters()) await g.think("I know all their names now. Lena. Daniel. Ivy. Carmen. Eddie. Grace. Mrs. Kessler. Frank. Marcus. Sam. Rosa. Tommy. Abby. Henry.");
  g.actor("g0")?.watch(g.camera);
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
  // everyone's on: the doors close, and you give him the seat
  g.setDoors(false);
  await g.wait(900);
  await g.fade(1, 1000);
  const P = g.places.bridge;
  g.drive.detach(true);
  P.group.visible = true;
  P.wreckage.visible = false;
  g.sky("void");
  g.bus.group.position.copy(P.start);
  g.bus.group.position.z = P.edge - 120;            // the last stretch of road, then the bridge
  g.bus.group.rotation.set(0, 0, 0);
  g.bus.setDoors(false);
  g.despawn("teodor");
  g.spawn("teodor", "uniform");
  g.actor("teodor").sit(g.bus.group, new THREE.Vector3(0.7, 0.5, 4.75), 0);
  // you stand in the aisle behind him, looking out through the windshield
  g.fixedCamera(g.bus.group, new THREE.Vector3(0.0, 1.78, 3.75), new THREE.Euler(-0.07, Math.PI + 0.08, 0, "YXZ"));
  const stars = starField(P.edge, P.start.x);
  P.group.add(stars);
  P.water.visible = false;           // tonight the river is made of stars
  await g.fade(0, 1400);
  // he drives; as the bridge runs out, a road of starlight lays itself down under the wheels
  const busZ = () => g.bus.group.position.z;
  let said = false;
  let below = false;
  let thought = Promise.resolve();
  await g.frames((dt) => {
    g.bus.group.position.z += 9 * dt;
    g.drive.state.speed = 9;
    stars.userData.update(dt, busZ());
    if (!said && busZ() > P.edge - 55) {
      said = true;
      thought = g.think("He drives like he never left. The road ends. The bridge isn't there anymore. We just keep going.");
    }
    if (!below && busZ() > P.edge + 55) {
      below = true;
      thought = g.think("Below us, the river is full of stars.");
    }
    return busZ() > P.edge + 140;
  });
  await thought;                                   // let the last thought finish
  await g.fade(1, 2500, true);
  await dawn(g, deadAir);
  return deadAir ? "deadair" : "home";
}

// the Route 9 bus of 1994 comes the other way: lit up, full, Teodor at the wheel. He lifts a hand.
async function oldNine(g) {
  const f = g.flags;
  const ghost = makeGhostBus();
  let gd = g.d + 170;
  g.holdTraffic(25);
  g.place(ghost.group, route.at(gd, -LANE, 0), route.heading(gd) + Math.PI);
  ghost.group.visible = true;
  const driver = g.spawn("oldnine", "uniform");
  driver.sit(ghost.group, ghost.driverSeat, 0);
  let passed = false;
  let honked = false;
  const driving = g.frames((dt) => {
    gd -= 5 * dt;                                  // an old bus, taking its time
    ghost.group.position.copy(route.at(gd, -LANE, 0));
    ghost.group.rotation.y = route.heading(gd) + Math.PI;
    const ahead = gd - g.d;
    if (!honked && ahead < 16) {
      honked = true;
      driver.wave(true);
      g.sfx("horn", 0.22);
      g.sfx("whoosh");
    }
    if (!passed && ahead < -6) { passed = true; driver.wave(false); }
    return ahead < -75 || gd < 30;
  });
  await g.until(() => gd - g.d < 75, 15000);     // (its lights, coming out of the fog)
  g.mood("grief");
  await g.muse("A bus, coming the other way. An old one. Brown and cream, like in the photos.");
  await g.until(() => passed, 15000);
  await g.think("Route 9. Ashgrove. The driver had a brown cap. He lifted one hand off the wheel, the way drivers do.");
  if (f.marcusRode) await g.say("marcus", "Huh. Two 9s tonight, sir.");
  await driving;
  ghost.group.visible = false;
  g.despawn("oldnine");
  if (g.d < 370) {
    g.hint("Check your mirror");
    await g.until(() => g.lookingAtMirror() || g.d > 395, 7000);
    g.hint(null);
    await g.muse("It's not in the mirror. There's nothing back there but the road.");
  }
  g.mood("dread");
}

// stars above, and stars in the river below; where the bridge ends, a road of starlight carries on
function starField(edge, laneX) {
  const group = new THREE.Group();
  // a soft round star, not a square
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const x = c.getContext("2d");
  const grad = x.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,250,235,.7)");
  grad.addColorStop(1, "rgba(255,250,235,0)");
  x.fillStyle = grad;
  x.fillRect(0, 0, 16, 16);
  const starTex = new THREE.CanvasTexture(c);
  const twinkle = [];
  const layer = (n, size, color, yMin, yMax, spread = 420) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
      pos[i * 3 + 2] = 60 + Math.random() * 760;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size, map: starTex, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    twinkle.push(m);
    group.add(new THREE.Points(geo, m));
  };
  layer(2600, 0.9, 0xfff4d8, -45, -6);       // the river, deep below
  layer(1400, 1.1, 0xd8e4ff, 10, 140);       // the sky
  layer(240, 2.4, 0xffe2a8, -30, 70);        // a few bright ones
  // the road of light: it lays itself down just ahead of the wheels as the bus leaves the bridge
  const rc = document.createElement("canvas");
  rc.width = 32;
  rc.height = 64;
  const r = rc.getContext("2d");
  const rg = r.createLinearGradient(0, 0, 32, 0);
  rg.addColorStop(0, "rgba(255,230,180,0)");
  rg.addColorStop(0.2, "rgba(255,236,196,.55)");
  rg.addColorStop(0.5, "rgba(255,244,220,.85)");
  rg.addColorStop(0.8, "rgba(255,236,196,.55)");
  rg.addColorStop(1, "rgba(255,230,180,0)");
  r.fillStyle = rg;
  r.fillRect(0, 0, 32, 64);
  for (let i = 0; i < 60; i++) { r.fillStyle = "rgba(255,255,255,.9)"; r.fillRect(Math.floor(4 + Math.random() * 24), Math.floor(Math.random() * 64), 1, 1); }
  const roadTex = new THREE.CanvasTexture(rc);
  roadTex.wrapT = THREE.RepeatWrapping;
  const roadLen = 420;
  roadTex.repeat.set(1, roadLen / 8);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(6.5, roadLen), new THREE.MeshBasicMaterial({ map: roadTex, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(laneX - 3000, 0.02, edge - 8 + roadLen / 2);
  group.add(road);
  // and it lays itself down from the end of the bridge, just ahead of the bus
  const cut = (z) => Math.max(0.001, Math.min(1, (z + 26 - (edge - 8)) / roadLen));
  let t = 0;
  group.userData.update = (dt, busZ) => {
    t += dt;
    road.material.opacity = busZ > edge - 30 ? Math.min(0.85, road.material.opacity + dt * 0.8) : 0;
    const k = cut(busZ);
    road.scale.y = k;
    road.position.z = edge - 8 + (roadLen * k) / 2;
    roadTex.repeat.set(1, (roadLen * k) / 8);
    roadTex.offset.y -= dt * 0.15;
    twinkle.forEach((m, i) => { m.opacity = 0.75 + Math.sin(t * (1.3 + i) + i) * 0.15; });
  };
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
  const junComes = f.junRode || f.junFound;
  if (junComes) {
    const jun = g.spawn("jun", "jun", { at: g.props.terminal.group.localToWorld(new THREE.Vector3(-6, 0, 20)) });
    jun.walk([busDoor.clone().setY(0).add(new THREE.Vector3(2.2, 0, 0))], { speed: 1.8 });
  }
  await g.fade(0, 3000, true);
  await g.muse("Northgate. Morning. The bus is empty, and dry.");
  await g.think("For the first time in thirty-two years, I think she made it home.");
  if (f.maraHelped) {
    await g.read({ kind: "note", lines: ["Mr. Varga passed at 12:31.", "Peacefully.", "He asked if Route 9 was running, and I said yes, and he smiled."], scrawl: "- Mara", neat: true }, [
      "There's a note taped to the driver's window. Mr. Varga passed at twelve thirty-one. Peacefully. He asked if Route 9 was running, and I said yes, and he smiled. Mara.",
    ]);
  }
  if (f.gaveRosie) await g.think("Somewhere across town, a music box is playing on a kitchen table. And a woman is finally asleep.");
  if (junComes) {
    const give = g.handOver("jun", "coffee", { speed: 1.8 });
    await g.wait(700);
    await g.think("Jun is here with two coffees. He doesn't say anything. He just hands me one.");
    await give;
  }
  if (deadAir) {
    g.sfx("static", 0.8);
    await g.say("dana", "Route 9, this is Dana on channel 4. You okay? I've got you back on GPS. Clean signal for the first time all week.");
    await g.muse("I tuned the spare radio to channel 9, just to check. Nothing. Just static. Just dead air.");
    await g.think("I'm keeping Route 9. Nobody else wants it anyway. And I always stop.");
    await g.wait(2500);
  } else {
    await g.think("I'm keeping Route 9. Somebody has to stop.");
    await g.fade(1, 2500);
    g.caption("Three weeks later", "Route 7. A new driver. First night. Last bus.");
    await g.muse("Three weeks later. A new driver starts on Route 7. First night. Last bus.");
    await g.wait(800);
    g.caption("Channel 9", "Somebody is still on the radio.");
    g.sfx("static", 1);
    await g.say("rhee", "Evening, new driver. This is Rhee, night dispatch. You'll be hearing a lot of me.");
    await g.wait(1600);
    g.caption(null);
    await g.wait(1300);
  }
  await g.fade(1, 2000);
}

async function endNotYet(g) {
  g.mood("grief");
  g.lockDoors(true);
  await g.wait(1600);
  await g.muse("Nobody moves.");
  await g.say("daniel", "It isn't enough to stop once. You have to be the kind of driver who stops.");
  await g.say("lena", "We'll know when you are.");
  await g.say("lena", "Not yet, sweetheart. Not yet.");
  g.setDoors(false);
  await g.say("teodor", "Tomorrow, then. And the night after. As long as it takes.");
  await g.think("But tonight is his last night. We both know it.");
  g.auto(8);
  await g.wait(4000);
  await g.fade(1, 2500);
  g.caption("Clocking out", "Ashgrove is still on the route display.");
  await g.muse("Ashgrove is still on my route display when I clock out. It'll be there tomorrow, too.");
  await g.wait(1500);
  g.caption(null);
  await g.wait(1300);
  return "notyet";
}

// you drive away. They don't come after you; they never did. You keep the schedule, every night, for the rest
// of your life, and end up where Teodor did: in Room 4B, asking if Route 9 is running.
async function endOnTime(g) {
  const f = g.flags;
  const md = g.props.mystery.d;
  const up = new THREE.Vector3(0, 1, 0);
  const aimAt = (eye, to) => new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, to, up)));
  g.mood("grief");
  const leftFrom = g.d;
  g.auto(11);                                     // the bus pulls away by itself now; it's on schedule
  await g.say("rhee", "Good. GOOD. Back on schedule.");
  g.late(-g.lateTonight);                         // and the dash says so
  await g.until(() => g.d > leftFrom + 14);       // (clear of the stop)
  // one look back, from the road where the doors were: there they are, still in the shelter. The shadow
  // doesn't need to hold them anymore
  await g.fade(1, 350);
  g.shadeHide();
  const eye = route.at(md + 0.2, 1.4, 1.5);
  g.camera.layers.disable(SELF_LAYER);           // (nobody's body in the driver's seat from out here)
  g.fixedCamera(g.bus.group.parent, eye, aimAt(eye, route.at(md - 0.3, CURB - 1.7, 1.25)));
  g.fade(0, 700);
  await g.wait(900);
  await g.think("They don't run after the bus. They never did. They just stand there in the rain and watch it go.");
  const mom = g.actor("g0");
  if (mom) {
    mom.reachOut(true);                           // she lifts her hand, the way she did at the door
    mom.lookAt(g.bus.group.localToWorld(new THREE.Vector3(0, 1.6, -4)));
  }
  await g.say("lena", "Go on, sweetheart. Don't be late.");
  await g.think("That's what she used to say at the door, every morning. Don't be late.");
  await g.wait(800);
  await g.fade(1, 1200);
  g.camera.layers.enable(SELF_LAYER);
  g.sitInBus();
  g.storm(false);
  g.amb({ rain: 0.15 });
  await g.fade(0, 1000);

  // Teodor saw it all from the seat behind you
  if (g.actor("teodor")) {
    g.lookAtActor("teodor");
    await g.say("teodor", "It's alright. I didn't stop either.");
    await g.say("teodor", "You'll tell yourself you'll stop tomorrow. I told myself that for thirty-two years.");
    await g.say("teodor", "I'm out of tomorrows. You've still got a few.");
    g.sfx("breath");
    g.vanish("teodor");
    await g.wait(1400);
    await g.think("And then the seat was empty.");
  }
  await g.think("Up on the fourth floor of St. Agnes, a monitor just went quiet.");
  if (f.maraHelped) await g.think("I hope Mara was holding his hand.");
  await g.wait(600);
  await g.fade(1, 1600);

  // Northgate, to the minute
  g.despawnAll();
  g.shadeHide();
  g.park();
  g.drive.d = route.length - 32;
  g.route(null);                                  // the sign says Northgate again, like nothing happened
  g.amb({ rain: 0, engine: 0.3 });
  await g.fade(0, 1400);
  await g.muse("Northgate. Twelve twenty. Exactly on time.");
  g.sfx("static", 0.6);
  await g.say("rhee", "Evening, driver. See you tomorrow night.");
  await g.say("rhee", "And the night after that.");
  await g.think("And I was. Every night. I was never late again.");
  await g.wait(800);
  await g.fade(1, 2200);
  await onTimeEpilogue(g);
  return "ontime";
}

// thirty-one years later: Room 4B, from the pillow
async function onTimeEpilogue(g) {
  const H = g.places.hospital;
  const up = new THREE.Vector3(0, 1, 0);
  const look = (eye, to) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, to, up));
  g.caption("Thirty-one years later", "St. Agnes Hospital. 4 West. Room 4B.");
  g.sky("ward");
  g.rain(true);
  g.amb({ rain: 0.25, engine: 0, hum: 1 });
  H.setActive(true);
  H.wipeBoardName();
  // Mara still works nights. She sits with the ones nobody comes for
  const mara = g.spawn("mara", "maraold");
  mara.sit(H.group, H.chairSeat, H.chairYaw);
  const maraFace = H.chairSeat.clone().add(new THREE.Vector3(0.12, 1.12, -0.03));
  g.camera.layers.disable(SELF_LAYER);
  const eye = H.bedEye.clone();
  g.fixedCamera(H.group, eye, new THREE.Euler().setFromQuaternion(look(eye, maraFace)));
  mara.lookAt(H.group.localToWorld(eye.clone()));
  await g.wait(1200);
  await g.fade(0, 3000);
  await g.wait(1400);
  g.caption(null);
  await g.think("I drove Route 9 for thirty-one years. I was never late. Not once.");
  await g.think("Every night I passed the stop with no name, right on time. And every night I told myself: tomorrow.");
  await g.say("mara", "There you are. You were dreaming about the bus again.");
  await g.muse("Mara still works nights. Her hair's gone gray. She sits with the ones nobody comes to see.");
  await g.say("you", "Is Route 9 running?");
  await g.say("mara", "It's running, hon. Right on time.");
  await g.say("you", "Does the new driver stop?");
  await g.wait(900);
  await g.say("mara", "I don't know. I hope so.");
  // you turn your head on the pillow, to the rain on the window
  const from = g.camera.quaternion.clone();
  const to = look(eye, H.winMiddle);
  let t = 0;
  const turning = g.frames((dt) => {
    t = Math.min(1, t + dt / 4.5);
    g.camera.quaternion.slerpQuaternions(from, to, t * t * (3 - 2 * t));
    return t >= 1;
  });
  await g.wait(1600);
  await g.think("Thirty-one years. Tonight I find out if she ever gets home.");
  await turning;
  await g.wait(1500);
  await g.say("lena", "Take your time, sweetheart. I'm still waiting.");
  await g.wait(2600);
  await g.fade(1, 3500);
}
