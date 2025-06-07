import React from 'react';
import { X } from 'lucide-react';
import { FileItem } from '../../types';

interface ActiveAudioBadgeProps {
  file: FileItem;
  onRemove: () => void;
  isActive: boolean;
  onClick: () => void;
}

const ActiveAudioBadge: React.FC<ActiveAudioBadgeProps> = ({
  file,
  onRemove,
  isActive,
  onClick,
}) => {
  return (
    <div
      className={`
        inline-flex items-center px-3 py-1 rounded-full mr-2 mb-2 cursor-pointer
        transition-colors duration-200
        ${isActive 
          ? 'bg-primary/20 text-primary' 
          : 'bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80'
        }
      `}
      onClick={onClick}
    >
      <span className="text-sm truncate max-w-[150px]">{file.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-2 p-1 rounded-full hover:bg-background-tertiary/50"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ActiveAudioBadge;