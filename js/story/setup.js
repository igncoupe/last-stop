/* ===================================================================
   LAST STOP — story setup
   The story is split into one file per night (night1.js ... night5.js).
   This file holds the characters, the routes, and the scene format.

   A scene looks like this:

     n1_elm: {
       stop: "Elm & 4th",           // where the bus is (must be on tonight's route)
       night: 2,                    // ONLY on a night's first scene (shows the title card)
       mood: "dread",               // music: calm, uneasy, dread, terror, grief, hope, silence
       fx: "storm",                 // view effect: none, dark, storm, flood, red, flicker
       mirror: "oldman",            // rear-view mirror: empty, oldman, wet, uniform, full, face
       amb: { rain: 1 },            // ambience levels 0-1: rain, water, engine
       lines: [
         "Plain strings are narration.",
         { who: "mara", text: "Objects with `who` are dialogue." },
         { text: "Big, important line.", big: true },
         { pause: 1500 },           // dramatic pause (ms)
         { sfx: "knock" },          // sound: knock, bang, static, door, thunder, heartbeat,
                                    //   drip, brake, whisper, coin, lightsout, breath, splash, ring, sting
         { scare: "face" },         // JUMPSCARE: face, hands, eyes
         { fx: "dark", mirror: "wet", mood: "terror" },   // change the look mid-scene
         { shake: true },           // camera shake
         { if: (s) => s.flags.maraHelped, text: "Only shows when the flag is set." },
         { who: "mara", text: "...", vo: "n1_mara_1" },   // plays audio/vo/n1_mara_1.mp3 if it exists
       ],
       choices: [
         { text: "Wait for her.", hint: "+2 min", late: 2, kind: 1, set: { maraHelped: true }, next: "n1_mara" },
       ],
     }

   Choice options:
     late  minutes added to the schedule     kind  hidden kindness points
     warn  dispatch warnings                 set   flags to remember for later
     if    (s) => true/false, hides the choice when false
     next  a scene id, or (s) => scene id, to branch on earlier choices

   `lines`, `choices` and the look fields can be functions of the state: (s) => ...
   `onEnter: (s) => { ... }` runs when the scene starts.
   A scene with `ending: { id, title, blurb, hint }` ends the game.

   Testing: add ?debug to the URL to see the state, or ?debug&scene=n3_start
   to jump straight to a scene.
   =================================================================== */

const FIRST_SCENE = "n1_start";
const SCENES = {};

const SPEAKERS = {
  rhee:    { name: "Rhee · Dispatch", style: "radio" },
  dana:    { name: "Dana · Dispatch (Ch. 4)", style: "radio" },
  teodor:  { name: (s) => (s.flags.knowsVarga ? "Teodor Varga" : "Old man"), style: "teodor" },
  mara:    { name: "Mara", style: "mara" },
  jun:     { name: (s) => (s.flags.junNamed ? "Jun" : "Kid"), style: "jun" },
  junmom:  { name: "Mrs. Park", style: "jun" },
  wet:     { name: (s) => (s.flags.knowsDaniel ? "Daniel" : "Drenched man"), style: "wet" },
  woman:   { name: (s) => (s.flags.knowsLena ? "Lena" : "Woman in the shelter"), style: "woman" },
  ivy:     { name: "Little girl", style: "ivy" },
  rosie:   { name: (s) => (s.flags.metRosie ? "Rosie" : "Woman on the bench"), style: "rosie" },
  harold:  { name: "Harold Rhee", style: "whisper" },
  voices:  { name: "Voices", style: "whisper" },
  radio94: { name: "Radio · 1994", style: "radio" },
  you:     { name: "You", style: "you" },
};

// t = minutes after 11:40 PM that the bus reaches each stop (when on time)
const ROUTE = {
  depot:     { name: "Depot", t: 0 },
  elm:       { name: "Elm & 4th", t: 6 },
  market:    { name: "Market St", t: 12 },
  stagnes:   { name: "St. Agnes", t: 18 },
  canal:     { name: "Canal Row", t: 26 },
  northgate: { name: "Northgate", t: 40 },
};
const mystery = (t) => ({ name: "???", t, mystery: true });
const R = ROUTE;

const NIGHTS = {
  1: { title: "Night 1", subtitle: "Your first run on Route 9.",
       stops: [R.depot, R.elm, R.market, R.stagnes, R.canal, R.northgate, mystery(46)] },
  2: { title: "Night 2", subtitle: "The stop with no name has moved.",
       stops: [R.depot, R.elm, R.market, R.stagnes, R.canal, mystery(33), R.northgate] },
  3: { title: "Night 3", subtitle: "A storm is coming in off the river.",
       stops: [R.depot, R.elm, R.market, R.stagnes, mystery(22), R.canal, R.northgate] },
  4: { title: "Night 4", subtitle: "Channel 9 is still broadcasting.",
       stops: [R.depot, R.elm, R.market, mystery(15), R.stagnes, R.canal, R.northgate] },
  5: { title: "Night 5", subtitle: "Last stop.",
       stops: [R.depot, R.elm, mystery(9), R.market, R.stagnes, R.canal, R.northgate] },
};

/* ---------- little helpers the story files share ---------- */
const minutes = (n) => `${n} minute${n === 1 ? "" : "s"}`;
const lateTonight = (s) => s.late - s.lateAtNightStart;
