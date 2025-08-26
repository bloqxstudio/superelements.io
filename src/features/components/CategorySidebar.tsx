
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Button } from '@/components/ui/button';
import { Folder, FolderOpen, Globe } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const CategorySidebar: React.FC = () => {
  const navigate = useNavigate();
  const { getConnectionById } = useConnectionsStore();
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

  const handleAllComponentsClick = () => {
    clearAllFilters();
  };

  // Check if we're in the initial "All Components" state
  // No active connection AND no selected categories means we're showing all components
  const isInAllComponentsState = !activeConnectionId && selectedCategories.length === 0;

  return (
    <div className="w-64 fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 shadow-sm hidden md:block">
      <div className="flex flex-col h-full pt-16 md:pt-20">
        
        {/* Header Section */}
        <div className="px-4 border-b border-gray-200 py-[8px]">
          
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
                        className={`flex-1 justify-start text-xs font-medium ${
                          activeConnectionId === connection.connectionId 
                            ? 'bg-gray-200 text-gray-900' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          if (activeConnectionId === connection.connectionId) {
                            toggleConnectionExpansion(connection.connectionId);
                          } else {
                            selectConnection(connection.connectionId);
                            toggleConnectionExpansion(connection.connectionId);
                          }
                        }}
                      >
                        {expandedConnections.has(connection.connectionId) ? (
                          <FolderOpen className="h-3 w-3 mr-2" />
                        ) : (
                          <Folder className="h-3 w-3 mr-2" />
                        )}
                        <span className="truncate">{connection.connectionName}</span>
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
                              isConnectionAllSelected(connection.connectionId) 
                                ? 'bg-gray-200 text-gray-900' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => selectAllFromConnection(connection.connectionId)}
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
                            className={`w-full justify-start text-xs ${
                              isCategorySelected(category.id) 
                                ? 'bg-gray-200 text-gray-900' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => selectCategory(connection.connectionId, category.id)}
                          >
                            <span className="truncate">{category.name}</span>
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
