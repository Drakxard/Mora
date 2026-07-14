"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { FolderOpen, Maximize2, Settings } from "lucide-react"
import type { FileItem, DirectoryState } from "../types"
import {
  openDirectory,
  getDirectoryContents,
  getFileTypeFromExtension,
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
  getSelectedModel,
  saveDirectoryPathElectron,
  getLastDirectory,
  isFirstRun,
  isApiKeyConfigured,
  markFirstRunComplete,
} from "../utils/storage"
import Breadcrumb from "./FileExplorer/Breadcrumb"
import FileList from "./FileExplorer/FileList"
import AudioPlayer, { type AudioPlayerHandle } from "./AudioPlayer/AudioPlayer"
import TranscriptionModal from "./Modals/TranscriptionModal"
import ChatPanel from "./Chat/ChatPanel"
import Button from "./ui/Button"
import ApiKeySetupModal from "./Modals/ApiKeySetupModal"
import SettingsModal from "./Settings/SettingsModal"
import TtsModal from "./Modals/TtsModal"
import PresentationMode from "./PresentationMode"
import { fetchGroqRateLimits, generateTtsAudio } from "../utils/tts"

const TTS_METADATA_FILE = ".mora-tts.json"
const PRESENTATION_BACKGROUNDS_DIR = "fondos"
const PRESENTATION_BACKGROUND_EXTENSIONS = new Set(["jpg", "jpeg"])

const getRandomPresentationBackgroundIndex = (currentIndex: number, backgroundCount: number) => {
  if (backgroundCount <= 1) return 0

  const normalizedCurrentIndex = ((currentIndex % backgroundCount) + backgroundCount) % backgroundCount
  const randomOffset = Math.floor(Math.random() * (backgroundCount - 1)) + 1
  return (normalizedCurrentIndex + randomOffset) % backgroundCount
}

interface TtsMetadataEntry {
  text: string
  model: string
  updatedAt: number
}

type TtsMetadata = Record<string, TtsMetadataEntry>

// Función helper para diálogos de confirmación
const showConfirmDialog = async ({ title, message, detail }: { title: string; message: string; detail: string }) => {
  // Implementación simple para navegador
  return window.confirm(`${title}\n\n${message}\n${detail}`)
}

const Explorer: React.FC = () => {
  // Model states
  const [transcriptionModel, setTranscriptionModel] = useState<string>(
    () => getSelectedModel("transcription") || "whisper-large-v3",
  )
  const [chatModel, setChatModel] = useState<string>(
    () => getSelectedModel("chat") || "llama-3.3-70b-versatile",
  )
  const [ttsModel, setTtsModel] = useState<string>(
    () => getSelectedModel("tts") || "canopylabs/orpheus-arabic-saudi",
  )

  // Directory and navigation states
  const [rootDirectoryHandle, setRootDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [currentDirectoryHandle, setCurrentDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [currentElectronDirectoryPath, setCurrentElectronDirectoryPath] = useState<string>("")
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
  const [ttsMetadata, setTtsMetadata] = useState<TtsMetadata>({})
  const [presentationBackgroundUrls, setPresentationBackgroundUrls] = useState<string[]>([])
  const [presentationBackgroundIndex, setPresentationBackgroundIndex] = useState(0)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const ttsMetadataRef = useRef<TtsMetadata>({})
  const audioPlayerRef = useRef<AudioPlayerHandle>(null)
  const presentationAudioPathRef = useRef<string | null>(null)
  const [isPresentationOpen, setIsPresentationOpen] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [transcribeFile, setTranscribeFile] = useState<FileItem | null>(null)
  const [isTranscriptionModalOpen, setIsTranscriptionModalOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Estado para almacenar transcripciones guardadas (cargadas desde localStorage)
  const [savedTranscriptions, setSavedTranscriptions] = useState<Map<string, string>>(new Map())
  const [transcribedFiles, setTranscribedFiles] = useState<{ file: FileItem; transcription: string }[]>([])

  // Estados para modales
  const [showApiKeySetup, setShowApiKeySetup] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isTtsModalOpen, setIsTtsModalOpen] = useState(false)

  // Verificar si estamos en Electron
  const isElectron = () => {
    return !!window.electron
  }

  const isPresentationBackgroundFile = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase() || ""
    return PRESENTATION_BACKGROUND_EXTENSIONS.has(extension)
  }

  const isPresentationBackgroundsDirectory = (file: FileItem) => {
    return file.isDirectory && file.name.toLowerCase() === PRESENTATION_BACKGROUNDS_DIR
  }

  const filterVisibleFiles = (nextFiles: FileItem[]) => {
    return nextFiles.filter((file) => file.name !== TTS_METADATA_FILE && !isPresentationBackgroundsDirectory(file))
  }

  const replacePresentationBackgrounds = (urls: string[]) => {
    setPresentationBackgroundUrls((currentUrls) => {
      currentUrls.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url)
        }
      })
      return urls
    })
  }

  const loadPresentationBackgroundsFromDirectory = async (directoryHandle: FileSystemDirectoryHandle) => {
    try {
      const backgroundsHandle = await directoryHandle.getDirectoryHandle(PRESENTATION_BACKGROUNDS_DIR)
      const urls: string[] = []

      for await (const entry of backgroundsHandle.values()) {
        if (entry.kind !== "file" || !isPresentationBackgroundFile(entry.name)) continue

        const file = await (entry as FileSystemFileHandle).getFile()
        urls.push(URL.createObjectURL(file))
      }

      replacePresentationBackgrounds(urls)
    } catch {
      replacePresentationBackgrounds([])
    }
  }

  const loadPresentationBackgroundsFromElectron = async (directoryPath: string) => {
    if (!window.electron?.readDirectory) return

    const backgroundsPath = `${directoryPath.replace(/[\\/]+$/, "")}/${PRESENTATION_BACKGROUNDS_DIR}`

    try {
      const backgroundFiles = await window.electron.readDirectory(backgroundsPath)
      replacePresentationBackgrounds(
        backgroundFiles
          .filter((file: any) => !file.isDirectory && isPresentationBackgroundFile(file.name))
          .map((file: any) => `file://${file.path.replace(/\\/g, "/")}`),
      )
    } catch {
      replacePresentationBackgrounds([])
    }
  }

  useEffect(() => {
    ttsMetadataRef.current = ttsMetadata
  }, [ttsMetadata])

  useEffect(() => {
    if (!currentAudioFile) {
      setIsAudioPlaying(false)
    }
  }, [currentAudioFile])

  useEffect(() => {
    if (!isPresentationOpen) {
      presentationAudioPathRef.current = null
      setPresentationBackgroundIndex(0)
      return
    }

    const currentPath = currentAudioFile?.path || null
    if (presentationAudioPathRef.current === null) {
      presentationAudioPathRef.current = currentPath
      setPresentationBackgroundIndex(0)
      return
    }

    if (currentPath && currentPath !== presentationAudioPathRef.current) {
      presentationAudioPathRef.current = currentPath
      setPresentationBackgroundIndex((index) =>
        getRandomPresentationBackgroundIndex(index, presentationBackgroundUrls.length),
      )
    }
  }, [currentAudioFile?.path, isPresentationOpen, presentationBackgroundUrls.length])

  const getPresentationText = () => {
    if (!currentAudioFile) return "Selecciona un audio para iniciar la presentación."

    return (
      ttsMetadata[currentAudioFile.name]?.text ||
      savedTranscriptions.get(currentAudioFile.path) ||
      currentAudioFile.name
    )
  }

  const parseTtsMetadata = (contents: string | null): TtsMetadata => {
    if (!contents) return {}

    try {
      const parsed = JSON.parse(contents)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  }

  const loadTtsMetadataFromElectron = async (directoryPath: string) => {
    if (!window.electron?.readTtsMetadata) return {}

    const contents = await window.electron.readTtsMetadata(directoryPath, TTS_METADATA_FILE)
    const metadata = parseTtsMetadata(contents)
    setTtsMetadata(metadata)
    return metadata
  }

  const loadTtsMetadataFromDirectory = async (directoryHandle: FileSystemDirectoryHandle) => {
    try {
      const fileHandle = await directoryHandle.getFileHandle(TTS_METADATA_FILE)
      const metadataFile = await fileHandle.getFile()
      const metadata = parseTtsMetadata(await metadataFile.text())
      setTtsMetadata(metadata)
      return metadata
    } catch {
      setTtsMetadata({})
      return {}
    }
  }

  const saveTtsMetadata = async (nextMetadata: TtsMetadata) => {
    const contents = JSON.stringify(nextMetadata, null, 2)
    ttsMetadataRef.current = nextMetadata
    setTtsMetadata(nextMetadata)

    if (isElectron() && window.electron?.writeTtsMetadata) {
      if (!currentElectronDirectoryPath) return
      await window.electron.writeTtsMetadata(currentElectronDirectoryPath, TTS_METADATA_FILE, contents)
      return
    }

    if (!currentDirectoryHandle) return
    const permission = await currentDirectoryHandle.requestPermission({ mode: "readwrite" })
    if (permission !== "granted") return

    const fileHandle = await currentDirectoryHandle.getFileHandle(TTS_METADATA_FILE, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(contents)
    await writable.close()
  }

  // Función para cargar directorio desde Electron
  const loadDirectoryFromElectron = async (directoryPath: string, confirmBeforeLoad = true) => {
    if (!window.electron) {
      console.error("window.electron no está disponible")
      return
    }

    try {
      console.log("🔄 Cargando directorio desde Electron:", directoryPath)

      // Add confirmation dialog before loading
      const confirmLoad = confirmBeforeLoad ? await showConfirmDialog({
        title: "Confirmar carga de directorio",
        message: `¿Confirmas cargar el directorio "${directoryPath}"?`,
        detail: "Esta acción cargará todos los archivos del directorio seleccionado.",
      }) : true
      if (!confirmLoad) {
        console.log("⚠️ Carga del directorio cancelada por el usuario.")
        return
      }

      setIsLoading(true)

      const electronFiles = await window.electron.readDirectory(directoryPath)
      console.log("📁 Archivos obtenidos:", electronFiles.length)

      // Convertir los archivos de Electron al formato FileItem
      const fileItems: FileItem[] = electronFiles
        .filter(
          (file: any) =>
            file.name !== TTS_METADATA_FILE &&
            !(file.isDirectory && file.name.toLowerCase() === PRESENTATION_BACKGROUNDS_DIR),
        )
        .map((file: any) => ({
          id: file.path,
          name: file.name,
          isDirectory: file.isDirectory,
          type: file.isDirectory ? "directory" : getFileTypeFromExtension(file.name),
          path: file.path,
          size: file.size,
          lastModified: file.lastModified,
          url: file.isDirectory ? undefined : `file://${file.path}`,
        }))

      setFiles(filterVisibleFiles(fileItems))
      setCurrentElectronDirectoryPath(directoryPath)
      await loadTtsMetadataFromElectron(directoryPath)
      await loadPresentationBackgroundsFromElectron(directoryPath)
      // setCurrentDirectoryPath(directoryPath)

      // Guardar la ruta para persistencia
      saveDirectoryPathElectron(directoryPath)
      if (window.electron.savePath) {
        await window.electron.savePath(directoryPath)
      }

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
        const savedPath = await window.electron?.getSavedPath()

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
              await loadDirectoryContents(savedDirHandle, [])
              await loadPresentationBackgroundsFromDirectory(savedDirHandle)
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

  useEffect(() => {
    return () => {
      presentationBackgroundUrls.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [presentationBackgroundUrls])

  // Filter audio files when files change
  useEffect(() => {
    if (files.length > 0) {
      const newAudioFiles = files.filter(isAudioFile)
      setAudioFiles(newAudioFiles)
    } else {
      setAudioFiles([])
    }
  }, [files])

  // Efecto para monitorear el estado de la API key y resetear funcionalidades dependientes
  useEffect(() => {
    const checkApiKeyStatus = () => {
      const apiKeyConfigured = isApiKeyConfigured()

      // Si no hay API key configurada, resetear estados que dependen de ella
      if (!apiKeyConfigured) {
        // Cerrar modales que requieren API key
        if (isTranscriptionModalOpen) {
          setIsTranscriptionModalOpen(false)
          setTranscribeFile(null)
        }

        if (isChatOpen) {
          setIsChatOpen(false)
        }

        if (isTtsModalOpen) {
          setIsTtsModalOpen(false)
        }

        // Limpiar archivos transcritos del chat
        if (transcribedFiles.length > 0) {
          setTranscribedFiles([])
        }

        // Limpiar transcripciones guardadas del estado
        if (savedTranscriptions.size > 0) {
          setSavedTranscriptions(new Map())
        }

        // Resetear modelos seleccionados
        setTranscriptionModel("")
        setChatModel("")
        setTtsModel("")

        console.log("🔄 Estados dependientes de API key reseteados")
      }
    }

    // Verificar inmediatamente
    checkApiKeyStatus()

    // Configurar un intervalo para verificar periódicamente
    const interval = setInterval(checkApiKeyStatus, 1000)

    return () => clearInterval(interval)
  }, [isTranscriptionModalOpen, isChatOpen, isTtsModalOpen, transcribedFiles.length, savedTranscriptions.size])

  // Add this effect after the other useEffect hooks
  useEffect(() => {
    // Check if API key is configured on every render
    const apiKeyConfigured = isApiKeyConfigured()

    // If no API key is configured but we have transcribed files or chat open,
    // reset those states as they require an API key to function
    if (!apiKeyConfigured) {
      if (transcribedFiles.length > 0) {
        setTranscribedFiles([])
      }

      if (isChatOpen) {
        setIsChatOpen(false)
      }

      // If we're trying to transcribe without an API key, show the setup modal
      if (isTranscriptionModalOpen) {
        setIsTranscriptionModalOpen(false)
        setShowApiKeySetup(true)
      }
    }
  }, [transcribedFiles.length, isChatOpen, isTranscriptionModalOpen])

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
            await loadDirectoryContents(savedDirHandle, [])
            await loadPresentationBackgroundsFromDirectory(savedDirHandle)
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
      await loadDirectoryContents(directoryHandle, [])
      await loadPresentationBackgroundsFromDirectory(directoryHandle)

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

  const loadDirectoryContents = async (directoryHandle: FileSystemDirectoryHandle, path: string[] = directoryState.currentPath) => {
    setIsLoading(true)
    try {
      const contents = await getDirectoryContents(directoryHandle)
      revokeFileUrls(files)
      setFiles(filterVisibleFiles(contents))
      setCurrentDirectoryHandle(directoryHandle)
      await loadTtsMetadataFromDirectory(directoryHandle)
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

        await loadDirectoryContents(currentHandle, newPath)
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

      await loadDirectoryContents(currentHandle, targetPath)
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
      await loadDirectoryContents(currentHandle, targetPath)
    }
  }

  // Transcription handlers
  const handleTranscribe = (file: FileItem) => {
    // Verificar que la API key esté configurada
    if (!isApiKeyConfigured()) {
      alert("No hay API key configurada. Por favor, configura tu API key en Configuración.")
      setShowApiKeySetup(true)
      return
    }

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
    // Verificar que la API key esté configurada
    if (!isApiKeyConfigured()) {
      alert("No hay API key configurada. Por favor, configura tu API key en Configuración.")
      setShowApiKeySetup(true)
      return
    }

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
    // Verificar que la API key esté configurada
    if (!isApiKeyConfigured()) {
      alert("No hay API key configurada. Por favor, configura tu API key en Configuración.")
      setShowApiKeySetup(true)
      return
    }

    if (!chatModel) {
      alert("Por favor, selecciona un modelo de chat primero.")
      return
    }

    // Verificar si el archivo tiene transcripción
    const transcription = savedTranscriptions.get(file.path)

    // Si tiene transcripción y no está ya en el chat, agregarla automáticamente
    if (transcription && !transcribedFiles.some((item) => item.file.path === file.path)) {
      setTranscribedFiles((prev) => [...prev, { file, transcription }])
      console.log(`Archivo ${file.name} agregado automáticamente al chat`)
    }

    // Abrir el chat en cualquier caso
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

  const hasOpenDirectory = !!currentDirectoryHandle || !!currentElectronDirectoryPath

  const createTtsBaseFileName = () => {
    const now = new Date()
    const pad = (value: number) => value.toString().padStart(2, "0")
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    return `tts-${date}-${time}`
  }

  const normalizeTtsFileName = (fileName: string) => {
    const baseName = fileName
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .replace(/\.wav$/i, "")

    return `${baseName || createTtsBaseFileName()}.wav`
  }

  const normalizeAudioRename = (currentName: string, nextName: string) => {
    const sanitizedName = nextName
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")

    if (!sanitizedName) {
      throw new Error("El nombre no puede estar vacio.")
    }

    const currentExtension = currentName.includes(".") ? currentName.slice(currentName.lastIndexOf(".")) : ""
    const hasNewExtension = /\.[^./\\]+$/.test(sanitizedName)

    return hasNewExtension || !currentExtension ? sanitizedName : `${sanitizedName}${currentExtension}`
  }

  const normalizeDirectoryName = (nextName: string) => {
    const sanitizedName = nextName
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")

    if (!sanitizedName) {
      throw new Error("El nombre no puede estar vacio.")
    }

    if (sanitizedName.toLowerCase() === PRESENTATION_BACKGROUNDS_DIR) {
      throw new Error("El nombre fondos esta reservado para los fondos de presentacion.")
    }

    return sanitizedName
  }

  const normalizeFileRename = (file: FileItem, nextName: string) => {
    if (file.isDirectory) return normalizeDirectoryName(nextName)
    return normalizeAudioRename(file.name, nextName)
  }

  const buildRenamedFile = (file: FileItem, newPath: string, newName: string): FileItem => ({
    ...file,
    id: newPath,
    name: newName,
    path: newPath,
    url: file.isDirectory ? undefined : isElectron() ? `file://${newPath}` : file.url,
  })

  const applyRenamedFileLocally = (oldPath: string, renamedFile: FileItem) => {
    setFiles((currentFiles) => filterVisibleFiles(currentFiles.map((item) => (item.path === oldPath ? renamedFile : item))))
    setCurrentAudioFile((currentFile) => (currentFile?.path === oldPath ? renamedFile : currentFile))
  }

  const createFolderInCurrentDirectory = async (nextName: string): Promise<FileItem> => {
    const normalizedName = normalizeDirectoryName(nextName)

    if (files.some((item) => item.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new Error("Ya existe un archivo o carpeta con ese nombre.")
    }

    if (isElectron() && window.electron?.createDirectory) {
      if (!currentElectronDirectoryPath) {
        throw new Error("No hay una carpeta abierta.")
      }

      const createdPath = await window.electron.createDirectory(currentElectronDirectoryPath, normalizedName)
      const createdFolder: FileItem = {
        id: createdPath,
        name: normalizedName,
        isDirectory: true,
        type: "directory",
        path: createdPath,
      }

      setIsCreatingFolder(false)
      setFiles((currentFiles) => filterVisibleFiles([...currentFiles, createdFolder]))
      return createdFolder
    }

    if (!currentDirectoryHandle) {
      throw new Error("No hay una carpeta abierta.")
    }

    const permission = await currentDirectoryHandle.requestPermission({ mode: "readwrite" })
    if (permission !== "granted") {
      throw new Error("No hay permiso de escritura para la carpeta actual.")
    }

    await currentDirectoryHandle.getDirectoryHandle(normalizedName, { create: true })

    const createdFolder: FileItem = {
      id: normalizedName,
      name: normalizedName,
      isDirectory: true,
      type: "directory",
      path: normalizedName,
    }

    setIsCreatingFolder(false)
    setFiles((currentFiles) => filterVisibleFiles([...currentFiles, createdFolder]))
    return createdFolder
  }

  const handleRenameFile = async (file: FileItem, nextName: string): Promise<FileItem | null> => {
    if (file.path === "__new-folder__") {
      return createFolderInCurrentDirectory(nextName)
    }

    if (isPresentationBackgroundsDirectory(file)) {
      throw new Error("La carpeta fondos esta reservada para la presentacion.")
    }

    const normalizedName = normalizeFileRename(file, nextName)

    if (normalizedName === file.name) {
      return file
    }

    if (files.some((item) => item.path !== file.path && item.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new Error("Ya existe un archivo o carpeta con ese nombre.")
    }

    if (isElectron() && window.electron?.renameFile) {
      if (!currentElectronDirectoryPath) {
        throw new Error("No hay una carpeta abierta.")
      }

      const renamedPath = await window.electron.renameFile(currentElectronDirectoryPath, file.path, normalizedName)
      const renamedFile = buildRenamedFile(file, renamedPath, normalizedName)

      if (!file.isDirectory && ttsMetadata[file.name]) {
        const nextMetadata = { ...ttsMetadata, [normalizedName]: ttsMetadata[file.name] }
        delete nextMetadata[file.name]
        await saveTtsMetadata(nextMetadata)
      }

      applyRenamedFileLocally(file.path, renamedFile)
      return renamedFile
    }

    if (!currentDirectoryHandle) {
      throw new Error("No hay una carpeta abierta.")
    }

    if (file.isDirectory) {
      throw new Error("Renombrar carpetas en navegador no esta soportado. Usa la version de escritorio.")
    }

    const permission = await currentDirectoryHandle.requestPermission({ mode: "readwrite" })
    if (permission !== "granted") {
      throw new Error("No hay permiso de escritura para la carpeta actual.")
    }

    const oldHandle = await currentDirectoryHandle.getFileHandle(file.name)

    if (oldHandle.move) {
      await oldHandle.move(normalizedName)
    } else {
      const oldFile = await oldHandle.getFile()
      const newHandle = await currentDirectoryHandle.getFileHandle(normalizedName, { create: true })
      const writable = await newHandle.createWritable()
      await writable.write(oldFile)
      await writable.close()
      await currentDirectoryHandle.removeEntry(file.name)
    }

    const renamedHandle = await currentDirectoryHandle.getFileHandle(normalizedName)
    const renamedBrowserFile = await renamedHandle.getFile()
    const renamedFile = {
      ...buildRenamedFile(file, normalizedName, normalizedName),
      type: renamedBrowserFile.type || getFileTypeFromExtension(normalizedName),
      size: renamedBrowserFile.size,
      lastModified: renamedBrowserFile.lastModified,
      url: URL.createObjectURL(renamedBrowserFile),
    }

    if (!file.isDirectory && ttsMetadata[file.name]) {
      const nextMetadata = { ...ttsMetadata, [normalizedName]: ttsMetadata[file.name] }
      delete nextMetadata[file.name]
      await saveTtsMetadata(nextMetadata)
    }

    applyRenamedFileLocally(file.path, renamedFile)
    return renamedFile
  }

  const handleRetryTtsAudio = async (file: FileItem) => {
    const metadata = ttsMetadata[file.name]
    if (!metadata) {
      alert("No hay texto TTS guardado para este audio.")
      return
    }

    try {
      const result = await generateTtsAudio(metadata.text, metadata.model || ttsModel)
      const regeneratedFile = await saveTtsAudioToCurrentFolder(result.audio, file.name)
      await saveTtsMetadata({
        ...ttsMetadata,
        [file.name]: {
          ...metadata,
          model: metadata.model || ttsModel,
          updatedAt: Date.now(),
        },
      })
      setCurrentAudioFile(regeneratedFile)
    } catch (error: any) {
      alert(error.message || "No se pudo reintentar el TTS.")
    }
  }

  const handleDeleteAudioFile = async (file: FileItem) => {
    if (!confirm(`¿Eliminar "${file.name}"?`)) return

    try {
      if (isElectron() && window.electron?.deleteFile) {
        if (!currentElectronDirectoryPath) {
          throw new Error("No hay una carpeta abierta.")
        }

        await window.electron.deleteFile(currentElectronDirectoryPath, file.path)
        if (currentAudioFile?.path === file.path) {
          setCurrentAudioFile(null)
        }

        if (ttsMetadata[file.name]) {
          const nextMetadata = { ...ttsMetadata }
          delete nextMetadata[file.name]
          await saveTtsMetadata(nextMetadata)
        }

        await loadDirectoryFromElectron(currentElectronDirectoryPath, false)
        return
      }

      if (!currentDirectoryHandle) {
        throw new Error("No hay una carpeta abierta.")
      }

      const permission = await currentDirectoryHandle.requestPermission({ mode: "readwrite" })
      if (permission !== "granted") {
        throw new Error("No hay permiso de escritura para la carpeta actual.")
      }

      await currentDirectoryHandle.removeEntry(file.name)
      if (currentAudioFile?.path === file.path) {
        setCurrentAudioFile(null)
      }

      if (ttsMetadata[file.name]) {
        const nextMetadata = { ...ttsMetadata }
        delete nextMetadata[file.name]
        await saveTtsMetadata(nextMetadata)
      }

      await loadDirectoryContents(currentDirectoryHandle)
    } catch (error: any) {
      alert(error.message || "No se pudo eliminar el audio.")
    }
  }

  const handleDeleteFile = async (file: FileItem) => {
    if (isPresentationBackgroundsDirectory(file)) {
      alert("La carpeta fondos esta reservada para la presentacion.")
      return
    }

    if (!confirm(`Eliminar "${file.name}"?`)) return

    try {
      if (isElectron()) {
        if (!currentElectronDirectoryPath) {
          throw new Error("No hay una carpeta abierta.")
        }

        if (file.isDirectory) {
          if (!window.electron?.deleteDirectory) {
            throw new Error("Eliminar carpetas no esta disponible.")
          }

          await window.electron.deleteDirectory(currentElectronDirectoryPath, file.path)
        } else {
          if (!window.electron?.deleteFile) {
            throw new Error("Eliminar archivos no esta disponible.")
          }

          await window.electron.deleteFile(currentElectronDirectoryPath, file.path)
        }

        if (currentAudioFile?.path === file.path) {
          setCurrentAudioFile(null)
        }

        if (!file.isDirectory && ttsMetadata[file.name]) {
          const nextMetadata = { ...ttsMetadata }
          delete nextMetadata[file.name]
          await saveTtsMetadata(nextMetadata)
        }

        await loadDirectoryFromElectron(currentElectronDirectoryPath, false)
        return
      }

      if (!currentDirectoryHandle) {
        throw new Error("No hay una carpeta abierta.")
      }

      const permission = await currentDirectoryHandle.requestPermission({ mode: "readwrite" })
      if (permission !== "granted") {
        throw new Error("No hay permiso de escritura para la carpeta actual.")
      }

      await currentDirectoryHandle.removeEntry(file.name, file.isDirectory ? { recursive: true } : undefined)
      if (currentAudioFile?.path === file.path) {
        setCurrentAudioFile(null)
      }

      if (!file.isDirectory && ttsMetadata[file.name]) {
        const nextMetadata = { ...ttsMetadata }
        delete nextMetadata[file.name]
        await saveTtsMetadata(nextMetadata)
      }

      await loadDirectoryContents(currentDirectoryHandle)
    } catch (error: any) {
      alert(error.message || "No se pudo eliminar.")
    }
  }

  const saveTtsAudioToCurrentFolder = async (audio: ArrayBuffer, fileName: string): Promise<FileItem> => {
    if (isElectron() && window.electron?.saveGeneratedAudio) {
      if (!currentElectronDirectoryPath) {
        throw new Error("Abre una carpeta antes de generar audio.")
      }

      const savedPath = await window.electron.saveGeneratedAudio(currentElectronDirectoryPath, fileName, audio)
      await loadDirectoryFromElectron(currentElectronDirectoryPath, false)
      return {
        id: savedPath,
        name: fileName,
        isDirectory: false,
        type: "audio/wav",
        path: savedPath,
        url: `file://${savedPath}`,
        size: audio.byteLength,
        lastModified: Date.now(),
      }
    }

    if (!currentDirectoryHandle) {
      throw new Error("Abre una carpeta antes de generar audio.")
    }

    const permission = await currentDirectoryHandle.requestPermission({ mode: "readwrite" })
    if (permission !== "granted") {
      throw new Error("No hay permiso de escritura para la carpeta actual.")
    }

    const fileHandle = await currentDirectoryHandle.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(new Blob([audio], { type: "audio/wav" }))
    await writable.close()
    await loadDirectoryContents(currentDirectoryHandle)

    const generatedFile = await fileHandle.getFile()
    return {
      id: fileName,
      name: fileName,
      isDirectory: false,
      type: generatedFile.type || "audio/wav",
      path: fileName,
      url: URL.createObjectURL(generatedFile),
      size: generatedFile.size,
      lastModified: generatedFile.lastModified,
    }
  }

  const handleGenerateTtsPreview = async (text: string) => {
    if (!isApiKeyConfigured()) {
      setShowApiKeySetup(true)
      throw new Error("No hay API key configurada. Configura tu API key en Configuración.")
    }

    if (!ttsModel) {
      throw new Error("Selecciona un modelo TTS primero.")
    }

    if (!hasOpenDirectory) {
      throw new Error("Abre una carpeta antes de generar audio.")
    }

    const result = await generateTtsAudio(text, ttsModel)
    return {
      audio: result.audio,
      fileName: createTtsBaseFileName(),
      rateLimit: result.rateLimit,
    }
  }

  const handleFetchTtsRateLimits = async () => {
    if (!isApiKeyConfigured()) {
      throw new Error("No hay API key configurada. Configura tu API key en ConfiguraciÃ³n.")
    }

    return fetchGroqRateLimits()
  }

  const handleConfirmTts = async (audio: ArrayBuffer, fileName: string, text: string) => {
    const normalizedFileName = normalizeTtsFileName(fileName)
    await saveTtsAudioToCurrentFolder(audio, normalizedFileName)
    await saveTtsMetadata({
      ...ttsMetadataRef.current,
      [normalizedFileName]: {
        text,
        model: ttsModel,
        updatedAt: Date.now(),
      },
    })

    return normalizedFileName
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "*" && event.key !== "+" && event.key !== "Backspace") return

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      const isEditableTarget =
        tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable
      const hasBlockingModal =
        isTtsModalOpen || isSettingsOpen || isChatOpen || isTranscriptionModalOpen || isPresentationOpen

      if (isEditableTarget || hasBlockingModal) return

      if (event.key === "Backspace") {
        if (isElectron() && currentElectronDirectoryPath) {
          const normalizedPath = currentElectronDirectoryPath.replace(/[\\/]+$/, "")
          const parentPath = normalizedPath.replace(/[\\/][^\\/]+$/, "").replace(/^([A-Za-z]:)$/, "$1\\")

          if (parentPath && parentPath !== normalizedPath) {
            event.preventDefault()
            loadDirectoryFromElectron(parentPath, false)
          }
          return
        }

        if (directoryState.historyIndex > 0) {
          event.preventDefault()
          handleGoBack()
        }
        return
      }

      event.preventDefault()

      if (event.key === "+") {
        if (hasOpenDirectory) {
          setIsCreatingFolder(true)
        }
        return
      }

      setIsTtsModalOpen(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    currentElectronDirectoryPath,
    directoryState.historyIndex,
    hasOpenDirectory,
    isChatOpen,
    isPresentationOpen,
    isSettingsOpen,
    isTranscriptionModalOpen,
    isTtsModalOpen,
  ])

  return (
    <div className="relative flex h-screen flex-col bg-background text-text-primary">
      <div className="absolute right-4 top-4 z-20 flex gap-3">
        <button
          type="button"
          onClick={handleOpenDirectory}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={hasOpenDirectory ? "Cambiar carpeta" : "Abrir carpeta"}
          title={hasOpenDirectory ? "Cambiar carpeta" : "Abrir carpeta"}
        >
          <FolderOpen size={18} />
        </button>

        <Button
          onClick={() => setIsSettingsOpen(true)}
          variant="secondary"
          leftIcon={<Settings size={18} />}
          className="h-9 w-9 px-0 [&>span]:mr-0"
          title="Configuración"
          aria-label="Configuración"
        >
        </Button>

        {isElectron() && (
          <Button onClick={checkForUpdates} variant="secondary" size="sm">
            Verificar actualizaciones
          </Button>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto scrollbar-thin scroll-smooth"
        style={{ paddingBottom: currentAudioFile ? "94px" : "0" }}
      >
        <div className="max-w-6xl mx-auto px-4 pb-6 pt-3 space-y-3">
          {hasOpenDirectory && (
            <Breadcrumb
              path={directoryState.currentPath}
              rootLabel={rootDirectoryHandle?.name || currentElectronDirectoryPath.split(/[/\\]/).pop()}
              onNavigate={handleBreadcrumbClick}
              onGoBack={handleGoBack}
              canGoBack={directoryState.historyIndex > 0}
              rightAction={
                <button
                  type="button"
                  onClick={() => setIsPresentationOpen(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary"
                  aria-label="Modo presentación"
                  title="Modo presentación"
                >
                  <Maximize2 size={18} />
                </button>
              }
            />
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-text-secondary">Cargando archivos...</p>
            </div>
          ) : hasOpenDirectory ? (
            <div className="bg-background-secondary rounded-lg shadow-sm overflow-hidden">
              <div className="p-4">
                <FileList
                  files={files}
                  onFileClick={handleFileClick}
                  onTranscribe={handleTranscribe}
                  onChat={handleChat}
                  onAddToChat={handleAddToChat}
                  onDeleteTranscription={handleDeleteTranscription}
                  onRetryTts={handleRetryTtsAudio}
                  onRenameFile={handleRenameFile}
                  onDeleteFile={(file) => (file.isDirectory ? handleDeleteFile(file) : handleDeleteAudioFile(file))}
                  onCancelCreateFolder={() => setIsCreatingFolder(false)}
                  isCreatingFolder={isCreatingFolder}
                  currentPlayingFile={currentAudioFile}
                  hasTranscription={hasTranscription}
                  hasTtsMetadata={(file) => !!ttsMetadata[file.name]}
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
        <AudioPlayer
          ref={audioPlayerRef}
          audioFiles={audioFiles}
          currentFile={currentAudioFile}
          onSelectFile={setCurrentAudioFile}
          onRenameFile={handleRenameFile}
          onPlaybackStateChange={setIsAudioPlaying}
          disableKeyboardShortcuts={isPresentationOpen}
        />
      )}

      <PresentationMode
        isOpen={isPresentationOpen}
        title={currentAudioFile?.name || rootDirectoryHandle?.name || currentElectronDirectoryPath.split(/[/\\]/).pop() || ""}
        text={getPresentationText()}
        isPlaying={isAudioPlaying}
        canControlPlayback={!!currentAudioFile}
        backgroundImages={presentationBackgroundUrls}
        backgroundIndex={presentationBackgroundIndex}
        onTogglePlayPause={() => audioPlayerRef.current?.togglePlayPause()}
        onPreviousAudio={() => audioPlayerRef.current?.playPrevious({ autoPlay: false })}
        onNextAudio={() => audioPlayerRef.current?.playNext({ autoPlay: false })}
        onClose={() => setIsPresentationOpen(false)}
      />

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

      <TtsModal
        isOpen={isTtsModalOpen}
        onClose={() => setIsTtsModalOpen(false)}
        selectedModel={ttsModel}
        canSaveToCurrentFolder={hasOpenDirectory}
        onFetchRateLimits={handleFetchTtsRateLimits}
        onGenerate={handleGenerateTtsPreview}
        onConfirm={handleConfirmTts}
      />

      {/* Modal de configuración */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        transcriptionModel={transcriptionModel}
        chatModel={chatModel}
        ttsModel={ttsModel}
        onTranscriptionModelChange={setTranscriptionModel}
        onChatModelChange={setChatModel}
        onTtsModelChange={setTtsModel}
      />
    </div>
  )
}

export default Explorer
