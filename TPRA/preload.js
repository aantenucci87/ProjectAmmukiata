const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  fetchMenu: async (payload) => ipcRenderer.invoke("fetch-menu", payload),
});
