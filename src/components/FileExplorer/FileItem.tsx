"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
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
  onRetryTts: (file: FileItemType) => void
  onRenameFile: (file: FileItemType, nextName: string) => Promise<FileItemType | null>
  onDeleteFile: (file: FileItemType) => void
  onCancelCreate?: () => void
  isPlaying?: boolean
  hasTranscription?: boolean
  hasTtsMetadata?: boolean
  isInChat?: boolean
  isCreating?: boolean
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onClick,
  onTranscribe,
  onChat,
  onAddToChat,
  onDeleteTranscription,
  onRetryTts,
  onRenameFile,
  onDeleteFile,
  onCancelCreate,
  isPlaying = false,
  hasTranscription = false,
  hasTtsMetadata = false,
  isInChat = false,
  isCreating = false,
}) => {
  const [isRenaming, setIsRenaming] = useState(isCreating)
  const [editableName, setEditableName] = useState(file.name)
  const [renameError, setRenameError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const isCommittingRef = useRef(false)
  const isAudio = file.type.startsWith("audio/")

  useEffect(() => {
    if (!isRenaming) return

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isRenaming])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isRenaming) return
    onClick(file)
  }

  const startRename = () => {
    setEditableName(file.name)
    setRenameError("")
    setIsRenaming(true)
  }

  const cancelRename = () => {
    setRenameError("")
    setEditableName(file.name)
    setIsRenaming(false)

    if (isCreating) {
      onCancelCreate?.()
    }
  }

  const commitRename = async () => {
    if (isCommittingRef.current) return

    const nextName = editableName.trim()

    if (!nextName) {
      if (isCreating) {
        onCancelCreate?.()
        return
      }

      setRenameError("El nombre no puede estar vacio.")
      return
    }

    try {
      isCommittingRef.current = true
      const renamedFile = await onRenameFile(file, nextName)
      setEditableName(renamedFile?.name || nextName)
      setRenameError("")
      setIsRenaming(false)
    } catch (error: any) {
      setRenameError(error.message || "No se pudo renombrar.")
    } finally {
      isCommittingRef.current = false
    }
  }

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commitRename()
    }

    if (event.key === "Escape") {
      event.preventDefault()
      cancelRename()
    }
  }

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
          {isRenaming ? (
            <input
              ref={inputRef}
              value={editableName}
              onChange={(event) => setEditableName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              className="min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-text-primary outline-none transition-colors hover:border-background-tertiary hover:bg-background-tertiary/60 focus:border-primary/50 focus:bg-background-tertiary"
            />
          ) : (
            <p
              className={cn(
                "truncate",
                isPlaying ? "text-primary font-medium" : "text-text-secondary group-hover:text-text-primary",
              )}
            >
              {file.name}
            </p>
          )}

          {isPlaying && !isRenaming && (
            <span className="ml-2 inline-flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow mr-0.5"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow mx-0.5 delay-100"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow ml-0.5 delay-200"></span>
            </span>
          )}

          {isAudio && hasTranscription && !isRenaming && (
            <span className="ml-2 inline-flex" title="Transcripcion disponible">
              <CheckCircle size={16} className="text-green-400" />
            </span>
          )}
        </div>

        {renameError && <p className="text-xs text-red-300">{renameError}</p>}
        {file.size !== undefined && !isCreating && <p className="text-xs text-text-tertiary">{formatFileSize(file.size)}</p>}
      </div>

      {isAudio && !isRenaming && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasTranscription && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteTranscription(file)
              }}
              className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
              title="Eliminar transcripcion permanentemente"
            >
              <Trash2 size={16} className="text-red-500 hover:text-red-400" />
            </button>
          )}

          {hasTranscription && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddToChat(file)
              }}
              className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
              title={isInChat ? "Quitar del chat" : "Agregar transcripcion al chat"}
            >
              {isInChat ? (
                <X size={18} className="text-red-400 hover:text-red-300" />
              ) : (
                <Plus size={18} className="text-green-400 hover:text-green-300" />
              )}
            </button>
          )}

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

      {!isRenaming && (
        <ContextMenu
          file={file}
          onTranscribe={onTranscribe}
          onDeleteTranscription={onDeleteTranscription}
          onRetryTts={onRetryTts}
          onRenameFile={startRename}
          onDeleteFile={onDeleteFile}
          hasTranscription={hasTranscription}
          hasTtsMetadata={hasTtsMetadata}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
    </div>
  )
}

export default FileItem
