"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { useGroqModels } from "../hooks/useGroqModels"
import { saveSelectedModel, getSelectedModel } from "../utils/storage"
import Button from "./ui/Button"
import { supportsVision } from "../utils/groqModels"

interface ModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  type: "transcription" | "chat"
  className?: string
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, type, className }) => {
  const { models, actualizarModelos, error } = useGroqModels()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Cargar modelo guardado al inicializar
  useEffect(() => {
    const savedModel = getSelectedModel(type)
    if (savedModel && !value) {
      onChange(savedModel)
      console.log(`Modelo ${type} cargado desde storage:`, savedModel)
    }
  }, [type, onChange, value])

  // Guardar modelo cuando cambie
  const handleModelChange = (modelId: string) => {
    onChange(modelId)
    if (modelId) {
      saveSelectedModel(type, modelId)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await actualizarModelos()
    setIsRefreshing(false)
  }

  // Obtener modelos según el tipo
  const getAvailableModels = () => {
    if (type === "transcription") {
      return models.transcription
    } else {
      // Para chat, incluir tanto modelos de chat como de visión
      return [...models.chat, ...models.vision]
    }
  }

  const availableModels = getAvailableModels()

  // Verificar si el modelo soporta visión
  const modelSupportsVision = (modelId: string) => {
    // Usar la función centralizada de supportsVision
    return supportsVision(modelId)
  }

  // Función para obtener el nombre amigable del modelo
  const getModelDisplayName = (modelId: string) => {
    const nameMap: Record<string, string> = {
      "whisper-large-v3-turbo": "Whisper Large v3 Turbo",
      "distil-whisper-large-v3-en": "Distil Whisper Large v3 EN",
      "llama-3.1-8b-instant": "Llama 3.1 8B Instant",
      "llama-3.3-70b-versatile": "Llama 3.3 70B Versatile",
      "llama-3.2-11b-vision-preview": "🖼️ Llama 3.2 11B Vision",
      "llama-3.2-90b-vision-preview": "🖼️ Llama 3.2 90B Vision",
      "llama-3.2-1b-preview": "Llama 3.2 1B Preview",
      "llama-3.2-3b-preview": "Llama 3.2 3B Preview",
      "mixtral-8x7b-32768": "Mixtral 8x7B",
      "gemma2-9b-it": "Gemma 2 9B IT",
      "qwen2.5-72b-instruct": "🇪🇸 Qwen 2.5 72B Instruct",
      "deepseek-r1-distill-llama-70b": "DeepSeek R1 Distill Llama 70B",
      "meta-llama/llama-4-scout-17b-16e-instruct": "🖼️ Llama 4 Scout 17B",
      "meta-llama/llama-4-scout-70b-16e-instruct": "🖼️ Llama 4 Scout 70B",
    }

    // Si el modelo no está en el mapa pero contiene "vision", agregar el icono
    if (!nameMap[modelId] && modelSupportsVision(modelId)) {
      return `🖼️ ${modelId}`
    }

    return nameMap[modelId] || modelId
  }

  // Función para obtener la descripción del modelo
  const getModelDescription = (modelId: string) => {
    const descMap: Record<string, string> = {
      "whisper-large-v3-turbo": "Velocidad alta, muy buena precisión",
      "distil-whisper-large-v3-en": "Optimizado para inglés, muy rápido",
      "llama-3.1-8b-instant": "Modelo rápido y eficiente",
      "llama-3.3-70b-versatile": "Modelo versátil para tareas complejas",
      "llama-3.2-11b-vision-preview": "Análisis de imágenes y texto",
      "llama-3.2-90b-vision-preview": "Análisis avanzado de imágenes y texto",
      "llama-3.2-1b-preview": "Modelo ligero para tareas básicas",
      "llama-3.2-3b-preview": "Modelo compacto y eficiente",
      "mixtral-8x7b-32768": "Balance velocidad/calidad, contexto largo",
      "gemma2-9b-it": "Buen balance calidad/creatividad",
      "qwen2.5-72b-instruct": "🇪🇸 Excelente para español y múltiples idiomas",
      "deepseek-r1-distill-llama-70b": "Modelo de razonamiento avanzado",
      "meta-llama/llama-4-scout-17b-16e-instruct": "Modelo multimodal avanzado",
      "meta-llama/llama-4-scout-70b-16e-instruct": "Modelo multimodal de alta capacidad",
    }

    // Si el modelo no está en el mapa pero contiene "vision", indicar que soporta visión
    if (!descMap[modelId] && modelId.includes("vision")) {
      return "Modelo con soporte para análisis de imágenes"
    }

    const baseDesc = descMap[modelId] || "Modelo disponible en Groq"

    // Agregar indicador de visión si corresponde
    if (modelSupportsVision(modelId)) {
      return `${baseDesc} (🖼️ Soporta imágenes)`
    }

    return baseDesc
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={`model-select-${type}`} className="block text-sm font-medium text-text-primary">
          Modelo de {type === "transcription" ? "transcripción" : "chat"}:
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={models.isLoading || isRefreshing}
          className="p-1"
          title="Actualizar modelos"
        >
          <RefreshCw size={14} className={`${models.isLoading || isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <select
        id={`model-select-${type}`}
        className="w-full bg-background-tertiary text-text-primary rounded px-2 py-1 focus:outline-none border border-background-tertiary focus:border-primary"
        value={value}
        onChange={(e) => handleModelChange(e.target.value)}
        disabled={models.isLoading}
      >
        <option value="" disabled>
          {models.isLoading ? "Cargando modelos..." : "— Selecciona un modelo —"}
        </option>
        {availableModels.map((model) => (
          <option key={model.id} value={model.id}>
            {getModelDisplayName(model.id)}
          </option>
        ))}
      </select>

      {value && <p className="text-xs text-text-tertiary mt-1">{getModelDescription(value)}</p>}

      {error && <p className="text-xs text-red-400 mt-1">Error: {error}</p>}

      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-text-tertiary">
          {type === "transcription"
            ? "Modelo para transcribir audio a texto."
            : "Modelos con 🖼️ soportan análisis de imágenes"}
        </p>
        {models.lastUpdated && <p className="text-xs text-text-tertiary">{availableModels.length} disponibles</p>}
      </div>
    </div>
  )
}

export default ModelSelector
