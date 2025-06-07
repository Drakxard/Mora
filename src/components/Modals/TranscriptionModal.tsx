"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { X, RefreshCw } from "lucide-react"
import type { FileItem, TranscriptionResponse } from "../../types"
import { transcribeAudio } from "../../utils/transcription"
import Button from "../ui/Button"
import { formatFileSize } from "../../utils/format"

interface TranscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  file: FileItem | null
  onTranscriptionComplete: (file: FileItem, transcription: string) => void
  selectedModel: string
  existingTranscription?: string
}

const TranscriptionModal: React.FC<TranscriptionModalProps> = ({
  isOpen,
  onClose,
  file,
  onTranscriptionComplete,
  selectedModel,
  existingTranscription,
}) => {
  const [transcription, setTranscription] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && file) {
      if (existingTranscription) {
        // Si ya hay una transcripción, mostrarla
        setTranscription(existingTranscription)
        setError("")
      } else {
        // Si no hay transcripción, generar una nueva
        handleTranscribe()
      }
    }
  }, [isOpen, file, existingTranscription])

  const handleTranscribe = async () => {
    if (!file || !file.url) {
      setError("No se pudo acceder al archivo.")
      return
    }

    if (!selectedModel) {
      setError("Por favor, selecciona un modelo de transcripción primero.")
      return
    }

    setIsLoading(true)
    setError("")
    setTranscription("")

    try {
      console.log("Iniciando transcripción para:", file.name)
      console.log("URL del archivo:", file.url)
      console.log("Modelo seleccionado:", selectedModel)

      // Verificar que la API key esté configurada
      if (!import.meta.env.VITE_GROQ_API_KEY) {
        throw new Error("VITE_GROQ_API_KEY no está configurada en las variables de entorno.")
      }

      // Fetch the file as a blob
      const response = await fetch(file.url)
      if (!response.ok) {
        throw new Error(`Error al descargar el archivo: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      console.log("Blob obtenido:", blob.size, "bytes, tipo:", blob.type)

      // Crear el archivo con el tipo correcto
      const audioFile = new File([blob], file.name, {
        type: file.type || blob.type || "audio/mpeg",
      })

      console.log("Archivo creado:", audioFile.name, audioFile.size, "bytes, tipo:", audioFile.type)

      // Call the transcription service
      const result: TranscriptionResponse = await transcribeAudio(audioFile, selectedModel)

      if (result.error) {
        console.error("Error en transcripción:", result.error)
        setError(result.error)
      } else if (result.text) {
        console.log("Transcripción exitosa, longitud:", result.text.length)
        setTranscription(result.text)
        // Notificar al componente padre que la transcripción está completa
        onTranscriptionComplete(file, result.text)
      } else {
        setError("La transcripción está vacía.")
      }
    } catch (err: any) {
      console.error("Error en la transcripción:", err)
      setError(`Error: ${err.message || "No se pudo transcribir el audio. Intenta más tarde."}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = () => {
    handleTranscribe()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative bg-background-secondary w-full max-w-2xl max-h-[80vh] rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-background-tertiary">
          <h2 className="text-lg font-medium text-text-primary">Transcripción de audio</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-background-tertiary transition-colors">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <div className="p-4">
          {file && (
            <div className="mb-4 pb-4 border-b border-background-tertiary">
              <p className="text-text-secondary text-sm">
                Archivo: <span className="text-primary">{file.name}</span>
              </p>
              {file.size && <p className="text-text-tertiary text-sm mt-1">Tamaño: {formatFileSize(file.size)}</p>}
              <p className="text-text-tertiary text-sm mt-1">Modelo: {selectedModel || "No seleccionado"}</p>
              <p className="text-text-tertiary text-sm mt-1">Tipo: {file.type}</p>
              <p className="text-text-tertiary text-sm mt-1">URL disponible: {file.url ? "Sí" : "No"}</p>
              {existingTranscription && (
                <p className="text-green-400 text-sm mt-1">✓ Transcripción guardada disponible</p>
              )}
            </div>
          )}

          <div className="overflow-y-auto max-h-[50vh]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-text-secondary">
                  {existingTranscription ? "Regenerando transcripción..." : "Transcribiendo audio..."}
                </p>
                <p className="text-text-tertiary text-sm mt-2">Esto puede tomar unos momentos...</p>
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-800 p-4 rounded-md">
                <p className="text-red-300 whitespace-pre-wrap">{error}</p>
                <details className="mt-2">
                  <summary className="text-red-400 text-sm cursor-pointer">Información de depuración</summary>
                  <div className="text-red-300 text-xs mt-2">
                    <p>API Key configurada: {import.meta.env.VITE_GROQ_API_KEY ? "Sí" : "No"}</p>
                    <p>Archivo: {file?.name}</p>
                    <p>Tipo: {file?.type}</p>
                    <p>URL: {file?.url ? "Disponible" : "No disponible"}</p>
                    <p>Modelo: {selectedModel}</p>
                  </div>
                </details>
              </div>
            ) : transcription ? (
              <div className="text-text-primary whitespace-pre-wrap bg-background-tertiary p-4 rounded-md">
                {transcription}
              </div>
            ) : (
              <p className="text-text-tertiary text-center py-4">No hay transcripción disponible</p>
            )}
          </div>
        </div>

        <div className="flex justify-between p-4 border-t border-background-tertiary">
          <div>
            {(transcription || error) && !isLoading && (
              <Button onClick={handleRegenerate} variant="secondary" leftIcon={<RefreshCw size={16} />}>
                {error ? "Reintentar" : "Regenerar"}
              </Button>
            )}
          </div>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

export default TranscriptionModal
