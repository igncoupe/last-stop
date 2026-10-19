// Trailer capture, run inside a test run of the game (?test...), served by tools/trailer/server.py.
//   const C = await import("/tools/trailer/capture.js");
//   await C.until(() => C.said(/Sir\? Where/));          // let the story (and the bot) get there
//   await C.shoot("01_oldman", 120, { each: (t) => C.look(...) });
// Every frame is one exact 1/30 s step of the game, saved as a PNG: smooth, whatever the speed of the machine.
// What the page lays over the game (the fade, the underwater murk) is drawn onto the frame as well.
const L = () => window.__lastStop;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function save(path, body) {
  const r = await fetch("/__save?path=" + encodeURIComponent(path), { method: "POST", body });
  if (!r.ok) throw new Error("save failed: " + path);
}

// the story so far (the playtester's transcript)
export const log = () => (window.__botReport ? window.__botReport.log : []);
export const said = (re) => log().some((l) => re.test(l));
export async function until(test, ms = 40000) {
  const t0 = Date.now();
  while (!test()) {
    if (Date.now() - t0 > ms) return false;
    await sleep(25);
  }
  return true;
}

// ---------- the camera
// in your seat: turn to look at a point (bus space) or set yaw/pitch (yaw PI = the windshield)
export function seatLook(yaw, pitch = 0) {
  const s = L().player.state;
  s.look = null;
  s.yaw = s.viewYaw = yaw;
  s.pitch = s.viewPitch = pitch;
}
// out of your seat: the camera is ours, anywhere in the world
export function freeCam() {
  const { player, scene, camera } = L();
  player.state.mode = "fixed";
  scene.attach(camera);
}
// ...and back in the driver's seat
export function seatCam() {
  const { player, camera, world } = L();
  player.state.mode = "seat";
  player.state.seatParent.add(camera);
  world.fovOverride = null;
}
export function place(pos, target, fov) {
  const { camera, world } = L();
  camera.position.copy(pos);
  camera.lookAt(target);
  if (fov) { world.fovOverride = fov; camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ---------- what the page draws over the game
function overlays(c, w, h) {
  const uw = document.querySelector(".underwater");
  if (uw && uw.classList.contains("on")) {
    const a = Number(getComputedStyle(uw).opacity) || 0;
    ellipse(c, w, h, 0.5, 0.42, [[0, `rgba(30,80,70,${0.1 * a})`], [0.6, `rgba(4,22,18,${0.45 * a})`], [1, `rgba(0,6,5,${0.88 * a})`]]);
    const d = Number(getComputedStyle(uw, "::before").opacity) || 0;
    if (d > 0.01) ellipse(c, w, h, 0.5, 0.46, [[0.3, "rgba(0,0,0,0)"], [0.6, `rgba(0,0,0,${0.6 * d})`], [0.88, `rgba(0,0,0,${0.96 * d})`], [1, `rgba(0,0,0,${0.96 * d})`]]);
  }
  const fade = document.getElementById("fade");
  const f = Number(getComputedStyle(fade).opacity) || 0;
  if (f > 0.003) {
    c.fillStyle = fade.classList.contains("white") ? `rgba(244,241,234,${f})` : `rgba(0,0,0,${f})`;
    c.fillRect(0, 0, w, h);
  }
}
// a CSS-style radial gradient (an ellipse reaching the farthest corner)
function ellipse(c, w, h, cx, cy, stops) {
  const x = cx * w;
  const y = cy * h;
  const rx = Math.max(x, w - x) * Math.SQRT2;
  const ry = Math.max(y, h - y) * Math.SQRT2;
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  const gr = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  c.fillStyle = gr;
  c.fillRect(-x, -y * (rx / ry), w, h * (rx / ry));
  c.restore();
}

// ---------- recording
// `frames` exact steps of the game, each saved as shot/0000.png ... (each(t, i) runs before every step)
export async function shoot(shot, frames, { fps = 30, each = null, from = 0 } = {}) {
  window.__manual = true;
  const view = L().renderer.domElement;
  const out = document.createElement("canvas");
  out.width = view.width;
  out.height = view.height;
  const c = out.getContext("2d");
  const pending = [];
  for (let i = from; i < from + frames; i++) {
    if (each) each(i / fps, i);
    window.__tick(1 / fps);
    c.drawImage(view, 0, 0);
    overlays(c, out.width, out.height);
    const blob = await new Promise((r) => out.toBlob(r, "image/png"));
    pending.push(save(`${shot}/${String(i).padStart(4, "0")}.png`, blob));
    if (pending.length > 8) await pending.shift();
  }
  await Promise.all(pending);
  return { shot, frames: from + frames, size: [out.width, out.height] };
}
// let the game run on by itself again
export function release() { window.__manual = false; }

// ---------- sound: everything the game plays, recorded losslessly to a WAV
export async function listen(name, seconds, start = null) {
  const { ctx, out } = window.__soundOut;
  if (ctx.state !== "running") await ctx.resume();
  const tap = ctx.createScriptProcessor(4096, 2, 2);
  const left = [];
  const right = [];
  tap.onaudioprocess = (e) => {
    left.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    right.push(new Float32Array(e.inputBuffer.getChannelData(1)));
  };
  out.connect(tap);
  tap.connect(ctx.destination);
  if (start) await start();
  await sleep(seconds * 1000);
  out.disconnect(tap);
  tap.disconnect();
  await save(`audio/${name}.wav`, wav([left, right], ctx.sampleRate));
  return { name, seconds, rate: ctx.sampleRate };
}
function wav(chans, rate) {
  const n = chans[0].reduce((a, b) => a + b.length, 0);
  const buf = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((ch, i) => buf.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); buf.setUint32(4, 36 + n * 4, true); str(8, "WAVE"); str(12, "fmt ");
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 2, true); buf.setUint32(24, rate, true);
  buf.setUint32(28, rate * 4, true); buf.setUint16(32, 4, true); buf.setUint16(34, 16, true); str(36, "data");
  buf.setUint32(40, n * 4, true);
  let o = 44;
  const flat = chans.map((parts) => { const a = new Float32Array(n); let p = 0; parts.forEach((x) => { a.set(x, p); p += x.length; }); return a; });
  for (let i = 0; i < n; i++) {
    for (const a of flat) { buf.setInt16(o, Math.max(-1, Math.min(1, a[i])) * 32767, true); o += 2; }
  }
  return new Blob([buf], { type: "audio/wav" });
}

// ---------- a subtitle, the way the game shows them: the speaker's name in their color, the words on a dark band
export async function subtitle(name, who, color, text, { inner = false, w = 1920, h = 1080, size = 36, maxW = 1380 } = {}) {
  await document.fonts.load(`500 ${size}px Inter`);
  await document.fonts.load(`700 ${size}px Inter`);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  const label = inner ? `${who} (in your head):` : `${who}:`;
  const fontWho = `${inner ? "" : ""}${inner ? 600 : 700} ${size}px Inter`;
  const fontText = `${inner ? "italic " : ""}500 ${size}px Inter`;
  // wrap: the name and the words flow together, like an inline span
  const words = text.split(" ");
  const lines = [];
  c.font = fontWho;
  let line = [{ t: label + " ", who: true }];
  let lw = c.measureText(label + " ").width;
  c.font = fontText;
  for (const wd of words) {
    const ww = c.measureText(wd + " ").width;
    if (lw + ww > maxW && line.length) { lines.push(line); line = []; lw = 0; }
    line.push({ t: wd + " ", who: false });
    lw += ww;
  }
  lines.push(line);
  const lh = size * 1.45;
  let y = h - h * 0.09 - lines.length * lh;
  c.textBaseline = "middle";
  for (const ln of lines) {
    const widths = ln.map((p) => { c.font = p.who ? fontWho : fontText; return c.measureText(p.t).width; });
    const total = widths.reduce((a, b) => a + b, 0) - c.measureText(" ").width;
    let x = (w - total) / 2;
    c.fillStyle = "rgba(0,0,0,0.72)";
    c.fillRect(x - 14, y, total + 28, lh);
    ln.forEach((p, i) => {
      c.font = p.who ? fontWho : fontText;
      c.fillStyle = p.who ? color : inner ? "#d9dde4" : "#e8e8e8";
      if (p.who && inner) c.globalAlpha = 0.85;
      c.fillText(p.t, x, y + lh / 2 + 1);
      c.globalAlpha = 1;
      x += widths[i];
    });
    y += lh;
  }
  await save(`text/${name}.png`, await new Promise((r) => cv.toBlob(r, "image/png")));
}

// ---------- text, set in the game's own typefaces (VT323, Inter), saved as transparent PNGs
export async function text(name, lines, { w = 1920, h = 1080, font = "VT323", size = 96, color = "#ffb54a", glow = "rgba(255,181,74,0.45)", spacing = 0.12, y = 0.5, gap = 1.2, sizes = null, colors = null } = {}) {
  await document.fonts.load(`${size}px ${font}`);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  c.textAlign = "center";
  c.textBaseline = "middle";
  const total = lines.reduce((a, _, i) => a + (sizes ? sizes[i] : size) * gap, 0);
  let cy = y * h - total / 2;
  lines.forEach((line, i) => {
    const sz = sizes ? sizes[i] : size;
    cy += (sz * gap) / 2;
    c.font = `${sz}px ${font}`;
    if (c.letterSpacing !== undefined) c.letterSpacing = `${spacing * sz}px`;
    c.shadowColor = glow;
    c.shadowBlur = sz * 0.35;
    c.fillStyle = colors ? colors[i] : color;
    c.fillText(line, w / 2, cy);
    c.shadowBlur = 0;
    c.fillText(line, w / 2, cy);
    cy += (sz * gap) / 2;
  });
  await save(`text/${name}.png`, await new Promise((r) => cv.toBlob(r, "image/png")));
}
