import React from 'react';
import { ChevronRight, ChevronLeft, Home } from 'lucide-react';
import Button from '../ui/Button';

interface BreadcrumbProps {
  path: string[];
  rootLabel?: string;
  onNavigate: (index: number) => void;
  onGoBack: () => void;
  canGoBack: boolean;
  rightAction?: React.ReactNode;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  path, 
  rootLabel,
  onNavigate, 
  onGoBack, 
  canGoBack,
  rightAction,
}) => {
  return (
    <div className="mb-4 flex items-center rounded-md bg-background-secondary p-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onGoBack}
        disabled={!canGoBack}
        className="mr-2"
        aria-label="Volver atrás"
      >
        <ChevronLeft className="w-5 h-5 text-text-secondary" />
      </Button>
      
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto py-1 scrollbar-hide">
        <button 
          onClick={() => onNavigate(-1)}
          className="flex items-center px-2 py-1 hover:bg-background-tertiary rounded transition-colors"
        >
          <Home size={16} className="text-primary" />
          {rootLabel && path.length === 0 && (
            <span className="ml-2 whitespace-nowrap text-text-secondary">{rootLabel}</span>
          )}
        </button>
        
        {path.filter(Boolean).map((segment, index) => (
          <React.Fragment key={index}>
            <ChevronRight size={16} className="mx-1 text-text-tertiary" />
            <button
              onClick={() => onNavigate(index)}
              className="px-2 py-1 text-text-secondary hover:text-text-primary hover:bg-background-tertiary rounded transition-colors whitespace-nowrap"
            >
              {segment}
            </button>
          </React.Fragment>
        ))}
      </div>
      {rightAction && <div className="ml-auto flex flex-shrink-0 items-center pl-3">{rightAction}</div>}
    </div>
  );
};

export default Breadcrumb;
