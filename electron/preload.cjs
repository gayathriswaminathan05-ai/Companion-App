// Bridge: the only doorway between the page (character UI) and the system window.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companion", {
  setClickThrough: (ignore) => ipcRenderer.send("set-click-through", ignore),
  dragStart: () => ipcRenderer.send("drag-start"),
  dragEnd: () => ipcRenderer.send("drag-end"),
  hide: () => ipcRenderer.send("hide-app"),
  quit: () => ipcRenderer.send("quit-app"),
  layoutInfo: () => ipcRenderer.invoke("layout-info"),
  ensureMic: () => ipcRenderer.invoke("ensure-mic"),
  idleSeconds: () => ipcRenderer.invoke("idle-seconds"),
  openLink: (url) => ipcRenderer.send("open-link", url),
  brainStatus: () => ipcRenderer.invoke("brain-status"),
  brainConnect: (key) => ipcRenderer.invoke("brain-connect", key),
  chatSend: (payload) => ipcRenderer.invoke("chat-send", payload),
  brainOnce: (payload) => ipcRenderer.invoke("brain-once", payload),
  onChatEvent: (channel, handler) => {
    const wrapped = (_e, data) => handler(data);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  transcribe: (audioBuffer) => ipcRenderer.invoke("transcribe", audioBuffer),
  dataLoad: () => ipcRenderer.invoke("data-load"),
  dataSave: (data) => ipcRenderer.send("data-save", data),
});
