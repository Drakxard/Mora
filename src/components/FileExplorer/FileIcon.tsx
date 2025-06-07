import React from 'react';
import { Folder, File, FileText, FileImage, FileAudio, FileVideo, FileCode, FileArchive, File as FilePdf } from 'lucide-react';
import { FileItem } from '../../types';

interface FileIconProps {
  file: FileItem;
  className?: string;
  size?: number;
}

const FileIcon: React.FC<FileIconProps> = ({ 
  file, 
  className = '', 
  size = 20 
}) => {
  if (file.isDirectory) {
    return <Folder size={size} className={`text-yellow-400 ${className}`} />;
  }
  
  const { type } = file;
  
  // Handle different file types
  if (type.startsWith('audio/')) {
    return <FileAudio size={size} className={`text-primary ${className}`} />;
  }
  
  if (type.startsWith('image/')) {
    return <FileImage size={size} className={`text-green-400 ${className}`} />;
  }
  
  if (type.startsWith('video/')) {
    return <FileVideo size={size} className={`text-blue-400 ${className}`} />;
  }
  
  if (type.startsWith('text/') || type.includes('document')) {
    return <FileText size={size} className={`text-gray-300 ${className}`} />;
  }
  
  if (type.includes('pdf')) {
    return <FilePdf size={size} className={`text-red-400 ${className}`} />;
  }
  
  if (type.includes('zip') || type.includes('compressed') || type.includes('archive')) {
    return <FileArchive size={size} className={`text-amber-400 ${className}`} />;
  }
  
  if (
    type.includes('javascript') || 
    type.includes('typescript') || 
    type.includes('json') || 
    type.includes('html') || 
    type.includes('css') || 
    type.includes('xml')
  ) {
    return <FileCode size={size} className={`text-cyan-400 ${className}`} />;
  }
  
  return <File size={size} className={`text-gray-400 ${className}`} />;
};

export default FileIcon;