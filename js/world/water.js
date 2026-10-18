// Water. Black, cold, moving: waves rolling across it, rain rings opening on it, and every light near it (the
// streetlights, your headlights) laid across it in long broken streaks, the way a river looks at night. One shader
// for all of it: the canal, the flood on Canal Row, the river under the bridge, the water in the bus.
import * as THREE from "three";

const MAX_LIGHTS = 8;
const all = new Set();

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uChop;
  uniform float uOpacity;
  uniform float uRain;
  uniform float uMurk;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightCol[${MAX_LIGHTS}];
  uniform int uLightCount;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // the surface: long slow swells, cross-chop on top, a fine shiver over everything
  float height(vec2 p, float t) {
    float h = noise(p * 0.32 + vec2(t * 0.05, t * 0.035)) * 0.62;
    h += noise(p * 0.85 - vec2(t * 0.09, -t * 0.07)) * 0.3;
    h += noise(p * 2.4 + vec2(-t * 0.17, t * 0.13)) * 0.14 * uChop;
    h += noise(p * 6.0 + vec2(t * 0.4, -t * 0.3)) * 0.05 * uChop;
    h += sin(p.x * 0.6 + p.y * 0.35 + t * 0.8) * 0.07 + sin(p.y * 1.2 - p.x * 0.25 - t * 1.1) * 0.05;
    return h;
  }
  // rain: rings opening and fading, a few to every square meter
  vec2 rings(vec2 p, float t) {
    vec2 sum = vec2(0.0);
    for (int k = 0; k < 3; k++) {
      vec2 q = p * 1.7 + float(k) * 13.7;
      vec2 cell = floor(q);
      vec2 f = fract(q) - 0.5;
      float r = hash(cell + float(k) * 3.1);
      float ph = fract(t * 0.85 + r);
      vec2 off = vec2(hash(cell + 3.3), hash(cell + 9.1)) - 0.5;
      vec2 d = f - off * 0.6;
      float dist = length(d);
      float wave = sin((dist - ph * 0.42) * 70.0) * exp(-abs(dist - ph * 0.42) * 26.0) * (1.0 - ph);
      sum += (d / max(dist, 1e-3)) * wave;
    }
    return sum;
  }
  void main() {
    vec2 p = vWorld.xz * uScale;
    float t = uTime;
    float e = 0.12;
    float h0 = height(p, t);
    float hx = height(p + vec2(e, 0.0), t);
    float hz = height(p + vec2(0.0, e), t);
    vec3 n = normalize(vec3((h0 - hx) * 2.2, 1.0, (h0 - hz) * 2.2));
    if (uRain > 0.0) {
      vec2 r = rings(vWorld.xz, t);
      n = normalize(n + vec3(r.x, 0.0, r.y) * 0.5 * uRain);
    }
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 rdir = reflect(-v, n);
    // the sky in it: black overhead, the glow of the city low down
    vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.45, rdir.y));
    vec3 col = mix(uDeep * (0.75 + h0 * 0.6), sky, clamp(fres * 1.25, 0.0, 1.0));
    // the lights: each one laid across the water as a long streak running toward you (narrow side to side, long
    // front to back), broken up by the waves, with hard glints where the surface catches it full on
    vec3 side = normalize(cross(v, vec3(0.0, 1.0, 0.0)) + vec3(1e-5));
    float broken = 0.45 + 1.1 * noise(vWorld.xz * vec2(3.5, 1.2) + vec2(0.0, t * 1.4));
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= uLightCount) break;
      vec3 L = uLightPos[i] - vWorld;
      float dist = length(L);
      L /= dist;
      vec3 diff = rdir - L;
      float ds = dot(diff, side);
      float du = length(diff - side * ds);
      float streak = exp(-ds * ds * 520.0) * exp(-du * du * 9.0);
      float glint = pow(max(dot(rdir, L), 0.0), 260.0) * 3.5;
      col += uLightCol[i] * (streak * 0.85 * broken + glint) / (1.0 + dist * dist * 0.0022);
      // and a little of each light on the water right under it
      col += uLightCol[i] * 0.008 * max(0.0, 1.0 - dist / 12.0);
    }
    // murk: silt in the water, the color of the river
    col = mix(col, uDeep * 1.6, uMurk * 0.5);
    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const linear = (hex) => new THREE.Color(hex);    // (THREE.Color stores linear values when it's given sRGB hex)

// deep: the water's own color, deep down. scale: how big the waves are (bigger number, smaller waves).
// chop: how rough. murk: how much silt. opacity: < 1 to see the road through a shallow flood.
export function waterMaterial({ deep = 0x07141a, sky = 0x080b12, horizon = 0x241c16, scale = 1, chop = 1, murk = 0, opacity = 1, side = THREE.FrontSide } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uScale: { value: scale }, uChop: { value: chop }, uOpacity: { value: opacity }, uRain: { value: 0 },
      uMurk: { value: murk }, uDeep: { value: linear(deep) }, uSky: { value: linear(sky) }, uHorizon: { value: linear(horizon) },
      uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
      uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
      uLightCount: { value: 0 },
    }]),
    vertexShader,
    fragmentShader,
    fog: true,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    side,
  });
  all.add(m);
  return m;
}

// every frame: the time, the rain, and the lights near the camera (nearest first)
const lightBuf = [];
export function updateWater(dt, { camera, lights = [], rain = false }) {
  if (!all.size) return;
  const cam = camera.getWorldPosition(tmp);
  lightBuf.length = 0;
  for (const l of lights) lightBuf.push({ l, d: l.pos.distanceToSquared(cam) });
  lightBuf.sort((a, b) => a.d - b.d);
  const n = Math.min(MAX_LIGHTS, lightBuf.length);
  for (const m of all) {
    const u = m.uniforms;
    u.uTime.value += dt;
    u.uRain.value += ((rain ? 1 : 0) - u.uRain.value) * Math.min(1, dt * 1.5);
    u.uLightCount.value = n;
    for (let i = 0; i < n; i++) {
      const { pos, color, power = 1 } = lightBuf[i].l;
      u.uLightPos.value[i].copy(pos);
      u.uLightCol.value[i].set(color.r * power, color.g * power, color.b * power);
    }
  }
}
const tmp = new THREE.Vector3();
