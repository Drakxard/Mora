import React, { useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { MoreVertical } from 'lucide-react';
import { FileItem } from '../../types';

interface ContextMenuProps {
  file: FileItem;
  onTranscribe: (file: FileItem) => void;
  className?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ 
  file, 
  onTranscribe, 
  className 
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleTranscribe = () => {
    onTranscribe(file);
    setIsOpen(false);
  };
  
  const isAudio = file.type.startsWith('audio/');

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
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
            <button
              onClick={handleTranscribe}
              className="w-full text-left px-4 py-2 text-text-secondary hover:bg-background-tertiary transition-colors"
            >
              Transcribir audio
            </button>
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
  );
};

export default ContextMenu;