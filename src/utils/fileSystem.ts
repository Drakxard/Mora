import type { FileItem } from "../types"

/**
 * Requests access to a directory using the File System Access API
 */
export const openDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    // Check if the File System Access API is supported
    if (!("showDirectoryPicker" in window)) {
      alert("Tu navegador no soporta File System Access API. Intenta con Chrome, Edge o Safari actualizado.")
      return null
    }

    // Show directory picker
    return await window.showDirectoryPicker()
  } catch (error) {
    console.error("Error al abrir directorio:", error)
    return null
  }
}

/**
 * Gets all files and directories in the specified directory
 */
export const getDirectoryContents = async (directoryHandle: FileSystemDirectoryHandle): Promise<FileItem[]> => {
  const entries: FileItem[] = []

  try {
    // Iterate through all entries in the directory
    for await (const entry of directoryHandle.values()) {
      const item: FileItem = {
        name: entry.name,
        isDirectory: entry.kind === "directory",
        type: entry.kind === "directory" ? "directory" : "unknown",
        path: entry.name,
      }

      // If it's a file, get more information
      if (entry.kind === "file") {
        try {
          const file = await entry.getFile()
          item.type = file.type || getFileTypeFromExtension(file.name)
          item.url = URL.createObjectURL(file)
          item.size = file.size
          item.lastModified = file.lastModified
        } catch (error) {
          console.error(`Error al obtener el archivo ${entry.name}:`, error)
        }
      }

      entries.push(item)
    }

    // Sort directories first, then files alphabetically
    return entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error("Error al leer el contenido del directorio:", error)
    return []
  }
}

/**
 * Determines file type based on file extension
 */
export const getFileTypeFromExtension = (filename: string): string => {
  const extension = filename.split(".").pop()?.toLowerCase() || ""

  const typeMap: Record<string, string> = {
    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",

    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",

    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    rtf: "application/rtf",

    // Videos
    mp4: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    wmv: "video/x-ms-wmv",

    // Archives
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",

    // Code
    js: "text/javascript",
    ts: "text/typescript",
    jsx: "text/jsx",
    tsx: "text/tsx",
    html: "text/html",
    css: "text/css",
    json: "application/json",
    xml: "application/xml",
  }

  return typeMap[extension] || "application/octet-stream"
}

/**
 * Navigate to a specific directory by path
 */
export const navigateToDirectory = async (
  rootHandle: FileSystemDirectoryHandle,
  path: string[],
): Promise<{ currentHandle: FileSystemDirectoryHandle; success: boolean }> => {
  if (!path.length) {
    return { currentHandle: rootHandle, success: true }
  }

  let currentHandle = rootHandle

  try {
    for (const segment of path) {
      if (segment === "") continue
      currentHandle = await currentHandle.getDirectoryHandle(segment)
    }
    return { currentHandle, success: true }
  } catch (error) {
    console.error("Error al navegar al directorio:", error)
    return { currentHandle, success: false }
  }
}

/**
 * Checks if a file is an audio file
 */
export const isAudioFile = (file: FileItem): boolean => {
  const audioTypes = [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
    "audio/mp4",
    "audio/aac",
    "audio/webm",
    "audio/x-m4a",
  ]

  return audioTypes.includes(file.type)
}

/**
 * Revokes object URLs to prevent memory leaks
 */
export const revokeFileUrls = (files: FileItem[]): void => {
  files.forEach((file) => {
    if (file.url) {
      URL.revokeObjectURL(file.url)
    }
  })
}

/**
 * Función para manejar directorios en Electron (usando rutas de archivo)
 * Esta función sería usada cuando la aplicación se ejecuta en Electron
 */
export const getDirectoryContentsElectron = async (directoryPath: string): Promise<FileItem[]> => {
  // Esta función sería implementada usando las APIs de Electron
  // y Node.js para leer directorios del sistema de archivos

  // Por ahora, devolvemos un array vacío como placeholder
  console.log("Esta función debe ser implementada para Electron usando Node.js fs")
  return []
}
