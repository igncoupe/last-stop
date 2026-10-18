// Route 9: the streets the bus drives, as one smooth path.
// Distances are in meters along the road from the depot.
import * as THREE from "three";

const CORNERS = [
  [0, -40], [0, 320], [360, 320], [360, 760], [760, 760],
  [760, 1260], [1160, 1260], [1160, 1440],
];
const RADIUS = 18;

const path = new THREE.CurvePath();
const v = (x, z) => new THREE.Vector3(x, 0, z);
let prev = v(...CORNERS[0]);
for (let i = 1; i < CORNERS.length; i++) {
  const p = v(...CORNERS[i]);
  if (i === CORNERS.length - 1) {
    path.add(new THREE.LineCurve3(prev, p));
    break;
  }
  const next = v(...CORNERS[i + 1]);
  const inDir = p.clone().sub(prev).normalize();
  const outDir = next.clone().sub(p).normalize();
  const a = p.clone().addScaledVector(inDir, -RADIUS);
  const b = p.clone().addScaledVector(outDir, RADIUS);
  path.add(new THREE.LineCurve3(prev, a));
  path.add(new THREE.QuadraticBezierCurve3(a, p, b));
  prev = b;
}

export const ROUTE_LENGTH = path.getLength();
path.arcLengthDivisions = 4000;
path.updateArcLengths();

const tmpUp = new THREE.Vector3(0, 1, 0);
export const route = {
  length: ROUTE_LENGTH,
  point(d, target = new THREE.Vector3()) {
    return target.copy(path.getPointAt(THREE.MathUtils.clamp(d / ROUTE_LENGTH, 0, 1)));
  },
  tangent(d, target = new THREE.Vector3()) {
    return target.copy(path.getTangentAt(THREE.MathUtils.clamp(d / ROUTE_LENGTH, 0, 0.99999)));
  },
  right(d, target = new THREE.Vector3()) {
    const t = this.tangent(d);
    return target.set(-t.z, 0, t.x);
  },
  // a point `side` meters to the right of the road center at distance d
  at(d, side = 0, y = 0) {
    const p = this.point(d);
    const r = this.right(d);
    return p.addScaledVector(r, side).setY(y);
  },
  heading(d) {
    const t = this.tangent(d);
    return Math.atan2(t.x, t.z);
  },
  corners: [],   // distances of the corners, filled in below
  up: tmpUp,
};

// find each corner's distance along the path by searching for the closest sample
for (let i = 1; i < CORNERS.length - 1; i++) {
  const c = v(...CORNERS[i]);
  let best = 0;
  let bestDist = Infinity;
  for (let d = 0; d < ROUTE_LENGTH; d += 2) {
    const dist = route.point(d).distanceTo(c);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  route.corners.push(best);
}
export const nearCorner = (d, margin) => route.corners.some((c) => Math.abs(c - d) < margin);

export const LANE = 2.3;       // the bus drives this far right of center
export const ROAD_HALF = 5;    // road is 10 m wide
export const CURB = 8;         // sidewalk runs from 5 to 8 m

// stop positions along the route
export const STOPS = {
  "Depot": 14,
  "Elm & 4th": 520,
  "Market St": 905,
  "St. Agnes": 1345,
  "Canal Row": 1800,
  "Northgate": ROUTE_LENGTH - 30,
};
// where the stop with no name is each night (null = not on the road yet)
export const MYSTERY = { 1: null, 2: 2290, 3: 1630, 4: 1085, 5: 660 };
// neighborhoods, by distance
export const DISTRICTS = [
  { from: 0, to: 360, kind: "industrial" },
  { from: 360, to: 760, kind: "houses" },
  { from: 760, to: 1160, kind: "shops" },
  { from: 1160, to: 1560, kind: "hospital" },
  { from: 1560, to: 2060, kind: "canal" },
  { from: 2060, to: 2460, kind: "empty" },
  { from: 2460, to: 99999, kind: "terminal" },
];
export const districtAt = (d) => DISTRICTS.find((z) => d >= z.from && d < z.to).kind;

// The low stretch of road at Canal Row, beside the canal: it slopes down, runs flat along the bottom past the
// stop, and climbs out again. When the river's up, this is where the water collects.
export const DIP = { from: 1650, down: 1700, up: 1905, to: 1955, depth: 0.6 };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// how far below the usual road level the road is, d meters along the route
export const roadDip = (d) => DIP.depth * smooth(DIP.from, DIP.down, d) * (1 - smooth(DIP.up, DIP.to, d));
// the height of the road surface
export const roadY = (d) => -roadDip(d);
