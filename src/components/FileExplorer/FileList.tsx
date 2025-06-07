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
  currentPlayingFile?: FileItemType | null
  hasTranscription: (file: FileItemType) => boolean
  isInChat: (file: FileItemType) => boolean
}

const FileList: React.FC<FileListProps> = ({
  files,
  onFileClick,
  onTranscribe,
  onChat,
  onAddToChat,
  onDeleteTranscription,
  currentPlayingFile,
  hasTranscription,
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
          const getNumber = (fileName: string) => Number.parseInt(fileName.match(/\d+/)?.[0] || "0", 10)

          return getNumber(a.name) - getNumber(b.name)
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
            isPlaying={currentPlayingFile?.path === file.path}
            hasTranscription={hasTranscription(file)}
            isInChat={isInChat(file)}
          />
        ))}
    </div>
  )
}

export default FileList
