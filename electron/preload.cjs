// Bridge: the only doorway between the page (character UI) and the system window.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companion", {
  setClickThrough: (ignore) => ipcRenderer.send("set-click-through", ignore),
  dragStart: () => ipcRenderer.send("drag-start"),
  dragEnd: () => ipcRenderer.send("drag-end"),
  hide: () => ipcRenderer.send("hide-app"),
  quit: () => ipcRenderer.send("quit-app"),
  dataLoad: () => ipcRenderer.invoke("data-load"),
  dataSave: (data) => ipcRenderer.send("data-save", data),
});
