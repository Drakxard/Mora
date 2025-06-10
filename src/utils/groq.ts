// src/utils/groq.ts
import { getApiKey } from "./storage"

export interface GroqModel {
  id: string // ej. "mixtral-8x7b-8192"
  object: string // ej. "model"
  owned_by: string // ej. "groq"
  root: string
  parent: string | null
}

export interface ListModelsResponse {
  data: GroqModel[]
  object: string
}

/**
 * Recupera la lista completa de modelos desde Groq/OpenAI.
 * Devuelve un array de objetos con la forma { id, object, owned_by, ... }.
 */
export async function listModels(): Promise<GroqModel[]> {
  try {
    // ✅ Usar la API key del usuario dinámicamente
    const apiKey = getApiKey()

    if (!apiKey) {
      console.error("[listModels] No hay API key configurada")
      return []
    }

    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`, // ✅ USA LA API KEY DEL USUARIO
      },
    })

    if (!res.ok) {
      // Si la respuesta no es 2xx, leemos el texto para debug y devolvemos array vacío
      const textoError = await res.text()
      console.error("[listModels] Error al listar modelos:", textoError)
      return []
    }

    const json: ListModelsResponse = await res.json()
    return json.data
  } catch (error) {
    console.error("[listModels] Falló la petición:", error)
    return []
  }
}
