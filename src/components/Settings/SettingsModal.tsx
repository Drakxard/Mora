"use client"

import type React from "react"
import { X } from "lucide-react"
import ModelSelector from "../ModelSelector"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  transcriptionModel: string
  chatModel: string
  onTranscriptionModelChange: (modelId: string) => void
  onChatModelChange: (modelId: string) => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  transcriptionModel,
  chatModel,
  onTranscriptionModelChange,
  onChatModelChange,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-background-tertiary bg-background-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-background-tertiary p-6">
          <h2 className="text-xl font-semibold text-text-primary">Configuracion</h2>
          <button onClick={onClose} className="rounded-md p-2 transition-colors hover:bg-background-tertiary">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <div className="p-6">
          <h3 className="mb-4 text-lg font-medium text-text-primary">Modelos</h3>
          <div className="grid grid-cols-1 gap-4 rounded-lg bg-background-tertiary p-4">
            <ModelSelector type="transcription" value={transcriptionModel} onChange={onTranscriptionModelChange} />
            <ModelSelector type="chat" value={chatModel} onChange={onChatModelChange} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
