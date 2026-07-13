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
  onConfirm: (audio: ArrayBuffer, fileName: string) => Promise<string>
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
    if (isOpen) {
      setError("")
      setSavedFileName("")
      setTimeout(() => textAreaRef.current?.focus(), 0)
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const handleClose = () => {
    if (isGenerating || isSaving) return
    onClose()
  }

  const resetPreview = () => {
    setAudio(null)
    setFileName("")
    setSavedFileName("")
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl("")
    }
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
      const savedName = await onConfirm(audio, fileName)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-background-secondary w-full max-w-2xl max-h-[85vh] rounded-lg shadow-xl border border-background-tertiary overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-background-tertiary">
          <div>
            <h2 className="text-lg font-medium text-text-primary">Generar audio TTS</h2>
            <p className="text-xs text-text-tertiary mt-1">Modelo: {selectedModel || "No seleccionado"}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isGenerating || isSaving}
            className="p-1 rounded-full hover:bg-background-tertiary transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <div className="p-4 space-y-4">
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
            rows={8}
            className="w-full bg-background-tertiary border border-background rounded-md p-3 text-text-primary placeholder-text-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          {audioUrl && (
            <div className="bg-background-tertiary border border-background rounded-md p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nombre del audio</label>
                <div className="flex items-center gap-2">
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
                    className="flex-1 bg-background-secondary border border-background rounded-md px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-text-tertiary">.wav</span>
                </div>
              </div>

              <audio src={audioUrl} controls className="w-full" />
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

        <div className="flex justify-between gap-3 p-4 border-t border-background-tertiary">
          <Button onClick={handleClose} variant="secondary" disabled={isGenerating || isSaving}>
            Cancelar
          </Button>
          <div className="flex gap-3">
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
