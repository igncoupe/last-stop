// The trailer's sound, recorded from the game itself (a test run with &sound, the game frozen): ambience, the
// score's moods, effects and voice lines, each to its own WAV through the game's own mix.
import * as C from "./capture.js";
import { CAST } from "../../js/story/cast.js";

const L = () => window.__lastStop;
const S = () => L().Sound;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OFF = { rain: 0, engine: 0, water: 0, hum: 0, wind: 0, tires: 0 };

// nothing playing: no ambience, no score
export async function hush(settle = 1600) {
  S().ambience(OFF);
  S().engine(0, 0);
  S().mood("silence");
  S().underwater(false, 0.05);
  await sleep(settle);
}
// ---------- what there is to record
export const AMBIENCE = {
  amb_rain_engine: { secs: 20, start: () => { S().ambience({ rain: 1, engine: 1, tires: 0.6 }); S().engine(0.75, 0.55); } },
  amb_rain: { secs: 16, start: () => S().ambience({ rain: 1, wind: 0.6 }) },
  amb_underwater: { secs: 12, start: () => { S().underwater(true, 0.05); S().ambience({ water: 1 }); } },
};
export const MOODS = { uneasy: 22, dread: 26, terror: 22, grief: 18 };
export const SFX = [
  ["sting"], ["rise", 3], ["slam"], ["crack"], ["shriek"], ["scream", 1.9], ["heartbeat", 10, 112], ["static", 1.4],
  ["splash"], ["gush", 4], ["bubbles", 3], ["lightsout"], ["moan", 7], ["knock", 3], ["bang"], ["thunder"],
  ["bushorn"], ["horn", 1.2], ["squeak", 4], ["whisper"], ["groan", 4], ["gasp"], ["click"], ["brake"], ["screech"],
  ["door"], ["beeps", 4, 1.05], ["ring", 1], ["breath"], ["drip"],
];
const SFX_SECS = { moan: 8, thunder: 5, gush: 5, heartbeat: 7, groan: 5, rise: 4, squeak: 5, ring: 4, beeps: 5, breath: 4, bubbles: 4 };

export async function ambience(names = Object.keys(AMBIENCE)) {
  for (const n of names) {
    await hush();
    await C.listen(n, AMBIENCE[n].secs, async () => AMBIENCE[n].start());
  }
  await hush(200);
}
export async function moods(names = Object.keys(MOODS)) {
  for (const n of names) {
    await hush(2500);
    await C.listen(`mood_${n}`, MOODS[n], async () => S().mood(n));
  }
  await hush(200);
}
export async function sfx(list = SFX) {
  for (const [name, ...args] of list) {
    await C.listen(`sfx_${name}`, (SFX_SECS[name] || 3) + 0.6, async () => { await sleep(150); S().sfx(name, ...args); });
  }
}
// voice lines by id: [who, id] (who sets the effect: Rhee on the radio, the drowned doubled, your thoughts close)
export async function voices(list, { underwater = false } = {}) {
  if (underwater) S().underwater(true, 0.05);
  for (const [who, id] of list) {
    let done = false;
    const rec = C.listen(`vo_${id}`, 0.5, async () => {
      await sleep(150);
      await S().voice(id, { fx: CAST[who].fx });
      done = true;
    });
    await rec;
    if (!done) throw new Error("voice didn't play: " + id);
  }
  if (underwater) S().underwater(false, 0.05);
}
