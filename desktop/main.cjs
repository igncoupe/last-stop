// The Last Stop, as a Windows app: the game in its own window, served from inside the app (nothing from the
// internet), full screen, with saves kept where Windows keeps app data (%APPDATA%\The Last Stop).
const { app, BrowserWindow, protocol, net, Menu, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { execFile, spawn } = require("child_process");

const GAME = path.join(__dirname, "game");
// the game is served as app://game/..., a real origin, so its modules, fetches and saves work as they do on the web
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// a test run keeps its saves (and everything else) in its own folder, never with yours
if (process.env.LASTSTOP_SMOKE) app.setPath("userData", path.join(process.env.LASTSTOP_SMOKE, "userData"));
// one window at a time: opening it again brings the running one back
if (!app.requestSingleInstanceLock()) app.quit();

const prefsFile = () => path.join(app.getPath("userData"), "window.json");
const prefs = () => { try { return JSON.parse(fs.readFileSync(prefsFile(), "utf8")); } catch { return {}; } };
const savePrefs = (p) => { try { fs.writeFileSync(prefsFile(), JSON.stringify(p)); } catch { /* not saved */ } };

let win = null;
const testLog = [];
const note = (m) => { if (process.env.LASTSTOP_SMOKE) testLog.push(m); };

function open() {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    show: false,
    backgroundColor: "#000000",
    title: "The Last Stop",
    icon: path.join(__dirname, "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: "no-user-gesture-required",
      backgroundThrottling: false,
    },
  });
  const testing = !!process.env.LASTSTOP_SMOKE;
  win.once("ready-to-show", () => {
    if (!testing) win.maximize();
    if (prefs().fullscreen !== false && !testing) win.setFullScreen(true);
    win.show();
    if (!testing) setTimeout(checkForUpdate, 8000);   // once the game's up, not while it's starting
  });
  // F11 or Alt+Enter: in and out of full screen
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11" || (input.alt && input.key === "Enter")) {
      e.preventDefault();
      setFullscreen(!win.isFullScreen());
    }
  });
  // the game never leaves itself; a real link (none today) opens in the browser
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("app://")) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  smokeTest(win);
  win.loadURL("app://game/index.html");
}

function setFullscreen(on) {
  win.setFullScreen(on);
  savePrefs({ ...prefs(), fullscreen: on });
}

ipcMain.on("fullscreen:get", (e) => { e.returnValue = !!(win && win.isFullScreen()); });
ipcMain.on("fullscreen:set", (e, on) => { if (win) setFullscreen(!!on); });
ipcMain.on("app:quit", () => app.quit());

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("app", (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(GAME, decodeURIComponent(pathname)));
    if (!file.startsWith(GAME + path.sep)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  open();
});
app.on("window-all-closed", () => app.quit());
// an update that was downloaded but not installed yet goes in as you quit
app.on("will-quit", () => install(false));

// ---------- updates
// A new version is a GitHub release on the game's repo (private). The app asks the GitHub CLI that's signed in on
// this PC, so no password or key is ever kept in the app; without it, or offline, there's just no update. Publish one
// with: npm run release -- "what changed".
const REPO = "igncoupe/last-stop";
let pendingInstaller = null;

function gh(args, timeout = 20000) {
  const tries = ["gh", path.join(process.env.ProgramFiles || "C:/Program Files", "GitHub CLI", "gh.exe")];
  const run = (i) => new Promise((done) => {
    if (i >= tries.length) return done(null);
    execFile(tries[i], args, { windowsHide: true, timeout, maxBuffer: 8 << 20 }, (err, out) => {
      if (err && err.code === "ENOENT") return run(i + 1).then(done);
      done(err ? null : out);
    });
  });
  return run(0);
}
function newer(a, b) {
  const x = a.split(".").map((n) => parseInt(n, 10) || 0);
  const y = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
async function checkForUpdate() {
  const test = process.env.LASTSTOP_UPDATE_TEST;         // a test run pretends to be this (old) version, and stops
  if (!app.isPackaged && !test) return;                  // short of installing anything
  const current = test || app.getVersion();
  const out = await gh(["release", "view", "--repo", REPO, "--json", "tagName,body,assets"]);
  if (!out) return note("[update] no answer from GitHub");
  let rel;
  try { rel = JSON.parse(out); } catch { return note("[update] unreadable answer"); }
  const latest = String(rel.tagName || "").replace(/^v/, "");
  note(`[update] this is ${current}, the latest is ${latest}`);
  if (!newer(latest, current)) return;
  const asset = (rel.assets || []).find((a) => /\.exe$/i.test(a.name));
  if (!asset) return note("[update] the release has no installer");
  const dir = path.join(app.getPath("temp"), "the-last-stop-update", latest);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const got = await gh(["release", "download", rel.tagName, "--repo", REPO, "--pattern", asset.name, "--dir", dir], 30 * 60 * 1000);
  const file = path.join(dir, asset.name);
  if (got === null || !fs.existsSync(file) || fs.statSync(file).size !== asset.size) return note("[update] the download failed");
  note(`[update] downloaded ${asset.name}, ${asset.size} bytes`);
  if (test) return;
  pendingInstaller = file;
  const { response } = await dialog.showMessageBox(win, {
    type: "info",
    title: "The Last Stop",
    message: `Version ${latest} is ready.`,
    detail: `${String(rel.body || "").trim().slice(0, 800)}\n\nYour saves are kept.`.trim(),
    buttons: ["Restart and update", "When I quit"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) install(true);
}
// the installer runs on its own once the game has closed, silently; with runAfter it opens the game again
function install(runAfter) {
  if (!pendingInstaller) return;
  const file = pendingInstaller;
  pendingInstaller = null;
  spawn(file, ["/S", "--updated", ...(runAfter ? ["--force-run"] : [])], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  if (runAfter) app.quit();
}

// For checking a build: LASTSTOP_SMOKE=<folder> starts the app, gets past the warning into a new game, saves
// two screenshots and the console there, and quits. Never set when you just play.
function smokeTest(w) {
  const out = process.env.LASTSTOP_SMOKE;
  if (!out) return;
  fs.mkdirSync(out, { recursive: true });
  w.webContents.setAudioMuted(true);                 // a test run is a silent one
  const log = testLog;
  w.webContents.on("console-message", (...a) => {
    const d = a[0] && a[0].message !== undefined ? a[0] : { level: a[1], message: a[2] };
    log.push(`[${d.level}] ${d.message}`);
  });
  w.webContents.on("did-fail-load", (e, code, desc, url) => log.push(`[fail] ${code} ${desc} ${url}`));
  const flush = () => fs.writeFileSync(path.join(out, "console.log"), log.join("\n"));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const capped = (p, what, ms = 8000) => {
    let done = false;
    return Promise.race([p.then((v) => { done = true; return v; }),
      wait(ms).then(() => { if (!done) log.push(`[timeout] ${what}`); return null; })]);
  };
  const shot = async (name) => {
    const img = await capped(w.webContents.capturePage(), `screenshot ${name}`);
    if (img) fs.writeFileSync(path.join(out, name), img.toPNG());
    log.push(`[step] ${name}`);
    flush();
  };
  const js = (code) => capped(w.webContents.executeJavaScript(code, true).catch((err) => { log.push(`[js] ${err}`); return null; }), "script");
  w.webContents.once("did-finish-load", async () => {
    await wait(4000);
    await shot("1-start.png");
    await js(`document.getElementById("btn-warning")?.click()`);
    await wait(2500);
    await shot("2-title.png");
    const info = await js(`JSON.stringify({ exit: !document.getElementById("btn-exit").hidden, full: window.desktop.isFullscreen(),
      canvas: !!document.querySelector("canvas"), fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family) })`);
    log.push(`[info] ${info}`);
    await js(`document.getElementById("btn-new")?.click()`);
    await wait(3000);
    await shot("3-night.png");
    await js(`[...document.querySelectorAll("button")].find((b) => /start shift/i.test(b.textContent) && b.offsetParent)?.click()`);
    await wait(14000);
    await shot("4-bus.png");
    log.push(`[info] ${await js(`JSON.stringify({ sound: !!window.AudioContext, playing: !document.getElementById("screen-title") || document.getElementById("screen-title").hidden })`)}`);
    if (process.env.LASTSTOP_UPDATE_TEST) await checkForUpdate();
    flush();
    app.quit();
  });
}
