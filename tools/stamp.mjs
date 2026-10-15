// Stamps every script and the stylesheet in index.html with a hash of its contents, so browsers
// always load the newest version of a changed file instead of a stale cached copy.
// Run before publishing: node tools/stamp.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = (file) => crypto.createHash("sha1").update(fs.readFileSync(path.join(root, file))).digest("hex").slice(0, 8);
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : []));

const modules = [...walk("js"), "tools/playtest.js"];
const imports = { three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" };
// modules are imported relatively; the import map points each one at its stamped address
for (const m of modules) imports[`./${m}`] = `./${m}?v=${hash(m)}`;

const indexPath = path.join(root, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">\n    ${JSON.stringify({ imports }, null, 1).replace(/\n/g, "\n    ")}\n  </script>`);
html = html.replace(/<script type="module" src="js\/main\.js[^"]*"><\/script>/, `<script type="module" src="js/main.js?v=${hash("js/main.js")}"></script>`);
html = html.replace(/href="css\/style\.css[^"]*"/, `href="css/style.css?v=${hash("css/style.css")}"`);
fs.writeFileSync(indexPath, html);

// voice clips too: the manifest lists each clip's hash, and the game asks for voices/<id>.mp3?v=<hash>
const manifestPath = path.join(root, "voices", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.versions = {};
for (const id of Object.values(manifest.nights).flat().concat((manifest.lines || []).map((l) => l.id))) {
  if (!manifest.versions[id] && fs.existsSync(path.join(root, "voices", `${id}.mp3`))) manifest.versions[id] = hash(`voices/${id}.mp3`);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`stamped ${modules.length} modules and ${Object.keys(manifest.versions).length} voice clips`);
