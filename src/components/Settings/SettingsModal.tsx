"use client"

import type React from "react"
import { useState } from "react"
import { X, Key, Info, Trash2, Eye, EyeOff, Save, ExternalLink } from "lucide-react"
import Button from "../ui/Button"
import UpdaterSettings from "./UpdaterSettings"
import { getUserApiKey, saveUserApiKey, deleteUserApiKey, isApiKeyConfigured } from "../../utils/storage"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"general" | "api" | "updates">("general")
  const [apiKey, setApiKey] = useState(getUserApiKey() || "")
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")

  if (!isOpen) return null

  const handleSaveApiKey = async () => {
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
    setSuccess("")

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
      setSuccess("API key guardada correctamente")
    } catch (error: any) {
      setError(`Error verificando API key: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteApiKey = () => {
    if (confirm("¿Estás seguro de que quieres eliminar tu API key? Tendrás que configurarla nuevamente.")) {
      deleteUserApiKey()
      setApiKey("")
      setSuccess("API key eliminada correctamente")
    }
  }

  const openGroqConsole = () => {
    window.open("https://console.groq.com/keys", "_blank")
  }

  const handleClose = () => {
    setError("")
    setSuccess("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-background-secondary w-full max-w-2xl max-h-[90vh] rounded-lg shadow-xl border border-background-tertiary overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-background-tertiary">
          <h2 className="text-xl font-semibold text-text-primary">Configuración</h2>
          <button onClick={handleClose} className="p-2 hover:bg-background-tertiary rounded-md transition-colors">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-background-tertiary">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "general"
                ? "text-primary border-b-2 border-primary bg-background-tertiary/50"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "api"
                ? "text-primary border-b-2 border-primary bg-background-tertiary/50"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            API Key
          </button>
          <button
            onClick={() => setActiveTab("updates")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "updates"
                ? "text-primary border-b-2 border-primary bg-background-tertiary/50"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Actualizaciones
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-4">Información de la aplicación</h3>
                <div className="bg-background-tertiary rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Nombre:</span>
                    <span className="text-text-primary">Audio Explorer</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Versión:</span>
                    <span className="text-text-primary">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Estado API:</span>
                    <span className={`${isApiKeyConfigured() ? "text-green-400" : "text-red-400"}`}>
                      {isApiKeyConfigured() ? "Configurada" : "No configurada"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-text-primary mb-4">Acerca de</h3>
                <div className="bg-background-tertiary rounded-lg p-4">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    Audio Explorer es una aplicación para explorar, transcribir y chatear sobre archivos de audio
                    utilizando la API de Groq. Permite navegar por directorios, reproducir archivos de audio, generar
                    transcripciones automáticas y mantener conversaciones sobre el contenido.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* API Key Tab */}
          {activeTab === "api" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-4">Configuración de API Key</h3>

                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <Info size={20} className="text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-blue-300 font-medium mb-2">¿Qué es la API Key de Groq?</p>
                      <p className="text-blue-200 mb-3">
                        La API Key te permite acceder a los servicios de IA de Groq para transcripción y chat. Es
                        gratuita y necesaria para usar las funciones principales de la aplicación.
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

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Tu API Key de Groq</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value)
                          setError("")
                          setSuccess("")
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
                    <p className="text-xs text-text-tertiary mt-1">
                      Tu API key se guarda de forma segura en tu dispositivo y nunca se comparte.
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center p-3 bg-red-900/20 border border-red-800 rounded-md">
                      <X size={16} className="text-red-400 mr-2 flex-shrink-0" />
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center p-3 bg-green-900/20 border border-green-800 rounded-md">
                      <Key size={16} className="text-green-400 mr-2 flex-shrink-0" />
                      <p className="text-green-300 text-sm">{success}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={!apiKey.trim() || isLoading}
                      leftIcon={<Save size={18} />}
                      className="flex-1"
                    >
                      {isLoading ? "Verificando..." : "Guardar API Key"}
                    </Button>

                    {isApiKeyConfigured() && (
                      <Button
                        onClick={handleDeleteApiKey}
                        variant="secondary"
                        leftIcon={<Trash2 size={18} />}
                        className="text-red-400 hover:text-red-300"
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Updates Tab */}
          {activeTab === "updates" && (
            <div className="space-y-6">
              <UpdaterSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
