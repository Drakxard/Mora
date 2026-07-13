"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Pause, Play, X } from "lucide-react"

interface PresentationModeProps {
  isOpen: boolean
  title: string
  text: string
  isPlaying: boolean
  canControlPlayback?: boolean
  backgroundImages?: string[]
  backgroundIndex?: number
  onTogglePlayPause: () => void
  onClose: () => void
}

const BACKGROUND_TRANSITION_MS = 700

const PresentationMode: React.FC<PresentationModeProps> = ({
  isOpen,
  title,
  text,
  isPlaying,
  canControlPlayback = true,
  backgroundImages = [],
  backgroundIndex = 0,
  onTogglePlayPause,
  onClose,
}) => {
  const normalizedBackgroundIndex = backgroundImages.length
    ? ((backgroundIndex % backgroundImages.length) + backgroundImages.length) % backgroundImages.length
    : 0
  const targetBackground = backgroundImages.length ? backgroundImages[normalizedBackgroundIndex] : undefined
  const [displayedBackground, setDisplayedBackground] = useState<string | undefined>(targetBackground)
  const [previousBackground, setPreviousBackground] = useState<string | undefined>()
  const [isTransitioningBackground, setIsTransitioningBackground] = useState(false)
  const displayedBackgroundRef = useRef<string | undefined>(targetBackground)
  const transitionStartTimerRef = useRef<number | null>(null)
  const transitionEndTimerRef = useRef<number | null>(null)

  const outlinedTextStyle: React.CSSProperties = {
    textShadow:
      "0 2px 0 #000, 2px 0 0 #000, 0 -2px 0 #000, -2px 0 0 #000, 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 8px 28px rgba(0,0,0,0.85)",
  }

  const clearBackgroundTransitionTimers = () => {
    if (transitionStartTimerRef.current) {
      window.clearTimeout(transitionStartTimerRef.current)
      transitionStartTimerRef.current = null
    }

    if (transitionEndTimerRef.current) {
      window.clearTimeout(transitionEndTimerRef.current)
      transitionEndTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !targetBackground || backgroundImages.length <= 1) {
      clearBackgroundTransitionTimers()
      displayedBackgroundRef.current = targetBackground
      setDisplayedBackground(targetBackground)
      setPreviousBackground(undefined)
      setIsTransitioningBackground(false)
      return
    }

    if (displayedBackgroundRef.current === targetBackground) return

    clearBackgroundTransitionTimers()
    const outgoingBackground = displayedBackgroundRef.current
    displayedBackgroundRef.current = targetBackground
    setPreviousBackground(outgoingBackground)
    setDisplayedBackground(targetBackground)
    setIsTransitioningBackground(false)

    transitionStartTimerRef.current = window.setTimeout(() => {
      setIsTransitioningBackground(true)
      transitionStartTimerRef.current = null
    }, 20)

    transitionEndTimerRef.current = window.setTimeout(() => {
      setPreviousBackground(undefined)
      setIsTransitioningBackground(false)
      transitionEndTimerRef.current = null
    }, BACKGROUND_TRANSITION_MS + 40)
  }, [backgroundImages.length, isOpen, targetBackground])

  useEffect(() => clearBackgroundTransitionTimers, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      {displayedBackground && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-all ease-out ${
            previousBackground && !isTransitioningBackground ? "scale-[1.01] blur-[6px] opacity-0" : "scale-100 blur-0 opacity-100"
          }`}
          style={{
            backgroundImage: `url("${displayedBackground}")`,
            transitionDuration: `${BACKGROUND_TRANSITION_MS}ms`,
          }}
        />
      )}

      {previousBackground && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-all ease-out ${
            isTransitioningBackground ? "scale-[1.01] blur-[6px] opacity-0" : "scale-100 blur-0 opacity-100"
          }`}
          style={{
            backgroundImage: `url("${previousBackground}")`,
            transitionDuration: `${BACKGROUND_TRANSITION_MS}ms`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-4 px-6 py-5">
        <p className="min-w-0 truncate text-sm font-medium text-white" style={outlinedTextStyle}>
          {title}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-white transition-colors hover:bg-white/10"
          aria-label="Salir de presentación"
          title="Salir"
          style={outlinedTextStyle}
        >
          <X size={22} />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-8 py-8">
        <p
          className="max-h-full max-w-5xl overflow-hidden whitespace-pre-wrap text-center text-3xl font-semibold leading-snug text-white md:text-5xl md:leading-tight"
          style={outlinedTextStyle}
        >
          {text}
        </p>
      </div>

      <div className="relative z-10 flex flex-shrink-0 items-center justify-center px-6 py-8">
        {canControlPlayback && (
          <button
            type="button"
            onClick={onTogglePlayPause}
            className="inline-flex items-center gap-3 rounded-md border border-white/70 bg-black/20 px-6 py-3 text-base font-semibold text-white backdrop-blur-[1px] transition-colors hover:bg-black/35"
            style={outlinedTextStyle}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            {isPlaying ? "Pausar" : "Reproducir"}
          </button>
        )}
      </div>
    </div>
  )
}

export default PresentationMode
