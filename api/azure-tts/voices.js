const getAzureConfig = () => {
  const key = process.env.clave || process.env.AZURE_SPEECH_KEY
  const region = process.env.zona || process.env.AZURE_SPEECH_REGION

  if (!key || !region) {
    return { error: "Faltan variables `clave` y/o `zona` en Vercel." }
  }

  return { key, region }
}

const normalizeVoice = (voice) => ({
  name: voice.Name || "",
  displayName: voice.DisplayName || "",
  localName: voice.LocalName || "",
  shortName: voice.ShortName || "",
  gender: voice.Gender || "",
  locale: voice.Locale || "",
  localeName: voice.LocaleName || "",
  styleList: voice.StyleList || [],
  sampleRateHertz: voice.SampleRateHertz || "",
  voiceType: voice.VoiceType || "",
  status: voice.Status || "",
  wordsPerMinute: voice.WordsPerMinute || "",
})

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Metodo no permitido." })
  }

  const config = getAzureConfig()
  if (config.error) {
    return res.status(500).json({ error: config.error })
  }

  const response = await fetch(
    `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    {
      headers: {
        "Ocp-Apim-Subscription-Key": config.key,
      },
    },
  )

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? "Clave o zona de Azure Speech invalida."
        : response.status === 429
          ? "Azure Speech limito la solicitud; espera y reintenta."
          : `Error ${response.status}: ${response.statusText}`
    return res.status(response.status).json({ error: message })
  }

  const voices = await response.json()
  const spanishVoices = voices
    .filter((voice) => typeof voice.Locale === "string" && voice.Locale.startsWith("es-"))
    .map(normalizeVoice)
    .sort((a, b) => {
      const localeCompare = a.locale.localeCompare(b.locale)
      if (localeCompare !== 0) return localeCompare
      return (a.localName || a.displayName || a.shortName).localeCompare(b.localName || b.displayName || b.shortName)
    })

  return res.status(200).json({ voices: spanishVoices })
}
