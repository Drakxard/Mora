"use client"

import type React from "react"
import { useRef } from "react"
import { Mic, X } from "lucide-react"

interface AudioUploadProps {
  onAudioSelect: (file: File) => void
  onAudioRemove: () => void
  audioFile: File | null
  disabled?: boolean
  supportsAudio?: boolean
}

const AudioUpload: React.FC<AudioUploadProps> = ({
  onAudioSelect,
  onAudioRemove,
  audioFile,
  disabled = false,
  supportsAudio = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAudioSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type.startsWith("audio/")) {
        if (file.size > 25 * 1024 * 1024) {
          alert("El archivo de audio es demasiado grande. El tamaño máximo es 25MB.")
          return
        }
        onAudioSelect(file)
      } else {
        alert("Por favor selecciona un archivo de audio válido.")
      }
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  if (!supportsAudio) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {/* Preview compacto de audio */}
      {audioFile && (
        <div className="relative flex items-center bg-background-tertiary rounded px-2 py-1">
          <Mic size={12} className="text-primary mr-1" />
          <span className="text-xs text-text-primary truncate max-w-[60px]">{audioFile.name}</span>
          <button
            onClick={onAudioRemove}
            className="ml-1 p-0.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
            title="Eliminar audio"
          >
            <X size={8} />
          </button>
        </div>
      )}

      {/* Botón compacto para subir */}
      <button
        type="button"
        onClick={triggerFileInput}
        disabled={disabled}
        className="p-2 rounded-full bg-background-tertiary hover:bg-background-tertiary/80 transition-colors disabled:opacity-50"
        title={audioFile ? "Cambiar audio" : "Subir audio"}
      >
        <Mic size={16} className="text-text-secondary" />
      </button>

      {/* Input oculto */}
      <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />
    </div>
  )
}

export default AudioUpload
