"use client"

import type React from "react"
import { useState } from "react"
import { AlertCircle, ExternalLink, Eye, EyeOff, Key, Save } from "lucide-react"
import Button from "../ui/Button"
import { saveUserApiKey } from "../../utils/storage"

interface ApiKeySetupModalProps {
  isOpen: boolean
  onComplete: () => void
}

const ApiKeySetupModal: React.FC<ApiKeySetupModalProps> = ({ isOpen, onComplete }) => {
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  if (!isOpen) return null

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError("Ingresa una API key valida.")
      return
    }

    if (!apiKey.startsWith("gsk_")) {
      setError('La API key de Groq debe comenzar con "gsk_".')
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const testResponse = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
      })

      if (!testResponse.ok) {
        throw new Error("API key invalida o sin permisos")
      }

      saveUserApiKey(apiKey.trim())
      onComplete()
    } catch (error: any) {
      setError(`Error verificando API key: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const openGroqConsole = () => {
    window.open("https://console.groq.com/keys", "_blank")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg border border-background-tertiary bg-background-secondary shadow-xl">
        <div className="p-6">
          <div className="mb-6 flex items-center">
            <Key size={24} className="mr-3 text-primary" />
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Configuracion inicial</h2>
              <p className="text-sm text-text-secondary">No se encontro una API key de Groq configurada</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-4">
              <div className="flex items-start">
                <AlertCircle size={20} className="mr-3 mt-0.5 flex-shrink-0 text-blue-400" />
                <div className="text-sm">
                  <p className="mb-2 font-medium text-blue-300">API key requerida</p>
                  <p className="mb-3 text-blue-200">
                    En Vercel configura <span className="font-mono">VITE_GROQ_API_KEY</span>. En local tambien puedes
                    ingresar una API key manual para usar transcripcion, chat y TTS.
                  </p>
                  <Button
                    onClick={openGroqConsole}
                    variant="secondary"
                    size="sm"
                    leftIcon={<ExternalLink size={16} />}
                    className="border-blue-600 text-blue-300 hover:bg-blue-800/30"
                  >
                    Obtener API key gratuita
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">Tu API Key de Groq</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value)
                    setError("")
                  }}
                  placeholder="gsk_..."
                  className="w-full rounded-md border border-background bg-background-tertiary px-3 py-3 pr-10 text-text-primary placeholder-text-tertiary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary transition-colors hover:text-text-primary"
                  disabled={isLoading}
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-text-tertiary">
                Si Vercel tiene <span className="font-mono">VITE_GROQ_API_KEY</span>, este paso no aparecera.
              </p>
            </div>

            {error && (
              <div className="flex items-center rounded-md border border-red-800 bg-red-900/20 p-3">
                <AlertCircle size={16} className="mr-2 flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={!apiKey.trim() || isLoading}
              leftIcon={<Save size={18} />}
              className="w-full"
            >
              {isLoading ? "Verificando..." : "Guardar y continuar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiKeySetupModal
