import React from 'react';
import { FileItem } from '../../types';
import { ChevronDown, ListMusic } from 'lucide-react';
import FileIcon from '../FileExplorer/FileIcon';
import { cn } from '../../utils/cn';

interface PlaylistPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  audioFiles: FileItem[];
  currentFile: FileItem | null;
  onSelectFile: (file: FileItem) => void;
}

const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  isOpen,
  onToggle,
  audioFiles,
  currentFile,
  onSelectFile
}) => {
  return (
    <div className={cn(
      'bg-background-tertiary transition-all duration-300 ease-in-out overflow-hidden',
      isOpen ? 'max-h-64' : 'max-h-0'
    )}>
      {audioFiles.length > 0 && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <ListMusic size={16} className="text-primary mr-2" />
              <span className="text-text-secondary text-sm font-medium">Cola de reproducción</span>
            </div>
            <button 
              onClick={onToggle}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronDown size={18} />
            </button>
          </div>
          
          <div className="overflow-y-auto max-h-48 pr-1">
            {audioFiles.map((file) => (
              <div 
                key={file.path}
                onClick={() => onSelectFile(file)}
                className={cn(
                  'flex items-center p-2 rounded-md cursor-pointer transition-colors',
                  currentFile?.path === file.path 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
                )}
              >
                <FileIcon file={file} size={16} className="mr-2" />
                <span className="truncate text-sm">{file.name}</span>
                
                {currentFile?.path === file.path && (
                  <span className="ml-2 inline-flex items-center">
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse-slow mr-0.5"></span>
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse-slow mx-0.5 delay-100"></span>
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse-slow ml-0.5 delay-200"></span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistPanel;