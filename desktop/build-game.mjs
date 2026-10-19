// Copies the game into desktop/game for the app, with what it gets from the internet on the web (three.js from a
// CDN, the fonts from Google) swapped for copies inside the app, so it plays offline.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const out = path.join(here, "game");
const mod = (p) => path.join(here, "node_modules", p);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "vendor", "fonts"), { recursive: true });
for (const p of ["index.html", "css", "js", "voices"]) fs.cpSync(path.join(root, p), path.join(out, p), { recursive: true });

// three.js, the same version the web game uses
const html0 = fs.readFileSync(path.join(out, "index.html"), "utf8");
const cdn = html0.match(/"three":\s*"(https:\/\/cdn\.jsdelivr\.net\/npm\/three@([\d.]+)\/build\/three\.module\.js)"/);
if (!cdn) throw new Error("index.html: three.js import not found");
const want = cdn[2];
const have = JSON.parse(fs.readFileSync(mod("three/package.json"), "utf8")).version;
if (have !== want) throw new Error(`the game uses three ${want}, desktop/package.json has ${have}`);
fs.copyFileSync(mod("three/build/three.module.js"), path.join(out, "vendor", "three.module.js"));

// the fonts: VT323 (400) and Inter (500, 700), latin
const faces = [
  ["VT323", 400, "@fontsource/vt323/files/vt323-latin-400-normal.woff2"],
  ["Inter", 500, "@fontsource/inter/files/inter-latin-500-normal.woff2"],
  ["Inter", 700, "@fontsource/inter/files/inter-latin-700-normal.woff2"],
];
const css = faces.map(([family, weight, file]) => {
  fs.copyFileSync(mod(file), path.join(out, "vendor", "fonts", path.basename(file)));
  return `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url("fonts/${path.basename(file)}") format("woff2"); }`;
});
fs.writeFileSync(path.join(out, "vendor", "fonts.css"), css.join("\n") + "\n");

let html = html0
  .replace(cdn[1], "./vendor/three.module.js")
  .replace(/\s*<link rel="preconnect"[^>]*>/g, "")
  .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="vendor/fonts.css">');
if (/https?:\/\/(?!www\.w3\.org)/.test(html)) throw new Error("index.html still loads something from the internet");
// and nothing from outside the app can load at all
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "media-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:";
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`game copied to ${path.relative(root, out)} (three ${have}, ${faces.length} font faces)`);
