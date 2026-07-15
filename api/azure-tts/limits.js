module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Metodo no permitido." })
  }

  const tier = (process.env.AZURE_SPEECH_TIER || "F0").toUpperCase()

  if (tier === "S0") {
    return res.status(200).json({
      tier,
      transactionsLabel: "200 TPS default",
      maxAudioLengthLabel: "10 min por request",
      details: "El limite S0 de TTS real-time es ajustable hasta 1.000 TPS mediante solicitud de cuota.",
    })
  }

  return res.status(200).json({
    tier: "F0",
    transactionsLabel: "20 transacciones / 60s",
    maxAudioLengthLabel: "10 min por request",
    details: "El limite F0 de Azure Speech no es ajustable.",
  })
}
