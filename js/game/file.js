// The Route 9 file (js/story/file.js): the things you can find for yourself each night. Each one is a
// real thing in the world you look at and press E on: a missing poster on a shelter (from your seat, with
// the bus stopped), a clipping in the old locker at the depot, Teodor's logbook by your seat.
// Reading one is silent and yours: it stays up until you press E again. Found things are kept in the run's
// flags, and across every game in the browser (for the title screen).
import * as THREE from "three";
import { mat } from "../core/ps1.js";
import { tex } from "../core/textures.js";
import { ui } from "../core/ui.js";
import { Sound } from "../audio.js";
import { POSTERS, CLIPPINGS, LOG, FILE_TOTAL } from "../story/file.js";

const EVER = "laststop3d-file";
const POSTER_REACH = 8;       // you can read a poster on the shelter from the driver's seat
// where a poster goes on a shelter: on the back wall, facing the road, at one end or the other
const SLOTS = [new THREE.Vector3(-0.89, 1.45, -1.55), new THREE.Vector3(-0.89, 1.45, 1.57)];

export function createFile({ player, props, bus, drive, director, store }) {
  const g = director.g;
  const placed = [];          // { entry, mesh } added tonight
  let open = null;            // id of what's up
  let cooldown = 0;
  let ever = new Set();
  try { ever = new Set(store.get(EVER) || []); } catch { /* ignore */ }

  const found = () => g.flags.file || (g.flags.file = {});
  // nothing new opens over the story: a choice, its own papers, a cutscene, a scare
  const busy = () => cooldown > 0 || !!open || player.state.locked || player.mode === "fixed"
    || !!document.querySelector("#choices .choice") || ui.paperOpen() !== null;
  const seatedStill = () => player.mode === "seat" && drive.speed < 0.5;

  function read(item) {
    open = item.id;
    player.state.blockUse = true;
    ui.paper({ ...item.doc, findable: item.id, footer: "E  ·  put it away" });
    Sound.sfx("click");
    const f = found();
    if (!f[item.id]) {
      f[item.id] = true;
      ever.add(item.id);
      try { store.set(EVER, [...ever]); } catch { /* ignore */ }
      ui.toast(`Route 9 file  ·  ${Object.keys(f).length} / ${FILE_TOTAL}`, 2600);
    }
  }
  function close() {
    if (ui.paperOpen() === open) ui.paper(null);
    open = null;
    cooldown = 0.45;
  }
  function add(mesh, label, use, reach) {
    const entry = player.addInteract({ mesh, label: () => (busy() ? null : label()), use, reach });
    placed.push({ entry, mesh });
  }

  return {
    // put tonight's things out
    setup(night) {
      for (const p of placed) {
        player.removeInteract(p.entry);
        if (p.mesh.userData.fromFile) p.mesh.removeFromParent();
      }
      placed.length = 0;
      open = null;
      // posters on tonight's shelters
      for (const item of POSTERS.filter((p) => p.night === night)) {
        const stop = props.stops[item.stop];
        if (!stop) continue;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.72), mat({ map: tex.poster(item.sign, item.who) }));
        m.position.copy(SLOTS[item.slot]);
        m.rotation.y = Math.PI / 2;
        m.userData.fromFile = true;
        stop.group.add(m);
        add(m, () => (seatedStill() ? "Read the poster" : null), () => read(item), POSTER_REACH);
      }
      // tonight's clipping in Teodor's locker
      const clip = CLIPPINGS.find((c) => c.night === night);
      props.depot.locker.setClipping(clip ? clip.doc.title : null);
      if (clip) add(props.depot.locker.hit, () => (player.mode === "walk" ? "Look in the old locker" : null), () => read(clip));
      // the logbook: the first page you haven't read yet, up to tonight's
      bus.logbook.visible = true;
      add(bus.logbook, () => (seatedStill() ? "Read the old logbook" : null), () => {
        const pages = LOG.filter((p) => p.night <= night);
        read(pages.find((p) => !found()[p.id]) || pages[pages.length - 1]);
      });
    },
    update(dt, input) {
      cooldown = Math.max(0, cooldown - dt);
      if (open) {
        // put away with E, or by the story taking over the page; it can't stay up while you drive off
        if (ui.paperOpen() !== open || input.hit("KeyE") || input.hit("Escape") || drive.speed > 3) close();
      } else if (cooldown <= 0) player.state.blockUse = false;
    },
    get count() { return Object.keys(found()).length; },
    get everCount() { return ever.size; },
    total: FILE_TOTAL,
    // every poster ever read (the drowned have names)
    allPosters() { return POSTERS.every((p) => ever.has(p.id)); },
  };
}
