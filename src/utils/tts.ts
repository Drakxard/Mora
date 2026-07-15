export interface TtsAudioResponse {
  audio: ArrayBuffer
  contentType: string
}

export interface AzureTtsVoice {
  name: string
  displayName: string
  localName: string
  shortName: string
  gender: string
  locale: string
  localeName: string
  styleList?: string[]
  sampleRateHertz?: string
  voiceType?: string
  status?: string
  wordsPerMinute?: string
}

export interface AzureTtsLimitInfo {
  tier: "F0" | "S0" | string
  transactionsLabel: string
  maxAudioLengthLabel: string
  details: string
}

const parseJsonError = async (response: Response, fallback: string) => {
  try {
    const data = await response.clone().json()
    return data?.error || data?.message || fallback
  } catch {
    const text = await response.text().catch(() => "")
    return text || fallback
  }
}

export async function fetchAzureSpanishVoices(): Promise<AzureTtsVoice[]> {
  const response = await fetch("/api/azure-tts/voices")

  if (!response.ok) {
    throw new Error(await parseJsonError(response, "No se pudieron cargar las voces de Azure Speech."))
  }

  const data = await response.json()
  return Array.isArray(data.voices) ? data.voices : []
}

export async function fetchAzureTtsLimits(): Promise<AzureTtsLimitInfo> {
  const response = await fetch("/api/azure-tts/limits")

  if (!response.ok) {
    throw new Error(await parseJsonError(response, "No se pudieron consultar los limites de Azure Speech."))
  }

  return response.json()
}

export async function generateTtsAudio(input: string, voiceShortName: string): Promise<TtsAudioResponse> {
  const text = input.trim()
  if (!text) {
    throw new Error("Ingresa texto para generar el audio.")
  }

  if (!voiceShortName) {
    throw new Error("Selecciona una voz TTS primero.")
  }

  const response = await fetch("/api/azure-tts/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice: voiceShortName,
    }),
  })

  if (!response.ok) {
    throw new Error(await parseJsonError(response, `Error ${response.status}: ${response.statusText}`))
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/wav",
  }
}
