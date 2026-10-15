// Keyboard + mouse. Mouse look needs pointer lock (click the game to grab the mouse).
export const input = {
  keys: new Set(),
  hits: new Set(),       // keys pressed since the last frame
  dx: 0,
  dy: 0,
  locked: false,
  sensitivity: 1,
  canvas: null,
  onLockChange: null,

  init(canvas) {
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
      this.dx += e.movementX * this.sensitivity;
      this.dy += e.movementY * this.sensitivity;
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  },
  lock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
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
