
import React, { memo } from 'react';
import { useOptimizedFastLoading } from '@/hooks/useOptimizedFastLoading';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import ComponentGridError from './ComponentGridError';
import OptimizedComponentGridLoading from './OptimizedComponentGridLoading';
import ComponentGridContent from './ComponentGridContent';
import { useComponentGridCallbacks } from './hooks/useComponentGridCallbacks';
import { useWordPressStore } from '@/store/wordpressStore';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useLibraryComponentCount } from '@/hooks/useLibraryComponentCount';
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
    totalComponents
  } = useOptimizedFastLoading({
    selectedCategories,
    activeConnectionId
  });

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

  // Real total from WordPress API (all active designer connections, per_page=1 + X-WP-Total)
  const { data: realTotalAll } = useLibraryComponentCount();

  // Total to display: always use real API total (X-WP-Total) when available.
  // For a single connection, look up its count from byConnection.
  // Only fall back to data?.totalAvailable (capped at 150) if the API hasn't responded yet.
  const totalToShow = isShowingAllComponents
    ? (realTotalAll?.total ?? data?.totalAvailable ?? displayComponents.length)
    : (activeConnectionId && realTotalAll?.byConnection[activeConnectionId] != null
        ? realTotalAll.byConnection[activeConnectionId]
        : (data?.totalAvailable ?? displayComponents.length));

  const activeDesignerConnections = connections.filter(
    (c) => c.isActive && (!c.connection_type || c.connection_type === 'designer_connection')
  );

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

  // Show content
  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-4">
        {isLoading ? (
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading components...</span>
          </Badge>
        ) : displayComponents.length > 0 ? (
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1">
            {isShowingAllComponents ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Grid className="h-4 w-4" />
            )}
            <span>
              {totalToShow} {totalToShow === 1 ? 'component' : 'components'} found
              {isShowingAllComponents && activeDesignerConnections.length > 1 && (
                <span className="text-muted-foreground ml-1">
                  (from {activeDesignerConnections.length} connections)
                </span>
              )}
              {activeConnection && (
                <span className="text-muted-foreground ml-1">
                  from {activeConnection.name}
                </span>
              )}
            </span>
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
