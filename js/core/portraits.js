// Photos of people, painted the way the people in the game look (blocky, the same skin, hair and clothes),
// so a photo is never a blank grey shape: Jun on his missing poster, the fourteen in the newspaper,
// Teodor as employee of the month in 1994.

const PEOPLE = {
  jun:     { skin: "#d9b28f", hair: "#0e0e10", shirt: "#26292e", hood: true, straps: "#d8b21e" },
  lena:    { skin: "#c49a7a", hair: "#4a3626", shirt: "#7a5a6a" },
  daniel:  { skin: "#c6a184", hair: "#241c16", shirt: "#23262c" },
  ivy:     { skin: "#e0b996", hair: "#3a2a1a", shirt: "#e0b42a", hood: true, child: true },
  kid:     { skin: "#d8b08e", hair: "#2a1d14", shirt: "#8fb0d0", child: true },
  varga:   { skin: "#cdb8a4", hair: "#5a4532", shirt: "#5a4632", cap: "#4a3a2a", mustache: true },
  a:       { skin: "#a77b5e", hair: "#1a1210", shirt: "#3d6fa8" },
  b:       { skin: "#d6b096", hair: "#7a7a7a", shirt: "#6b6f72" },
  c:       { skin: "#8a5e44", hair: "#141010", shirt: "#5d6e5a" },
  d:       { skin: "#e1c2a6", hair: "#b08848", shirt: "#3b2b2b" },
  e:       { skin: "#b98a6c", hair: "#2b211a", shirt: "#2f3a40" },
  f:       { skin: "#d2a988", hair: "#9a9a9a", shirt: "#4a4038" },
  // the rest of the fourteen
  eddie:   { skin: "#b8865f", hair: "#15100c", shirt: "#e4e1d8" },
  dorothy: { skin: "#d8bfab", hair: "#d4d0cc", shirt: "#6b4f6a" },
  frank:   { skin: "#d3ad8c", hair: "#5a4a3c", shirt: "#3f5370", mustache: true },
  carmen:  { skin: "#c49470", hair: "#120d0a", shirt: "#8a4a5a" },
  marcus:  { skin: "#6e4a33", hair: "#0e0b09", shirt: "#2f4a3a" },
  grace:   { skin: "#e0c0a2", hair: "#a8743a", shirt: "#d06a70" },
  sam:     { skin: "#8a5e44", hair: "#141010", shirt: "#5d6e5a" },
  rosa:    { skin: "#c99a78", hair: "#3a2a22", shirt: "#6a3d4e" },
  thomas:  { skin: "#dcb48e", hair: "#0d0b0a", shirt: "#3a4a6a" },
  abby:    { skin: "#e3c3a3", hair: "#140f0c", shirt: "#a83a32" },
  henry:   { skin: "#d2a988", hair: "#9a9a9a", shirt: "#4a4038", mustache: true },
};

// one person, head and shoulders, standing on baseY, centred on cx; u is the size of a "pixel"
function person(x, cx, baseY, u, p) {
  const k = p.child ? 0.72 : 1;
  const sw = 13 * u * k;                 // shoulders
  const sh = 7 * u * k;
  const hw = 7 * u * k;                  // head
  const hh = 8 * u * k;
  const headY = baseY - sh - 1.5 * u * k - hh;
  x.fillStyle = p.shirt;
  x.fillRect(cx - sw / 2, baseY - sh, sw, sh + 1);
  if (p.straps) { x.fillStyle = p.straps; x.fillRect(cx - sw / 2 + 2 * u, baseY - sh, 1.5 * u, sh); x.fillRect(cx + sw / 2 - 3.5 * u, baseY - sh, 1.5 * u, sh); }
  x.fillStyle = p.skin;
  x.fillRect(cx - 1.5 * u * k, baseY - sh - 1.6 * u * k, 3 * u * k, 1.8 * u * k);   // neck
  if (p.hood) { x.fillStyle = p.shirt; x.fillRect(cx - hw / 2 - 1.3 * u * k, headY - 1.2 * u * k, hw + 2.6 * u * k, hh + 1.6 * u * k); }
  x.fillStyle = p.skin;
  x.fillRect(cx - hw / 2, headY, hw, hh);
  x.fillStyle = p.hair;
  x.fillRect(cx - hw / 2, headY, hw, 2 * u * k);                                     // hair on top
  if (!p.hood) { x.fillRect(cx - hw / 2, headY, 1 * u * k, 4 * u * k); x.fillRect(cx + hw / 2 - 1 * u * k, headY, 1 * u * k, 4 * u * k); }
  if (p.cap) { x.fillStyle = p.cap; x.fillRect(cx - hw / 2 - 0.5 * u, headY - 1.4 * u, hw + u, 2.4 * u); x.fillStyle = "#1a140e"; x.fillRect(cx - hw / 2, headY + 0.8 * u, hw + 1.6 * u, 0.9 * u); }
  x.fillStyle = "#151515";
  x.fillRect(cx - 2.2 * u * k, headY + 3.6 * u * k, 1.3 * u * k, 1.2 * u * k);       // eyes
  x.fillRect(cx + 0.9 * u * k, headY + 3.6 * u * k, 1.3 * u * k, 1.2 * u * k);
  if (p.mustache) { x.fillStyle = p.hair; x.fillRect(cx - 1.8 * u, headY + 5.6 * u, 3.6 * u, 0.9 * u); }
  x.fillStyle = "rgba(60,30,25,.7)";
  x.fillRect(cx - 1.4 * u * k, headY + 6.4 * u * k, 2.8 * u * k, 0.7 * u * k);         // mouth
  return { headY, hw, hh };
}

// an old photo: grain, and sepia (newsprint) or grey (a photocopied poster)
function age(x, w, h, tone) {
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 + (Math.random() - 0.5) * 22;
    if (tone === "gray") { d[i] = d[i + 1] = d[i + 2] = l; }
    else if (tone === "sepia") { d[i] = l * 1.07 + 18; d[i + 1] = l * 0.95 + 8; d[i + 2] = l * 0.78; }
    else { d[i] += (Math.random() - 0.5) * 14; d[i + 1] += (Math.random() - 0.5) * 14; d[i + 2] += (Math.random() - 0.5) * 14; }
  }
  x.putImageData(img, 0, 0);
}

// draw a photo into a canvas context at (px, py), w x h
export function drawPhoto(ctx, kind, px, py, w, h, { tone = null } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  if (kind === "jun") {
    x.fillStyle = "#6f87a3"; x.fillRect(0, 0, w, h);                 // a school photo backdrop
    const g = x.createRadialGradient(w / 2, h * 0.4, 2, w / 2, h * 0.4, w * 0.7);
    g.addColorStop(0, "rgba(255,255,255,.25)"); g.addColorStop(1, "rgba(0,0,0,.15)");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    person(x, w / 2, h + 1, w / 17, PEOPLE.jun);
    age(x, w, h, tone || "gray");
  } else if (kind === "victims") {
    // fourteen people in two rows, on the steps of a bus, a long time ago. A woman holding a child on her hip.
    x.fillStyle = "#8c8574"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#6e6a5c"; x.fillRect(0, h * 0.62, w, h * 0.38);
    const back = ["henry", "sam", "daniel", "frank", "dorothy", "rosa", "marcus"];
    const front = ["lena", "ivy", "carmen", "eddie", "grace", "thomas", "abby"];
    const u = w / 105;
    back.forEach((k, i) => person(x, (i + 0.5) * (w / 7), h * 0.66, u, PEOPLE[k]));
    front.forEach((k, i) => {
      const cx = (i + 0.5) * (w / 7) + (i % 2 ? 3 : -3);
      person(x, cx, h + 2, u * 1.08, PEOPLE[k]);
      if (k === "lena") person(x, cx + 6 * u, h * 0.86, u * 0.85, PEOPLE.kid);     // the kid on her hip
    });
    age(x, w, h, tone || "sepia");
  } else if (kind === "varga") {
    x.fillStyle = "#7d8c95"; x.fillRect(0, 0, w, h);
    person(x, w / 2, h + 1, w / 16, PEOPLE.varga);
    x.fillStyle = "#c9a640"; x.fillRect(w / 2 + w * 0.12, h - w * 0.22, w * 0.08, w * 0.05);   // his badge
    age(x, w, h, tone || "sepia");
  } else if (kind.startsWith("person:") && PEOPLE[kind.slice(7)]) {
    // one of them, head and shoulders: a school photo, a work ID, a snapshot someone gave the paper
    x.fillStyle = "#7a8794"; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h * 0.4, 2, w / 2, h * 0.4, w * 0.7);
    g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(1, "rgba(0,0,0,.18)");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const who = PEOPLE[kind.slice(7)];
    person(x, w / 2, h + 1, w / (who.child ? 13 : 17), who);
    age(x, w, h, tone || "gray");
  } else if (kind === "bridge") {
    // the Ashgrove bridge the morning after: a river, and a span that stops in the air
    x.fillStyle = "#9a9486"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#5e5d58"; x.fillRect(0, h * 0.58, w, h * 0.42);                       // the river
    x.fillStyle = "#3a3934";
    x.fillRect(0, h * 0.42, w * 0.38, h * 0.07);                                          // the deck, up to the break
    x.fillRect(w * 0.62, h * 0.45, w * 0.38, h * 0.07);
    for (const px2 of [0.12, 0.3, 0.72, 0.9]) x.fillRect(w * px2, h * 0.49, w * 0.04, h * 0.2);   // piers
    x.beginPath(); x.moveTo(w * 0.38, h * 0.42); x.lineTo(w * 0.47, h * 0.64); x.lineTo(w * 0.38, h * 0.49); x.fill();   // the broken end, hanging
    x.fillStyle = "#2a2a28"; for (let i = 0; i < 6; i++) x.fillRect(w * (0.42 + i * 0.03), h * (0.61 + (i % 2) * 0.02), w * 0.012, h * 0.04);   // divers' boats
    age(x, w, h, tone || "sepia");
  } else {
    x.fillStyle = "#777"; x.fillRect(0, 0, w, h);
  }
  ctx.drawImage(c, px, py);
  return c;
}

// what a document's photo caption shows
export function photoKind(caption) {
  const t = String(caption || "").toUpperCase();
  if (t.startsWith("PERSON:")) return "person:" + t.slice(7).toLowerCase();
  if (t.includes("BRIDGE")) return "bridge";
  if (t.includes("JUN")) return "jun";
  if (t.includes("14") || t.includes("VICTIM")) return "victims";
  if (t.includes("VARGA")) return "varga";
  return "victims";
}
export function photoURL(caption, w = 160, h = 110, tone = null) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  drawPhoto(c.getContext("2d"), photoKind(caption), 0, 0, w, h, { tone });
  return c.toDataURL();
}
