"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import type { FileItem } from "../../types"
import AudioControls from "./AudioControls"
import FileIcon from "../FileExplorer/FileIcon"

interface AudioPlayerProps {
  audioFiles: FileItem[]
  currentFile: FileItem | null
  onSelectFile: (file: FileItem) => void
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioFiles, currentFile, onSelectFile }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playerHeight, setPlayerHeight] = useState(120) // altura por defecto
  const [isResizing, setIsResizing] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const minHeight = 80
  const maxHeight = 120

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
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

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
      playNext()
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
    if (!currentFile || audioFiles.length <= 1) return

    const currentIndex = audioFiles.findIndex((file) => file.path === currentFile.path)
    const nextIndex = (currentIndex + 1) % audioFiles.length
    onSelectFile(audioFiles[nextIndex])
  }

  const playPrevious = () => {
    if (!currentFile || audioFiles.length <= 1) return

    const currentIndex = audioFiles.findIndex((file) => file.path === currentFile.path)
    const prevIndex = (currentIndex - 1 + audioFiles.length) % audioFiles.length
    onSelectFile(audioFiles[prevIndex])
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
        <div className="flex items-center w-full max-w-4xl">
          {/* File info */}
          <div className="flex items-center mr-8 min-w-0 flex-shrink-0">
            <div className="mr-3 p-2 bg-primary/10 rounded-lg">
              <FileIcon file={currentFile} size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-text-primary font-medium truncate text-sm">{currentFile.name}</h3>
              <p className="text-text-tertiary text-xs">
                {audioFiles.findIndex((f) => f.path === currentFile.path) + 1} de {audioFiles.length}
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

          {/* Right spacer for balance */}
          <div className="w-32 flex-shrink-0"></div>
        </div>

        <audio ref={audioRef} src={currentFile.url} preload="metadata" className="hidden" />
      </div>
    </div>
  )
}

export default AudioPlayer
