"use client"

import type React from "react"
import type { FileItem as FileItemType } from "../../types"
import FileIcon from "./FileIcon"
import ContextMenu from "./ContextMenu"
import { cn } from "../../utils/cn"
import { formatFileSize } from "../../utils/format"
import { MessageSquare, Plus, CheckCircle, X, Trash2 } from "lucide-react"

interface FileItemProps {
  file: FileItemType
  onClick: (file: FileItemType) => void
  onTranscribe: (file: FileItemType) => void
  onChat: (file: FileItemType) => void
  onAddToChat: (file: FileItemType) => void
  onDeleteTranscription: (file: FileItemType) => void
  isPlaying?: boolean
  hasTranscription?: boolean
  isInChat?: boolean
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onClick,
  onTranscribe,
  onChat,
  onAddToChat,
  onDeleteTranscription,
  isPlaying = false,
  hasTranscription = false,
  isInChat = false,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onClick(file)
  }

  const isAudio = file.type.startsWith("audio/")

  return (
    <div
      className={cn(
        "flex items-center p-2 rounded-md transition-colors cursor-pointer group",
        isPlaying ? "bg-primary/20" : "hover:bg-background-tertiary",
      )}
      onClick={handleClick}
    >
      <div className="mr-3">
        <FileIcon file={file} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <p
            className={cn(
              "truncate",
              isPlaying ? "text-primary font-medium" : "text-text-secondary group-hover:text-text-primary",
            )}
          >
            {file.name}
          </p>

          {isPlaying && (
            <span className="ml-2 inline-flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow mr-0.5"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow mx-0.5 delay-100"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow ml-0.5 delay-200"></span>
            </span>
          )}

          {/* Indicador de transcripción disponible */}
          {isAudio && hasTranscription && (
            <CheckCircle size={16} className="ml-2 text-green-400" title="Transcripción disponible" />
          )}
        </div>

        {file.size !== undefined && <p className="text-xs text-text-tertiary">{formatFileSize(file.size)}</p>}
      </div>

      {/* Botones de acción para archivos de audio */}
      {isAudio && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Botón para eliminar transcripción permanentemente */}
          {hasTranscription && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteTranscription(file)
              }}
              className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
              title="Eliminar transcripción permanentemente"
            >
              <Trash2 size={16} className="text-red-500 hover:text-red-400" />
            </button>
          )}

          {/* Botón para agregar/quitar del chat (solo si hay transcripción) */}
          {hasTranscription && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddToChat(file)
              }}
              className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
              title={isInChat ? "Quitar del chat" : "Agregar transcripción al chat"}
            >
              {isInChat ? (
                <X size={18} className="text-red-400 hover:text-red-300" />
              ) : (
                <Plus size={18} className="text-green-400 hover:text-green-300" />
              )}
            </button>
          )}

          {/* Botón de chat general */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChat(file)
            }}
            className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
            title="Abrir chat"
          >
            <MessageSquare size={18} className="text-text-tertiary hover:text-primary" />
          </button>
        </div>
      )}

      <ContextMenu
        file={file}
        onTranscribe={onTranscribe}
        onDeleteTranscription={onDeleteTranscription}
        hasTranscription={hasTranscription}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  )
}

export default FileItem
