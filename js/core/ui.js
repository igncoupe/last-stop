// HTML overlays on top of the 3D view: subtitles, dialogue options,
// the objective hint, interaction prompts, fades, cards and jumpscares.
const $ = (id) => document.getElementById(id);
const el = {
  hud: $("hud"), hint: $("hint"), crosshair: $("crosshair"), prompt: $("prompt"),
  choices: $("choices"), subtitle: $("subtitle"), fade: $("fade"), scare: $("scare"),
  card: $("screen-card"), cardKicker: $("card-kicker"), cardTitle: $("card-title"),
  cardSub: $("card-sub"), cardNote: $("card-note"), cardActions: $("card-actions"),
  loading: $("screen-loading"), loadingText: $("loading-text"),
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SCARES = {
  face: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="sk" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#ddd8ca"/><stop offset=".5" stop-color="#8d8a80"/><stop offset="1" stop-color="#090909"/></radialGradient>
    <radialGradient id="hole" r="50%"><stop offset="0" stop-color="#000"/><stop offset=".75" stop-color="#060606"/><stop offset="1" stop-color="#3a3630" stop-opacity="0"/></radialGradient>
    <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="16"/></filter></defs>
    <rect width="400" height="400" fill="#000"/>
    <g filter="url(#rough)">
      <ellipse cx="200" cy="220" rx="122" ry="170" fill="url(#sk)"/>
      <ellipse cx="148" cy="188" rx="36" ry="47" fill="url(#hole)"/><ellipse cx="252" cy="188" rx="36" ry="47" fill="url(#hole)"/>
      <circle cx="150" cy="194" r="3.5" fill="#f2ead2"/><circle cx="250" cy="194" r="3.5" fill="#f2ead2"/>
      <path d="M148 232 C 146 260 150 290 144 330 M252 232 C 254 262 250 300 256 340" stroke="#0b0b0b" stroke-width="5" fill="none"/>
      <path d="M200 228 l-13 36 h26z" fill="#2a2824" opacity=".7"/>
      <ellipse cx="200" cy="318" rx="40" ry="62" fill="#000"/>
      <path d="M96 150 C 104 40 296 40 304 150 C 262 96 138 96 96 150 Z" fill="#040404"/>
      <path d="M86 160 C 92 70 196 50 200 92 C 160 100 126 118 116 176 L 106 390 C 96 300 88 230 86 160 Z" fill="#040404"/>
      <path d="M314 160 C 308 70 204 50 200 92 C 240 100 274 118 284 176 L 294 390 C 304 300 312 230 314 160 Z" fill="#040404"/>
      <path d="M168 100 C 158 170 172 240 158 330 M236 104 C 248 176 232 250 248 340 M200 96 C 204 150 194 200 200 236" stroke="#040404" stroke-width="7" fill="none"/>
    </g></svg>`,
  hands: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs>
    <filter id="rough2"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="10"/></filter>
    <g id="hand"><ellipse cx="0" cy="62" rx="50" ry="60"/><rect x="-48" y="-58" width="19" height="96" rx="9"/><rect x="-25" y="-82" width="19" height="112" rx="9"/><rect x="-1" y="-80" width="19" height="108" rx="9"/><rect x="22" y="-62" width="18" height="92" rx="9"/><rect x="42" y="24" width="17" height="64" rx="8" transform="rotate(38 50 56)"/></g></defs>
    <rect width="400" height="400" fill="#020304"/>
    <g filter="url(#rough2)" fill="#bfbab0"><use href="#hand" transform="translate(110 160) rotate(-14)"/><use href="#hand" transform="translate(292 176) rotate(12) scale(-1 1)"/></g>
    <g stroke="#8fa0aa" stroke-opacity=".35" stroke-width="3" fill="none"><path d="M80 230 v120 M104 240 v140 M126 236 v90 M268 250 v130 M292 244 v110 M316 252 v120"/></g></svg>`,
  eyes: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="eg"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#c7bf9c"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="400" fill="#000"/>
    <ellipse cx="152" cy="200" rx="44" ry="17" fill="url(#eg)"/><ellipse cx="248" cy="200" rx="44" ry="17" fill="url(#eg)"/>
    <circle cx="152" cy="200" r="6" fill="#000"/><circle cx="248" cy="200" r="6" fill="#000"/></svg>`,
};

export const ui = {
  subsOn: true,

  showHud(on) { el.hud.hidden = !on; },

  subtitle(name, color, text) {
    if (!this.subsOn || !text) { el.subtitle.classList.remove("on"); return; }
    el.subtitle.replaceChildren();
    const line = document.createElement("span");
    line.className = "line";
    if (name) {
      const who = document.createElement("span");
      who.className = "who";
      who.style.color = color || "#fff";
      who.textContent = name + ":";
      line.append(who);
    }
    line.append(document.createTextNode(text));
    el.subtitle.append(line);
    el.subtitle.classList.add("on");
  },
  clearSubtitle() { el.subtitle.classList.remove("on"); },
  // big words in the middle of the screen (over black, in the endings); null takes them away
  caption(kicker, text) {
    const c = document.getElementById("caption");
    if (!kicker && !text) { c.classList.remove("on"); return; }
    c.querySelector(".c-kicker").textContent = kicker || "";
    c.querySelector(".c-text").textContent = text || "";
    c.classList.add("on");
  },

  hint(text) {
    if (text) el.hint.textContent = text;
    el.hint.classList.toggle("on", !!text);
    // anything that needs a key press also shows big, in the middle of the screen
    const cta = document.getElementById("cta");
    if (!cta) return;
    if (text && /[[A-Z0-9]+]/.test(text)) {
      cta.textContent = text.replace(/s*·s*/g, "   ·   ");
      cta.classList.add("on");
    } else cta.classList.remove("on");
  },

  prompt(text, key = "E") {
    el.crosshair.classList.toggle("hot", !!text);
    if (!text) { el.prompt.replaceChildren(); return; }
    const k = document.createElement("kbd");
    k.textContent = key;
    el.prompt.replaceChildren(k, document.createTextNode(text));
  },

  // shows dialogue options; resolves with the picked index (keys 1-9 or click)
  choices(options) {
    return new Promise((done) => {
      el.choices.replaceChildren();
      const pick = (i) => {
        removeEventListener("keydown", onKey);
        el.choices.replaceChildren();
        this.cancelChoices = () => {};
        done(i);
      };
      // called off (you drove away from whoever was asking): the question just goes away, unanswered
      this.cancelChoices = () => {
        removeEventListener("keydown", onKey);
        el.choices.replaceChildren();
        this.cancelChoices = () => {};
      };
      const onKey = (e) => {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= options.length) { e.preventDefault(); pick(n - 1); }
      };
      options.forEach((text, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice";
        b.style.animationDelay = `${i * 70}ms`;
        const num = document.createElement("span");
        num.className = "num";
        num.textContent = `${i + 1}.`;
        b.append(num, document.createTextNode(text));
        b.addEventListener("click", () => pick(i));
        el.choices.append(b);
      });
      addEventListener("keydown", onKey);
    });
  },
  clearChoices() { this.cancelChoices(); el.choices.replaceChildren(); },
  cancelChoices() {},
  // a short message in the middle of the screen
  toast(text, ms = 1800) {
    const t = document.getElementById("toast");
    t.textContent = text;
    t.classList.add("on");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove("on"), ms);
  },

  async fade(to, ms = 1200, white = false) {
    el.fade.classList.toggle("white", white);
    el.fade.style.transitionDuration = `${ms}ms`;
    el.fade.style.opacity = String(to);
    await wait(ms);
  },

  async scare(kind) {
    el.scare.innerHTML = SCARES[kind] || SCARES.face;
    el.scare.hidden = false;
    document.body.classList.remove("shake");
    void document.body.offsetWidth;
    document.body.classList.add("shake");
    await wait(850);
    el.scare.hidden = true;
    el.scare.innerHTML = "";
  },

  shake() {
    document.body.classList.remove("shake");
    void document.body.offsetWidth;
    document.body.classList.add("shake");
  },

  card({ kicker = "", title = "", sub = "", note = "", actions = [{ label: "Continue" }] }) {
    el.cardKicker.textContent = kicker;
    el.cardTitle.textContent = title;
    el.cardSub.textContent = sub;
    el.cardNote.textContent = note;
    el.cardActions.replaceChildren();
    el.card.hidden = false;
    return new Promise((done) => {
      actions.forEach((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = i === 0 ? "btn primary" : "btn";
        b.textContent = a.label;
        b.addEventListener("click", () => { el.card.hidden = true; done(i); });
        el.cardActions.append(b);
      });
      el.cardActions.querySelector("button").focus();
    });
  },

  // a document held up close: { kind: "notice"|"clipping"|"poster"|"note", title, lines, scrawl, photo }
  paper(doc) {
    let p = document.getElementById("paper");
    if (!doc) { if (p) p.classList.remove("on"); return; }
    if (!p) {
      p = document.createElement("div");
      p.id = "paper";
      document.body.append(p);
    }
    p.className = `paper paper-${doc.kind || "notice"}`;
    p.replaceChildren();
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    if (doc.kicker) { const k = document.createElement("div"); k.className = "p-kicker"; k.textContent = doc.kicker; sheet.append(k); }
    if (doc.title) { const h = document.createElement("div"); h.className = "p-title"; h.textContent = doc.title; sheet.append(h); }
    if (doc.photo) { const ph = document.createElement("div"); ph.className = "p-photo"; ph.textContent = doc.photo; sheet.append(ph); }
    for (const line of doc.lines || []) { const l = document.createElement("p"); l.textContent = line; sheet.append(l); }
    if (doc.scrawl) {
      const s = document.createElement("div");
      s.className = doc.neat ? "p-scrawl" : "p-scrawl rushed";
      if (doc.neat) s.textContent = doc.scrawl;
      else {
        // written in a hurry: each letter its own size and angle, the line sliding downhill, worse at the end
        const chars = [...doc.scrawl];
        chars.forEach((ch, i) => {
          const k = i / Math.max(1, chars.length - 1);
          const c = document.createElement("span");
          c.textContent = ch;
          const r = (Math.random() - 0.5) * (14 + k * 22);
          const y = (Math.random() - 0.5) * (3 + k * 6) + k * 9;
          const sc = 0.82 + Math.random() * (0.35 + k * 0.3);
          c.style.transform = `translateY(${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${sc.toFixed(2)})`;
          c.style.marginRight = `${(Math.random() * 3 - 1).toFixed(1)}px`;
          c.style.opacity = (0.65 + Math.random() * 0.35).toFixed(2);
          if (Math.random() < 0.18) c.classList.add("hard");                // pressed so hard it's darker
          s.append(c);
        });
        const tail = document.createElement("span");
        tail.className = "tail";                                            // the pencil skidding off the page
        s.append(tail);
      }
      sheet.append(s);
    }
    p.append(sheet);
    void p.offsetWidth;
    p.classList.add("on");
  },

  loading(text) {
    el.loading.hidden = !text;
    if (text) el.loadingText.textContent = text;
  },

  // scrolling credits; resolves when they finish (or on click / key press)
  credits(html) {
    return new Promise((done) => {
      const wrap = document.createElement("div");
      wrap.className = "credits";
      const roll = document.createElement("div");
      roll.className = "credits-roll";
      roll.innerHTML = html;
      wrap.append(roll);
      document.body.append(wrap);
      const finish = () => {
        removeEventListener("keydown", finish);
        wrap.remove();
        done();
      };
      roll.addEventListener("animationend", finish);
      setTimeout(() => {
        wrap.addEventListener("click", finish);
        addEventListener("keydown", finish);
      }, 1500);
    });
  },
};
