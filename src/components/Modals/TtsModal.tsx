"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Check, Clock, Loader2, Pause, Pencil, Play, RotateCcw, Save, Send, Square, Star, X } from "lucide-react"
import Button from "../ui/Button"
import {
  fetchAzureSpanishVoices,
  fetchAzureTtsLimits,
  type AzureTtsLimitInfo,
  type AzureTtsVoice,
} from "../../utils/tts"
import {
  getFavoriteTtsVoices,
  getRotateFavoriteTtsVoices,
  saveFavoriteTtsVoices,
  saveRotateFavoriteTtsVoices,
} from "../../utils/storage"

interface TtsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedVoice: string
  canSaveToCurrentFolder: boolean
  onVoiceChange: (voiceShortName: string) => void
  onGenerate: (text: string, voiceShortName?: string) => Promise<{ audio: ArrayBuffer; fileName: string }>
  onConfirm: (audio: ArrayBuffer, fileName: string, text: string, voiceShortName?: string) => Promise<string>
}

type QueueItemStatus = "pending" | "generating" | "done" | "error" | "stopped"

interface QueueItem {
  id: string
  text: string
  status: QueueItemStatus
  fileName: string
  targetFileName?: string
  audioBuffer?: ArrayBuffer
  audioUrl?: string
  isEditing?: boolean
  draftText?: string
  voice?: string
  error?: string
}

interface ParsedTtsSegment {
  text: string
  targetFileName?: string
}

const DEFAULT_DELAY_SECONDS = 7
const DEFAULT_GENERATION_SECONDS = 4
const REQUESTS_PER_MINUTE_LIMIT = 20

const extractTrailingTitle = (value: string): ParsedTtsSegment | null => {
  const titleMatch = value.match(/\s*\{([^{}]*)\}\s*$/)
  const rawText = titleMatch ? value.slice(0, titleMatch.index).trim() : value.trim()

  if (!rawText) return null

  const targetFileName = titleMatch?.[1]?.trim()
  return {
    text: rawText,
    targetFileName: targetFileName || undefined,
  }
}

const parseTtsSegments = (value: string) => {
  const segments: ParsedTtsSegment[] = []
  let current: string[] = []

  const flushCurrent = () => {
    const segment = current.join(" ").replace(/\s+/g, " ").trim()
    const parsedSegment = segment ? extractTrailingTitle(segment) : null
    if (parsedSegment) {
      segments.push(parsedSegment)
    }
    current = []
  }

  value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line) => {
      const trimmedLine = line.trim()

      if (!trimmedLine) {
        flushCurrent()
        return
      }

      const bulletMatch = trimmedLine.match(/^[-•*]\s+(.*)$/)
      if (bulletMatch) {
        flushCurrent()
        current = [bulletMatch[1].trim()]
        return
      }

      current.push(trimmedLine)
    })

  flushCurrent()
  return segments
}

const formatDuration = (seconds: number) => {
  const roundedSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(roundedSeconds / 60)
  const remainingSeconds = roundedSeconds % 60

  if (minutes === 0) return `${remainingSeconds}s`
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`
}

const createSequentialFileName = (baseName: string, index: number, total: number) => {
  const cleanBaseName = baseName.replace(/\.wav$/i, "").trim() || "tts"
  if (total === 1) return cleanBaseName

  const width = Math.max(2, total.toString().length)
  return `${cleanBaseName}-${(index + 1).toString().padStart(width, "0")}`
}

const getComparableWavName = (value: string) => {
  const trimmedValue = value.trim().toLowerCase()
  return trimmedValue.endsWith(".wav") ? trimmedValue : `${trimmedValue}.wav`
}

const stripWavExtension = (value: string) => value.replace(/\.wav$/i, "")

const ensureWavExtension = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.toLowerCase().endsWith(".wav") ? trimmedValue : `${trimmedValue}.wav`
}

const TtsModal: React.FC<TtsModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  canSaveToCurrentFolder,
  onVoiceChange,
  onGenerate,
  onConfirm,
}) => {
  const [text, setText] = useState("")
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [error, setError] = useState("")
  const [summary, setSummary] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isStopRequested, setIsStopRequested] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [delaySeconds, setDelaySeconds] = useState(DEFAULT_DELAY_SECONDS)
  const [averageGenerationSeconds, setAverageGenerationSeconds] = useState(DEFAULT_GENERATION_SECONDS)
  const [voices, setVoices] = useState<AzureTtsVoice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [voiceLoadError, setVoiceLoadError] = useState("")
  const [ttsLimits, setTtsLimits] = useState<AzureTtsLimitInfo | null>(null)
  const [isLoadingLimits, setIsLoadingLimits] = useState(false)
  const [favoriteVoices, setFavoriteVoices] = useState<string[]>(() => getFavoriteTtsVoices())
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)
  const [rotateFavoriteVoices, setRotateFavoriteVoices] = useState(() => getRotateFavoriteTtsVoices())
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const pendingPreviewPlayRef = useRef<string | null>(null)
  const queueItemsRef = useRef<QueueItem[]>([])
  const stopRequestedRef = useRef(false)
  const completedDurationsRef = useRef<number[]>([])
  const delayTimerRef = useRef<number | null>(null)
  const delayResolverRef = useRef<(() => void) | null>(null)
  const generatedBaseFileNameRef = useRef("")

  const toggleFavoriteVoice = (voiceShortName: string) => {
    setFavoriteVoices((currentFavorites) => {
      const nextFavorites = currentFavorites.includes(voiceShortName)
        ? currentFavorites.filter((favoriteVoice) => favoriteVoice !== voiceShortName)
        : [...currentFavorites, voiceShortName]

      saveFavoriteTtsVoices(nextFavorites)
      return nextFavorites
    })
  }

  const toggleRotateFavoriteVoices = () => {
    setRotateFavoriteVoices((currentValue) => {
      const nextValue = !currentValue
      saveRotateFavoriteTtsVoices(nextValue)
      return nextValue
    })
  }

  const revokeQueueAudioUrls = (items: QueueItem[]) => {
    items.forEach((item) => {
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl)
      }
    })
  }

  const createAudioUrl = (audio: ArrayBuffer) => URL.createObjectURL(new Blob([audio], { type: "audio/wav" }))

  const replaceQueueItems = (items: QueueItem[]) => {
    revokeQueueAudioUrls(queueItemsRef.current)
    queueItemsRef.current = items
    setQueueItems(items)
  }

  const applyQueueItemsUpdate = (updater: (items: QueueItem[]) => QueueItem[]) => {
    const previousItems = queueItemsRef.current
    const nextItems = updater(previousItems)
    const nextAudioUrls = new Set(nextItems.map((item) => item.audioUrl).filter(Boolean))

    previousItems.forEach((item) => {
      if (item.audioUrl && !nextAudioUrls.has(item.audioUrl)) {
        URL.revokeObjectURL(item.audioUrl)
      }
    })

    queueItemsRef.current = nextItems
    setQueueItems(nextItems)
  }

  useEffect(() => {
    return () => {
      if (delayTimerRef.current) {
        window.clearTimeout(delayTimerRef.current)
      }
      delayResolverRef.current?.()
      previewAudioRef.current?.pause()
      revokeQueueAudioUrls(queueItemsRef.current)
    }
  }, [])

  const resetModal = () => {
    previewAudioRef.current?.pause()
    setText("")
    setError("")
    setSummary("")
    replaceQueueItems([])
    setIsStopRequested(false)
    setIsConfirming(false)
    setSelectedItemId(null)
    setIsPreviewPlaying(false)
    setRetryingItemId(null)
    setDelaySeconds(DEFAULT_DELAY_SECONDS)
    setAverageGenerationSeconds(DEFAULT_GENERATION_SECONDS)
    stopRequestedRef.current = false
    pendingPreviewPlayRef.current = null
    completedDurationsRef.current = []
    generatedBaseFileNameRef.current = ""
  }

  useEffect(() => {
    if (isOpen) {
      resetModal()
      setTimeout(() => textAreaRef.current?.focus(), 0)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    let isCancelled = false

    setIsLoadingVoices(true)
    setVoiceLoadError("")
    fetchAzureSpanishVoices()
      .then((nextVoices) => {
        if (isCancelled) return
        setVoices(nextVoices)
        if (nextVoices.length && !nextVoices.some((voice) => voice.shortName === selectedVoice)) {
          onVoiceChange(nextVoices[0].shortName)
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          setVoiceLoadError(err.message || "No se pudieron cargar las voces de Azure Speech.")
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingVoices(false)
        }
      })

    setIsLoadingLimits(true)
    fetchAzureTtsLimits()
      .then((nextLimits) => {
        if (!isCancelled) {
          setTtsLimits(nextLimits)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setTtsLimits(null)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingLimits(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isOpen, onVoiceChange, selectedVoice])

  useEffect(() => {
    const audio = previewAudioRef.current
    if (!audio) return

    const handlePlay = () => setIsPreviewPlaying(true)
    const handlePause = () => setIsPreviewPlaying(false)
    const handleEnded = () => setIsPreviewPlaying(false)

    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  useEffect(() => {
    const audio = previewAudioRef.current
    if (!audio) return

    audio.pause()
    audio.currentTime = 0
    audio.load()
    setIsPreviewPlaying(false)

    if (pendingPreviewPlayRef.current === selectedItemId) {
      pendingPreviewPlayRef.current = null
      window.setTimeout(() => {
        audio.play().catch((err) => {
          console.error("Error playing TTS preview:", err)
          setError("No se pudo reproducir la vista previa.")
        })
      }, 0)
    }
  }, [selectedItemId])

  const handleClose = () => {
    if (isProcessing || isConfirming) return
    resetModal()
    onClose()
  }

  const waitBeforeNextRequest = (seconds = delaySeconds) =>
    new Promise<void>((resolve) => {
      delayResolverRef.current = resolve
      delayTimerRef.current = window.setTimeout(() => {
        delayTimerRef.current = null
        delayResolverRef.current = null
        resolve()
      }, Math.max(0, seconds) * 1000)
    })

  const validateBeforeProcessing = (segments: unknown[]) => {
    if (segments.length === 0) {
      setError("Ingresa texto para generar el audio.")
      return false
    }

    if (!selectedVoice) {
      setError("Selecciona una voz TTS primero.")
      return false
    }

    if (rotateFavoriteVoices && favoriteVoices.length === 0) {
      setError("Marca al menos una voz con estrella para activar la rotacion.")
      return false
    }

    if (!canSaveToCurrentFolder) {
      setError("Abre una carpeta antes de generar audio.")
      return false
    }

    return true
  }

  const updateQueueItem = (id: string, update: Partial<QueueItem>) => {
    applyQueueItemsUpdate((items) => items.map((item) => (item.id === id ? { ...item, ...update } : item)))
  }

  const handleGenerateQueue = async () => {
    const segments = parseTtsSegments(text)
    if (!validateBeforeProcessing(segments)) return

    const initialItems = segments.map((segment, index) => ({
      id: `${index}-${segment.text.slice(0, 16)}`,
      text: segment.text,
      status: "pending" as QueueItemStatus,
      fileName: "",
      targetFileName: stripWavExtension(segment.targetFileName || ""),
      draftText: segment.text,
    }))

    replaceQueueItems(initialItems)
    setSelectedItemId(initialItems[0]?.id || null)
    setIsProcessing(true)
    setIsStopRequested(false)
    setIsPreviewPlaying(false)
    setError("")
    setSummary("")
    stopRequestedRef.current = false
    completedDurationsRef.current = []
    generatedBaseFileNameRef.current = ""

    let generatedCount = 0
    let hadError = false

    try {
      let baseFileName = ""

      for (let index = 0; index < initialItems.length; index += 1) {
        const item = initialItems[index]

        if (stopRequestedRef.current) {
          updateQueueItem(item.id, { status: "stopped" })
          continue
        }

        updateQueueItem(item.id, { status: "generating", error: undefined })
        const startedAt = performance.now()

        try {
          const voiceForItem = rotateFavoriteVoices
            ? favoriteVoices[index % favoriteVoices.length]
            : selectedVoice
          const result = await onGenerate(item.text, voiceForItem)
          baseFileName = baseFileName || result.fileName
          generatedBaseFileNameRef.current = baseFileName
          applyQueueItemsUpdate((items) =>
            items.map((queueItem, queueIndex) => ({
              ...queueItem,
              targetFileName:
                queueItem.targetFileName ||
                stripWavExtension(createSequentialFileName(baseFileName, queueIndex, initialItems.length)),
            })),
          )
          const nextFileName = stripWavExtension(createSequentialFileName(baseFileName, index, initialItems.length))
          const nextAudioUrl = createAudioUrl(result.audio)
          const elapsedSeconds = (performance.now() - startedAt) / 1000

          completedDurationsRef.current = [...completedDurationsRef.current, elapsedSeconds]
          setAverageGenerationSeconds(
            completedDurationsRef.current.reduce((total, value) => total + value, 0) /
              completedDurationsRef.current.length,
          )

          generatedCount += 1
          updateQueueItem(item.id, {
            status: "done",
            fileName: "",
            targetFileName: item.targetFileName || nextFileName,
            audioBuffer: result.audio,
            audioUrl: nextAudioUrl,
            draftText: item.text,
            voice: voiceForItem,
          })

          const nextItem = initialItems[index + 1]
          if (!stopRequestedRef.current && nextItem) {
            if (stopRequestedRef.current) {
              continue
            }
            await waitBeforeNextRequest()
          }
        } catch (err: any) {
          const message = err.message || "No se pudo generar el audio."
          updateQueueItem(item.id, { status: "error", error: message })

          const normalizedMessage = message.toLowerCase()
          if (message.includes("429") || normalizedMessage.includes("limite") || normalizedMessage.includes("límite")) {
            setError(`${message} Aumenta el retraso entre solicitudes antes de reintentar.`)
          } else {
            setError(message)
          }
          hadError = true
          break
        }

      }

      if (stopRequestedRef.current) {
        setSummary(`Cola detenida. Audios generados: ${generatedCount}.`)
      } else if (generatedCount > 0 && !hadError) {
        setSummary(
          initialItems.length === 1
            ? "Audio generado. Confirma para guardarlo."
            : `Cola generada. Audios listos para confirmar: ${generatedCount}.`,
        )
      }
    } catch (err: any) {
      setError(err.message || "No se pudo completar la cola TTS.")
    } finally {
      setIsProcessing(false)
      setIsStopRequested(false)
      stopRequestedRef.current = false
    }
  }

  const handleStop = () => {
    stopRequestedRef.current = true
    setIsStopRequested(true)
    if (delayTimerRef.current) {
      window.clearTimeout(delayTimerRef.current)
      delayTimerRef.current = null
    }
    delayResolverRef.current?.()
    delayResolverRef.current = null
  }

  const handleTogglePreview = () => {
    const audio = previewAudioRef.current
    if (!audio) return

    if (isPreviewPlaying) {
      audio.pause()
      return
    }

    audio.play().catch((err) => {
      console.error("Error playing TTS preview:", err)
      setError("No se pudo reproducir la vista previa.")
    })
  }

  const handlePlayQueueItem = (itemId: string) => {
    if (itemId === selectedItemId) {
      handleTogglePreview()
      return
    }

    setSelectedItemId(itemId)
    pendingPreviewPlayRef.current = itemId
  }

  const handleStartEditItem = (itemId: string) => {
    applyQueueItemsUpdate((items) =>
      items.map((item) =>
        item.id === itemId ? { ...item, isEditing: true, draftText: item.draftText ?? item.text } : item,
      ),
    )
  }

  const handleCancelEditItem = (itemId: string) => {
    applyQueueItemsUpdate((items) =>
      items.map((item) =>
        item.id === itemId ? { ...item, isEditing: false, draftText: item.text } : item,
      ),
    )
  }

  const handleChangeDraftText = (itemId: string, draftText: string) => {
    applyQueueItemsUpdate((items) => items.map((item) => (item.id === itemId ? { ...item, draftText } : item)))
  }

  const handleChangeTargetFileName = (itemId: string, targetFileName: string) => {
    applyQueueItemsUpdate((items) =>
      items.map((item) => (item.id === itemId ? { ...item, targetFileName, error: undefined } : item)),
    )
    setError("")
  }

  const handleSaveEditItem = (itemId: string) => {
    const item = queueItemsRef.current.find((queueItem) => queueItem.id === itemId)
    const nextText = item?.draftText?.trim()

    if (!nextText) {
      setError("El texto de la solicitud no puede estar vacio.")
      return
    }

    if (selectedItemId === itemId) {
      previewAudioRef.current?.pause()
      setIsPreviewPlaying(false)
    }

    applyQueueItemsUpdate((items) =>
      items.map((queueItem) =>
        queueItem.id === itemId
          ? {
              ...queueItem,
              text: nextText,
              draftText: nextText,
              status: "pending",
              isEditing: false,
              fileName: "",
              audioBuffer: undefined,
              audioUrl: undefined,
              error: undefined,
            }
          : queueItem,
      ),
    )
    setError("")
    setSummary("Texto actualizado. Reintenta esa solicitud para generar el WAV.")
  }

  const handleRetryQueueItem = async (itemId: string) => {
    const item = queueItemsRef.current.find((queueItem) => queueItem.id === itemId)
    if (!item) return

    if (!validateBeforeProcessing([item.text])) return

    if (selectedItemId === itemId) {
      previewAudioRef.current?.pause()
      setIsPreviewPlaying(false)
    }

    setRetryingItemId(itemId)
    setError("")
    setSummary("")
    updateQueueItem(itemId, { status: "generating", error: undefined, isEditing: false })
    const startedAt = performance.now()

    try {
      const currentItems = queueItemsRef.current
      const itemIndex = Math.max(
        0,
        currentItems.findIndex((queueItem) => queueItem.id === itemId),
      )
      const voiceForItem =
        item.voice ||
        (rotateFavoriteVoices && favoriteVoices.length ? favoriteVoices[itemIndex % favoriteVoices.length] : selectedVoice)
      const result = await onGenerate(item.text, voiceForItem)

      const baseFileName = generatedBaseFileNameRef.current || result.fileName
      generatedBaseFileNameRef.current = baseFileName
      const targetFileName =
        stripWavExtension(item.fileName) ||
        item.targetFileName ||
        stripWavExtension(createSequentialFileName(baseFileName, itemIndex, Math.max(1, currentItems.length)))
      const nextAudioUrl = createAudioUrl(result.audio)
      const elapsedSeconds = (performance.now() - startedAt) / 1000

      completedDurationsRef.current = [...completedDurationsRef.current, elapsedSeconds]
      setAverageGenerationSeconds(
        completedDurationsRef.current.reduce((total, value) => total + value, 0) / completedDurationsRef.current.length,
      )

      updateQueueItem(itemId, {
        status: "done",
        fileName: "",
        targetFileName,
        audioBuffer: result.audio,
        audioUrl: nextAudioUrl,
        draftText: item.text,
        voice: voiceForItem,
        error: undefined,
      })
      setSelectedItemId(itemId)
      setSummary("Solicitud regenerada. Confirma para guardarla.")
    } catch (err: any) {
      const message = err.message || "No se pudo reintentar el TTS."
      updateQueueItem(itemId, { status: "error", error: message })
      setError(message)
    } finally {
      setRetryingItemId(null)
    }
  }

  const handleConfirmGeneratedQueue = async () => {
    const itemsToConfirm = queueItemsRef.current.filter((item) => item.status === "done" && item.audioBuffer && !item.fileName)

    if (itemsToConfirm.length === 0) {
      setError("No hay resultados nuevos para confirmar.")
      return
    }

    const emptyNameItem = itemsToConfirm.find((item) => !(item.targetFileName || "").trim())
    if (emptyNameItem) {
      updateQueueItem(emptyNameItem.id, { error: "El nombre del audio no puede estar vacio." })
      setSelectedItemId(emptyNameItem.id)
      setError("Completa los nombres de los audios antes de confirmar.")
      return
    }

    const normalizedNames = itemsToConfirm.map((item) => getComparableWavName(item.targetFileName || ""))
    const duplicateName = normalizedNames.find((name, index) => normalizedNames.indexOf(name) !== index)
    if (duplicateName) {
      setError(`Hay nombres repetidos en la cola: ${duplicateName}`)
      return
    }

    setIsConfirming(true)
    setError("")
    setSummary("")

    try {
      for (const item of itemsToConfirm) {
        if (!item.audioBuffer) continue

        const savedName = await onConfirm(
          item.audioBuffer,
          ensureWavExtension(item.targetFileName || ""),
          item.text,
          item.voice || selectedVoice,
        )
        updateQueueItem(item.id, {
          fileName: savedName,
          targetFileName: stripWavExtension(savedName),
          draftText: item.text,
          error: undefined,
        })
      }

      resetModal()
      onClose()
    } catch (err: any) {
      setError(err.message || "No se pudieron confirmar los resultados TTS.")
    } finally {
      setIsConfirming(false)
    }
  }

  if (!isOpen) return null

  const segments = parseTtsSegments(text)
  const estimatedSeconds = segments.length * averageGenerationSeconds + Math.max(0, segments.length - 1) * delaySeconds
  const estimatedSecondsBetweenStarts = Math.max(1, averageGenerationSeconds + delaySeconds)
  const completedCount = queueItems.filter((item) => item.status === "done").length
  const pendingConfirmCount = queueItems.filter((item) => item.status === "done" && item.audioBuffer && !item.fileName).length
  const confirmedCount = queueItems.filter((item) => item.status === "done" && item.fileName).length
  const hasGeneratedResults = completedCount > 0
  const hasPendingConfirmations = pendingConfirmCount > 0
  const isQueueMode = segments.length > 1
  const estimatedRequestRate = Math.ceil(60 / estimatedSecondsBetweenStarts)
  const limitWarning =
    estimatedRequestRate > REQUESTS_PER_MINUTE_LIMIT
      ? `El ritmo estimado supera ${REQUESTS_PER_MINUTE_LIMIT} solicitudes por minuto; sube el retraso si Azure responde 429.`
      : ""
  const hasRateLimitValue = (_value: unknown) => false
  const requestResetSeconds = 0
  const tokenResetSeconds = 0
  const rateLimit = { resetRequests: "", resetTokens: "" }
  const exceedsMinuteTokens = false
  const exceedsKnownRemainingTokens = false
  const favoriteVoiceSet = new Set(favoriteVoices)
  const visibleVoices = showOnlyFavorites
    ? voices.filter((voice) => favoriteVoiceSet.has(voice.shortName))
    : voices
  const displayItems: QueueItem[] = queueItems.length
    ? queueItems
    : segments.map((segment, index) => ({
        id: `preview-${index}`,
        text: segment.text,
        status: "pending",
        fileName: "",
        targetFileName: stripWavExtension(segment.targetFileName || ""),
      }))
  const selectedQueueItem = queueItems.find((item) => item.id === selectedItemId) || null
  const selectedAudioUrl = selectedQueueItem?.audioUrl || ""

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="relative flex h-screen w-screen flex-col overflow-hidden border border-background-tertiary bg-background-secondary shadow-xl">
        <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-background-tertiary px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary">Generar audio TTS</h2>
            <p className="mt-1 truncate text-xs text-text-tertiary">
              Voz: {selectedVoice || "No seleccionada"} · {segments.length || 0} solicitud
              {segments.length === 1 ? "" : "es"}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing || isConfirming}
            className="rounded-md p-1 text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[280px_minmax(0,1fr)_minmax(320px,0.9fr)] lg:overflow-hidden">
          <aside className="min-h-0 overflow-y-auto rounded-md border border-background bg-background-tertiary p-4">
            <div className="space-y-4">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text-primary">Voces en español</span>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={showOnlyFavorites}
                        onChange={(event) => setShowOnlyFavorites(event.target.checked)}
                        className="h-3.5 w-3.5 accent-primary"
                        disabled={isProcessing || isConfirming}
                      />
                      Favoritas
                    </label>
                    <button
                      type="button"
                      onClick={toggleRotateFavoriteVoices}
                      disabled={isProcessing || isConfirming}
                      className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors disabled:opacity-50 ${
                        rotateFavoriteVoices
                          ? "border-primary/70 bg-primary/20 text-primary"
                          : "border-background bg-background-secondary text-text-tertiary hover:text-text-primary"
                      }`}
                      title="Rotar voces favoritas en cada solicitud TTS"
                    >
                      {rotateFavoriteVoices ? "ON" : "OFF"}
                    </button>
                    <span>{isLoadingVoices ? "cargando" : visibleVoices.length}</span>
                  </div>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {visibleVoices.map((voice) => {
                    const isSelectedVoice = voice.shortName === selectedVoice
                    const isFavoriteVoice = favoriteVoiceSet.has(voice.shortName)

                    return (
                      <button
                        key={voice.shortName}
                        type="button"
                        onClick={() => onVoiceChange(voice.shortName)}
                        disabled={isProcessing || isConfirming}
                        className={`w-full rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isSelectedVoice
                            ? "border-primary/70 bg-primary/10"
                            : "border-background bg-background-secondary hover:border-background-tertiary"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleFavoriteVoice(voice.shortName)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                event.stopPropagation()
                                toggleFavoriteVoice(voice.shortName)
                              }
                            }}
                            className={`rounded p-0.5 transition-colors ${
                              isFavoriteVoice ? "text-yellow-300" : "text-text-tertiary hover:text-text-primary"
                            }`}
                            title={isFavoriteVoice ? "Quitar de favoritas" : "Marcar como favorita"}
                            aria-label={isFavoriteVoice ? "Quitar de favoritas" : "Marcar como favorita"}
                          >
                            <Star size={15} fill={isFavoriteVoice ? "currentColor" : "none"} />
                          </span>
                          <span className="block min-w-0 truncate text-sm font-medium text-text-primary">
                            {voice.localName || voice.displayName || voice.shortName}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-text-secondary">
                          {voice.locale} · {voice.gender || "Voz"} · {voice.voiceType || "Azure"}
                        </span>
                        <span className="mt-1 block truncate font-mono text-[11px] text-text-tertiary">
                          {voice.shortName}
                        </span>
                      </button>
                    )
                  })}
                  {!isLoadingVoices && visibleVoices.length === 0 && (
                    <div className="rounded-md border border-background bg-background-secondary p-3 text-xs text-text-secondary">
                      {voiceLoadError || (showOnlyFavorites ? "No hay voces favoritas." : "No hay voces disponibles.")}
                    </div>
                  )}
                </div>
                {voiceLoadError && voices.length > 0 && <p className="mt-2 text-xs text-red-300">{voiceLoadError}</p>}
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-text-primary">
                  <Clock size={16} />
                  <span className="text-sm font-medium">Retraso</span>
                </div>
                <span className="font-mono text-sm text-text-primary">{delaySeconds}s</span>
              </div>
              <input
                type="range"
                min="6"
                max="12"
                step="1"
                value={delaySeconds}
                onChange={(event) => setDelaySeconds(Number(event.target.value))}
                disabled={isProcessing}
                className="w-full accent-primary"
                title="Segundos entre solicitudes TTS"
              />
              <div className="grid grid-cols-1 gap-3 text-xs text-text-secondary">
                <div>
                  <p className="text-text-tertiary">Ritmo</p>
                  <p className="mt-1 font-mono text-text-primary">
                    {estimatedRequestRate}/{REQUESTS_PER_MINUTE_LIMIT} min
                  </p>
                </div>
                <div>
                  <p className="text-text-tertiary">Tiempo estimado</p>
                  <p className="mt-1 font-mono text-text-primary">{formatDuration(estimatedSeconds)}</p>
                </div>
              </div>
              <div className="rounded-md border border-background bg-background-secondary px-3 py-2 text-xs text-text-secondary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Limites Azure Speech</span>
                  <span className="text-text-tertiary">{isLoadingLimits ? "consultando" : ttsLimits?.tier || "F0"}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <p>
                    Transacciones:{" "}
                    <span className="font-mono text-text-primary">
                      {ttsLimits?.transactionsLabel || (isLoadingLimits ? "consultando" : "20 transacciones / 60s")}
                    </span>
                    {false ? (
                      <span className="text-text-tertiary">
                        {" "}
                        · reset {hasRateLimitValue(requestResetSeconds) ? `en ${formatDuration(requestResetSeconds)}` : rateLimit.resetRequests}
                      </span>
                    ) : null}
                  </p>
                  <p>
                    Audio maximo:{" "}
                    <span
                      className={`font-mono ${
                        exceedsMinuteTokens || exceedsKnownRemainingTokens ? "text-red-300" : "text-text-primary"
                      }`}
                    >
                      {ttsLimits?.maxAudioLengthLabel || (isLoadingLimits ? "consultando" : "10 min por request")}
                    </span>
                    {false ? (
                      <span className="text-text-tertiary">
                        {" "}
                        · reset {hasRateLimitValue(tokenResetSeconds) ? `en ${formatDuration(tokenResetSeconds)}` : rateLimit.resetTokens}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              {limitWarning && <p className="mt-3 text-xs text-red-300">{limitWarning}</p>}
            </div>
          </aside>

          <div className="flex min-h-[22rem] flex-col lg:min-h-0">
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setError("")
                setSummary("")
                replaceQueueItems([])
                setSelectedItemId(null)
                setIsPreviewPlaying(false)
                generatedBaseFileNameRef.current = ""
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault()
                  handleClose()
                }
              }}
              placeholder="Texto para convertir a audio..."
              disabled={isProcessing}
              className="min-h-0 flex-1 resize-none rounded-md border border-background bg-background-tertiary p-4 text-sm leading-6 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex min-h-[22rem] flex-col rounded-md border border-background bg-background-tertiary lg:min-h-0">
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-background px-4 py-3">
              <div>
                <h3 className="text-sm font-medium text-text-primary">{isQueueMode ? "Cola TTS" : "Solicitud TTS"}</h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  {isQueueMode ? "Se guarda un WAV por bloque." : "El texto actual se guarda como un WAV."}
                </p>
              </div>
              {isProcessing && <Loader2 size={16} className="flex-shrink-0 animate-spin text-primary" />}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {displayItems.map((item, index) => {
                const isSelected = item.id === selectedItemId
                const isRealQueueItem = queueItems.length > 0
                const isRetryingThisItem = retryingItemId === item.id
                const canPlayItem = isRealQueueItem && !!item.audioUrl && item.status === "done"
                const isSelectedPlaying = isSelected && isPreviewPlaying

                return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isRealQueueItem) {
                      setSelectedItemId(item.id)
                    }
                  }}
                  className={`mb-2 rounded-md border p-3 transition-colors last:mb-0 ${
                    isSelected
                      ? "border-primary/60 bg-primary/10"
                      : "border-background bg-background-secondary hover:border-background-tertiary"
                  } ${isRealQueueItem ? "cursor-pointer" : ""}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-text-tertiary">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      {isRealQueueItem && (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handlePlayQueueItem(item.id)
                            }}
                            disabled={!canPlayItem}
                            className="rounded p-1 text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            title={canPlayItem ? "Reproducir vista previa" : "Genera el audio antes de reproducir"}
                            aria-label={isSelectedPlaying ? "Pausar vista previa" : "Reproducir vista previa"}
                          >
                            {isSelectedPlaying ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleStartEditItem(item.id)
                            }}
                            disabled={isProcessing || isConfirming || isRetryingThisItem || item.status === "generating"}
                            className="rounded p-1 text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            title="Editar texto"
                            aria-label="Editar texto"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleRetryQueueItem(item.id)
                            }}
                            disabled={isProcessing || isConfirming || !!retryingItemId || item.status === "generating"}
                            className="rounded p-1 text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            title="Reintentar esta solicitud"
                            aria-label="Reintentar esta solicitud"
                          >
                            {isRetryingThisItem ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                          </button>
                        </>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          item.status === "done" && item.fileName
                            ? "bg-green-900/30 text-green-300"
                            : item.status === "done"
                              ? "bg-primary/20 text-primary"
                            : item.status === "error"
                              ? "bg-red-900/30 text-red-300"
                              : item.status === "generating"
                                ? "bg-primary/20 text-primary"
                                : item.status === "stopped"
                                  ? "bg-yellow-900/30 text-yellow-300"
                                  : "bg-background-tertiary text-text-secondary"
                        }`}
                      >
                        {item.status === "done" && item.fileName
                          ? "Guardado"
                          : item.status === "done"
                            ? "Listo"
                          : item.status === "error"
                            ? "Error"
                            : item.status === "generating"
                              ? "Generando"
                              : item.status === "stopped"
                                ? "Detenido"
                                : "Pendiente"}
                      </span>
                    </div>
                  </div>
                  {item.isEditing ? (
                    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                      <textarea
                        value={item.draftText ?? item.text}
                        onChange={(event) => handleChangeDraftText(item.id, event.target.value)}
                        disabled={isProcessing || isConfirming || isRetryingThisItem}
                        className="h-24 w-full resize-none rounded-md border border-background bg-background-tertiary p-2 text-sm leading-5 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCancelEditItem(item.id)}
                          disabled={isProcessing || isConfirming || isRetryingThisItem}
                          className="rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary disabled:opacity-40"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditItem(item.id)}
                          disabled={isProcessing || isConfirming || isRetryingThisItem}
                          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
                        >
                          <Save size={13} />
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="max-h-[3.75rem] overflow-hidden text-sm leading-5 text-text-primary">{item.text}</p>
                  )}
                  {(item.fileName || item.targetFileName) && (
                    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                      <input
                        value={item.fileName ? stripWavExtension(item.fileName) : item.targetFileName || ""}
                        onChange={(event) => handleChangeTargetFileName(item.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                        }}
                        disabled={
                          !isRealQueueItem || isProcessing || isConfirming || !!item.fileName || item.status === "generating"
                        }
                        className="w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-text-tertiary outline-none transition-colors hover:border-background-tertiary hover:bg-background-tertiary/60 focus:border-primary/50 focus:bg-background-tertiary focus:text-text-primary disabled:cursor-default disabled:opacity-80"
                        title={item.fileName ? "Audio guardado" : "Editar nombre y confirmar para guardar"}
                      />
                    </div>
                  )}
                  {item.error && <p className="mt-2 text-xs text-red-300">{item.error}</p>}
                </div>
                )
              })}

              {segments.length === 0 && (
                <div className="flex h-full min-h-[12rem] items-center justify-center text-center text-sm text-text-tertiary">
                  Escribe texto o una lista para ver las solicitudes detectadas.
                </div>
              )}
            </div>
            <audio ref={previewAudioRef} src={selectedAudioUrl} preload="metadata" className="hidden" />
          </div>

        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-background-tertiary bg-background-secondary px-5 py-4">
          <div className="min-w-0 flex-1">
            {error && <p className="truncate text-sm text-red-300">{error}</p>}
            {!error && summary && <p className="truncate text-sm text-green-300">{summary}</p>}
          </div>
          <Button onClick={handleClose} variant="secondary" disabled={isProcessing || isConfirming}>
            Cancelar
          </Button>
          <div className="flex flex-wrap justify-end gap-3">
            {isProcessing && (
              <Button
                onClick={handleStop}
                variant="secondary"
                disabled={isStopRequested}
                leftIcon={<Square size={16} />}
              >
                {isStopRequested ? "Deteniendo..." : "Detener"}
              </Button>
            )}
            <Button
              onClick={hasPendingConfirmations ? handleConfirmGeneratedQueue : handleGenerateQueue}
              disabled={
                isProcessing ||
                isConfirming ||
                segments.length === 0 ||
                !selectedVoice ||
                !canSaveToCurrentFolder ||
                (hasGeneratedResults && !hasPendingConfirmations && confirmedCount > 0)
              }
              leftIcon={
                isProcessing || isConfirming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : hasPendingConfirmations || (hasGeneratedResults && confirmedCount > 0) ? (
                  <Check size={16} />
                ) : (
                  <Send size={16} />
                )
              }
            >
              {isProcessing
                ? "Generando..."
                : isConfirming
                  ? "Confirmando..."
                  : hasPendingConfirmations
                    ? "Confirmar"
                    : hasGeneratedResults && confirmedCount > 0
                      ? "Confirmado"
                      : isQueueMode
                        ? "Generar cola"
                        : "Generar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TtsModal
