"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, Bot, Trash2, MessageSquarePlus } from "lucide-react"
import type { FileItem, ChatMessage } from "../../types"
import Button from "../ui/Button"
import { cn } from "../../utils/cn"
import ActiveAudioBadge from "./ActiveAudioBadge"
import ImageUpload from "./ImageUpload"
import AudioUpload from "./AudioUpload"
import { getModelCapabilities } from "../../utils/groqModels"

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  transcribedFiles: { file: FileItem; transcription: string }[]
  selectedChatModel: string
  onRemoveTranscription: (filePath: string) => void
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  transcribedFiles,
  selectedChatModel,
  onRemoveTranscription,
}) => {
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Ajustar el índice activo si se elimina el archivo actual
  useEffect(() => {
    if (transcribedFiles.length === 0) {
      setActiveFileIndex(0)
    } else if (activeFileIndex >= transcribedFiles.length) {
      setActiveFileIndex(transcribedFiles.length - 1)
    }
  }, [transcribedFiles, activeFileIndex])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Validar que el modelo seleccionado es para chat
  const isValidChatModel = (model: string) => {
    // Lista actualizada de modelos válidos para chat
    const invalidModels = ["whisper-large-v3-turbo", "distil-whisper-large-v3-en"]
    return !invalidModels.includes(model) && model.length > 0
  }

  // Obtener capacidades del modelo
  const modelCapabilities = getModelCapabilities(selectedChatModel)

  const handleImageSelect = (file: File) => {
    setSelectedImage(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageRemove = () => {
    setSelectedImage(null)
    setImagePreview(null)
  }

  const handleAudioSelect = (file: File) => {
    setSelectedAudio(file)
  }

  const handleAudioRemove = () => {
    setSelectedAudio(null)
  }

  // Función para limpiar la conversación
  const handleClearChat = () => {
    if (messages.length === 0) return

    if (confirm("¿Estás seguro de que quieres borrar toda la conversación?")) {
      setMessages([])
      setInput("")
      handleImageRemove()
      handleAudioRemove()
      console.log("Conversación borrada - memoria del chat reiniciada")
    }
  }

  // Función para nuevo chat (alias de limpiar)
  const handleNewChat = () => {
    setMessages([])
    setInput("")
    handleImageRemove()
    handleAudioRemove()
    console.log("Nuevo chat iniciado - memoria reiniciada")
  }

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(",")[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const transcribeAudio = async (audioFile: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", audioFile)
    formData.append("model", "whisper-large-v3-turbo")
    formData.append("language", "es")

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Error transcribiendo audio: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.text || ""
  }

  const sendMessage = async (message: string) => {
    if ((!message.trim() && !selectedImage && !selectedAudio) || !selectedChatModel) return

    if (!isValidChatModel(selectedChatModel)) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error: El modelo "${selectedChatModel}" no es válido para chat. Por favor, selecciona un modelo de chat válido.`,
        timestamp: new Date(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
      return
    }

    if (selectedImage && !modelCapabilities.image) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error: El modelo "${selectedChatModel}" no soporta imágenes. Usa un modelo con soporte de visión como "Llama 4 Scout" o "Llama 4 Maverick".`,
        timestamp: new Date(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
      return
    }

    if (selectedAudio && !modelCapabilities.audio) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error: El modelo "${selectedChatModel}" no soporta audio directamente. El audio será transcrito primero.`,
        timestamp: new Date(),
        isError: false,
      }
      setMessages((prev) => [...prev, errorMessage])
    }

    let finalMessage = message
    let audioTranscription = ""

    // Si hay audio, transcribirlo primero
    if (selectedAudio) {
      try {
        audioTranscription = await transcribeAudio(selectedAudio)
        if (audioTranscription) {
          finalMessage = finalMessage
            ? `${finalMessage}\n\n[Audio transcrito]: ${audioTranscription}`
            : `[Audio transcrito]: ${audioTranscription}`
        }
      } catch (error: any) {
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error transcribiendo audio: ${error.message}`,
          timestamp: new Date(),
          isError: true,
        }
        setMessages((prev) => [...prev, errorMessage])
        return
      }
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: finalMessage || "Analiza este contenido",
      timestamp: new Date(),
      image: imagePreview || undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      if (!import.meta.env.VITE_GROQ_API_KEY) {
        throw new Error("API key de Groq no encontrada")
      }

      const transcription = transcribedFiles[activeFileIndex]?.transcription || ""

      let systemPrompt = "Eres un asistente útil y amigable. Responde en español de manera clara y concisa."

      if (transcription) {
        systemPrompt = `Contexto de audio transcrito: ${transcription}\n\nEres un asistente útil que responde preguntas sobre el contenido del audio transcrito y puede analizar imágenes. Responde en español de manera clara y concisa.`
      }

      // Construir el historial de mensajes para mantener el contexto
      const chatMessages: any[] = [
        {
          role: "system",
          content: systemPrompt,
        },
      ]

      // Agregar todos los mensajes anteriores para mantener el contexto
      messages.forEach((msg) => {
        if (!msg.isError) {
          chatMessages.push({
            role: msg.role,
            content: msg.content,
          })
        }
      })

      // Construir el mensaje del usuario actual
      if (selectedImage && modelCapabilities.image) {
        const base64Image = await convertImageToBase64(selectedImage)
        chatMessages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: finalMessage || "Analiza esta imagen y describe lo que ves en español.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${selectedImage.type};base64,${base64Image}`,
              },
            },
          ],
        })
      } else {
        chatMessages.push({
          role: "user",
          content: finalMessage,
        })
      }

      console.log("Enviando mensaje con modelo:", selectedChatModel)
      console.log("Historial de mensajes:", chatMessages.length)

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedChatModel,
          messages: chatMessages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.choices?.[0]?.message?.content) {
        throw new Error("Respuesta inválida del servicio")
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.choices[0].message.content,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Limpiar archivos después de enviar
      handleImageRemove()
      handleAudioRemove()
    } catch (error: any) {
      console.error("Error en el chat:", error)

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error.message}`,
        timestamp: new Date(),
        isError: true,
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleRemoveTranscribedFile = (index: number) => {
    const fileToRemove = transcribedFiles[index]
    if (fileToRemove) {
      onRemoveTranscription(fileToRemove.file.path)
    }
  }

  if (!isOpen) return null

  const currentTranscription = transcribedFiles[activeFileIndex]?.transcription || "No hay transcripción activa."
  const isModelValid = isValidChatModel(selectedChatModel)

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-background-secondary border-l border-background-tertiary shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-background-tertiary">
        <h2 className="text-lg font-medium text-text-primary">Chat sobre audio</h2>
        <div className="flex items-center gap-2">
          {/* Botón Nuevo Chat */}
          <button
            onClick={handleNewChat}
            className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
            title="Nuevo chat"
          >
            <MessageSquarePlus size={18} className="text-text-secondary hover:text-primary" />
          </button>

          {/* Botón Borrar Conversación */}
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
              title="Borrar conversación"
            >
              <Trash2 size={18} className="text-text-secondary hover:text-red-400" />
            </button>
          )}

          {/* Botón Cerrar */}
          <button onClick={onClose} className="p-1 rounded-full hover:bg-background-tertiary transition-colors">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {transcribedFiles.length > 0 && (
        <div className="p-4 border-b border-background-tertiary">
          <div className="flex flex-wrap">
            {transcribedFiles.map((item, index) => (
              <ActiveAudioBadge
                key={item.file.path}
                file={item.file}
                isActive={index === activeFileIndex}
                onClick={() => setActiveFileIndex(index)}
                onRemove={() => handleRemoveTranscribedFile(index)}
              />
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            Transcripción activa: {currentTranscription.substring(0, 100)}...
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-text-secondary py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-text-tertiary" />
            <p>¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte hoy?</p>
            <p className="text-sm mt-2">Modelo actual: {selectedChatModel}</p>
            <div className="text-xs mt-2 space-y-1">
              {modelCapabilities.image && <p className="text-green-400">✨ Este modelo soporta análisis de imágenes</p>}
              {modelCapabilities.audio && (
                <p className="text-blue-400">🎵 Este modelo soporta procesamiento de audio</p>
              )}
              {!modelCapabilities.image && !modelCapabilities.audio && (
                <p className="text-text-tertiary">💬 Este modelo solo procesa texto</p>
              )}
            </div>
            {!isModelValid && selectedChatModel && (
              <p className="text-xs text-red-400 mt-2">⚠️ El modelo seleccionado no es válido para chat</p>
            )}
            {transcribedFiles.length === 0 && (
              <p className="text-xs text-text-tertiary mt-2">
                Transcribe un audio primero para chatear sobre su contenido
              </p>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[80%] rounded-lg p-3",
              message.role === "user"
                ? "bg-primary/20 ml-auto text-text-primary"
                : message.isError
                  ? "bg-red-900/20 border border-red-800 text-red-300"
                  : "bg-background-tertiary text-text-primary",
            )}
          >
            {message.image && (
              <img
                src={message.image || "/placeholder.svg"}
                alt="Imagen enviada"
                className="max-w-full h-auto rounded mb-2 border border-background-tertiary"
              />
            )}
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-background-tertiary space-y-3">
        {/* Componentes de subida encima del textarea */}
        <div className="flex items-center gap-2 justify-end">
          {modelCapabilities.image && (
            <ImageUpload
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              imagePreview={imagePreview}
              disabled={isLoading || !isModelValid}
              supportsVision={modelCapabilities.image}
            />
          )}

          <AudioUpload
            onAudioSelect={handleAudioSelect}
            onAudioRemove={handleAudioRemove}
            audioFile={selectedAudio}
            disabled={isLoading || !isModelValid}
            supportsAudio={true}
          />
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="w-full bg-background-tertiary rounded-lg p-3 text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={2}
              disabled={isLoading || !isModelValid}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
          </div>

          <Button
            type="submit"
            disabled={
              isLoading || (!input.trim() && !selectedImage && !selectedAudio) || !selectedChatModel || !isModelValid
            }
            title={
              !selectedChatModel
                ? "Selecciona un modelo de chat primero"
                : !isModelValid
                  ? "El modelo seleccionado no es válido para chat"
                  : ""
            }
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </Button>
        </form>

        {/* Mensajes de estado simplificados */}
        {!selectedChatModel && <p className="text-xs text-red-400">Selecciona un modelo de chat para comenzar</p>}
        {selectedChatModel && !isModelValid && (
          <p className="text-xs text-red-400">
            El modelo "{selectedChatModel}" no es válido para chat. Selecciona un modelo de chat.
          </p>
        )}
        <div className="text-xs text-text-tertiary">
          {modelCapabilities.image && <span className="text-green-400">🖼️ </span>}
          {modelCapabilities.audio && <span className="text-blue-400">🎵 </span>}
          <span>💬</span>
          {!modelCapabilities.audio && <span className="ml-2">📝</span>}
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
