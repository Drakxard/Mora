// utils/groqModels.ts

export interface GroqModel {
  id: string
  object: string
  owned_by: string
  root: string
  parent: string | null
  input_modalities?: string[] // Campo para detectar capacidades multimodales
  context_window?: number
  pricing?: {
    prompt: number
    completion: number
  }
}

export interface GroqModelsResponse {
  data: GroqModel[]
  object: string
}

export async function fetchGroqModels(): Promise<GroqModel[]> {
  try {
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      console.warn("VITE_GROQ_API_KEY no está configurada")
      return []
    }

    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText}`)
    }

    const data: GroqModelsResponse = await res.json()
    console.log("Modelos obtenidos de Groq:", data.data.length)

    // Obtener metadatos detallados para cada modelo
    const modelsWithMetadata = await Promise.all(
      data.data.map(async (model) => {
        try {
          const detailRes = await fetch(`https://api.groq.com/openai/v1/models/${model.id}`, {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
          })

          if (detailRes.ok) {
            const detailData = await detailRes.json()
            return {
              ...model,
              input_modalities: detailData.input_modalities || ["text"],
              context_window: detailData.context_window,
            }
          }
          return model
        } catch (error) {
          console.warn(`No se pudo obtener metadatos para ${model.id}:`, error)
          return model
        }
      }),
    )

    return modelsWithMetadata
  } catch (error) {
    console.error("Error obteniendo modelos de Groq:", error)
    return []
  }
}

// Mejorar la función categorizeModels para detectar mejor los modelos de visión
export function categorizeModels(models: GroqModel[]) {
  const transcriptionModels = models.filter(
    (model) => model.id.includes("whisper") || model.id.includes("distil-whisper"),
  )

  // Detectar modelos de visión usando input_modalities
  const visionModels = models.filter(
    (model) =>
      (model.input_modalities && model.input_modalities.includes("image")) ||
      model.id.includes("vision") ||
      model.id === "llama-3.2-11b-vision-preview" ||
      model.id === "llama-3.2-90b-vision-preview" ||
      (model.id.includes("llama-3.2") && (model.id.includes("11b-vision") || model.id.includes("90b-vision"))) ||
      model.id.includes("meta-llama/llama-4-scout") ||
      model.id.includes("meta-llama/llama-4-maverick"),
  )

  // Modelos de chat (excluyendo los de visión y transcripción)
  const chatModels = models.filter(
    (model) =>
      !model.id.includes("whisper") &&
      !model.id.includes("distil-whisper") &&
      !visionModels.some((vm) => vm.id === model.id) &&
      (model.id.includes("llama") ||
        model.id.includes("mixtral") ||
        model.id.includes("gemma") ||
        model.id.includes("qwen") ||
        model.id.includes("deepseek") ||
        model.id.includes("allam") ||
        model.id.includes("compuesto")),
  )

  console.log("Modelos categorizados:", {
    transcription: transcriptionModels.map((m) => m.id),
    chat: chatModels.map((m) => m.id),
    vision: visionModels.map((m) => m.id),
  })

  return {
    transcription: transcriptionModels,
    chat: chatModels,
    vision: visionModels,
  }
}

// Función para verificar si un modelo soporta visión
export function supportsVision(model: GroqModel | string): boolean {
  const modelId = typeof model === "string" ? model : model.id

  // Lista específica de modelos que soportan imágenes basada en tu lista
  const knownVisionModels = [
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview",
  ]

  // Verificar si está en la lista conocida
  if (knownVisionModels.includes(modelId)) {
    return true
  }

  // Verificar por patrones en el nombre
  if (
    modelId.includes("vision") ||
    modelId.includes("scout") ||
    modelId.includes("maverick") ||
    (modelId.includes("llama-3.2") && (modelId.includes("11b") || modelId.includes("90b")))
  ) {
    return true
  }

  // Si tenemos el objeto completo con input_modalities
  if (typeof model === "object" && model.input_modalities) {
    return model.input_modalities.includes("image")
  }

  return false
}

// Función para verificar si un modelo soporta audio
export function supportsAudio(model: GroqModel | string): boolean {
  const modelId = typeof model === "string" ? model : model.id

  // Lista específica de modelos que soportan audio basada en tu lista
  const knownAudioModels = [
    "distil-whisper-large-v3-en", // audio+texto
    "playai-tts", // texto+audio
    "playai-tts-arabic", // texto+audio
    "whisper-large-v3", // audio+texto
    "whisper-large-v3-turbo", // audio+texto
  ]

  // Verificar si está en la lista conocida
  if (knownAudioModels.includes(modelId)) {
    return true
  }

  // Verificar por patrones en el nombre
  if (modelId.includes("whisper") || modelId.includes("playai-tts")) {
    return true
  }

  // Si tenemos el objeto completo con input_modalities
  if (typeof model === "object" && model.input_modalities) {
    return model.input_modalities.includes("audio")
  }

  return false
}

// Función para obtener las capacidades de un modelo
export function getModelCapabilities(model: GroqModel | string): {
  text: boolean
  image: boolean
  audio: boolean
} {
  return {
    text: true, // Todos los modelos soportan texto
    image: supportsVision(model),
    audio: supportsAudio(model),
  }
}

// Modelos de fallback si la API no responde
export const FALLBACK_MODELS = {
  transcription: [
    {
      id: "whisper-large-v3-turbo",
      name: "Whisper Large v3 Turbo",
      description: "Velocidad alta, muy buena precisión",
    },
  ],
  chat: [
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B Instant",
      description: "Modelo rápido y eficiente",
    },
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B Versatile",
      description: "Modelo versátil para tareas complejas",
    },
    {
      id: "qwen2.5-72b-instruct",
      name: "Qwen 2.5 72B Instruct",
      description: "Excelente para español",
    },
  ],
  vision: [
    {
      id: "meta-llama/llama-4-maverick-17b-128e-instruct",
      name: "Llama 4 Maverick 17B",
      description: "Modelo multimodal avanzado",
    },
    {
      id: "meta-llama/llama-4-scout-17b-16e-instruct",
      name: "Llama 4 Scout 17B",
      description: "Modelo multimodal avanzado",
    },
  ],
}
