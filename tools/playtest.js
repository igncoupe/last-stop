// Automatic playtester. Plays the whole game by itself so every night,
// branch and ending can be checked for crashes and dead ends.
// Open: index.html?test&fast=10&bot=kind   (strategies: kind, cold, deadair, random)
// Results: window.__botReport (also logged to the console).
export function startBot(strategy = "kind") {
  const L = window.__lastStop;
  const { g, drive, bus, player, props, camera } = L;
  const V = camera.position.constructor;
  const Q = camera.quaternion.constructor;
  const E = camera.rotation.constructor;
  const report = (window.__botReport = { strategy, log: [], errors: [], stuck: [], ending: null, done: false, choices: [] });
  const log = (m) => { report.log.push(`[n${g.state.night} d${Math.round(drive.d)}] ${m}`); };
  addEventListener("error", (e) => report.errors.push(String(e.message || e)));
  addEventListener("unhandledrejection", (e) => report.errors.push("promise: " + String(e.reason && (e.reason.stack || e.reason))));

  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, key: code.replace("Key", "").replace("Digit", "").toLowerCase() }));
  const pressed = {};
  const press = (code) => {
    const now = performance.now();
    if (pressed[code] && now - pressed[code] < 700) return;
    pressed[code] = now;
    key(code, true);
    setTimeout(() => key(code, false), 70);
  };
  let gas = false;
  let brake = false;
  // keys get dropped when the window loses focus, so held keys are re-sent every tick
  const pedals = (w, s) => {
    if (w || w !== gas) key("KeyW", w);
    if (s || s !== brake) key("KeyS", s);
    gas = w;
    brake = s;
  };
  const aim = (v) => {
    const st = player.state;
    const p = st.mode === "walk" ? st.pos.clone() : camera.getWorldPosition(new V());
    const d = v.clone().sub(p);
    let yaw = Math.atan2(-d.x, -d.z);
    if (st.mode === "seat") yaw -= new E().setFromQuaternion(st.seatParent.getWorldQuaternion(new Q()), "YXZ").y;
    st.yaw = yaw;
    st.pitch = Math.asin(d.y / d.length());
  };
  const walkTo = (v, back = 1.0) => {
    const st = player.state;
    const dir = st.pos.clone().sub(v).setY(0).normalize();
    st.pos.set(v.x + dir.x * back, 1.7, v.z + dir.z * back);
  };
  const hintEl = document.getElementById("hint");
  const hint = () => (hintEl.classList.contains("on") ? hintEl.textContent : "");
  const busPoint = (x, y, z) => bus.group.localToWorld(new V(x, y, z));
  const wantsStop = (name) => {
    if (name === "Northgate" || name === "???") return true;
    if (strategy === "cold") return false;
    if (strategy === "random") return Math.random() < 0.6;
    return true;
  };
  const stopPlan = {};

  function pickChoice(opts) {
    const has = (re) => opts.findIndex((o) => re.test(o));
    if (strategy === "deadair" || strategy === "kind") {
      const said = has(/You said that to him/);
      if (said >= 0 && strategy === "deadair") return said;
      const floor = has(/Floor it/);
      if (floor >= 0) return 0;
      return 0;
    }
    if (strategy === "cold") return opts.length - 1;
    return Math.floor(Math.random() * opts.length);
  }

  let lastSig = "";
  let sameFor = 0;
  let lastSub = "";
  let lastHint = "";
  let holding = false;
  let holdFor = 0;
  let lastNav = null;
  let last = performance.now();
  const timer = setInterval(() => {
    if (window.__botPaused) return;          // set to true to take over (for screenshots)
    const now = performance.now();
    const dtReal = (now - last) / 1000;
    last = now;
    try {
      // cards (night titles, endings) and credits
      const card = document.getElementById("screen-card");
      if (!card.hidden) {
        const kicker = document.getElementById("card-kicker").textContent;
        const title = document.getElementById("card-title").textContent;
        if (kicker.startsWith("Ending")) {
          report.ending = title;
          log(`ENDING: ${title}`);
          // the page reloads after the credits, so keep the report
          try { localStorage.setItem(`botReport-${strategy}`, JSON.stringify({ ...report, flags: g.flags, kind: g.state.kind, late: g.state.late })); } catch { /* ignore */ }
        }
        else log(`card: ${title}`);
        card.querySelector("button").click();
        return;
      }
      const credits = document.querySelector(".credits");
      if (credits) { credits.click(); report.done = true; log("credits"); clearInterval(timer); pedals(false, false); return; }

      // transcript of everything said
      const subEl = document.getElementById("subtitle");
      if (subEl.classList.contains("on") && subEl.textContent !== lastSub) { lastSub = subEl.textContent; log(`say ${lastSub}`); }
      const hintNow = hint();
      if (hintNow && hintNow !== lastHint) { lastHint = hintNow; log(`hint ${hintNow}`); }

      // dialogue options
      const opts = [...document.querySelectorAll("#choices .choice")].map((b) => b.innerText.replace(/^\d\.\s*/, ""));
      if (opts.length) {
        const i = pickChoice(opts);
        report.choices.push(opts[i]);
        log(`choose: ${opts[i]}`);
        press(`Digit${i + 1}`);
        return;
      }

      const h = hint();
      const seat = player.mode === "seat";
      // things to look at
      if (/Check your mirror|Look in the mirror/.test(h)) aim(g.mirrorPoint());
      else if (/Look at the back row/.test(h)) aim(g.backRow());
      else if (/Turn around/.test(h)) aim(g.actor("lena") ? busPoint(0.66, 1.3, 3.1) : busPoint(0.66, 1.3, 3.1));
      else if (/Look at the door/.test(h)) aim(busPoint(-1.2, 1.6, 4.6));
      else if (/Look at the shelter/.test(h) && g.actor("drowned1")) aim(g.actor("drowned1").root.localToWorld(new V(0, 1.4, 0)));
      else if (/Look out the window/.test(h)) { walkTo(L.g.places.hospital.win.getWorldPosition(new V()), 1.2); aim(L.g.places.hospital.win.getWorldPosition(new V())); }
      else if (/Turn back to the bed/.test(h)) { walkTo(L.g.places.hospital.bedHead, 1.0); aim(L.g.places.hospital.bedHead); }
      else if (/Go to Room 4B/.test(h)) { const r = L.g.places.hospital.roomPos; player.state.pos.set(r.x + 1.2, 1.7, r.z); }
      else if (seat && !g.navTarget) aim(busPoint(0.7, 1.6, 30));

      // things to use
      const nav = g.navTarget;
      if (nav && nav.mesh && /Clock in|notice|Get on|radio|visor/i.test(h)) {
        const p = nav.mesh.getWorldPosition(new V());
        if (player.mode === "walk") walkTo(p, 1.1);
        aim(p);
        if (/E/.test(document.getElementById("prompt").textContent)) press("KeyE");
      }
      if (/End your shift/.test(h)) press("KeyE");
      if (/tear out the radio/.test(h) && strategy === "deadair") { aim(bus.radioMesh.getWorldPosition(new V())); press("KeyE"); }

      // doors
      if (seat && /Close the doors/.test(h) && bus.doorsOpen) press("KeyF");
      if (seat && /Open the doors/.test(h) && !bus.doorsOpen && drive.speed < 0.4) {
        const driveOn = /drive on|drive away/.test(h) && strategy === "cold";
        const tearFirst = /tear out the radio/.test(h) && strategy === "deadair";
        if (!driveOn && !tearFirst) press("KeyF");
      }

      // after pulling into a stop, wait there until the game says to drive
      if (nav && nav.stop) { holding = false; lastNav = nav.stop.d; }
      else if (lastNav !== null && drive.speed < 0.5 && drive.inZone(lastNav)) { holding = true; holdFor = 0; lastNav = null; }
      if (holding) {
        holdFor += dtReal;
        const navText = document.getElementById("nav").textContent;
        if (/^Drive/.test(h) || /Keep driving/.test(navText) || /drive on|drive away/.test(h) && strategy === "cold" || holdFor > 30) holding = false;
      }

      // driving
      if (!seat || drive.state.control !== "player" || bus.doorsOpen) { pedals(false, false); }
      else if (holding) { pedals(false, true); }
      else {
        let w = true;
        let s = false;
        if (nav && nav.stop) {
          const name = nav.stop.name;
          if (stopPlan[nav.stop.d] === undefined) stopPlan[nav.stop.d] = wantsStop(name);
          if (stopPlan[nav.stop.d]) {
            const target = nav.stop.d - 7;
            const left = target - drive.d;
            const brakeDist = (drive.speed * drive.speed) / (2 * 6.2) + 1.5;
            if (left > brakeDist + 12) { w = true; s = false; }
            else if (left > brakeDist) { w = drive.speed < 3; s = false; }
            else { w = false; s = true; }
            // the bus pulls in by itself from 60 m out: coast into it, hands off (a fresh W would drive past)
            const toDock = nav.stop.d - 3.9 - drive.d;
            const dock = drive.state.dock;
            if (drive.docking || (toDock > 0 && toDock < 66 && !(dock && (dock.done || dock.skipped)))) { w = false; s = false; }
          }
        }
        // the shadow crouched in the road: the kind driver brakes (it comes for you anyway)
        const shade = L.shade;
        if (shade && shade.visible && shade.mode === "still" && strategy === "kind" && shade.root.position.distanceTo(bus.group.position) < 45) { w = false; s = true; }
        // the flood on night 2: go slow unless you're careless
        if (g.state.night === 2 && drive.d > 1590 && drive.d < 1700 && strategy !== "cold" && drive.speed > 5) { w = false; s = true; }
        if (/drive on|drive away/.test(h) && strategy !== "cold") { w = false; }
        pedals(w, s);
        report.drive = { nav: nav && nav.stop ? nav.stop.name : null, d: Math.round(drive.d), v: +drive.speed.toFixed(1), w, s, keys: [...L.input.keys] };
      }

      // stuck detection (nothing changes for a long time)
      const sig = [g.state.night, Math.round(drive.d), h, document.getElementById("subtitle").textContent, player.mode, bus.doorsOpen, opts.length].join("|");
      if (sig === lastSig) sameFor += dtReal; else { sameFor = 0; lastSig = sig; }
      if (sameFor > 40) {
        report.stuck.push(sig);
        log(`STUCK: ${sig}`);
        sameFor = -1e9;
      }
    } catch (e) {
      report.errors.push("bot: " + (e.stack || e));
    }
  }, 60);
  return report;
}
