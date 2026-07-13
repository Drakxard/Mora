import { getApiKey } from "./storage"

export interface TtsAudioResponse {
  audio: ArrayBuffer
  contentType: string
  rateLimit?: GroqRateLimitInfo
}

export interface GroqRateLimitInfo {
  limitRequests?: number
  remainingRequests?: number
  resetRequests?: string
  limitTokens?: number
  remainingTokens?: number
  resetTokens?: string
  retryAfter?: string
}

export const TTS_VOICE = "abdullah"
export const TTS_RESPONSE_FORMAT = "wav"

let cachedGroqRateLimit: GroqRateLimitInfo | null = null

const parseRateLimitNumber = (value: string | null) => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const getGroqRateLimitInfo = (headers: Headers): GroqRateLimitInfo => ({
  limitRequests: parseRateLimitNumber(headers.get("x-ratelimit-limit-requests")),
  remainingRequests: parseRateLimitNumber(headers.get("x-ratelimit-remaining-requests")),
  resetRequests: headers.get("x-ratelimit-reset-requests") || undefined,
  limitTokens: parseRateLimitNumber(headers.get("x-ratelimit-limit-tokens")),
  remainingTokens: parseRateLimitNumber(headers.get("x-ratelimit-remaining-tokens")),
  resetTokens: headers.get("x-ratelimit-reset-tokens") || undefined,
  retryAfter: headers.get("retry-after") || undefined,
})

const cacheGroqRateLimitInfo = (rateLimit: GroqRateLimitInfo) => {
  cachedGroqRateLimit = {
    ...cachedGroqRateLimit,
    ...rateLimit,
  }

  return cachedGroqRateLimit
}

export async function fetchGroqRateLimits(): Promise<GroqRateLimitInfo> {
  if (cachedGroqRateLimit) {
    return cachedGroqRateLimit
  }

  const apiKey = getApiKey()

  if (!apiKey) {
    throw new Error("API key de Groq no encontrada. Configura tu API key en los ajustes de la aplicaciÃ³n.")
  }

  const response = await fetch("https://api.groq.com/openai/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  const rateLimit = cacheGroqRateLimitInfo(getGroqRateLimitInfo(response.headers))

  if (!response.ok) {
    const error = new Error(`No se pudieron consultar los limites de Groq: ${response.statusText}`) as Error & {
      rateLimit?: GroqRateLimitInfo
    }
    error.rateLimit = rateLimit
    throw error
  }

  return rateLimit
}

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
    const rateLimit = cacheGroqRateLimitInfo(getGroqRateLimitInfo(response.headers))

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

    const error = new Error(message) as Error & { rateLimit?: GroqRateLimitInfo }
    error.rateLimit = rateLimit
    throw error
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/wav",
    rateLimit: cacheGroqRateLimitInfo(getGroqRateLimitInfo(response.headers)),
  }
}
