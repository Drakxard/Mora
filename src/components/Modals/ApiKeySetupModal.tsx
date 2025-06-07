"use client"

import type React from "react"
import { useState } from "react"
import { Key, Eye, EyeOff, Save, AlertCircle, ExternalLink } from "lucide-react"
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
      setError("Por favor ingresa una API key válida")
      return
    }

    // Validación básica del formato de la API key de Groq
    if (!apiKey.startsWith("gsk_")) {
      setError('La API key de Groq debe comenzar con "gsk_"')
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Verificar que la API key funciona haciendo una petición de prueba
      const testResponse = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
      })

      if (!testResponse.ok) {
        throw new Error("API key inválida o sin permisos")
      }

      // Si la verificación es exitosa, guardar la API key
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
      <div className="relative bg-background-secondary w-full max-w-md rounded-lg shadow-xl border border-background-tertiary">
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Key size={24} className="text-primary mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Configuración inicial</h2>
              <p className="text-sm text-text-secondary">Configura tu API key de Groq para continuar</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle size={20} className="text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-blue-300 font-medium mb-2">¿Por qué necesitas una API key?</p>
                  <p className="text-blue-200 mb-3">
                    Esta aplicación utiliza los servicios de IA de Groq para transcripción y chat. Necesitas tu propia
                    API key para usar estas funciones.
                  </p>
                  <Button
                    onClick={openGroqConsole}
                    variant="secondary"
                    size="sm"
                    leftIcon={<ExternalLink size={16} />}
                    className="text-blue-300 border-blue-600 hover:bg-blue-800/30"
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
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setError("")
                  }}
                  placeholder="gsk_..."
                  className="w-full px-3 py-3 pr-10 bg-background-tertiary border border-background rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary transition-colors"
                  disabled={isLoading}
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-text-tertiary">
                Tu API key se guardará de forma segura en tu dispositivo y nunca se compartirá.
              </p>
            </div>

            {error && (
              <div className="flex items-center p-3 bg-red-900/20 border border-red-800 rounded-md">
                <AlertCircle size={16} className="text-red-400 mr-2 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
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
