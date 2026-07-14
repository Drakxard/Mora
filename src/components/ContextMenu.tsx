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
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 })
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

  const toggleMenu = (event: React.MouseEvent) => {
    event.stopPropagation()

    if (!buttonRef.current) {
      setIsOpen((open) => !open)
      return
    }

    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 192
    const menuHeight = isAudio ? (hasTranscription ? 88 : 44) : 0
    const top =
      rect.bottom + menuHeight + 8 > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - 4)
        : rect.bottom + 4
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8)

    setMenuPosition({ top, left })
    setIsOpen((open) => !open)
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-1 rounded-full hover:bg-background-tertiary transition-colors"
        aria-label="Opciones"
      >
        <MoreVertical size={18} className="text-text-tertiary" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed py-1 w-48 bg-background-secondary rounded-md shadow-xl z-[1000] border border-background-tertiary"
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

        </div>
      )}
    </div>
  )
}

export default ContextMenu
