const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron")
const path = require("path")
const fs = require("fs")
const { autoUpdater } = require("electron-updater")
const isDev = require("electron-is-dev")

// Mantener una referencia global del objeto window para evitar
// que la ventana se cierre automáticamente cuando el objeto JavaScript sea recogido por el recolector de basura.
let mainWindow

function createWindow() {
  // Crear la ventana del navegador.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Por seguridad, no permitimos integración directa de Node
      contextIsolation: true, // Aislar el contexto para mayor seguridad
      preload: path.join(__dirname, "preload.js"), // Script de precarga para exponer APIs seguras
    },
    icon: path.join(__dirname, "assets/icon.png"),
  })

  // Cargar la aplicación.
  const startUrl = isDev
    ? "http://localhost:5173" // URL de desarrollo
    : `file://${path.join(__dirname, "dist/index.html")}` // URL de producción

  mainWindow.loadURL(startUrl)

  // Abrir las herramientas de desarrollo en modo desarrollo.
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  // Emitido cuando la ventana es cerrada.
  mainWindow.on("closed", () => {
    mainWindow = null
  })

  // Crear menú
  createMenu()
}

// Crear el menú de la aplicación
function createMenu() {
  const template = [
    {
      label: "Archivo",
      submenu: [
        {
          label: "Abrir carpeta",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openDirectory"],
            })
            if (!result.canceled) {
              mainWindow.webContents.send("directory-selected", result.filePaths[0])
            }
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Ayuda",
      submenu: [
        {
          label: "Verificar actualizaciones",
          click: () => {
            autoUpdater.checkForUpdatesAndNotify()
          },
        },
        {
          label: "Acerca de",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: "Audio Explorer",
              message: `Audio Explorer v${app.getVersion()}`,
              detail: "Una aplicación para explorar y transcribir archivos de audio.",
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Este método será llamado cuando Electron haya terminado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    // En macOS es común volver a crear una ventana en la aplicación cuando
    // se hace clic en el icono del dock y no hay otras ventanas abiertas.
    if (mainWindow === null) createWindow()
  })

  // Configurar auto-updater
  setupAutoUpdater()
})

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// Configurar IPC (comunicación entre procesos)
function setupIPC() {
  // Manejar la selección de directorio
  ipcMain.handle("select-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    })
    return result
  })

  // Manejar la lectura de directorio
  ipcMain.handle("read-directory", async (event, dirPath) => {
    try {
      console.log("Leyendo directorio:", dirPath)
      const files = fs.readdirSync(dirPath, { withFileTypes: true })
      return files.map((file) => {
        const filePath = path.join(dirPath, file.name)
        const stats = fs.statSync(filePath)

        return {
          name: file.name,
          path: filePath,
          isDirectory: file.isDirectory(),
          type: file.isDirectory() ? "directory" : path.extname(file.name).slice(1),
          size: stats.size,
          lastModified: stats.mtime.getTime(),
        }
      })
    } catch (error) {
      console.error("Error leyendo directorio:", error)
      throw error
    }
  })

  // Verificar si un directorio existe
  ipcMain.handle("directory-exists", async (event, dirPath) => {
    try {
      const stats = fs.statSync(dirPath)
      return stats.isDirectory()
    } catch (error) {
      console.log("Directorio no existe o no es accesible:", dirPath)
      return false
    }
  })

  // Manejar la obtención de la versión de la aplicación
  ipcMain.handle("get-app-version", () => {
    return app.getVersion()
  })

  // Manejar la obtención de la plataforma
  ipcMain.handle("get-platform", () => {
    return process.platform
  })

  // Manejar la verificación de actualizaciones
  ipcMain.handle("check-for-updates", () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify()
    }
  })

  // Manejar la instalación de actualizaciones
  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall()
  })
}

// Configurar auto-updater
function setupAutoUpdater() {
  if (isDev) {
    console.log("Modo desarrollo: auto-updater desactivado")
    return
  }

  autoUpdater.logger = require("electron-log")
  autoUpdater.logger.transports.file.level = "info"

  autoUpdater.on("checking-for-update", () => {
    sendStatusToWindow("Verificando actualizaciones...")
  })

  autoUpdater.on("update-available", (info) => {
    sendStatusToWindow("Actualización disponible.")
    mainWindow.webContents.send("update-available", info)
  })

  autoUpdater.on("update-not-available", (info) => {
    sendStatusToWindow("La aplicación está actualizada.")
  })

  autoUpdater.on("error", (err) => {
    sendStatusToWindow(`Error en auto-updater: ${err.toString()}`)
    mainWindow.webContents.send("update-error", err)
  })

  autoUpdater.on("download-progress", (progressObj) => {
    sendStatusToWindow(
      `Velocidad: ${progressObj.bytesPerSecond} - Descargado ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`,
    )
    mainWindow.webContents.send("download-progress", progressObj)
  })

  autoUpdater.on("update-downloaded", (info) => {
    sendStatusToWindow("Actualización descargada. Se instalará al reiniciar.")
    mainWindow.webContents.send("update-downloaded", info)
  })

  // Verificar actualizaciones al iniciar
  autoUpdater.checkForUpdatesAndNotify()
}

function sendStatusToWindow(text) {
  console.log(text)
  if (mainWindow) {
    mainWindow.webContents.send("updater-message", text)
  }
}

// Configurar IPC cuando la app esté lista
app.whenReady().then(setupIPC)
