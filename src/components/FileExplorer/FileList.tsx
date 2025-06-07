import React from 'react';
import { FileItem as FileItemType } from '../../types';
import FileItem from './FileItem';

interface FileListProps {
  files: FileItemType[];
  onFileClick: (file: FileItemType) => void;
  onTranscribe: (file: FileItemType) => void;
  onChat: (file: FileItemType) => void;
  currentPlayingFile?: FileItemType | null;
}

const FileList: React.FC<FileListProps> = ({ 
  files, 
  onFileClick, 
  onTranscribe,
  onChat,
  currentPlayingFile 
}) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-text-tertiary">
        <p>No hay archivos en esta carpeta</p>
      </div>
    );
  }

return (
  <div className="space-y-1">
    {[...files]
      .sort((a, b) => {
        const getNumber = (fileName: string) =>
          parseInt(fileName.match(/\d+/)?.[0] || '0', 10);

        return getNumber(a.name) - getNumber(b.name);
      })
      .map((file) => (
        <FileItem
          key={file.path}
          file={file}
          onClick={onFileClick}
          onTranscribe={onTranscribe}
          onChat={onChat}
          isPlaying={currentPlayingFile?.path === file.path}
        />
      ))}
  </div>
);

};

export default FileList;