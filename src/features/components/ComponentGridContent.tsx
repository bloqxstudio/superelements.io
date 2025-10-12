import React from 'react';
import OptimizedComponentCard from './OptimizedComponentCard';
import ComponentGridLoading from './ComponentGridLoading';
import { Button } from '@/components/ui/button';
import { RefreshCw, Package, Filter } from 'lucide-react';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useConnectionsStore } from '@/store/connectionsStore';
import '../../components/ui/component-grid.css';

interface ComponentGridContentProps {
  displayComponents: any[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  onRetry: () => void;
  onPreview: (url: string, title: string, component: any) => void;
  handleCopyComponent: (component: any) => void;
  memoizedGetDesktopPreviewUrl: (component: any) => string;
  memoizedGetPreviewUrl: (component: any) => string;
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
  const getComponentTitle = React.useCallback((component: any) => {
    // Handle both string and object formats for title
    if (typeof component.title === 'string') {
      return component.title;
    }
    return (component.title as any)?.rendered || 'Untitled Component';
  }, []);

  // Helper function to get base URL for component
  const getComponentBaseUrl = React.useCallback((component: any) => {

    // Use connection_id from the component
    const connectionId = component.connection_id;
    
    if (connectionId) {
      const connection = getConnectionById(connectionId);
      if (connection) {
        return connection.base_url;
      }
    } 
    
    return '';
  }, [getConnectionById, getComponentTitle]);

  // Load more function for infinite scroll
  const loadMore = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      // Load more logic handled by parent
    }
  }, [hasNextPage, isFetchingNextPage]);

  // Enhanced preview handler that passes the full component
  const handlePreviewClick = React.useCallback((component: any) => {
    const previewUrl = memoizedGetPreviewUrl(component);
    const title = getComponentTitle(component);
    
    // Call onPreview with URL, title AND the full component
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
            {hasActiveFilters ? 'Nenhum componente correspondente' : 'Nenhum componente encontrado'}
          </h3>
          
          <p className="text-muted-foreground mb-6">
            {hasActiveFilters 
              ? 'Tente ajustar seus filtros de categoria para ver mais componentes.'
              : 'Nenhum componente está disponível em sua biblioteca conectada no momento.'
            }
          </p>
          
          <div className="flex gap-3 justify-center">
            {hasActiveFilters && clearAllFilters && (
              <Button onClick={() => clearAllFilters()} variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            )}
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
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
          const connectionId = component.connection_id || '';
          const connection = getConnectionById(connectionId);
          const postType = connection?.post_type || 'posts';
          
          return (
            <OptimizedComponentCard
              key={component.id}
              component={component}
              onPreview={() => handlePreviewClick(component)}
              getDesktopPreviewUrl={memoizedGetDesktopPreviewUrl}
              getPreviewUrl={memoizedGetPreviewUrl}
              baseUrl={baseUrl}
              connectionId={connectionId}
              postType={postType}
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
            Carregar Mais Componentes
          </Button>
        </div>
      )}

      {/* End of results indicator */}
      {!hasNextPage && displayComponents.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Você chegou ao final da sua biblioteca de componentes
          </p>
        </div>
      )}
    </div>
  );
};

export default ComponentGridContent;
