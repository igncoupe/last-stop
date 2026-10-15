// Plays the Last Stop story thousands of times with random choices to find
// broken links, crashes, unreachable endings, and estimate play time.
// Usage (needs Node.js): node tools/check-story.js .
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.argv[2];
const files = ["setup.js", "night1.js", "night2.js", "night3.js", "night4.js", "night5.js"];
const ctx = {};
vm.createContext(ctx);
const code = files.map((f) => fs.readFileSync(path.join(root, "js", "story", f), "utf8")).join("\n")
  + "\n;globalThis.__out = { SCENES, NIGHTS, SPEAKERS, FIRST_SCENE };";
vm.runInContext(code, ctx);
const { SCENES, NIGHTS, SPEAKERS, FIRST_SCENE } = ctx.__out;

const problems = new Set();
const resolve = (v, s) => (typeof v === "function" ? v(s) : v);

function fresh() {
  return { scene: null, night: 1, stop: null, late: 0, lateAtNightStart: 0, kind: 0, warn: 0, flags: {}, look: {} };
}

const TYPE_MS = 24, GAP = 420, DRIVE = 2300 + 1500; // drive + a little reading after
const endings = {};
const times = [];
const kinds = [];
const visited = new Set();

function play(strategy) {
  const s = fresh();
  let id = FIRST_SCENE;
  let ms = 0;
  for (let step = 0; step < 400; step++) {
    const sc = SCENES[id];
    if (!sc) { problems.add(`missing scene "${id}"`); return; }
    visited.add(id);
    if (sc.night) { s.night = sc.night; s.lateAtNightStart = s.late; s.stop = sc.stop; ms += 4000; }
    else if (sc.stop !== s.stop) ms += DRIVE;
    s.stop = sc.stop;
    const night = NIGHTS[s.night];
    if (!night.stops.some((st) => st.name === sc.stop)) problems.add(`${id}: stop "${sc.stop}" not on night ${s.night}`);
    if (sc.onEnter) sc.onEnter(s);
    let lines;
    try { lines = resolve(sc.lines, s) || []; } catch (e) { problems.add(`${id}: lines crashed: ${e.message}`); return; }
    for (const raw of lines) {
      const line = typeof raw === "string" ? { text: raw } : raw;
      if (!line || typeof line !== "object") { problems.add(`${id}: bad line ${JSON.stringify(raw)}`); continue; }
      if (line.if && !line.if(s)) continue;
      if (line.set) Object.assign(s.flags, line.set);
      if (line.who && !SPEAKERS[line.who]) problems.add(`${id}: unknown speaker "${line.who}"`);
      if (line.scare) ms += 820;
      if (line.pause) ms += line.pause;
      if (line.text !== undefined) {
        const t = resolve(line.text, s);
        if (typeof t !== "string") problems.add(`${id}: text is not a string`);
        ms += t.length * TYPE_MS + (t.match(/[.!?]/g) || []).length * TYPE_MS * 8 + GAP + (line.after || 0) + 900; // +reading time
      }
    }
    if (sc.ending) { endings[sc.ending.id] = (endings[sc.ending.id] || 0) + 1; times.push(ms); kinds.push(s.kind); return; }
    let choices;
    try { choices = (resolve(sc.choices, s) || []).filter((c) => !c.if || c.if(s)); } catch (e) { problems.add(`${id}: choices crashed: ${e.message}`); return; }
    if (!choices.length) { problems.add(`${id}: dead end (no choices)`); return; }
    let c;
    if (strategy === "kind") c = choices.reduce((a, b) => ((b.kind || 0) > (a.kind || 0) ? b : a), choices[0]);
    else if (strategy === "cold") c = choices.reduce((a, b) => ((b.kind || 0) < (a.kind || 0) ? b : a), choices[choices.length - 1]);
    else c = choices[Math.floor(Math.random() * choices.length)];
    ms += 3000; // thinking about the choice
    if (c.late) s.late += c.late;
    if (c.kind) s.kind += c.kind;
    if (c.warn) s.warn += c.warn;
    if (c.set) Object.assign(s.flags, c.set);
    id = resolve(c.next, s);
  }
  problems.add("run never ended");
}

for (let i = 0; i < 5000; i++) play("random");
for (let i = 0; i < 300; i++) play("kind");
for (let i = 0; i < 300; i++) play("cold");

const unvisited = Object.keys(SCENES).filter((k) => !visited.has(k));
const mins = (ms) => (ms / 60000).toFixed(1);
times.sort((a, b) => a - b);
console.log("scenes:", Object.keys(SCENES).length, "unvisited:", unvisited.join(", ") || "none");
console.log("endings reached:", JSON.stringify(endings));
console.log("play time (min): shortest", mins(times[0]), "median", mins(times[Math.floor(times.length / 2)]), "longest", mins(times[times.length - 1]));
console.log("kindness: max", Math.max(...kinds), "min", Math.min(...kinds));
console.log(problems.size ? "PROBLEMS:\n- " + [...problems].join("\n- ") : "no problems found");
