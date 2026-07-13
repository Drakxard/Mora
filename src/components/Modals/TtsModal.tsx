"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Check, Loader2, RotateCcw, Send, X } from "lucide-react"
import Button from "../ui/Button"

interface TtsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedModel: string
  canSaveToCurrentFolder: boolean
  onGenerate: (text: string) => Promise<{ audio: ArrayBuffer; fileName: string }>
  onConfirm: (audio: ArrayBuffer, fileName: string, text: string) => Promise<string>
}

const TtsModal: React.FC<TtsModalProps> = ({
  isOpen,
  onClose,
  selectedModel,
  canSaveToCurrentFolder,
  onGenerate,
  onConfirm,
}) => {
  const [text, setText] = useState("")
  const [audio, setAudio] = useState<ArrayBuffer | null>(null)
  const [audioUrl, setAudioUrl] = useState("")
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [savedFileName, setSavedFileName] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const resetPreview = () => {
    setAudio(null)
    setFileName("")
    setSavedFileName("")
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl("")
    }
  }

  const resetModal = () => {
    setText("")
    setError("")
    setSavedFileName("")
    resetPreview()
  }

  useEffect(() => {
    if (isOpen) {
      resetModal()
      setTimeout(() => textAreaRef.current?.focus(), 0)
    }
  }, [isOpen])

  const handleClose = () => {
    if (isGenerating || isSaving) return
    resetModal()
    onClose()
  }

  const handleGenerate = async () => {
    const trimmedText = text.trim()
    if (!trimmedText) {
      setError("Ingresa texto para generar el audio.")
      return
    }

    if (!selectedModel) {
      setError("Selecciona un modelo TTS primero.")
      return
    }

    if (!canSaveToCurrentFolder) {
      setError("Abre una carpeta antes de generar audio.")
      return
    }

    setIsGenerating(true)
    setError("")
    resetPreview()

    try {
      const result = await onGenerate(trimmedText)
      const nextUrl = URL.createObjectURL(new Blob([result.audio], { type: "audio/wav" }))
      setAudio(result.audio)
      setAudioUrl(nextUrl)
      setFileName(result.fileName)
    } catch (err: any) {
      setError(err.message || "No se pudo generar el audio.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleConfirm = async () => {
    if (!audio) {
      setError("Genera el audio antes de confirmar.")
      return
    }

    if (!fileName.trim()) {
      setError("Ingresa un nombre para el audio.")
      return
    }

    setIsSaving(true)
    setError("")
    setSavedFileName("")

    try {
      const savedName = await onConfirm(audio, fileName, text.trim())
      setSavedFileName(savedName)
      setText("")
      resetPreview()
      onClose()
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el audio.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const hasPreview = !!audioUrl

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
      <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-background-tertiary bg-background-secondary shadow-xl">
        <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-background-tertiary px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary">Generar audio TTS</h2>
            <p className="mt-1 truncate text-xs text-text-tertiary">Modelo: {selectedModel || "No seleccionado"}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isGenerating || isSaving}
            className="rounded-md p-1 text-text-secondary transition-colors hover:bg-background-tertiary hover:text-text-primary disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setError("")
              setSavedFileName("")
              resetPreview()
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                handleClose()
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                if (!isGenerating && !isSaving) {
                  handleGenerate()
                }
              }
            }}
            placeholder="Texto para convertir a audio..."
            disabled={isGenerating || isSaving}
            className={`w-full resize-none rounded-md border border-background bg-background-tertiary p-3 text-sm leading-6 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              hasPreview ? "h-36" : "h-56"
            }`}
          />

          {hasPreview && (
            <div className="space-y-3 rounded-md border border-background bg-background-tertiary p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-primary">Vista previa</span>
                <span className="text-xs text-text-tertiary">.wav</span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Nombre del audio</label>
                <div className="flex items-center">
                  <input
                    value={fileName}
                    onChange={(event) => {
                      setFileName(event.target.value)
                      setError("")
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        if (!isSaving) {
                          handleConfirm()
                        }
                      }
                    }}
                    disabled={isSaving}
                    className="min-w-0 flex-1 rounded-md border border-background bg-background-secondary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <audio src={audioUrl} controls className="block w-full" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 p-3 rounded-md">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {savedFileName && (
            <div className="bg-green-900/20 border border-green-800 p-3 rounded-md">
              <p className="text-green-300 text-sm">Audio guardado: {savedFileName}</p>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-background-tertiary bg-background-secondary px-5 py-4">
          <Button onClick={handleClose} variant="secondary" disabled={isGenerating || isSaving}>
            Cancelar
          </Button>
          <div className="flex flex-wrap justify-end gap-3">
            {audio && (
              <Button
                onClick={handleGenerate}
                variant="secondary"
                disabled={isGenerating || isSaving || !text.trim() || !selectedModel || !canSaveToCurrentFolder}
                leftIcon={isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              >
                {isGenerating ? "Generando..." : "Reintentar"}
              </Button>
            )}
            <Button
              onClick={audio ? handleConfirm : handleGenerate}
              disabled={
                isGenerating ||
                isSaving ||
                !text.trim() ||
                !selectedModel ||
                !canSaveToCurrentFolder ||
                (audio ? !fileName.trim() : false)
              }
              leftIcon={
                isGenerating || isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : audio ? (
                  <Check size={16} />
                ) : (
                  <Send size={16} />
                )
              }
            >
              {isGenerating ? "Generando..." : isSaving ? "Guardando..." : audio ? "Confirmar" : "Generar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TtsModal
