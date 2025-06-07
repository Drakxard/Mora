import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface AudioControlsProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  audioRef,
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  duration,
  currentTime,
  onSeek
}) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const prevVolume = useRef(1);

  // Update audio volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, audioRef]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!isMuted) {
      prevVolume.current = volume;
      setIsMuted(true);
    } else {
      setIsMuted(false);
      if (prevVolume.current === 0) {
        setVolume(0.5);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(parseFloat(e.target.value));
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-center space-x-4 mb-3">
        <button 
          onClick={onPrevious}
          className="p-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <SkipBack size={20} />
        </button>
        
        <button 
          onClick={onPlayPause}
          className="p-3 bg-primary rounded-full text-white hover:bg-primary-light transition-colors"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        
        <button 
          onClick={onNext}
          className="p-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <SkipForward size={20} />
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-xs text-text-secondary w-10 text-right">
          {formatTime(currentTime)}
        </span>
        
        <div className="relative flex-1 h-5">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="h-1 bg-background-tertiary rounded-full w-full relative top-2">
            <div 
              className="h-1 bg-primary rounded-full absolute top-0 left-0" 
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>
        </div>
        
        <span className="text-xs text-text-secondary w-10">
          {formatTime(duration)}
        </span>
      </div>
      
      <div className="flex items-center mt-3 space-x-2">
        <button 
          onClick={toggleMute}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={18} />
          ) : (
            <Volume2 size={18} />
          )}
        </button>
        
        <div className="relative w-24 h-5">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="h-1 bg-background-tertiary rounded-full w-full relative top-2">
            <div 
              className="h-1 bg-primary rounded-full absolute top-0 left-0" 
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioControls;