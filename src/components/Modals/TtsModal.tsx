"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Loader2, Send, X } from "lucide-react"
import Button from "../ui/Button"

interface TtsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedModel: string
  canSaveToCurrentFolder: boolean
  onGenerate: (text: string) => Promise<string>
}

const TtsModal: React.FC<TtsModalProps> = ({
  isOpen,
  onClose,
  selectedModel,
  canSaveToCurrentFolder,
  onGenerate,
}) => {
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [generatedFileName, setGeneratedFileName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setError("")
      setGeneratedFileName("")
      setTimeout(() => textAreaRef.current?.focus(), 0)
    }
  }, [isOpen])

  const handleClose = () => {
    if (isLoading) return
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

    setIsLoading(true)
    setError("")
    setGeneratedFileName("")

    try {
      const fileName = await onGenerate(trimmedText)
      setGeneratedFileName(fileName)
      setText("")
    } catch (err: any) {
      setError(err.message || "No se pudo generar el audio.")
    } finally {
      setIsLoading(false)
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
            disabled={isLoading}
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
              setGeneratedFileName("")
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                handleClose()
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                if (!isLoading) {
                  handleGenerate()
                }
              }
            }}
            placeholder="Texto para convertir a audio..."
            disabled={isLoading}
            rows={8}
            className="w-full bg-background-tertiary border border-background rounded-md p-3 text-text-primary placeholder-text-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          {error && (
            <div className="bg-red-900/20 border border-red-800 p-3 rounded-md">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {generatedFileName && (
            <div className="bg-green-900/20 border border-green-800 p-3 rounded-md">
              <p className="text-green-300 text-sm">Audio generado: {generatedFileName}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-background-tertiary">
          <Button onClick={handleClose} variant="secondary" disabled={isLoading}>
            Cerrar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !text.trim() || !selectedModel || !canSaveToCurrentFolder}
            leftIcon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          >
            {isLoading ? "Generando..." : "Generar WAV"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TtsModal
