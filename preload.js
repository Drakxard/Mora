const { contextBridge, ipcRenderer } = require("electron")

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld("electron", {
  // Diálogo de selección de directorio
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  // Lectura de directorio
  readDirectory: (path) => ipcRenderer.invoke("read-directory", path),

  // Información del sistema
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  // Manejo de actualizaciones
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  // Verificar si el directorio existe
  directoryExists: (path) => ipcRenderer.invoke("directory-exists", path),

  // Eventos
  onSelectDirectory: (callback) => {
    ipcRenderer.on("directory-selected", (_, path) => callback(path))
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_, info) => callback(info))
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", (_, info) => callback(info))
  },
  onUpdateError: (callback) => {
    ipcRenderer.on("update-error", (_, error) => callback(error))
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on("download-progress", (_, progressObj) => callback(progressObj))
  },
  onUpdaterMessage: (callback) => {
    ipcRenderer.on("updater-message", (_, message) => callback(message))
  },
})
