import React from 'react';
import { ChevronRight, ChevronLeft, Home } from 'lucide-react';
import Button from '../ui/Button';

interface BreadcrumbProps {
  path: string[];
  onNavigate: (index: number) => void;
  onGoBack: () => void;
  canGoBack: boolean;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  path, 
  onNavigate, 
  onGoBack, 
  canGoBack 
}) => {
  return (
    <div className="flex items-center p-2 bg-background-secondary rounded-md mb-4">
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
      
      <div className="flex items-center overflow-x-auto py-1 scrollbar-hide">
        <button 
          onClick={() => onNavigate(-1)}
          className="flex items-center px-2 py-1 hover:bg-background-tertiary rounded transition-colors"
        >
          <Home size={16} className="text-primary" />
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
    </div>
  );
};

export default Breadcrumb;