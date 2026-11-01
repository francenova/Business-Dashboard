// Preload script — runs in the renderer with Node access, before the page
// loads, with contextIsolation on. Exposes a narrow bridge for the device
// token (see electron/main.cjs's safeStorage-backed IPC handlers) — the
// renderer never touches the OS secure-storage APIs directly, only these
// two invoke calls.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('royalOpticalDesktop', {
  isDesktopApp: true,
  getDeviceToken: () => ipcRenderer.invoke('device-token:get'),
  setDeviceToken: (token) => ipcRenderer.invoke('device-token:set', token),
});
