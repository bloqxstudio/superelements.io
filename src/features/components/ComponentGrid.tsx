
import React, { memo } from 'react';
import { useOptimizedFastLoading } from '@/hooks/useOptimizedFastLoading';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import ComponentGridError from './ComponentGridError';
import OptimizedComponentGridLoading from './OptimizedComponentGridLoading';
import ComponentGridContent from './ComponentGridContent';
import { useComponentGridCallbacks } from './hooks/useComponentGridCallbacks';
import { useWordPressStore } from '@/store/wordpressStore';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Badge } from '@/components/ui/badge';
import { Grid, Globe, AlertCircle, Loader2 } from 'lucide-react';

interface ComponentGridProps {
  onPreview: (url: string, title: string) => void;
}

const ComponentGrid: React.FC<ComponentGridProps> = memo(({ onPreview }) => {
  const { activeConnectionId, selectedCategories } = useMultiConnectionData();
  const { connections } = useConnectionsStore();
  const { config } = useWordPressStore();

  const {
    data,
    isLoading,
    isError,
    error,
    isReady,
    refetch,
    totalComponents,
    isFetching
  } = useOptimizedFastLoading({
    selectedCategories,
    activeConnectionId
  });

  // Track if we're filtering (fetching but not loading from scratch)
  const isApplyingFilters = isFetching && !isLoading;

  const {
    handleCopyComponent,
    memoizedGetDesktopPreviewUrl,
    memoizedGetPreviewUrl
  } = useComponentGridCallbacks({
    config,
    reset: refetch
  });

  const displayComponents = data?.components || [];

  // Context determination
  const isShowingAllComponents = !activeConnectionId && selectedCategories.length === 0;
  const activeConnection = connections.find(c => c.id === activeConnectionId);

  // Show error state
  if (isError && error) {
    return (
      <ComponentGridError 
        error={error} 
        onRetry={refetch} 
        onCancel={() => {}} 
        onForceReload={() => window.location.reload()} 
        canRetry={true} 
      />
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <OptimizedComponentGridLoading 
        variant="loading"
        count={8}
      />
    );
  }

  // Show content with filtering indicator
  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-4">
        {isLoading ? (
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading components...</span>
          </Badge>
        ) : isApplyingFilters ? (
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs">Filtering...</span>
          </Badge>
        ) : displayComponents.length > 0 ? (
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1">
            {isShowingAllComponents ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Grid className="h-4 w-4" />
            )}
            <span>
              {displayComponents.length} 
              {data?.totalAvailable && data.totalAvailable > displayComponents.length && (
                <span> of {data.totalAvailable}</span>
              )} {displayComponents.length === 1 ? 'component' : 'components'} found
              {isShowingAllComponents && connections.filter(c => c.isActive).length > 1 && (
                <span className="text-muted-foreground ml-1">
                  (from {connections.filter(c => c.isActive).length} connections)
                </span>
              )}
              {activeConnection && (
                <span className="text-muted-foreground ml-1">
                  from {activeConnection.name}
                </span>
              )}
            </span>
            {data?.totalAvailable && data.totalAvailable > displayComponents.length && (
              <span className="text-xs text-muted-foreground ml-2">
                (showing first {displayComponents.length})
              </span>
            )}
          </Badge>
        ) : (
          <Badge variant="outline" className="flex items-center gap-2 px-3 py-1">
            <AlertCircle className="h-4 w-4" />
            <span>No components found</span>
          </Badge>
        )}
      </div>

      <ComponentGridContent 
        displayComponents={displayComponents} 
        hasNextPage={false} 
        isFetchingNextPage={false} 
        error={error} 
        onRetry={refetch} 
        onPreview={onPreview} 
        handleCopyComponent={handleCopyComponent} 
        memoizedGetDesktopPreviewUrl={memoizedGetDesktopPreviewUrl} 
        memoizedGetPreviewUrl={memoizedGetPreviewUrl} 
      />
    </div>
  );
});

ComponentGrid.displayName = 'ComponentGrid';
export default ComponentGrid;
