import React, { useState, useRef, useEffect } from 'react';
import { FileItem } from '../../types';
import { ChevronUp } from 'lucide-react';
import AudioControls from './AudioControls';
import PlaylistPanel from './PlaylistPanel';
import FileIcon from '../FileExplorer/FileIcon';
import { cn } from '../../utils/cn';

interface AudioPlayerProps {
  audioFiles: FileItem[];
  currentFile: FileItem | null;
  onSelectFile: (file: FileItem) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioFiles,
  currentFile,
  onSelectFile
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Update audio player state when audio loads or time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      playNext();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentFile]);

  // Reset state when changing files
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [currentFile]);

  // Auto-play when a file is selected
  useEffect(() => {
    if (currentFile && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Error playing audio:', err));
    }
  }, [currentFile]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error('Error playing audio:', err));
    }
    
    setIsPlaying(!isPlaying);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const playNext = () => {
    if (!currentFile || audioFiles.length <= 1) return;
    
    const currentIndex = audioFiles.findIndex(file => file.path === currentFile.path);
    const nextIndex = (currentIndex + 1) % audioFiles.length;
    onSelectFile(audioFiles[nextIndex]);
  };

  const playPrevious = () => {
    if (!currentFile || audioFiles.length <= 1) return;
    
    const currentIndex = audioFiles.findIndex(file => file.path === currentFile.path);
    const prevIndex = (currentIndex - 1 + audioFiles.length) % audioFiles.length;
    onSelectFile(audioFiles[prevIndex]);
  };

  if (!currentFile) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background-secondary border-t border-background-tertiary shadow-lg">
      <PlaylistPanel
        isOpen={isPlaylistOpen}
        onToggle={() => setIsPlaylistOpen(!isPlaylistOpen)}
        audioFiles={audioFiles}
        currentFile={currentFile}
        onSelectFile={onSelectFile}
      />
      
      <div className="flex items-center p-4">
        <button 
          onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
          className={cn(
            "p-1 rounded-full hover:bg-background-tertiary transition-colors mr-3",
            isPlaylistOpen && "rotate-180"
          )}
        >
          <ChevronUp size={20} className="text-text-secondary" />
        </button>
        
        <div className="flex items-center mr-4 min-w-0">
          <div className="mr-3 flex-shrink-0">
            <FileIcon file={currentFile} size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="text-text-primary font-medium truncate">
              {currentFile.name}
            </h3>
          </div>
        </div>
        
        <div className="flex-1">
          <AudioControls
            audioRef={audioRef}
            isPlaying={isPlaying}
            onPlayPause={togglePlayPause}
            onPrevious={playPrevious}
            onNext={playNext}
            duration={duration}
            currentTime={currentTime}
            onSeek={seekTo}
          />
        </div>
        
        <audio 
          ref={audioRef}
          src={currentFile.url}
          preload="metadata"
          className="hidden"
        />
      </div>
    </div>
  );
};

export default AudioPlayer;