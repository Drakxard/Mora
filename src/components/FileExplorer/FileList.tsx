"use client"

import type React from "react"
import type { FileItem as FileItemType } from "../../types"
import FileItem from "./FileItem"

interface FileListProps {
  files: FileItemType[]
  onFileClick: (file: FileItemType) => void
  onTranscribe: (file: FileItemType) => void
  onChat: (file: FileItemType) => void
  onAddToChat: (file: FileItemType) => void
  onDeleteTranscription: (file: FileItemType) => void
  onRetryTts: (file: FileItemType) => void
  onDeleteFile: (file: FileItemType) => void
  currentPlayingFile?: FileItemType | null
  hasTranscription: (file: FileItemType) => boolean
  hasTtsMetadata: (file: FileItemType) => boolean
  isInChat: (file: FileItemType) => boolean
}

const FileList: React.FC<FileListProps> = ({
  files,
  onFileClick,
  onTranscribe,
  onChat,
  onAddToChat,
  onDeleteTranscription,
  onRetryTts,
  onDeleteFile,
  currentPlayingFile,
  hasTranscription,
  hasTtsMetadata,
  isInChat,
}) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-text-tertiary">
        <p>No hay archivos en esta carpeta</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {[...files]
        .sort((a, b) => {
          // Extraer números del nombre del archivo
          const getNumber = (fileName: string) => {
            const match = fileName.match(/(\d+)/)
            return match ? Number.parseInt(match[1], 10) : 0
          }

          const numA = getNumber(a.name)
          const numB = getNumber(b.name)

          // Si ambos tienen números, ordenar por número
          if (numA !== 0 && numB !== 0) {
            return numA - numB
          }

          // Si solo uno tiene número, el que tiene número va primero
          if (numA !== 0 && numB === 0) return -1
          if (numA === 0 && numB !== 0) return 1

          // Si ninguno tiene número, ordenar alfabéticamente
          return a.name.localeCompare(b.name)
        })
        .map((file) => (
          <FileItem
            key={file.path}
            file={file}
            onClick={onFileClick}
            onTranscribe={onTranscribe}
            onChat={onChat}
            onAddToChat={onAddToChat}
            onDeleteTranscription={onDeleteTranscription}
            onRetryTts={onRetryTts}
            onDeleteFile={onDeleteFile}
            isPlaying={currentPlayingFile?.path === file.path}
            hasTranscription={hasTranscription(file)}
            hasTtsMetadata={hasTtsMetadata(file)}
            isInChat={isInChat(file)}
          />
        ))}
    </div>
  )
}

export default FileList
