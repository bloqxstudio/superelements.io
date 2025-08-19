import React from 'react';
import { OptimizedSkeleton } from '@/components/ui/optimized-skeleton';

interface OptimizedComponentGridLoadingProps {
  variant: 'loading' | 'initializing' | 'applying-filters';
  count?: number;
}

const OptimizedComponentGridLoading: React.FC<OptimizedComponentGridLoadingProps> = ({
  variant,
  count = 8, // Reduced from 12
}) => {
  const getMessage = () => {
    switch (variant) {
      case 'initializing':
        return 'Connecting...';
      case 'applying-filters':
        return 'Filtering...';
      default:
        return 'Loading...';
    }
  };

  return (
    <div className="space-y-4">
      {/* Simple Loading Message */}
      <div className="flex items-center gap-2">
        <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div>
        <span className="text-muted-foreground text-sm">{getMessage()}</span>
      </div>

      {/* Optimized Skeleton Grid */}
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

export default OptimizedComponentGridLoading;