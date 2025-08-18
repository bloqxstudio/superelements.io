
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Shield, Folder, FolderOpen, Globe, Gift } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const CategorySidebar: React.FC = () => {
  const navigate = useNavigate();
  const {
    userRole,
    isAdmin,
    isPro,
    isFree
  } = useAccessControl();
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

  const handleUpgradeClick = () => {
    navigate('/pricing');
  };

  const handleAllComponentsClick = () => {
    clearAllFilters();
  };

  // Check if we're in the initial "All Components" state
  // No active connection AND no selected categories means we're showing all components
  const isInAllComponentsState = !activeConnectionId && selectedCategories.length === 0;

  console.log('CategorySidebar render:', {
    connectionsCount: connectionsData.length,
    activeConnectionId,
    selectedCategoriesCount: selectedCategories.length,
    hasActiveFilters,
    isInAllComponentsState
  });

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
            All Components
          </Button>
        </div>

        {/* Categories Section */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {connectionsData.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                No active connections found.
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
                            Loading categories...
                          </div>
                        )}
                        
                        {connection.error && (
                          <div className="text-xs text-red-500 py-2">
                            Error: {connection.error}
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
                            <span className="font-medium">All</span>
                          </Button>
                        )}
                        
                        {connection.isLoaded && connection.categories.length === 0 && (
                          <div className="text-xs text-gray-500 py-2">
                            No categories found
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

        {/* Bottom Section - Plan Status */}
        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <div className="text-center">
            {isAdmin ? (
              <>
                <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium inline-flex items-center">
                  <Shield className="h-3 w-3 mr-1" />
                  ADMIN ACCESS
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Full system access enabled
                </p>
              </>
            ) : isPro ? (
              <>
                <div className="bg-[#D2F525] text-black px-3 py-1 rounded-full text-xs font-medium inline-flex items-center">
                  <Crown className="h-3 w-3 mr-1" />
                  PRO ACTIVE
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  You have access to all features
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <div className="mb-2 text-xs font-medium text-gray-600">FREE PLAN</div>
                <p className="text-xs text-gray-600 mb-3">
                  Upgrade to PRO for premium features
                </p>
                <Button 
                  onClick={handleUpgradeClick} 
                  className="w-full bg-[#D2F525] text-black hover:bg-[#B8CC02]" 
                  size="sm"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to PRO
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
