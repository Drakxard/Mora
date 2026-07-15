const getAzureConfig = () => {
  const key = process.env.clave || process.env.AZURE_SPEECH_KEY
  const region = process.env.zona || process.env.AZURE_SPEECH_REGION

  if (!key || !region) {
    return { error: "Faltan variables `clave` y/o `zona` en Vercel." }
  }

  return { key, region }
}

const escapeXml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString("utf8")
  return rawBody ? JSON.parse(rawBody) : {}
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Metodo no permitido." })
  }

  const config = getAzureConfig()
  if (config.error) {
    return res.status(500).json({ error: config.error })
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    return res.status(400).json({ error: "JSON invalido." })
  }

  const text = typeof body.text === "string" ? body.text.trim() : ""
  const voice = typeof body.voice === "string" ? body.voice.trim() : ""

  if (!text) {
    return res.status(400).json({ error: "Ingresa texto para generar el audio." })
  }

  if (!voice) {
    return res.status(400).json({ error: "Selecciona una voz TTS primero." })
  }

  const voiceLocale = voice.match(/^([a-z]{2}-[A-Z]{2})-/)?.[1] || "es-ES"
  const ssml = `<speak version="1.0" xml:lang="${voiceLocale}" xmlns="http://www.w3.org/2001/10/synthesis"><voice name="${escapeXml(
    voice,
  )}">${escapeXml(text)}</voice></speak>`

  const response = await fetch(`https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
      "User-Agent": "Mora",
    },
    body: ssml,
  })

  if (!response.ok) {
    const azureText = await response.text().catch(() => "")
    const message =
      response.status === 401 || response.status === 403
        ? "Clave o zona de Azure Speech invalida."
        : response.status === 429
          ? "Azure Speech limito la solicitud; espera y reintenta."
          : azureText || `Error ${response.status}: ${response.statusText}`
    return res.status(response.status).json({ error: message })
  }

  const audio = Buffer.from(await response.arrayBuffer())
  res.setHeader("Content-Type", "audio/wav")
  res.setHeader("Cache-Control", "no-store")
  return res.status(200).send(audio)
}
