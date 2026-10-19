// What the game can ask of the app: full screen (the window's own) and quitting.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isFullscreen: () => ipcRenderer.sendSync("fullscreen:get"),
  setFullscreen: (on) => ipcRenderer.send("fullscreen:set", !!on),
  quit: () => ipcRenderer.send("app:quit"),
});
