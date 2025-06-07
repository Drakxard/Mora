// src/types/electron.d.ts

interface ElectronAPI {
  // Diálogo de selección de directorio
  selectDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>

  // Operaciones de directorio
  readDirectory: (path: string) => Promise<any[]>
  directoryExists: (path: string) => Promise<boolean>
  savePath: (path: string) => Promise<void>
  getSavedPath: () => Promise<string | null>

  // Manejo de actualizaciones
  checkForUpdates: () => Promise<{ available: boolean; message?: string; error?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void

  // Eventos de actualización
  onUpdaterChecking: (callback: () => void) => () => void
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateNotAvailable: (callback: () => void) => () => void
  onUpdaterError: (callback: (error: string) => void) => () => void
  onDownloadProgress: (callback: (progress: any) => void) => () => void
  onUpdateDownloaded: (callback: () => void) => () => void
  onUpdaterMessage: (callback: (message: string) => void) => () => void
  onUpdateError: (callback: (error: any) => void) => () => void

  // Eventos de directorio
  onSelectDirectory: (callback: (path: string) => void) => void

  // Información del sistema
  getAppVersion: () => Promise<string>
  getPlatform: () => Promise<string>

  // Configuración
  getSettings: () => Promise<any>
  saveSettings: (settings: any) => Promise<void>

  // Diálogos
  showMessageBox: (options: any) => Promise<{ response: number }>
}

declare global {
  interface Window {
    electron?: ElectronAPI
    electronAPI?: ElectronAPI // Para compatibilidad con UpdaterSettings.tsx
    process?: {
      type: string
    }
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
}

// Extensiones para File System Access API
declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>
    queryPermission(options: { mode: string }): Promise<string>
    requestPermission(options: { mode: string }): Promise<string>
  }
}

export {}
