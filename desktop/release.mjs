// Publishes an update for the installed app to pick up:
//   npm run release -- "what changed"          bumps the version (1.0.0 -> 1.0.1), builds, uploads
//   npm run release -- --same "what changed"   publishes the version in package.json as it is
// It builds the installer and makes it a GitHub release on the (private) repo; the app finds it the next time it
// starts. Commit desktop/package.json afterwards, so the version number is kept.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = "igncoupe/last-stop";
const args = process.argv.slice(2);
const same = args.includes("--same");
const notes = args.filter((a) => a !== "--same").join(" ").trim() || "Fixes and improvements.";

const pkgFile = path.join(here, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
if (!same) {
  const v = pkg.version.split(".").map(Number);
  v[2] += 1;
  pkg.version = v.join(".");
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
}
const run = (cmd, a) => execFileSync(cmd, a, { cwd: here, stdio: "inherit", shell: process.platform === "win32" });

console.log(`The Last Stop ${pkg.version}`);
run("node", ["build-game.mjs"]);
run("npx", ["electron-builder", "--win", "nsis", "--publish", "never"]);
const exe = path.join(here, "dist", `The Last Stop Setup ${pkg.version}.exe`);
if (!fs.existsSync(exe)) throw new Error("no installer at " + exe);
run("gh", ["release", "create", `v${pkg.version}`, exe, "--repo", REPO, "--title", `The Last Stop ${pkg.version}`, "--notes", notes]);
console.log(`released ${pkg.version}: the app will offer it the next time it starts`);
