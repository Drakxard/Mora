"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCcw, RotateCw } from "lucide-react"

interface AudioControlsProps {
  audioRef: React.RefObject<HTMLAudioElement>
  isPlaying: boolean
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSkipForward: () => void
  onSkipBackward: () => void
  duration: number
  currentTime: number
  onSeek: (time: number) => void
}

const AudioControls: React.FC<AudioControlsProps> = ({
  audioRef,
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  onSkipForward,
  onSkipBackward,
  duration,
  currentTime,
  onSeek,
}) => {
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const prevVolume = useRef(1)

  // Update audio volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted, audioRef])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    if (newVolume > 0 && isMuted) {
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    if (!isMuted) {
      prevVolume.current = volume
      setIsMuted(true)
    } else {
      setIsMuted(false)
      if (prevVolume.current === 0) {
        setVolume(0.5)
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number.parseFloat(e.target.value)
    onSeek(newTime)
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00"

    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex flex-col w-full">
      {/* Control buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-1">
          <button
            onClick={toggleMute}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-background-tertiary"
          >
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <div className="relative w-20 h-6 group">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="h-1 bg-background-tertiary rounded-full w-full relative top-2.5 group-hover:h-1.5 transition-all">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full absolute top-0 left-0 transition-all"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onPrevious}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-background-tertiary"
            title="Pista anterior"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={onSkipBackward}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-background-tertiary"
            title="Retroceder 5s"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={onPlayPause}
            className="p-3 bg-gradient-to-r from-primary to-primary/80 rounded-full text-white hover:from-primary/90 hover:to-primary/70 transition-all transform hover:scale-105 shadow-lg"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>

          <button
            onClick={onSkipForward}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-background-tertiary"
            title="Adelantar 5s"
          >
            <RotateCw size={18} />
          </button>

          <button
            onClick={onNext}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-background-tertiary"
            title="Siguiente pista"
          >
            <SkipForward size={20} />
          </button>
        </div>
        <div className="w-24"></div> {/* Spacer for balance */}
      </div>

      {/* Progress bar - moved to bottom */}
      <div className="flex items-center space-x-3">
        <span className="text-xs text-text-secondary font-mono w-12 text-right">{formatTime(currentTime)}</span>

        <div className="relative flex-1 h-6 group">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            tabIndex={-1}
          />
          <div className="h-1 bg-background-tertiary rounded-full w-full relative top-2.5 group-hover:h-1.5 transition-all">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full absolute top-0 left-0 transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
            <div
              className="w-3 h-3 bg-primary rounded-full absolute top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              style={{ left: `calc(${progressPercentage}% - 6px)` }}
            />
          </div>
        </div>

        <span className="text-xs text-text-secondary font-mono w-12">{formatTime(duration)}</span>
      </div>
    </div>
  )
}

export default AudioControls
