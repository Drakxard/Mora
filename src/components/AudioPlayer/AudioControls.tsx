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

  const iconButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary"

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onPrevious} className={iconButtonClass} title="Anterior" aria-label="Anterior">
          <SkipBack size={18} />
        </button>

        <button onClick={onSkipBackward} className={iconButtonClass} title="-5s" aria-label="Retroceder 5 segundos">
          <RotateCcw size={16} />
        </button>

        <button
          onClick={onPlayPause}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        <button onClick={onSkipForward} className={iconButtonClass} title="+5s" aria-label="Adelantar 5 segundos">
          <RotateCw size={16} />
        </button>

        <button onClick={onNext} className={iconButtonClass} title="Siguiente" aria-label="Siguiente">
          <SkipForward size={18} />
        </button>
      </div>

      <span className="w-10 shrink-0 text-right font-mono text-[11px] text-text-tertiary">{formatTime(currentTime)}</span>

      <div className="group relative h-7 min-w-24 flex-1">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          tabIndex={-1}
          aria-label="Progreso"
        />
        <div className="relative top-3 h-1 w-full rounded-full bg-background-tertiary transition-all group-hover:h-1.5">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100"
            style={{ left: `calc(${progressPercentage}% - 5px)` }}
          />
        </div>
      </div>

      <span className="w-10 shrink-0 font-mono text-[11px] text-text-tertiary">{formatTime(duration)}</span>

      <div className="hidden shrink-0 items-center gap-1 md:flex">
        <button onClick={toggleMute} className={iconButtonClass} title="Volumen" aria-label="Volumen">
          {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <div className="group relative h-7 w-16">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            aria-label="Volumen"
          />
          <div className="relative top-3 h-1 w-full rounded-full bg-background-tertiary transition-all group-hover:h-1.5">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AudioControls
