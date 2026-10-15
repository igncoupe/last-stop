// PS1-style rendering helpers: chunky low-res pixels, wobbly snapped
// vertices, and cheap Lambert lighting. Every world material goes through mat().
import * as THREE from "three";

export const PIXEL_SCALE = 2;                       // 1 game pixel = 2 screen pixels
const SNAP = new THREE.Vector2(360, 270);            // vertex snapping grid (lower = wobblier)

function patch(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: SNAP };
    shader.vertexShader = "uniform vec2 uSnap;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
       gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;`,
    );
  };
  material.customProgramCacheKey = () => "ps1-" + material.type;
  return material;
}

// world material: Lambert with snapping. Options pass straight to three.js.
export function mat(options = {}) {
  return patch(new THREE.MeshLambertMaterial(options));
}
// glowing material (lamps, signs, lit windows) that ignores lighting
export function glow(color, options = {}) {
  return patch(new THREE.MeshBasicMaterial({ color, ...options }));
}

export function makeRenderer(canvas, { preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const resize = (camera) => {
    // a minimized window can report 0 x 0; keep the last real size instead
    if (!window.innerWidth || !window.innerHeight) return;
    const w = Math.ceil(window.innerWidth / PIXEL_SCALE);
    const h = Math.ceil(window.innerHeight / PIXEL_SCALE);
    renderer.setSize(w, h, false);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  };
  return { renderer, resize };
}

// box with UVs scaled to its size, so one texture tile covers `tile` meters
export function box(w, h, d, material, tile = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (tile) {
    const uv = g.attributes.uv;
    // face order in BoxGeometry: +x, -x, +y, -y, +z, -z (4 vertices each)
    const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * sizes[f][0] / tile[0], uv.getY(k) * sizes[f][1] / tile[1]);
      }
    }
  }
  return new THREE.Mesh(g, material);
}
