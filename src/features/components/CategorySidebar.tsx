
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useLibraryComponentCount } from '@/hooks/useLibraryComponentCount';
import { Button } from '@/components/ui/button';
import { Folder, FolderOpen, Globe, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSlugResolver } from '@/hooks/useSlugResolver';
import { useCategoryCache } from '@/hooks/useCategoryCache';
import { useComponentMetadataCache } from '@/hooks/useComponentMetadataCache';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export const CategorySidebar: React.FC = () => {
  const navigate = useNavigate();
  const { connectionId: urlConnectionId, categoryId: urlCategoryId, connectionSlug, categorySlug } = useParams();
  const { getConnectionById } = useConnectionsStore();
  const { getConnectionSlug, getCategorySlug } = useSlugResolver();
  const { invalidateCache: invalidateCategoryCache } = useCategoryCache();
  const { invalidateCache: invalidateComponentCache } = useComponentMetadataCache();
  const queryClient = useQueryClient();
  const { data: libCount } = useLibraryComponentCount();
  const {
    connectionsData,
    expandedConnections,
    activeConnectionId,
    selectedCategories,
    toggleConnectionExpansion,
    selectConnection,
    selectAllFromConnection,
    selectCategory,
    clearAllFilters,
    isCategorySelected,
    isConnectionAllSelected,
    hasActiveFilters
  } = useMultiConnectionData();

  // Track which connections have been auto-expanded to avoid forcing them open
  const autoExpandedRef = React.useRef<Set<string>>(new Set());

  // Auto-expand connection when accessing via direct link (only once per connection)
  React.useEffect(() => {
    // Determine which connection should be expanded based on URL
    let targetConnectionId: string | null = null;

    // Resolve connection from slug or ID
    if (connectionSlug) {
      const connection = connectionsData.find(cd => 
        getConnectionById(cd.connectionId)?.slug === connectionSlug
      );
      targetConnectionId = connection?.connectionId || null;
    } else if (urlConnectionId) {
      targetConnectionId = urlConnectionId;
    }

    // Only auto-expand if:
    // 1. We have a target connection
    // 2. It hasn't been auto-expanded before
    // 3. It's not currently expanded
    if (targetConnectionId && 
        !autoExpandedRef.current.has(targetConnectionId) && 
        !expandedConnections.has(targetConnectionId)) {
      // Wait for connection data to be loaded before expanding
      const connection = connectionsData.find(cd => cd.connectionId === targetConnectionId);
      if (connection && (connection.isLoaded || connection.isLoading)) {
        console.log('🔓 Auto-expanding connection from URL:', connection.connectionName);
        toggleConnectionExpansion(targetConnectionId);
        autoExpandedRef.current.add(targetConnectionId);
      }
    }
  }, [connectionSlug, urlConnectionId, connectionsData, expandedConnections, toggleConnectionExpansion, getConnectionById]);

  const handleAllComponentsClick = () => {
    navigate('/');
    clearAllFilters();
  };

  const handleForceRefresh = () => {
    // Invalidar todos os caches
    invalidateCategoryCache();
    invalidateComponentCache();
    
    // Invalidar queries do React Query
    queryClient.invalidateQueries({ queryKey: ['optimizedComponents'] });
    
    // Mostrar toast de confirmação
    toast({
      title: "Cache limpo",
      description: "Recarregando dados frescos do servidor...",
      duration: 2000
    });
  };

  const handleConnectionClick = (connectionId: string) => {
    const slug = getConnectionSlug(connectionId);
    navigate(slug ? `/${slug}` : `/connection/${connectionId}`);
  };

  const handleCategoryClick = (connectionId: string, categoryId: number, categorySlug: string) => {
    const connSlug = getConnectionSlug(connectionId);
    
    if (connSlug && categorySlug) {
      navigate(`/${connSlug}/${categorySlug}`);
    } else {
      navigate(`/connection/${connectionId}/category/${categoryId}`);
    }
  };

  // Check if we're in the initial "All Components" state based on URL
  const isInAllComponentsState = !urlConnectionId && !urlCategoryId && !connectionSlug && !categorySlug;

  return (
    <div className="w-64 fixed top-[65px] bottom-0 left-64 z-30 bg-white border-r border-gray-200 shadow-sm hidden md:block">
      <div className="flex flex-col h-full">
        
        {/* Header Section */}
        <div className="px-4 border-b border-gray-200 py-[8px]">
          
          {/* Force Refresh Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-center text-xs font-medium mb-2"
            onClick={handleForceRefresh}
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Forçar Atualização
          </Button>
          
          {/* All Components Option - Highlight when active */}
          <Button 
            variant={isInAllComponentsState ? "default" : "ghost"} 
            size="sm" 
            className={`w-full justify-start text-xs font-medium mb-2 ${
              isInAllComponentsState 
                ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                : 'hover:bg-gray-100'
            }`}
            onClick={handleAllComponentsClick}
          >
            <Globe className="h-3 w-3 mr-2" />
            Todos os Componentes
          </Button>
        </div>

        {/* Categories Section */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {connectionsData.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                Nenhuma conexão ativa encontrada.
              </div>
            ) : (
              <>
                {connectionsData.map(connection => (
                  <div key={connection.connectionId} className="space-y-2">
                    {/* Connection Header */}
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`flex-1 justify-between text-xs font-medium ${
                          (urlConnectionId === connection.connectionId || 
                           (connectionSlug && getConnectionById(connection.connectionId)?.slug === connectionSlug))
                            ? 'bg-gray-200 text-gray-900' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          // Always toggle expansion on click
                          toggleConnectionExpansion(connection.connectionId);
                          
                          // Navigate only if not already on this connection
                          if (urlConnectionId !== connection.connectionId && 
                              !(connectionSlug && getConnectionById(connection.connectionId)?.slug === connectionSlug)) {
                            handleConnectionClick(connection.connectionId);
                          }
                        }}
                      >
                        <div className="flex items-center truncate">
                          {expandedConnections.has(connection.connectionId) ? (
                            <FolderOpen className="h-3 w-3 mr-2 flex-shrink-0" />
                          ) : (
                            <Folder className="h-3 w-3 mr-2 flex-shrink-0" />
                          )}
                          <span className="truncate">{connection.connectionName}</span>
                        </div>
                        {libCount?.byConnection[connection.connectionId] != null ? (
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            ({libCount.byConnection[connection.connectionId]})
                          </span>
                        ) : connection.isLoaded && connection.categories.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            ({connection.categories.reduce((sum, cat) => sum + cat.count, 0)})
                          </span>
                        )}
                      </Button>
                      
                    </div>

                    {/* Connection Content - All + Categories List */}
                    {expandedConnections.has(connection.connectionId) && (
                      <div className="ml-4 space-y-1">
                        {connection.isLoading && (
                          <div className="text-xs text-gray-500 py-2">
                            Carregando categorias...
                          </div>
                        )}
                        
                        {connection.error && (
                          <div className="text-xs text-red-500 py-2">
                            Erro: {connection.error}
                          </div>
                        )}
                        
                        {/* "All" Option for this Connection */}
                        {connection.isLoaded && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`w-full justify-start text-xs ${
                              ((urlConnectionId === connection.connectionId && !urlCategoryId) ||
                               (connectionSlug && getConnectionById(connection.connectionId)?.slug === connectionSlug && !categorySlug))
                                ? 'bg-gray-200 text-gray-900' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => handleConnectionClick(connection.connectionId)}
                          >
                            <span className="font-medium">Todos</span>
                          </Button>
                        )}
                        
                        {connection.isLoaded && connection.categories.length === 0 && (
                          <div className="text-xs text-gray-500 py-2">
                            Nenhuma categoria encontrada
                          </div>
                        )}
                        
                        {/* Individual Categories */}
                        {connection.categories.map(category => (
                          <Button 
                            key={category.id} 
                            variant="ghost" 
                            size="sm" 
                            className={`w-full justify-between text-xs ${
                              (urlCategoryId === String(category.id) ||
                               (categorySlug && category.slug === categorySlug))
                                ? 'bg-gray-200 text-gray-900' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => handleCategoryClick(connection.connectionId, category.id, category.slug)}
                          >
                            <span className="truncate flex-1 text-left">{category.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({category.count})</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
