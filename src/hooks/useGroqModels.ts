"use client"

// hooks/useGroqModels.ts
import { useEffect, useState } from "react"
import { useStore } from "@nanostores/react"
import { models, setModels } from "../store/models"
import { fetchGroqModels, categorizeModels, FALLBACK_MODELS } from "../utils/groqModels"

export function useGroqModels() {
  const modelStore = useStore(models)
  const [error, setError] = useState<string | null>(null)

  const actualizarModelos = async () => {
    try {
      setError(null)
      setModels({ isLoading: true })

      const groqModels = await fetchGroqModels()

      if (groqModels.length === 0) {
        // Usar modelos de fallback si no se pueden obtener de la API
        console.warn("Usando modelos de fallback")
        setModels({
          transcription: FALLBACK_MODELS.transcription.map((m) => ({
            id: m.id,
            object: "model",
            owned_by: "groq",
            root: m.id,
            parent: null,
          })),
          chat: FALLBACK_MODELS.chat.map((m) => ({
            id: m.id,
            object: "model",
            owned_by: "groq",
            root: m.id,
            parent: null,
          })),
          vision: FALLBACK_MODELS.vision.map((m) => ({
            id: m.id,
            object: "model",
            owned_by: "groq",
            root: m.id,
            parent: null,
          })),
          isLoading: false,
          lastUpdated: Date.now(),
        })
        return
      }

      const categorized = categorizeModels(groqModels)

      setModels({
        transcription: categorized.transcription,
        chat: categorized.chat,
        vision: categorized.vision,
        isLoading: false,
        lastUpdated: Date.now(),
      })

      console.log("Modelos actualizados:", {
        transcription: categorized.transcription.length,
        chat: categorized.chat.length,
        vision: categorized.vision.length,
      })
    } catch (err: any) {
      console.error("Error actualizando modelos:", err)
      setError(err.message)
      setModels({ isLoading: false })
    }
  }

  // Cargar modelos al montar el componente
  useEffect(() => {
    if (modelStore.lastUpdated === null) {
      actualizarModelos()
    }
  }, [])

  return {
    models: modelStore,
    actualizarModelos,
    error,
  }
}
