
import React from 'react';
import { OptimizedSkeleton } from '@/components/ui/optimized-skeleton';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ComponentGridLoadingProps {
  variant: 'loading' | 'initializing' | 'applying-filters';
  count?: number;
  showCancel?: boolean;
  onCancel?: () => void;
}

const ComponentGridLoading: React.FC<ComponentGridLoadingProps> = ({
  variant,
  count = 12,
  showCancel = false,
  onCancel
}) => {
  const getMessage = () => {
    switch (variant) {
      case 'initializing':
        return 'Inicializando conexão...';
      case 'applying-filters':
        return 'Aplicando filtros...';
      default:
        return 'Carregando componentes...';
    }
  };

  return (
    <div className="space-y-6">
      {/* Loading Message */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div>
          <span className="text-muted-foreground">{getMessage()}</span>
        </div>
        
        {showCancel && onCancel && (
          <Button 
            onClick={onCancel} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        )}
      </div>

      {/* Skeleton Grid */}
      <div className="component-grid">
        {Array.from({ length: count }).map((_, index) => (
          <OptimizedSkeleton 
            key={index} 
            variant="card"
            className="animate-pulse"
          />
        ))}
      </div>
    </div>
  );
};

export default ComponentGridLoading;
