// Who's who: subtitle names and colors, voice effects in the game, and the
// Kokoro voice their reference clip (tools/refs) was first made with.
//   fx:    dry | inner | radio | phone | ghost | whisper
//   voice: Kokoro voice id; speed and pitch shape it (pitch < 1 = deeper)
export const CAST = {
  you:     { name: "You", color: "#cfd3da", fx: "inner", voice: "am_michael", speed: 1.0, pitch: 0.98 },
  rhee:    { name: "Rhee (Dispatch)", color: "#86cf9b", fx: "radio", voice: "am_fenrir", speed: 0.94, pitch: 0.9 },
  dana:    { name: "Dana (Dispatch)", color: "#9fd6ff", fx: "radio", voice: "af_aoede", speed: 1.05, pitch: 1.0 },
  radio94: { name: "Radio", color: "#86cf9b", fx: "radio", voice: "bm_lewis", speed: 1.0, pitch: 0.96 },
  teodor:  { name: (f) => (f.knowsVarga ? "Teodor" : "Old man"), color: "#dfbd88", fx: "dry", voice: "bm_george", speed: 0.85, pitch: 0.88 },
  mara:    { name: "Mara", color: "#8cc2ff", fx: "dry", voice: "af_heart", speed: 1.02, pitch: 1.0 },
  jun:     { name: (f) => (f.junNamed ? "Jun" : "Kid"), color: "#c6a3ff", fx: "dry", voice: "am_puck", speed: 1.06, pitch: 1.1 },
  junmom:  { name: "Mrs. Park", color: "#c6a3ff", fx: "dry", voice: "af_sarah", speed: 1.0, pitch: 1.0 },
  momcall: { name: "Mrs. Park (phone)", color: "#c6a3ff", fx: "phone", voice: "af_sarah", speed: 1.0, pitch: 1.0 },
  daniel:  { name: (f) => (f.knowsDaniel ? "Daniel" : "Drenched man"), color: "#78c0b8", fx: "ghost", voice: "bm_fable", speed: 0.9, pitch: 0.95 },
  lena:    { name: (f) => (f.knowsMother ? "Mom" : f.knowsLena ? "Lena" : "Woman in the shelter"), color: "#e59ab0", fx: "ghost", voice: "bf_emma", speed: 0.92, pitch: 0.98 },
  ivy:     { name: "Little girl", color: "#f2d36b", fx: "ghost", voice: "af_bella", speed: 0.88, pitch: 1.3 },
  rosie:   { name: (f) => (f.metRosie ? "Rosie" : "Woman on the bench"), color: "#f0b98a", fx: "dry", voice: "af_kore", speed: 0.98, pitch: 1.0 },
  teodor94: { name: "Route 9 (tape, 1994)", color: "#dfbd88", fx: "radio", voice: "bm_george", speed: 0.92, pitch: 0.92 },
  rhee94:  { name: "Dispatch (tape, 1994)", color: "#86cf9b", fx: "radio", voice: "am_fenrir", speed: 0.96, pitch: 0.92 },
  harold:  { name: "Harold Rhee", color: "#9aa0ad", fx: "ghost", voice: "am_fenrir", speed: 0.86, pitch: 0.92 },
  voices:  { name: "Voices", color: "#9aa0ad", fx: "whisper", voice: "af_nicole", speed: 0.85, pitch: 0.97 },
  // five more of the fourteen. They seem alive. (Their voices were designed with tools/design_voices.py.)
  eddie:   { name: (f) => (f.metEddie ? "Eddie" : "Kid in an apron"), color: "#e8c98a", fx: "dry", voice: "am_puck", speed: 1.05, pitch: 1.05 },
  dorothy: { name: (f) => (f.metDorothy ? "Mrs. Kessler" : "Old woman"), color: "#d3a6d0", fx: "dry", voice: "bf_isabella", speed: 0.9, pitch: 0.95 },
  frank:   { name: (f) => (f.metFrank ? "Frank" : "Mailman"), color: "#9fc0e8", fx: "dry", voice: "am_adam", speed: 1.0, pitch: 0.95 },
  carmen:  { name: (f) => (f.metCarmen ? "Carmen" : "Young woman"), color: "#f2a0a0", fx: "dry", voice: "af_river", speed: 1.0, pitch: 1.0 },
  marcus:  { name: (f) => (f.metMarcus ? "Marcus" : "Young man"), color: "#9fe0b8", fx: "dry", voice: "am_eric", speed: 1.0, pitch: 0.98 },
};

// the words that actually get spoken for a dialogue option, or null for
// actions like "[Say nothing]"
export function spoken(text) {
  const t = text.trim();
  if (t.startsWith("[")) return null;
  return t.replace(/^[“"]/, "").replace(/[”"]$/, "");
}

// stable id for a line: the voice file is voices/<id>.mp3
export function lineId(who, text) {
  let h = 0x811c9dc5;
  const s = `${who}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
