// src/utils/storage.ts

interface AppConfig {
  lastDirectoryName?: string
  lastDirectoryPath?: string // Nueva propiedad para Electron
  transcriptions: Record<string, string>
  selectedModels?: {
    transcription?: string
    chat?: string
  }
  userApiKey?: string // Nueva propiedad para la API key del usuario
  isFirstRun?: boolean // Nueva propiedad para detectar primer inicio
  apiKeyConfigured?: boolean // Nueva propiedad para verificar si la API key está configurada
}

const STORAGE_KEY = "audio-explorer-config"
const DIRECTORY_HANDLE_KEY = "audio-explorer-directory-handle"

export const loadConfig = (): AppConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error("Error cargando configuración:", error)
  }

  return {
    transcriptions: {},
    selectedModels: {},
    isFirstRun: true,
    apiKeyConfigured: false,
  }
}

export const saveConfig = (config: AppConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error("Error guardando configuración:", error)
  }
}

export const saveTranscription = (filePath: string, transcription: string): void => {
  const config = loadConfig()
  config.transcriptions[filePath] = transcription
  saveConfig(config)
}

export const getTranscription = (filePath: string): string | undefined => {
  const config = loadConfig()
  return config.transcriptions[filePath]
}

export const deleteTranscription = (filePath: string): void => {
  const config = loadConfig()
  delete config.transcriptions[filePath]
  saveConfig(config)
}

export const saveLastDirectory = (directoryName: string, directoryPath?: string): void => {
  const config = loadConfig()
  config.lastDirectoryName = directoryName
  if (directoryPath) {
    config.lastDirectoryPath = directoryPath
  }
  saveConfig(config)
}

export const getLastDirectory = (): { name?: string; path?: string } => {
  const config = loadConfig()
  return {
    name: config.lastDirectoryName,
    path: config.lastDirectoryPath,
  }
}

export const getAllTranscriptions = (): Record<string, string> => {
  const config = loadConfig()
  return config.transcriptions
}

// Funciones para modelos seleccionados
export const saveSelectedModel = (type: "transcription" | "chat", modelId: string): void => {
  const config = loadConfig()
  if (!config.selectedModels) {
    config.selectedModels = {}
  }
  config.selectedModels[type] = modelId
  saveConfig(config)
  console.log(`Modelo ${type} guardado:`, modelId)
}

export const getSelectedModel = (type: "transcription" | "chat"): string | undefined => {
  const config = loadConfig()
  return config.selectedModels?.[type]
}

// Funciones para manejar el directorio con File System Access API (Web)
export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  try {
    // Solicitar permiso persistente
    if ("permissions" in navigator) {
      const permission = await handle.requestPermission({ mode: "read" })
      console.log("Permiso de directorio:", permission)
    }

    // Guardar el handle en IndexedDB
    if ("indexedDB" in window) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("AudioExplorerDB", 1)

        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains("directoryHandles")) {
            db.createObjectStore("directoryHandles", { keyPath: "id" })
          }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("directoryHandles", "readwrite")
        const store = transaction.objectStore("directoryHandles")
        const request = store.put({ id: DIRECTORY_HANDLE_KEY, handle })

        request.onsuccess = () => {
          console.log("Handle de directorio guardado en IndexedDB")
          saveLastDirectory(handle.name) // También guardar el nombre en localStorage
          resolve()
        }

        request.onerror = () => reject(request.error)
      })
    } else {
      throw new Error("IndexedDB no está disponible")
    }
  } catch (error) {
    console.error("Error guardando handle de directorio:", error)
    // Fallback: al menos guardar el nombre
    saveLastDirectory(handle.name)
  }
}

export const getDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    if ("indexedDB" in window) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("AudioExplorerDB", 1)

        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains("directoryHandles")) {
            db.createObjectStore("directoryHandles", { keyPath: "id" })
          }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
        const transaction = db.transaction("directoryHandles", "readonly")
        const store = transaction.objectStore("directoryHandles")
        const request = store.get(DIRECTORY_HANDLE_KEY)

        request.onsuccess = () => {
          if (request.result) {
            console.log("Handle de directorio recuperado de IndexedDB")
            resolve(request.result.handle)
          } else {
            console.log("No se encontró handle de directorio en IndexedDB")
            resolve(null)
          }
        }

        request.onerror = () => reject(request.error)
      })
    }
  } catch (error) {
    console.error("Error recuperando handle de directorio:", error)
  }

  return null
}

// Nuevas funciones para Electron
export const saveDirectoryPathElectron = (directoryPath: string): void => {
  const directoryName = directoryPath.split(/[/\\]/).pop() || directoryPath
  saveLastDirectory(directoryName, directoryPath)
  console.log("Ruta de directorio guardada para Electron:", directoryPath)
}

export const getDirectoryPathElectron = (): string | undefined => {
  const config = loadConfig()
  return config.lastDirectoryPath
}

// Funciones para manejar la API key del usuario
export const saveUserApiKey = (apiKey: string): void => {
  const config = loadConfig()
  config.userApiKey = apiKey
  config.apiKeyConfigured = true
  config.isFirstRun = false
  saveConfig(config)
  console.log("API key del usuario guardada")
}

export const getUserApiKey = (): string | undefined => {
  const config = loadConfig()
  return config.userApiKey
}

export const deleteUserApiKey = (): void => {
  const config = loadConfig()
  delete config.userApiKey
  config.apiKeyConfigured = false
  saveConfig(config)
  console.log("API key del usuario eliminada")
}

// Función helper para obtener la API key (usuario o fallback)
export const getApiKey = (): string | undefined => {
  const userApiKey = getUserApiKey()
  if (userApiKey) {
    return userApiKey
  }
  // No usar fallback - forzar al usuario a configurar su propia API key
  return undefined
}

// Nuevas funciones para el primer inicio
export const isFirstRun = (): boolean => {
  const config = loadConfig()
  return config.isFirstRun !== false
}

export const isApiKeyConfigured = (): boolean => {
  const config = loadConfig()
  return config.apiKeyConfigured === true && !!config.userApiKey
}

export const markFirstRunComplete = (): void => {
  const config = loadConfig()
  config.isFirstRun = false
  saveConfig(config)
}
