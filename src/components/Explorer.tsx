"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { FolderOpen, Settings } from "lucide-react"
import type { FileItem, DirectoryState } from "../types"
import {
  openDirectory,
  getDirectoryContents,
  navigateToDirectory,
  isAudioFile,
  revokeFileUrls,
} from "../utils/fileSystem"
import {
  saveTranscription,
  deleteTranscription,
  saveDirectoryHandle,
  getDirectoryHandle,
  getAllTranscriptions,
  saveDirectoryPathElectron,
  getLastDirectory,
  isFirstRun,
  isApiKeyConfigured,
  markFirstRunComplete,
} from "../utils/storage"
import Breadcrumb from "./FileExplorer/Breadcrumb"
import FileList from "./FileExplorer/FileList"
import AudioPlayer from "./AudioPlayer/AudioPlayer"
import TranscriptionModal from "./Modals/TranscriptionModal"
import ChatPanel from "./Chat/ChatPanel"
import Button from "./ui/Button"
import ModelSelector from "./ModelSelector"
import ApiKeySetupModal from "./Modals/ApiKeySetupModal"
import SettingsModal from "./Settings/SettingsModal"

// Función helper para diálogos de confirmación
const showConfirmDialog = async ({ title, message, detail }: { title: string; message: string; detail: string }) => {
  // Implementación simple para navegador
  return window.confirm(`${title}\n\n${message}\n${detail}`)
}

const Explorer: React.FC = () => {
  // Model states
  const [transcriptionModel, setTranscriptionModel] = useState<string>("")
  const [chatModel, setChatModel] = useState<string>("")

  // Directory and navigation states
  const [rootDirectoryHandle, setRootDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [directoryState, setDirectoryState] = useState<DirectoryState>({
    currentPath: [],
    history: [[]],
    historyIndex: 0,
  })

  // Audio and chat states
  const [currentAudioFile, setCurrentAudioFile] = useState<FileItem | null>(null)
  const [audioFiles, setAudioFiles] = useState<FileItem[]>([])
  const [transcribeFile, setTranscribeFile] = useState<FileItem | null>(null)
  const [isTranscriptionModalOpen, setIsTranscriptionModalOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Estado para almacenar transcripciones guardadas (cargadas desde localStorage)
  const [savedTranscriptions, setSavedTranscriptions] = useState<Map<string, string>>(new Map())
  const [transcribedFiles, setTranscribedFiles] = useState<{ file: FileItem; transcription: string }[]>([])

  // Estados para modales
  const [showApiKeySetup, setShowApiKeySetup] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Verificar si estamos en Electron
  const isElectron = () => {
    return window && window.process && window.process.type
  }

  // Función para cargar directorio desde Electron
  const loadDirectoryFromElectron = async (directoryPath: string) => {
    if (!window.electron) {
      console.error("window.electron no está disponible")
      return
    }

    try {
      console.log("🔄 Cargando directorio desde Electron:", directoryPath)

      // Add confirmation dialog before loading
      const confirmLoad = await showConfirmDialog({
        title: "Confirmar carga de directorio",
        message: `¿Confirmas cargar el directorio "${directoryPath}"?`,
        detail: "Esta acción cargará todos los archivos del directorio seleccionado.",
      })
      if (!confirmLoad) {
        console.log("⚠️ Carga del directorio cancelada por el usuario.")
        return
      }

      setIsLoading(true)

      const electronFiles = await window.electron.readDirectory(directoryPath)
      console.log("📁 Archivos obtenidos:", electronFiles.length)

      // Convertir los archivos de Electron al formato FileItem
      const fileItems: FileItem[] = electronFiles.map((file: any) => ({
        name: file.name,
        isDirectory: file.isDirectory,
        type: file.isDirectory ? "directory" : file.type,
        path: file.path,
        size: file.size,
        lastModified: file.lastModified,
        url: file.isDirectory ? undefined : `file://${file.path}`,
      }))

      setFiles(fileItems)
      // setCurrentDirectoryPath(directoryPath)

      // Guardar la ruta para persistencia
      saveDirectoryPathElectron(directoryPath)
      await window.electron.savePath(directoryPath)

      console.log("💾 Ruta guardada en localStorage:", directoryPath)
    } catch (error) {
      console.error("❌ Error cargando directorio desde Electron:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Cargar configuración al iniciar
  useEffect(() => {
    const loadSavedConfig = async () => {
      console.log("🚀 Iniciando carga de configuración...")

      // Verificar si es el primer inicio o si no hay API key configurada
      if (isFirstRun() || !isApiKeyConfigured()) {
        console.log("🔑 Primer inicio o API key no configurada, mostrando modal de configuración")
        setShowApiKeySetup(true)
        return
      }

      // Cargar transcripciones
      const transcriptions = getAllTranscriptions()
      setSavedTranscriptions(new Map(Object.entries(transcriptions)))
      console.log("📝 Transcripciones cargadas:", Object.keys(transcriptions).length)

      if (isElectron()) {
        console.log("🖥️ Ejecutándose en Electron")

        // En Electron, intentar cargar la ruta guardada
        const savedPath = await window.electron.getSavedPath()

        console.log("📂 Ruta guardada encontrada:", savedPath)

        if (savedPath && window.electron) {
          console.log("🔍 Verificando si el directorio existe:", savedPath)

          try {
            const exists = await window.electron.directoryExists(savedPath)
            console.log("✅ Directorio existe:", exists)

            if (exists) {
              // Confirmación antes de cargar el directorio guardado
              const confirmLoad = await showConfirmDialog({
                title: "Cargar directorio guardado",
                message: `¿Confirmas cargar el directorio guardado "${savedPath}"?`,
                detail: "Este directorio fue usado anteriormente en la aplicación.",
              })
              if (confirmLoad) {
                console.log("📁 Cargando directorio guardado...")
                await loadDirectoryFromElectron(savedPath)
              } else {
                console.log("⚠️ Carga del directorio guardado cancelada por el usuario.")
              }
            } else {
              console.log("⚠️ El directorio guardado ya no existe")
              const lastDir = getLastDirectory()
              if (lastDir.name) {
                console.log("📋 Último directorio conocido:", lastDir.name)
              }
            }
          } catch (error) {
            console.error("❌ Error verificando directorio:", error)
          }
        } else {
          console.log("📭 No hay ruta guardada o window.electron no disponible")
        }
      } else {
        console.log("🌐 Ejecutándose en navegador web")

        // En web, usar File System Access API
        try {
          const savedDirHandle = await getDirectoryHandle()
          if (savedDirHandle) {
            console.log("📁 Handle de directorio recuperado:", savedDirHandle.name)

            // Verificar que aún tenemos permiso para acceder al directorio
            const permissionStatus = await savedDirHandle.queryPermission({ mode: "read" })

            if (permissionStatus === "granted") {
              setRootDirectoryHandle(savedDirHandle)
              await loadDirectoryContents(savedDirHandle)
              console.log("✅ Contenido del directorio cargado")
            } else {
              // No solicitar permiso automáticamente, solo mostrar que hay un directorio guardado
              console.log("📋 Directorio guardado disponible, pero requiere permiso del usuario")
              console.log("💡 El usuario puede hacer clic en 'Abrir Carpeta' para restaurar el acceso")
            }
          }
        } catch (error) {
          console.error("❌ Error recuperando directorio guardado:", error)
          console.log("💡 Esto es normal si es la primera vez que usas la aplicación")
        }
      }
    }

    loadSavedConfig()

    // Verificar si estamos en Electron y configurar comunicación IPC
    if (isElectron()) {
      // Escuchar eventos de Electron si estamos en la app de escritorio
      if (window.electron) {
        console.log("🔗 Configurando listeners de Electron...")

        // Escuchar cuando se selecciona un directorio desde el menú de Electron
        window.electron.onSelectDirectory((path: string) => {
          console.log("📁 Directorio seleccionado desde menú de Electron:", path)
          loadDirectoryFromElectron(path)
        })

        // Escuchar actualizaciones disponibles
        window.electron.onUpdateAvailable((info: any) => {
          console.log("🔄 Actualización disponible:", info)
          // Mostrar notificación al usuario
        })
      }
    }
  }, [])

  // Clean up URLs when files change
  useEffect(() => {
    return () => {
      revokeFileUrls(files)
    }
  }, [files])

  // Filter audio files when files change
  useEffect(() => {
    if (files.length > 0) {
      const newAudioFiles = files.filter(isAudioFile)
      setAudioFiles(newAudioFiles)
    } else {
      setAudioFiles([])
    }
  }, [files])

  // Directory operations
  const handleOpenDirectory = async () => {
    // Si estamos en Electron, usar el diálogo nativo
    if (isElectron() && window.electron) {
      try {
        const result = await window.electron.selectDirectory()
        if (result.canceled) return

        console.log("Directorio seleccionado en Electron:", result.filePaths[0])

        // Add confirmation dialog
        const confirmLoad = await showConfirmDialog({
          title: "Cargar nuevo directorio",
          message: `¿Confirmas cargar el directorio "${result.filePaths[0]}"?`,
          detail: "Se cargarán todos los archivos del directorio seleccionado.",
        })
        if (!confirmLoad) {
          console.log("⚠️ Carga del directorio cancelada por el usuario.")
          return
        }

        // Cargar el directorio seleccionado
        await loadDirectoryFromElectron(result.filePaths[0])
        return
      } catch (error) {
        console.error("Error al abrir directorio en Electron:", error)
      }
    }

    // Versión web usando File System Access API
    try {
      // Primero verificar si hay un directorio guardado que podemos restaurar
      const savedDirHandle = await getDirectoryHandle()
      if (savedDirHandle) {
        const permissionStatus = await savedDirHandle.queryPermission({ mode: "read" })

        if (permissionStatus === "prompt") {
          // Intentar restaurar el directorio guardado primero
          const newPermission = await savedDirHandle.requestPermission({ mode: "read" })
          if (newPermission === "granted") {
            setRootDirectoryHandle(savedDirHandle)
            await loadDirectoryContents(savedDirHandle)
            console.log("✅ Directorio guardado restaurado con éxito")

            setDirectoryState({
              currentPath: [],
              history: [[]],
              historyIndex: 0,
            })
            return
          }
        }
      }

      // Si no hay directorio guardado o no se pudo restaurar, abrir uno nuevo
      const directoryHandle = await openDirectory()
      if (!directoryHandle) return

      setRootDirectoryHandle(directoryHandle)
      await loadDirectoryContents(directoryHandle)

      // Guardar el directorio para persistencia
      await saveDirectoryHandle(directoryHandle)
      console.log("Directorio guardado:", directoryHandle.name)

      setDirectoryState({
        currentPath: [],
        history: [[]],
        historyIndex: 0,
      })
    } catch (error) {
      console.error("Error al abrir directorio:", error)
    }
  }

  const loadDirectoryContents = async (directoryHandle: FileSystemDirectoryHandle) => {
    setIsLoading(true)
    try {
      const contents = await getDirectoryContents(directoryHandle)
      revokeFileUrls(files)
      setFiles(contents)
    } catch (error) {
      console.error("Error al cargar el contenido del directorio:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // File and navigation handlers
  const handleFileClick = async (file: FileItem) => {
    if (file.isDirectory) {
      if (!rootDirectoryHandle) return

      const newPath = [...directoryState.currentPath, file.name]
      const { currentHandle, success } = await navigateToDirectory(rootDirectoryHandle, newPath)

      if (success) {
        const newHistory = [...directoryState.history.slice(0, directoryState.historyIndex + 1), newPath]

        setDirectoryState({
          currentPath: newPath,
          history: newHistory,
          historyIndex: directoryState.historyIndex + 1,
        })

        await loadDirectoryContents(currentHandle)
      }
    } else if (isAudioFile(file)) {
      setCurrentAudioFile(file)
    }
  }

  const handleBreadcrumbClick = async (index: number) => {
    if (!rootDirectoryHandle) return

    const targetPath = index === -1 ? [] : directoryState.currentPath.slice(0, index + 1)
    const { currentHandle, success } = await navigateToDirectory(rootDirectoryHandle, targetPath)

    if (success) {
      const newHistory = [...directoryState.history.slice(0, directoryState.historyIndex + 1), targetPath]

      setDirectoryState({
        currentPath: targetPath,
        history: newHistory,
        historyIndex: directoryState.historyIndex + 1,
      })

      await loadDirectoryContents(currentHandle)
    }
  }

  const handleGoBack = async () => {
    if (!rootDirectoryHandle || directoryState.historyIndex <= 0) return

    const newIndex = directoryState.historyIndex - 1
    const targetPath = directoryState.history[newIndex]

    const { currentHandle, success } = await navigateToDirectory(rootDirectoryHandle, targetPath)

    if (success) {
      setDirectoryState((prev) => ({
        ...prev,
        currentPath: targetPath,
        historyIndex: newIndex,
      }))
      await loadDirectoryContents(currentHandle)
    }
  }

  // Transcription handlers
  const handleTranscribe = (file: FileItem) => {
    if (!transcriptionModel) {
      alert("Por favor, selecciona un modelo de transcripción primero.")
      return
    }
    setTranscribeFile(file)
    setIsTranscriptionModalOpen(true)
  }

  const handleTranscriptionComplete = (file: FileItem, transcription: string) => {
    // Guardar la transcripción en localStorage y en el estado
    saveTranscription(file.path, transcription)
    setSavedTranscriptions((prev) => new Map(prev.set(file.path, transcription)))
    console.log(`Transcripción guardada permanentemente para ${file.name}`)
  }

  // Función para eliminar transcripción permanentemente
  const handleDeleteTranscription = (file: FileItem) => {
    if (confirm(`¿Estás seguro de que quieres eliminar la transcripción de "${file.name}"?`)) {
      deleteTranscription(file.path)
      setSavedTranscriptions((prev) => {
        const newMap = new Map(prev)
        newMap.delete(file.path)
        return newMap
      })

      // También eliminar del chat si está presente
      setTranscribedFiles((prev) => prev.filter((item) => item.file.path !== file.path))

      console.log(`Transcripción eliminada permanentemente para ${file.name}`)
    }
  }

  // Función para agregar transcripción al chat
  const handleAddToChat = (file: FileItem) => {
    if (!chatModel) {
      alert("Por favor, selecciona un modelo de chat primero.")
      return
    }

    const transcription = savedTranscriptions.get(file.path)
    if (!transcription) {
      alert("No hay transcripción disponible para este archivo.")
      return
    }

    // Verificar si ya está en el chat
    const isAlreadyInChat = transcribedFiles.some((item) => item.file.path === file.path)
    if (isAlreadyInChat) {
      // Si ya está en el chat, lo quitamos (toggle)
      setTranscribedFiles((prev) => prev.filter((item) => item.file.path !== file.path))
      console.log(`Archivo ${file.name} eliminado del chat`)
      return
    }

    // Agregar al chat
    setTranscribedFiles((prev) => [...prev, { file, transcription }])
    setIsChatOpen(true)
    console.log(`Archivo ${file.name} agregado al chat`)
  }

  const handleChat = (file: FileItem) => {
    if (!chatModel) {
      alert("Por favor, selecciona un modelo de chat primero.")
      return
    }
    setIsChatOpen(true)
  }

  // Verificar si un archivo tiene transcripción guardada
  const hasTranscription = (file: FileItem): boolean => {
    return savedTranscriptions.has(file.path)
  }

  // Verificar si un archivo está en el chat
  const isInChat = (file: FileItem): boolean => {
    return transcribedFiles.some((item) => item.file.path === file.path)
  }

  // Función para eliminar transcripción del chat
  const handleRemoveFromChat = (filePath: string) => {
    setTranscribedFiles((prev) => prev.filter((item) => item.file.path !== filePath))
  }

  // Función para verificar actualizaciones (solo en Electron)
  const checkForUpdates = () => {
    if (isElectron() && window.electron) {
      window.electron.checkForUpdates()
      console.log("Verificando actualizaciones...")
    }
  }

  // Función para manejar la finalización de la configuración de API key
  const handleApiKeySetupComplete = () => {
    setShowApiKeySetup(false)
    markFirstRunComplete()

    // Recargar la configuración después de configurar la API key
    window.location.reload()
  }

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary">
      <div className="flex-1 overflow-y-auto scrollbar-thin scroll-smooth">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModelSelector type="transcription" value={transcriptionModel} onChange={setTranscriptionModel} />
            <ModelSelector type="chat" value={chatModel} onChange={setChatModel} />
          </div>

          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-text-primary">
              Explorador de Archivos
              {rootDirectoryHandle && (
                <span className="text-sm text-text-tertiary ml-2">({rootDirectoryHandle.name})</span>
              )}
            </h1>

            <div className="flex gap-3">
              <Button onClick={handleOpenDirectory} leftIcon={<FolderOpen size={18} />}>
                {rootDirectoryHandle ? "Cambiar Carpeta" : "Abrir Carpeta"}
              </Button>

              {/* Botón de configuración */}
              <Button onClick={() => setIsSettingsOpen(true)} variant="secondary" leftIcon={<Settings size={18} />}>
                Configuración
              </Button>

              {/* Botón de verificar actualizaciones (solo visible en Electron) */}
              {isElectron() && (
                <Button onClick={checkForUpdates} variant="secondary" size="sm">
                  Verificar actualizaciones
                </Button>
              )}
            </div>
          </div>

          {rootDirectoryHandle && (
            <Breadcrumb
              path={directoryState.currentPath}
              onNavigate={handleBreadcrumbClick}
              onGoBack={handleGoBack}
              canGoBack={directoryState.historyIndex > 0}
            />
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-text-secondary">Cargando archivos...</p>
            </div>
          ) : rootDirectoryHandle ? (
            <div className="bg-background-secondary rounded-lg shadow-sm overflow-hidden">
              <div className="p-4">
                <FileList
                  files={files}
                  onFileClick={handleFileClick}
                  onTranscribe={handleTranscribe}
                  onChat={handleChat}
                  onAddToChat={handleAddToChat}
                  onDeleteTranscription={handleDeleteTranscription}
                  currentPlayingFile={currentAudioFile}
                  hasTranscription={hasTranscription}
                  isInChat={isInChat}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-background-secondary rounded-lg border border-background-tertiary">
              <FolderOpen size={64} className="text-primary mb-4" />
              <h2 className="text-xl font-medium mb-2">Ninguna carpeta abierta</h2>
              <p className="text-text-secondary mb-6">Selecciona una carpeta para comenzar a explorar archivos</p>
            </div>
          )}
        </div>
      </div>

      {currentAudioFile && (
        <AudioPlayer audioFiles={audioFiles} currentFile={currentAudioFile} onSelectFile={setCurrentAudioFile} />
      )}

      <TranscriptionModal
        isOpen={isTranscriptionModalOpen}
        onClose={() => {
          setIsTranscriptionModalOpen(false)
          setTranscribeFile(null)
        }}
        file={transcribeFile}
        onTranscriptionComplete={handleTranscriptionComplete}
        selectedModel={transcriptionModel}
        existingTranscription={transcribeFile ? savedTranscriptions.get(transcribeFile.path) : undefined}
      />

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        transcribedFiles={transcribedFiles}
        selectedChatModel={chatModel}
        onRemoveTranscription={handleRemoveFromChat}
      />

      {/* Modal de configuración de API key */}
      <ApiKeySetupModal isOpen={showApiKeySetup} onComplete={handleApiKeySetupComplete} />

      {/* Modal de configuración */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default Explorer
