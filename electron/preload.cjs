// Bridge: the only doorway between the page (character UI) and the system window.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companion", {
  setClickThrough: (ignore) => ipcRenderer.send("set-click-through", ignore),
  cursorClientPos: () => ipcRenderer.invoke("cursor-client-pos"),
  dragStart: () => ipcRenderer.send("drag-start"),
  dragEnd: () => ipcRenderer.send("drag-end"),
  hide: () => ipcRenderer.send("hide-app"),
  quit: () => ipcRenderer.send("quit-app"),
  layoutInfo: () => ipcRenderer.invoke("layout-info"),
  setWindowSize: (size) => ipcRenderer.invoke("set-window-size", size),
  ensureMic: () => ipcRenderer.invoke("ensure-mic"),
  idleSeconds: () => ipcRenderer.invoke("idle-seconds"),
  openLink: (url) => ipcRenderer.send("open-link", url),
  setCallAutohide: (on) => ipcRenderer.send("set-call-autohide", on),
  getLoginItem: () => ipcRenderer.invoke("get-login-item"),
  setLoginItem: (on) => ipcRenderer.invoke("set-login-item", on),
  brainDisconnect: () => ipcRenderer.invoke("brain-disconnect"),
  dataReset: () => ipcRenderer.invoke("data-reset"),
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
  dataSave: (data) => ipcRenderer.invoke("data-save", data),
  calendarStatus: () => ipcRenderer.invoke("calendar-status"),
  calendarSaveClient: (creds) => ipcRenderer.invoke("calendar-save-client", creds),
  calendarConnect: () => ipcRenderer.invoke("calendar-connect"),
  calendarDisconnect: () => ipcRenderer.invoke("calendar-disconnect"),
  onCalendarMeeting: (handler) => {
    const wrapped = (_e, data) => handler(data);
    ipcRenderer.on("calendar-meeting", wrapped);
    return () => ipcRenderer.removeListener("calendar-meeting", wrapped);
  },
});
