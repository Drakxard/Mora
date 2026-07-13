import { getApiKey } from "./storage"

export interface TtsAudioResponse {
  audio: ArrayBuffer
  contentType: string
}

export const TTS_VOICE = "abdullah"
export const TTS_RESPONSE_FORMAT = "wav"

export async function generateTtsAudio(input: string, model: string): Promise<TtsAudioResponse> {
  const apiKey = getApiKey()

  if (!apiKey) {
    throw new Error("API key de Groq no encontrada. Configura tu API key en los ajustes de la aplicación.")
  }

  const text = input.trim()
  if (!text) {
    throw new Error("Ingresa texto para generar el audio.")
  }

  if (!model) {
    throw new Error("Selecciona un modelo TTS primero.")
  }

  const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice: TTS_VOICE,
      input: text,
      response_format: TTS_RESPONSE_FORMAT,
    }),
  })

  if (!response.ok) {
    let message = `Error ${response.status}: ${response.statusText}`

    try {
      const errorData = await response.clone().json()
      if (response.status === 401) {
        message = "API key inválida. Verifica tu configuración."
      } else if (response.status === 429) {
        message = "Límite de solicitudes alcanzado. Espera un momento antes de intentar nuevamente."
      } else if (response.status === 400) {
        message = errorData.error?.message || "Solicitud inválida. Verifica el texto y el modelo TTS."
      } else {
        message = errorData.error?.message || message
      }
    } catch {
      const errorText = await response.text().catch(() => "")
      if (errorText) {
        message = errorText
      }
    }

    throw new Error(message)
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/wav",
  }
}
