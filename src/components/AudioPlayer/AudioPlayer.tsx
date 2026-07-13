"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Clock } from "lucide-react"
import type { FileItem } from "../../types"
import AudioControls from "./AudioControls"
import FileIcon from "../FileExplorer/FileIcon"

interface AudioPlayerProps {
  audioFiles: FileItem[]
  currentFile: FileItem | null
  onSelectFile: (file: FileItem) => void
  onRenameFile: (file: FileItem, newName: string) => Promise<FileItem | null>
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioFiles, currentFile, onSelectFile, onRenameFile }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playerHeight, setPlayerHeight] = useState(124) // altura por defecto
  const [isResizing, setIsResizing] = useState(false)
  const [delaySeconds, setDelaySeconds] = useState(2)
  const [editableName, setEditableName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)
  const [renameError, setRenameError] = useState("")
  const audioRef = useRef<HTMLAudioElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const nextAudioTimerRef = useRef<number | null>(null)

  const minHeight = 96
  const maxHeight = 144

  const clearNextAudioTimer = () => {
    if (nextAudioTimerRef.current) {
      window.clearTimeout(nextAudioTimerRef.current)
      nextAudioTimerRef.current = null
    }
  }

  // Función para ordenar archivos numéricamente
  const sortAudioFilesNumerically = (files: FileItem[]): FileItem[] => {
    return [...files].sort((a, b) => {
      // Extraer números del nombre del archivo
      const getNumber = (fileName: string) => {
        const match = fileName.match(/(\d+)/)
        return match ? Number.parseInt(match[1], 10) : 0
      }

      const numA = getNumber(a.name)
      const numB = getNumber(b.name)

      // Si ambos tienen números, ordenar por número
      if (numA !== 0 && numB !== 0) {
        return numA - numB
      }

      // Si solo uno tiene número, el que tiene número va primero
      if (numA !== 0 && numB === 0) return -1
      if (numA === 0 && numB !== 0) return 1

      // Si ninguno tiene número, ordenar alfabéticamente
      return a.name.localeCompare(b.name)
    })
  }

  // Ordenar archivos de audio numéricamente
  const sortedAudioFiles = sortAudioFilesNumerically(audioFiles)

  // Handle resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newHeight = Math.max(minHeight, Math.min(maxHeight, window.innerHeight - e.clientY))
      setPlayerHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  useEffect(() => {
    setEditableName(currentFile?.name || "")
    setRenameError("")
  }, [currentFile])

  useEffect(() => {
    return clearNextAudioTimer
  }, [])

  // Keyboard navigation for 5-second skips and play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.contentEditable === "true" ||
        activeElement?.getAttribute("role") === "textbox"

      if (isInputFocused) {
        return
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault()
        e.stopPropagation()
      }

      switch (e.key) {
        case "ArrowLeft":
          skipBackward()
          break
        case "ArrowRight":
          skipForward()
          break
        case " ":
        case "Spacebar":
          togglePlayPause()
          break
      }
    }

    if (currentFile) {
      document.addEventListener("keydown", handleKeyDown, { capture: true })
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [currentFile, isPlaying, currentTime, duration])

  // Update audio player state when audio loads or time updates
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      scheduleNext()
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
    }
  }, [currentFile])

  // Reset state when changing files
  useEffect(() => {
    clearNextAudioTimer()
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
  }, [currentFile])

  // Auto-play when a file is selected
  useEffect(() => {
    if (currentFile && audioRef.current) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Error playing audio:", err))
    }
  }, [currentFile])

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch((err) => console.error("Error playing audio:", err))
    }
  }

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration))
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const skipForward = () => {
    if (audioRef.current && duration > 0) {
      const newTime = Math.min(currentTime + 5, duration)
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const skipBackward = () => {
    if (audioRef.current) {
      const newTime = Math.max(currentTime - 5, 0)
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const playNext = () => {
    if (!currentFile || sortedAudioFiles.length <= 1) return

    clearNextAudioTimer()
    const currentIndex = sortedAudioFiles.findIndex((file) => file.path === currentFile.path)
    const nextIndex = (currentIndex + 1) % sortedAudioFiles.length
    onSelectFile(sortedAudioFiles[nextIndex])
  }

  const playPrevious = () => {
    if (!currentFile || sortedAudioFiles.length <= 1) return

    clearNextAudioTimer()
    const currentIndex = sortedAudioFiles.findIndex((file) => file.path === currentFile.path)
    const prevIndex = (currentIndex - 1 + sortedAudioFiles.length) % sortedAudioFiles.length
    onSelectFile(sortedAudioFiles[prevIndex])
  }

  const scheduleNext = () => {
    if (!currentFile || sortedAudioFiles.length <= 1) return

    clearNextAudioTimer()
    const currentIndex = sortedAudioFiles.findIndex((file) => file.path === currentFile.path)
    const nextIndex = (currentIndex + 1) % sortedAudioFiles.length

    nextAudioTimerRef.current = window.setTimeout(() => {
      onSelectFile(sortedAudioFiles[nextIndex])
      nextAudioTimerRef.current = null
    }, delaySeconds * 1000)
  }

  const saveEditableName = async () => {
    if (!currentFile || isSavingName) return

    const nextName = editableName.trim()
    if (!nextName || nextName === currentFile.name) {
      setEditableName(currentFile.name)
      setRenameError("")
      return
    }

    setIsSavingName(true)
    setRenameError("")

    try {
      const renamedFile = await onRenameFile(currentFile, nextName)
      setEditableName(renamedFile?.name || nextName)
    } catch (error: any) {
      setEditableName(currentFile.name)
      setRenameError(error.message || "No se pudo renombrar.")
    } finally {
      setIsSavingName(false)
    }
  }

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.blur()
      saveEditableName()
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setEditableName(currentFile?.name || "")
      setRenameError("")
      event.currentTarget.blur()
    }
  }

  if (!currentFile) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-background-secondary via-background-secondary to-background-secondary border-t border-background-tertiary shadow-2xl backdrop-blur-sm"
      style={{ height: `${playerHeight}px` }}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="absolute top-0 right-4 w-8 h-3 cursor-ns-resize opacity-20 hover:opacity-40 transition-opacity"
        onMouseDown={() => setIsResizing(true)}
      >
        <div className="w-full h-0.5 bg-text-tertiary rounded-full mt-1"></div>
        <div className="w-full h-0.5 bg-text-tertiary rounded-full mt-0.5"></div>
      </div>

      <div className="flex items-center justify-center h-full px-4">
        <div className="flex items-center w-full max-w-6xl gap-6">
          {/* File info */}
          <div className="flex w-64 flex-shrink-0 items-center min-w-0">
            <div className="mr-3 p-2 bg-primary/10 rounded-lg">
              <FileIcon file={currentFile} size={20} />
            </div>
            <div className="min-w-0">
              <input
                value={editableName}
                onChange={(event) => {
                  setEditableName(event.target.value)
                  setRenameError("")
                }}
                onKeyDown={handleNameKeyDown}
                onBlur={() => setEditableName((value) => value.trim() || currentFile.name)}
                disabled={isSavingName}
                className="w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-text-primary outline-none transition-colors hover:border-background-tertiary hover:bg-background-tertiary/60 focus:border-primary/50 focus:bg-background-tertiary"
                title="Editar nombre y presionar Enter para guardar"
              />
              <p className="text-text-tertiary text-xs">
                {renameError || `${sortedAudioFiles.findIndex((f) => f.path === currentFile.path) + 1} de ${sortedAudioFiles.length}`}
              </p>
            </div>
          </div>

          {/* Audio controls - centered */}
          <div className="flex-1 max-w-2xl">
            <AudioControls
              audioRef={audioRef}
              isPlaying={isPlaying}
              onPlayPause={togglePlayPause}
              onPrevious={playPrevious}
              onNext={playNext}
              onSkipForward={skipForward}
              onSkipBackward={skipBackward}
              duration={duration}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          </div>

          <div className="flex w-40 flex-shrink-0 items-center gap-2 text-text-secondary">
            <Clock size={16} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>Retraso</span>
                <span className="font-mono">{delaySeconds}s</span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                step="1"
                value={delaySeconds}
                onChange={(event) => setDelaySeconds(Number(event.target.value))}
                className="w-full accent-primary"
                title="Segundos entre audios"
              />
            </div>
          </div>
        </div>

        <audio ref={audioRef} src={currentFile.url} preload="metadata" className="hidden" />
      </div>
    </div>
  )
}

export default AudioPlayer
