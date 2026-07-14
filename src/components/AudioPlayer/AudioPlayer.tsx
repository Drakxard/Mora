"use client"

import type React from "react"
import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from "react"
import { Clock, FastForward, SkipForward } from "lucide-react"
import type { FileItem } from "../../types"
import AudioControls from "./AudioControls"
import FileIcon from "../FileExplorer/FileIcon"

interface AudioPlayerProps {
  audioFiles: FileItem[]
  currentFile: FileItem | null
  onSelectFile: (file: FileItem) => void
  onRenameFile: (file: FileItem, newName: string) => Promise<FileItem | null>
  onPlaybackStateChange?: (isPlaying: boolean) => void
  disableKeyboardShortcuts?: boolean
}

interface AudioNavigationOptions {
  autoPlay?: boolean
}

export interface AudioPlayerHandle {
  togglePlayPause: () => void
  playNext: (options?: AudioNavigationOptions) => void
  playPrevious: (options?: AudioNavigationOptions) => void
}

const splitFileNameExtension = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf(".")
  if (lastDotIndex <= 0) {
    return { baseName: fileName, extension: "" }
  }

  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  }
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ audioFiles, currentFile, onSelectFile, onRenameFile, onPlaybackStateChange, disableKeyboardShortcuts = false }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playerHeight, setPlayerHeight] = useState(78)
  const [isResizing, setIsResizing] = useState(false)
  const [delayEnabled, setDelayEnabled] = useState(false)
  const [delaySeconds, setDelaySeconds] = useState(2)
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false)
  const [hasEnded, setHasEnded] = useState(false)
  const [editableName, setEditableName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)
  const [renameError, setRenameError] = useState("")
  const audioRef = useRef<HTMLAudioElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const nextAudioTimerRef = useRef<number | null>(null)
  const delayEnabledRef = useRef(delayEnabled)
  const delaySecondsRef = useRef(delaySeconds)
  const autoAdvanceEnabledRef = useRef(autoAdvanceEnabled)
  const togglePlayPauseLockedRef = useRef(false)
  const suppressNextAutoPlayRef = useRef(false)

  const minHeight = 64
  const maxHeight = 104

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
    setEditableName(currentFile ? splitFileNameExtension(currentFile.name).baseName : "")
    setRenameError("")
  }, [currentFile])

  useEffect(() => {
    delayEnabledRef.current = delayEnabled
    delaySecondsRef.current = delaySeconds
    autoAdvanceEnabledRef.current = autoAdvanceEnabled
  }, [delayEnabled, delaySeconds, autoAdvanceEnabled])

  useEffect(() => {
    onPlaybackStateChange?.(isPlaying)
  }, [isPlaying, onPlaybackStateChange])

  useEffect(() => {
    if (!autoAdvanceEnabled) {
      clearNextAudioTimer()
    }
  }, [autoAdvanceEnabled])

  useEffect(() => {
    return clearNextAudioTimer
  }, [])

  // Keyboard navigation for 5-second skips and play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const activeHTMLElement = activeElement instanceof HTMLElement ? activeElement : null
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.tagName === "BUTTON" ||
        activeHTMLElement?.isContentEditable ||
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
          if (hasEnded && !autoAdvanceEnabledRef.current) {
            playNext()
          } else {
            togglePlayPause()
          }
          break
      }
    }

    if (currentFile && !disableKeyboardShortcuts) {
      document.addEventListener("keydown", handleKeyDown, { capture: true })
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [currentFile, isPlaying, currentTime, duration, hasEnded, disableKeyboardShortcuts])

  // Update audio player state when audio loads or time updates
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      if (audio.currentTime < audio.duration) {
        setHasEnded(false)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setHasEnded(true)
      if (autoAdvanceEnabledRef.current) {
        scheduleNext()
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      setHasEnded(false)
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
    setHasEnded(false)
  }, [currentFile])

  // Auto-play when a file is selected
  useEffect(() => {
    if (currentFile && audioRef.current) {
      if (suppressNextAutoPlayRef.current) {
        suppressNextAutoPlayRef.current = false
        return
      }

      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Error playing audio:", err))
    }
  }, [currentFile])

  const togglePlayPause = () => {
    if (!audioRef.current) return
    if (togglePlayPauseLockedRef.current) return

    togglePlayPauseLockedRef.current = true
    window.setTimeout(() => {
      togglePlayPauseLockedRef.current = false
    }, 500)

    if (hasEnded && !autoAdvanceEnabledRef.current) {
      playNext()
      return
    }

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

  const prepareNavigation = (options?: AudioNavigationOptions) => {
    if (options?.autoPlay === false) {
      audioRef.current?.pause()
      setIsPlaying(false)
      suppressNextAutoPlayRef.current = true
    }
  }

  const playNext = (options?: AudioNavigationOptions) => {
    if (!currentFile || sortedAudioFiles.length <= 1) return

    clearNextAudioTimer()
    prepareNavigation(options)
    const currentIndex = sortedAudioFiles.findIndex((file) => file.path === currentFile.path)
    const nextIndex = (currentIndex + 1) % sortedAudioFiles.length
    onSelectFile(sortedAudioFiles[nextIndex])
  }

  const playPrevious = (options?: AudioNavigationOptions) => {
    if (!currentFile || sortedAudioFiles.length <= 1) return

    clearNextAudioTimer()
    prepareNavigation(options)
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
    }, (delayEnabledRef.current ? delaySecondsRef.current : 0) * 1000)
  }

  const saveEditableName = async () => {
    if (!currentFile || isSavingName) return

    const nextName = editableName.trim()
    const currentBaseName = splitFileNameExtension(currentFile.name).baseName
    if (!nextName || nextName === currentBaseName) {
      setEditableName(currentBaseName)
      setRenameError("")
      return
    }

    setIsSavingName(true)
    setRenameError("")
    suppressNextAutoPlayRef.current = true

    try {
      const renamedFile = await onRenameFile(currentFile, nextName)
      setEditableName(renamedFile ? splitFileNameExtension(renamedFile.name).baseName : nextName)
    } catch (error: any) {
      suppressNextAutoPlayRef.current = false
      setEditableName(currentBaseName)
      setRenameError(error.message || "No se pudo renombrar.")
    } finally {
      setIsSavingName(false)
    }
  }

  useImperativeHandle(ref, () => ({
    togglePlayPause,
    playNext,
    playPrevious,
  }))

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      saveEditableName()
    }

    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      setEditableName(currentFile ? splitFileNameExtension(currentFile.name).baseName : "")
      setRenameError("")
      event.currentTarget.blur()
    }
  }

  if (!currentFile) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-background-tertiary bg-background-secondary/95 shadow-lg backdrop-blur-sm"
      style={{ height: `${playerHeight}px` }}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="absolute right-4 top-0 h-3 w-8 cursor-ns-resize opacity-20 transition-opacity hover:opacity-40"
        onMouseDown={() => setIsResizing(true)}
      >
        <div className="mt-1 h-0.5 w-full rounded-full bg-text-tertiary"></div>
        <div className="mt-0.5 h-0.5 w-full rounded-full bg-text-tertiary"></div>
      </div>

      <div className="flex h-full items-center justify-center px-3">
        <div className="flex w-full max-w-6xl items-center gap-3">
          <div className="flex w-56 min-w-0 flex-shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-background-tertiary text-primary">
              <FileIcon file={currentFile} size={18} />
            </div>
            <div className="min-w-0">
              <input
                value={editableName}
                onChange={(event) => {
                  setEditableName(event.target.value)
                  setRenameError("")
                }}
                onKeyDown={handleNameKeyDown}
                onBlur={() =>
                  setEditableName((value) => value.trim() || splitFileNameExtension(currentFile.name).baseName)
                }
                disabled={isSavingName}
                className="w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-text-primary outline-none transition-colors hover:border-background-tertiary hover:bg-background-tertiary/60 focus:border-primary/50 focus:bg-background-tertiary"
                title="Editar nombre y presionar Enter para guardar"
              />
              <p className="text-xs text-text-tertiary">
                {renameError || `${sortedAudioFiles.findIndex((f) => f.path === currentFile.path) + 1}/${sortedAudioFiles.length}`}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
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

          <div className="flex w-auto flex-shrink-0 items-center gap-1 text-text-secondary">
            <button
              type="button"
              onClick={() => {
                setAutoAdvanceEnabled((enabled) => {
                  if (enabled && delayEnabled) {
                    setDelayEnabled(false)
                  }
                  return !enabled
                })
              }}
              className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors ${
                autoAdvanceEnabled
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
              }`}
              aria-pressed={autoAdvanceEnabled}
              title={autoAdvanceEnabled ? "Autoavance activo" : "Autoavance"}
              aria-label="Autoavance"
            >
              {autoAdvanceEnabled ? <FastForward size={18} /> : <SkipForward size={18} />}
            </button>

            <button
              type="button"
              onClick={() => {
                setDelayEnabled((enabled) => {
                  const nextEnabled = !enabled
                  if (nextEnabled) {
                    setAutoAdvanceEnabled(true)
                  }
                  return nextEnabled
                })
              }}
              className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 transition-colors ${
                delayEnabled
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
              }`}
              aria-pressed={delayEnabled}
              title="Demora"
              aria-label="Demora"
            >
              <Clock size={16} />
              {delayEnabled && <span className="font-mono text-[11px]">{delaySeconds}s</span>}
            </button>

            {delayEnabled && (
              <input
                type="range"
                min="2"
                max="15"
                step="1"
                value={delaySeconds}
                onChange={(event) => {
                  setDelaySeconds(Number(event.target.value))
                  setAutoAdvanceEnabled(true)
                }}
                className="hidden w-16 accent-primary lg:block"
                title="Segundos entre audios"
                aria-label="Segundos entre audios"
              />
            )}
          </div>
        </div>

        <audio ref={audioRef} src={currentFile.url} preload="metadata" className="hidden" />
      </div>
    </div>
  )
})

AudioPlayer.displayName = "AudioPlayer"

export default AudioPlayer
