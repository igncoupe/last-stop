// Keyboard + mouse. Mouse look needs pointer lock (click the game to grab the mouse).
//
// What the mouse reports isn't always what your hand did: the first move after the pointer is captured carries
// the jump from wherever it was, and Chrome on Windows (the desktop app is Chrome too) now and then reports a single
// enormous move with pointer lock. Raw input avoids most of those; the rest are thrown away here, before they can
// turn the camera.
const SETTLE_MS = 80;        // after the mouse is captured, ignore it this long
const SPIKE_MIN = 250;       // a single move this big (in counts)...
const SPIKE_RATIO = 6;       // ...and this many times bigger than the moves just before it is not a real one

export const input = {
  keys: new Set(),
  hits: new Set(),       // keys pressed since the last frame
  dx: 0,
  dy: 0,
  locked: false,
  sensitivity: 1,
  invertY: false,
  canvas: null,
  onLockChange: null,
  settleUntil: 0,
  recent: 0,             // how big the last few moves were (counts)

  init(canvas) {
    if (this.canvas) return;     // one set of listeners for the whole game
    this.canvas = canvas;
    addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.hits.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());
    addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const mx = e.movementX, my = e.movementY;
      if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
      if (performance.now() < this.settleUntil) return;
      const size = Math.hypot(mx, my);
      // (a real flick goes on: after one move thrown away, the next big one counts)
      if (size > SPIKE_MIN && size > this.recent * SPIKE_RATIO) { this.recent = size; return; }
      this.recent += (size - this.recent) * 0.5;
      this.dx += mx * this.sensitivity;
      this.dy += my * this.sensitivity * (this.invertY ? -1 : 1);
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      // nothing carries across a capture or a release
      this.dx = 0;
      this.dy = 0;
      this.recent = 0;
      this.settleUntil = performance.now() + SETTLE_MS;
      if (!this.locked) this.keys.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  },
  lock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    const plain = () => {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    };
    // raw mouse input, where the browser has it; if it says no, the ordinary kind
    let p = null;
    try { p = this.canvas.requestPointerLock({ unadjustedMovement: true }); } catch { plain(); return; }
    if (p && p.catch) p.catch(plain);
  },
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  },
  down(code) { return this.keys.has(code); },
  hit(code) { return this.hits.has(code); },
  endFrame() {
    this.hits.clear();
    this.dx = 0;
    this.dy = 0;
  },
};
