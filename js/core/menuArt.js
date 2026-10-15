// The main menu's own picture, apart from the game world: a wet street at night, an empty bus
// shelter, and the 9 coming out of the fog. It never quite arrives. Lightning shows who's waiting.
// Drawn in 2D at a tiny size and scaled up with hard pixels, like the game.
const W = 384;
const H = 216;
const HOR = 122;                  // the horizon
const VX = 250;                   // where the road meets it
const DEPTH = H - HOR;

// a point on the ground: X across the street, f how close (0 at the horizon, 1 at the bottom edge)
const gx = (X, f) => VX + X * f;
const gy = (f) => HOR + DEPTH * f;

export function createMenuArt(canvas) {
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // the skyline: dark blocks with a few windows still lit
  const blocks = [];
  for (let x = -12; x < W + 12;) {
    const w = 12 + rnd() * 30;
    const near = Math.abs(x + w / 2 - VX) < 50;
    const h = (near ? 8 : 16) + rnd() * (near ? 16 : 52);
    const wins = [];
    for (let wy = HOR - h + 4; wy < HOR - 5; wy += 5) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) if (rnd() < 0.08) wins.push({ x: wx, y: wy, p: rnd() });
    }
    blocks.push({ x, w, h, wins });
    x += w + rnd() * 4;
  }
  // low clouds, lit orange from underneath by the city
  const clouds = Array.from({ length: 9 }, () => ({ x: rnd() * W, y: 8 + rnd() * 70, rx: 40 + rnd() * 70, ry: 6 + rnd() * 9 }));
  // puddles on the road: (X across, f how close, width)
  const puddles = [[-110, 0.55, 40], [-20, 0.8, 70], [30, 0.38, 26], [-70, 0.28, 22], [50, 0.95, 50]];
  const drops = Array.from({ length: 170 }, () => ({ x: rnd() * W, y: rnd() * H, v: 170 + rnd() * 140, l: 3 + rnd() * 6 }));

  let raf = 0;
  let last = 0;
  let time = 0;
  let nextBolt = 4;
  let bolt = -10;                 // when the last lightning started

  const rect = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // a box standing on the ground at (X, f): width and height in street units
  const stand = (X, f, w, h, color) => rect(gx(X, f), gy(f) - h * f, w * f, h * f, color);
  const glow = (x, y, r, color, alpha) => {
    const grad = c.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color.replace("A", alpha));
    grad.addColorStop(1, color.replace("A", 0));
    c.fillStyle = grad;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // the thing at the stop: too tall, head cocked, arms hanging past its knees. Drawn in street units
  function figure(x, y, k) {
    const P = (pts) => {
      c.beginPath();
      pts.forEach(([px, py], i) => (i ? c.lineTo(x + px * k, y + py * k) : c.moveTo(x + px * k, y + py * k)));
      c.closePath();
      c.fill();
    };
    c.fillStyle = "#000";
    c.beginPath();
    c.ellipse(x + 3 * k, y - 116 * k, 6.5 * k, 8.5 * k, 0.35, 0, Math.PI * 2);          // the head, tipped over
    c.fill();
    P([[-2, -108], [3, -110], [4, -100], [-3, -100]]);                                       // neck
    P([[-14, -101], [14, -99], [9, -60], [-8, -60]]);                                        // shoulders to waist
    P([[-14, -101], [-9, -99], [-11, -34], [-13, -30], [-16, -34]]);                        // the arms, too long
    P([[9, -99], [14, -99], [15, -32], [13, -28], [11, -33]]);
    P([[-8, -61], [-1, -61], [-3, 0], [-8, 0]]);                                             // legs
    P([[1, -61], [8, -61], [8, 0], [3, 0]]);
  }

  function flashLevel() {
    const s = time - bolt;
    if (s < 0 || s > 0.7) return 0;
    // two quick strikes, then a fade
    return s < 0.07 ? 1 : s < 0.14 ? 0.15 : s < 0.22 ? 0.85 : Math.max(0, 0.85 - (s - 0.22) * 2);
  }

  function draw() {
    const flash = flashLevel();
    // the sky: black, with the sodium glow of the city low down
    const sky = c.createLinearGradient(0, 0, 0, HOR);
    sky.addColorStop(0, "#030409");
    sky.addColorStop(0.75, "#0d0c10");
    sky.addColorStop(1, "#241a10");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, HOR + 1);
    for (const k of clouds) {
      c.fillStyle = flash ? `rgba(130, 140, 170, ${0.12 + flash * 0.28})` : "rgba(26, 22, 24, .55)";
      c.beginPath();
      c.ellipse(k.x, k.y, k.rx, k.ry, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(70, 44, 24, .12)";
      c.beginPath();
      c.ellipse(k.x, k.y + k.ry * 0.5, k.rx * 0.8, k.ry * 0.4, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (flash) rect(0, 0, W, HOR, `rgba(150, 168, 200, ${flash * 0.4})`);

    // the skyline
    for (const b of blocks) {
      rect(b.x, HOR - b.h, b.w, b.h + 1, "#050507");
      for (const w of b.wins) {
        const lit = Math.sin(time * 0.3 + w.p * 40) > -0.85 || w.p > 0.5;
        if (lit) rect(w.x, w.y, 2, 2, w.p > 0.8 ? "rgba(170, 190, 210, .45)" : "rgba(214, 150, 60, .55)");
      }
    }
    // fog where the road meets the sky
    const fog = c.createLinearGradient(0, HOR - 24, 0, HOR + 30);
    fog.addColorStop(0, "rgba(70, 74, 86, 0)");
    fog.addColorStop(0.5, "rgba(70, 74, 86, .32)");
    fog.addColorStop(1, "rgba(70, 74, 86, 0)");
    c.fillStyle = fog;
    c.fillRect(0, HOR - 24, W, 54);

    // the ground: sidewalks, then the road
    rect(0, HOR, W, DEPTH, "#070709");
    const road = c.createLinearGradient(0, HOR, 0, H);
    road.addColorStop(0, "#1c1c21");
    road.addColorStop(0.35, "#141519");
    road.addColorStop(1, "#101115");
    c.fillStyle = road;
    c.beginPath();
    c.moveTo(VX, HOR);
    c.lineTo(gx(-160, 1.2), gy(1.2));
    c.lineTo(gx(80, 1.2), gy(1.2));
    c.closePath();
    c.fill();
    // curbs and the broken center line
    // puddles: dull mirrors of the sky
    for (const [X, pf, pw] of puddles) {
      c.fillStyle = flash ? `rgba(170, 185, 215, ${0.12 + flash * 0.3})` : "rgba(110, 120, 140, .09)";
      c.beginPath();
      c.ellipse(gx(X, pf), gy(pf), pw * pf * 0.5, Math.max(1, pw * pf * 0.07), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = "rgba(140, 140, 150, .38)";
    c.lineWidth = 1;
    for (const X of [-160, 80]) {
      c.beginPath();
      c.moveTo(VX, HOR);
      c.lineTo(gx(X, 1.2), gy(1.2));
      c.stroke();
    }
    for (let k = 0; k < 9; k++) {
      const f0 = Math.pow(k / 9, 1.8) + 0.02;
      const f1 = f0 + 0.06 * (0.3 + f0);
      c.strokeStyle = "rgba(190, 160, 80, .35)";
      c.lineWidth = Math.max(1, f0 * 3);
      c.beginPath();
      c.moveTo(gx(-40, f0), gy(f0));
      c.lineTo(gx(-40, f1), gy(f1));
      c.stroke();
    }

    // the street lamps, the near one with a dying bulb
    const flicker = Math.sin(time * 37) > 0.2 && Math.sin(time * 1.3) > -0.7 ? 1 : 0.18;
    for (const [f, on] of [[0.42, flicker], [0.2, 1], [0.1, 1]]) {
      const x = gx(-178, f);
      const top = gy(f) - 250 * f;
      const pole = "#25262c";
      stand(-180, f, 5, 250, pole);
      rect(x + 4 * f, top, Math.max(1, 1.2 * f), 250 * f, `rgba(232, 150, 60, ${0.18 * on})`);   // lit side
      rect(x, top, 34 * f, Math.max(1, 3 * f), pole);
      const hx = x + 32 * f;
      rect(hx - 6 * f, top - 1, 12 * f, Math.max(2, 4 * f), "#2c2d33");                   // the lamp's head
      // the pool of light on the wet road, and its long reflection
      glow(hx, gy(f), 70 * f, "rgba(232, 150, 60, A)", 0.32 * on);
      c.fillStyle = `rgba(232, 150, 60, ${0.16 * on})`;
      c.fillRect(Math.round(hx - 2 * f), gy(f), Math.max(1, Math.round(4 * f)), Math.round(DEPTH * (1 - f) * 0.8));
      glow(hx, top + 3 * f, 22 * f + 3, "rgba(255, 190, 110, A)", 0.8 * on);
      rect(hx - 4 * f, top + 2 * f, 8 * f, Math.max(1, 2 * f), on > 0.5 ? "#ffe2b0" : "#3a2c1c");
    }

    c.strokeStyle = "rgba(34, 34, 40, .95)";
    c.lineWidth = 1;
    const tx = gx(-178, 0.42);
    const ty = gy(0.42) - 250 * 0.42;
    for (const [dy, ey] of [[4, 30], [8, 40]]) {
      c.beginPath();
      c.moveTo(tx, ty + dy);
      c.quadraticCurveTo((tx + W) / 2, ty + dy + 34, W + 4, ey);
      c.stroke();
    }

    // the 9: headlights out of the fog, closer and closer, and then gone
    const loop = time % 19;
    if (loop < 15.5) {
      const p = loop / 15.5;
      const f = 0.015 + p * p * 0.5;
      const fade = Math.min(1, loop / 2.5) * (loop > 14.6 ? Math.max(0, (15.5 - loop) / 0.9) : 1);
      const fogged = 0.35 + 0.65 * Math.min(1, f * 3);
      const a = fade * fogged;
      stand(-12, f, 64, 118, `rgba(8, 8, 10, ${0.9 * fade})`);
      const ly = gy(f) - 26 * f;
      for (const X of [-4, 44]) {
        const lx = gx(X, f);
        glow(lx, ly, 60 * f + 6, "rgba(235, 230, 205, A)", 0.55 * a);
        rect(lx - 3 * f, ly - 2 * f, Math.max(1, 6 * f), Math.max(1, 4 * f), `rgba(255, 252, 235, ${a})`);
        c.fillStyle = `rgba(235, 230, 205, ${0.13 * a})`;
        c.fillRect(Math.round(lx - 3 * f), Math.round(gy(f)), Math.max(1, Math.round(6 * f)), Math.round(DEPTH * (1 - f)));
      }
      // the route sign over the windshield
      const sx = gx(2, f);
      const sy = gy(f) - 108 * f;
      rect(sx, sy, 36 * f, Math.max(2, 9 * f), `rgba(255, 181, 74, ${a * 0.9})`);
      glow(sx + 18 * f, sy + 4 * f, 30 * f + 4, "rgba(255, 181, 74, A)", 0.35 * a);
    }

    // the shelter on the near sidewalk, and the old stop sign in front of it
    const fs = 0.56;
    const shelterX = 96;
    const ad = Math.sin(time * 23) > -0.3 && Math.sin(time * 0.7 + 1) > -0.6 ? 1 : 0.2;     // a broken ad light
    stand(shelterX, fs, 84, 140, flash ? `rgba(130, 150, 175, ${0.1 + flash * 0.3})` : "rgba(70, 82, 96, .1)");
    stand(shelterX + 58, fs, 22, 92, `rgba(150, 170, 190, ${0.05 + 0.13 * ad})`);                // the backlit ad, dying
    stand(shelterX + 62, fs, 14, 70, `rgba(20, 24, 30, ${0.5 * ad})`);                             // the faded face on it
    glow(gx(shelterX + 69, fs), gy(fs) - 50 * fs, 40, "rgba(170, 195, 220, A)", 0.08 * ad);
    // who's waiting: only a lightning flash shows it
    if (flash > 0.1) figure(gx(shelterX + 34, fs), gy(fs) - 4 * fs, fs);
    for (const X of [shelterX, shelterX + 82]) stand(X, fs, 3, 142, "#17181c");
    rect(gx(shelterX - 4, fs), gy(fs) - 146 * fs, 92 * fs, 6 * fs, "#17181c");      // the roof
    rect(gx(shelterX + 8, fs), gy(fs) - 40 * fs, 46 * fs, 4 * fs, "#141518");        // the bench
    const fp = 0.66;
    stand(86, fp, 3, 190, "#1b1c20");
    const px = gx(86, fp) - 10 * fp;
    const py = gy(fp) - 204 * fp;
    rect(px, py, 24 * fp, 18 * fp, "#1d1e22");
    rect(px + 2, py + 2, 24 * fp - 4, 18 * fp - 4, flash ? "#c9c3b0" : "#5e4a26");
    c.fillStyle = flash ? "#111" : "rgba(255, 181, 74, .95)";
    c.font = "bold 9px monospace";
    c.textAlign = "center";
    c.fillText("9", px + 12 * fp, py + 13 * fp);

    // rain
    c.strokeStyle = flash ? "rgba(220, 230, 245, .55)" : "rgba(150, 165, 190, .3)";
    c.lineWidth = 1;
    c.beginPath();
    for (const d of drops) {
      c.moveTo(Math.round(d.x), Math.round(d.y));
      c.lineTo(Math.round(d.x - d.l * 0.25), Math.round(d.y + d.l));
    }
    c.stroke();
    if (flash) rect(0, 0, W, H, `rgba(190, 205, 230, ${flash * 0.12})`);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    time += dt;
    for (const d of drops) {
      d.y += d.v * dt;
      d.x -= d.v * dt * 0.25;
      if (d.y > H) { d.y -= H + 10; d.x = Math.random() * (W + 40); }
    }
    if (time > nextBolt) { bolt = time; nextBolt = time + 9 + Math.random() * 12; }
    draw();
  }

  return {
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
