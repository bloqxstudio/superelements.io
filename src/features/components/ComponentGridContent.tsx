import React, { useCallback } from 'react';
import { ComponentItem } from '@/hooks/useSimplifiedComponentLoading';
import OptimizedComponentCard from './OptimizedComponentCard';
import ComponentGridLoading from './ComponentGridLoading';
import { Button } from '@/components/ui/button';
import { RefreshCw, Package, Filter } from 'lucide-react';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useConnectionsStore } from '@/store/connectionsStore';
import '../../components/ui/component-grid.css';

interface ComponentGridContentProps {
  displayComponents: ComponentItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  onRetry: () => void;
  onPreview: (url: string, title: string, component: ComponentItem) => void;
  handleCopyComponent: (component: ComponentItem) => void;
  memoizedGetDesktopPreviewUrl: (component: ComponentItem) => string;
  memoizedGetPreviewUrl: (component: ComponentItem) => string;
}

const ComponentGridContent: React.FC<ComponentGridContentProps> = ({
  displayComponents,
  hasNextPage,
  isFetchingNextPage,
  error,
  onRetry,
  onPreview,
  handleCopyComponent,
  memoizedGetDesktopPreviewUrl,
  memoizedGetPreviewUrl
}) => {
  const { selectedCategories, clearAllFilters } = useMultiConnectionData();
  const { getConnectionById } = useConnectionsStore();
  const hasActiveFilters = selectedCategories && selectedCategories.length > 0;

  // Helper function to get component title
  const getComponentTitle = useCallback((component: ComponentItem) => {
    // Handle both string and object formats for title
    if (typeof component.title === 'string') {
      return component.title;
    }
    return (component.title as any)?.rendered || 'Untitled Component';
  }, []);

  // Helper function to get base URL for component with enhanced debugging
  const getComponentBaseUrl = useCallback((component: ComponentItem) => {
    console.log('🔍 GETTING BASE URL FOR COMPONENT - ENHANCED DEBUG:', {
      componentId: component.id,
      originalId: component.originalId,
      // Check connection_id property (not _connectionId)
      connectionId: component.connection_id,
      componentTitle: getComponentTitle(component),
      hasConnectionId: !!component.connection_id,
      availableProperties: Object.keys(component),
      fullComponent: component
    });

    // Use connection_id from the component
    const connectionId = component.connection_id;
    
    if (connectionId) {
      const connection = getConnectionById(connectionId);
      if (connection) {
        console.log('🔗 CONNECTION FOUND:', {
          connectionId: connectionId,
          connectionName: connection.name,
          baseUrl: connection.base_url,
          hasCredentials: !!(connection.username && connection.application_password)
        });
        return connection.base_url;
      } else {
        console.warn('⚠️ CONNECTION NOT FOUND:', {
          componentId: component.id,
          originalId: component.originalId,
          searchedConnectionId: connectionId
        });
      }
    } else {
      console.warn('⚠️ NO CONNECTION ID FOUND:', {
        componentId: component.id,
        originalId: component.originalId,
        checkedProperties: ['connection_id'],
        availableProperties: Object.keys(component),
        component: component
      });
    }
    
    return '';
  }, [getConnectionById, getComponentTitle]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      console.log('Load more requested');
    }
  }, [hasNextPage, isFetchingNextPage]);

  // Enhanced preview handler that passes the full component
  const handlePreviewClick = useCallback((component: ComponentItem) => {
    const previewUrl = memoizedGetPreviewUrl(component);
    const title = getComponentTitle(component);
    
    console.log('🎯 MODAL PREVIEW WITH FULL COMPONENT:', {
      componentId: component.id,
      originalId: component.originalId,
      title,
      previewUrl,
      connectionId: component.connection_id,
      hasConnectionId: !!component.connection_id
    });
    
    // Chamar onPreview com URL, título E o componente completo
    onPreview(previewUrl, title, component);
  }, [memoizedGetPreviewUrl, getComponentTitle, onPreview]);

  // Empty state when no components
  if (displayComponents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
            {hasActiveFilters ? (
              <Filter className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          
          <h3 className="text-lg font-semibold mb-2">
            {hasActiveFilters ? 'No matching components' : 'No components found'}
          </h3>
          
          <p className="text-muted-foreground mb-6">
            {hasActiveFilters 
              ? 'Try adjusting your category filters to see more components.'
              : 'No components are available in your connected library at the moment.'
            }
          </p>
          
          <div className="flex gap-3 justify-center">
            {hasActiveFilters && clearAllFilters && (
              <Button onClick={() => clearAllFilters()} variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Components Grid - Using custom CSS classes for responsive layout */}
      <div className="component-grid">
        {displayComponents.map((component) => {
          const baseUrl = getComponentBaseUrl(component);
          
          console.log('🎯 RENDERING COMPONENT CARD:', {
            componentId: component.id,
            originalId: component.originalId,
            title: getComponentTitle(component),
            baseUrl,
            connectionId: component.connection_id,
            hasBaseUrl: !!baseUrl
          });
          
          return (
            <OptimizedComponentCard
              key={component.id}
              component={component}
              onPreview={() => handlePreviewClick(component)}
              getDesktopPreviewUrl={memoizedGetDesktopPreviewUrl}
              getPreviewUrl={memoizedGetPreviewUrl}
              baseUrl={baseUrl}
            />
          );
        })}
      </div>

      {/* Infinite Scroll Loading */}
      {isFetchingNextPage && (
        <div className="py-8">
          <ComponentGridLoading 
            variant="loading"
            count={4}
            showCancel={false}
          />
        </div>
      )}

      {/* Load More Button (fallback for infinite scroll) */}
      {hasNextPage && !isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <Button 
            onClick={loadMore}
            variant="outline"
            className="flex items-center gap-2"
          >
            Load More Components
          </Button>
        </div>
      )}

      {/* End of results indicator */}
      {!hasNextPage && displayComponents.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            You've reached the end of your component library
          </p>
        </div>
      )}
    </div>
  );
};

export default ComponentGridContent;
