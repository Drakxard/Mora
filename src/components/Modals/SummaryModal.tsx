"use client"

// src/components/Modals/SummaryModal.tsx

import type React from "react"
import { useState } from "react"
import { X, FileAudio, Download } from 'lucide-react'
import type { FileItem, SummaryResponse } from "../../types"
import Button from "./ui/Button"
import { generateSummary } from "../../utils/chat"

interface SummaryModalProps {
  isOpen: boolean
  onClose: () => void
  files: FileItem[]
  selectedModel: string // Nuevo prop: modelo elegido
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, files, selectedModel }) => {
  const [context, setContext] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * buildFileArray(): baja cada URL de FileItem como un Blob real, y construye
   * un array de objetos File válidos para enviarlos al servidor.
   */
  const buildFileArray = async (): Promise<File[]> => {
    if (files.length === 0) return []

    const filePromises = files.map(async (f) => {
      if (!f.url) {
        throw new Error(`La URL del archivo "${f.name}" está indefinida.`)
      }

      // Intentamos descargar la URL. Debe ser una URL válida (blob: o http:).
      const resp = await fetch(f.url)
      if (!resp.ok) {
        throw new Error(`Error al descargar "${f.name}". HTTP ${resp.status}`)
      }

      const blob = await resp.blob()
      return new File([blob], f.name, { type: f.type })
    })

    return Promise.all(filePromises)
  }

  const handleGenerateSummary = async () => {
    setError(null)
    setSummary(null)

    if (!selectedModel) {
      setError("Debes seleccionar un modelo antes de generar el resumen.")
      return
    }

    setIsLoading(true)

    try {
      // 1) Construir los archivos reales (File[]) a partir de las URLs
      const fileArray: File[] = await buildFileArray()

      // 2) Llamada a generateSummary usando el modelo seleccionado
      const response: SummaryResponse = await generateSummary(selectedModel, fileArray, context)

      setSummary(response)
    } catch (err: any) {
      const mensajeInterno = err?.message?.trim() ? err.message : JSON.stringify(err, Object.getOwnPropertyNames(err))
      setError(`No fue posible generar el resumen. (${mensajeInterno})`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    if (!summary) return

    const contenido = [
      "Resumen de Audios",
      "",
      summary.summary,
      "",
      "Archivos incluidos:",
      ...summary.metadata.map((m) => `- ${m.fileName}`),
    ].join("\n")

    const blob = new Blob([contenido], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "resumen-audios.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative bg-background-secondary w-full max-w-2xl max-h-[80vh] rounded-lg shadow-xl overflow-hidden">
        {/* HEADER DEL MODAL */}
        <div className="flex items-center justify-between p-4 border-b border-background-tertiary">
          <h2 className="text-lg font-medium text-text-primary">Generar resumen de audios</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-background-tertiary transition-colors">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className="p-4">
          {/* 1. Archivos seleccionados */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Archivos seleccionados:</h3>
            {files.length === 0 ? (
              <p className="text-text-secondary text-sm">No hay archivos seleccionados.</p>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <div key={file.path} className="flex items-center p-2 rounded bg-background-tertiary">
                    <FileAudio size={16} className="text-primary mr-2" />
                    <span className="text-text-primary text-sm">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Selector de modelo */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Modelo seleccionado:</h3>
            <div className="flex items-center space-x-2">
              <span className="text-text-primary text-sm">{selectedModel || "— Ninguno —"}</span>
            </div>
          </div>

          {/* 3. Textarea para contexto/instrucciones opcional */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Contexto o instrucciones (opcional):
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ej.: Resúmeme los puntos clave de estas reuniones..."
              className="w-full bg-background-tertiary rounded-lg p-3 text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
            />
          </div>

          {/* 4. Mensaje de error (si existe) */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-md">
              <p className="text-red-300 text-sm whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {/* 5. Mostrar el resumen si ya se generó */}
          {summary && (
            <div className="mb-4">
              <div className="bg-background-tertiary rounded-lg p-4 max-h-60 overflow-y-auto">
                <p className="text-text-primary whitespace-pre-wrap">{summary.summary}</p>
              </div>
              <Button onClick={handleDownload} className="mt-3" leftIcon={<Download size={16} />}>
                Descargar resumen
              </Button>
            </div>
          )}
        </div>

        {/* FOOTER DEL MODAL */}
        <div className="flex justify-end gap-3 p-4 border-t border-background-tertiary">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerateSummary}
            isLoading={isLoading}
            disabled={isLoading || files.length === 0 || !selectedModel}
          >
            Generar resumen
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SummaryModal
