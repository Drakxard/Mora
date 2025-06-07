"use client"

import type React from "react"
import { useRef } from "react"
import { ImagePlus, X } from "lucide-react"

interface ImageUploadProps {
  onImageSelect: (file: File) => void
  onImageRemove: () => void
  imagePreview: string | null
  disabled?: boolean
  supportsVision?: boolean
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelect,
  onImageRemove,
  imagePreview,
  disabled = false,
  supportsVision = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type.startsWith("image/")) {
        if (file.size > 10 * 1024 * 1024) {
          alert("La imagen es demasiado grande. El tamaño máximo es 10MB.")
          return
        }
        onImageSelect(file)
      } else {
        alert("Por favor selecciona un archivo de imagen válido.")
      }
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  if (!supportsVision) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {/* Preview compacto de imagen */}
      {imagePreview && (
        <div className="relative">
          <img
            src={imagePreview || "/placeholder.svg"}
            alt="Preview"
            className="w-8 h-8 object-cover rounded border border-background-tertiary"
          />
          <button
            onClick={onImageRemove}
            className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
            title="Eliminar imagen"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Botón compacto para subir */}
      <button
        type="button"
        onClick={triggerFileInput}
        disabled={disabled}
        className="p-2 rounded-full bg-background-tertiary hover:bg-background-tertiary/80 transition-colors disabled:opacity-50"
        title={imagePreview ? "Cambiar imagen" : "Subir imagen"}
      >
        <ImagePlus size={16} className="text-text-secondary" />
      </button>

      {/* Input oculto */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
    </div>
  )
}

export default ImageUpload
