const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const MENU_ENDPOINT = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/home/menu/get";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("index.html");
}

ipcMain.handle("fetch-menu", async (_event, payload) => {
  const body = JSON.stringify(payload || { id_settore: 2 });

  const response = await fetch(MENU_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json,text/plain, */*",
      Authorization: "Bearer null",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
