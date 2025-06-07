"use client"

import React, { useRef, useEffect } from "react"
import { cn } from "../../utils/cn"
import { MoreVertical, Trash2 } from "lucide-react"
import type { FileItem } from "../../types"

interface ContextMenuProps {
  file: FileItem
  onTranscribe: (file: FileItem) => void
  onDeleteTranscription: (file: FileItem) => void
  hasTranscription?: boolean
  className?: string
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  file,
  onTranscribe,
  onDeleteTranscription,
  hasTranscription = false,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleTranscribe = () => {
    onTranscribe(file)
    setIsOpen(false)
  }

  const handleDeleteTranscription = () => {
    onDeleteTranscription(file)
    setIsOpen(false)
  }

  const isAudio = file.type.startsWith("audio/")

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
        aria-label="Opciones"
      >
        <MoreVertical size={18} className="text-text-tertiary" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-1 py-1 w-48 bg-background-secondary rounded-md shadow-lg z-10 border border-background-tertiary"
        >
          {isAudio && (
            <>
              <button
                onClick={handleTranscribe}
                className="w-full text-left px-4 py-2 text-text-secondary hover:bg-background-tertiary transition-colors"
              >
                {hasTranscription ? "Re-transcribir audio" : "Transcribir audio"}
              </button>

              {hasTranscription && (
                <button
                  onClick={handleDeleteTranscription}
                  className="w-full text-left px-4 py-2 text-red-400 hover:bg-background-tertiary transition-colors"
                >
                  <span className="flex items-center">
                    <Trash2 size={16} className="mr-2" />
                    Eliminar transcripción
                  </span>
                </button>
              )}
            </>
          )}

          {/* Other menu items can be added here */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full text-left px-4 py-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          >
            Propiedades
          </button>
        </div>
      )}
    </div>
  )
}

export default ContextMenu
