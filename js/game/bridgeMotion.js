// One owner of longitudinal motion, including the decision and crash handoff.
// Small fixed integration steps keep braking/acceleration consistent at low FPS.
export function bridgeMotion(z, speed, edge) {
  return {
    z, speed, mode: "approach",
    brake() {
      this.mode = "brake";
      this.deceleration = this.speed * this.speed / (2 * Math.max(0.01, edge - 6 - this.z));
    },
    update(dt) {
      while (dt > 1e-8) {
        const h = Math.min(dt, 1 / 120);
        dt -= h;
        const left = Math.max(0, edge - 6 - this.z);
        const target = this.mode === "floor" ? 16 : this.mode === "brake" ? 0 : Math.min(13, Math.sqrt(2 * 3 * left));
        const before = this.speed;
        const rate = this.mode === "brake" ? this.deceleration : target > before ? 3.6 : 3;
        this.speed += Math.sign(target - before) * Math.min(Math.abs(target - before), rate * h);
        this.z += (before + this.speed) * 0.5 * h;
        if (this.mode !== "floor" && this.z >= edge - 6) {
          this.z = edge - 6;
          this.speed = 0;
        }
      }
    },
  };
}
