import type { TranscriptionResponse } from "../types"

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB limit for Groq API

export const transcribeAudio = async (
  audioFile: File,
  model = "whisper-large-v3-turbo",
): Promise<TranscriptionResponse> => {
  try {
    console.log("[transcribeAudio] Iniciando transcripción...")
    console.log("[transcribeAudio] Archivo:", audioFile.name, audioFile.size, "bytes")
    console.log("[transcribeAudio] Tipo:", audioFile.type)
    console.log("[transcribeAudio] Modelo:", model)

    // Verificar API key
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      throw new Error(
        "API key de Groq no encontrada. Asegúrate de que VITE_GROQ_API_KEY esté configurada en tu archivo .env",
      )
    }

    // Verificar tamaño del archivo
    if (audioFile.size > MAX_FILE_SIZE) {
      throw new Error(
        `El archivo es demasiado grande. El tamaño máximo permitido es ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      )
    }

    // Verificar que el archivo no esté vacío
    if (audioFile.size === 0) {
      throw new Error("El archivo está vacío.")
    }

    console.log("[transcribeAudio] Preparando FormData...")
    const formData = new FormData()
    formData.append("file", audioFile)
    formData.append("model", model)
    formData.append("language", "es")

    console.log("[transcribeAudio] Enviando petición a Groq...")
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
      },
      body: formData,
    })

    console.log("[transcribeAudio] Respuesta recibida:", response.status, response.statusText)

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}`

      try {
        const errorData = await response.json()
        console.error("[transcribeAudio] Error data:", errorData)

        if (response.status === 503) {
          errorMessage =
            "El servicio de transcripción está temporalmente no disponible. Intenta nuevamente en unos minutos."
        } else if (response.status === 401) {
          errorMessage = "API key inválida. Verifica tu configuración de VITE_GROQ_API_KEY."
        } else if (response.status === 429) {
          errorMessage = "Has excedido el límite de solicitudes. Espera un momento antes de intentar nuevamente."
        } else if (response.status === 400) {
          errorMessage = errorData.error?.message || "Error en la solicitud. Verifica el formato del archivo."
        } else {
          errorMessage = errorData.error?.message || errorMessage
        }
      } catch (parseError) {
        console.error("[transcribeAudio] Error parsing error response:", parseError)
      }

      throw new Error(errorMessage)
    }

    console.log("[transcribeAudio] Parseando respuesta...")
    const data = await response.json()
    console.log("[transcribeAudio] Datos recibidos:", data)

    if (!data.text) {
      throw new Error("La respuesta no contiene texto transcrito.")
    }

    console.log("[transcribeAudio] Transcripción exitosa, longitud:", data.text.length)
    return {
      text: data.text,
    }
  } catch (error: any) {
    console.error("[transcribeAudio] Error completo:", error)
    return {
      text: "",
      error: error.message || "No se pudo transcribir el audio. Verifica tu conexión y configuración.",
    }
  }
}
