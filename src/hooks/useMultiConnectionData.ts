import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';
import { PostTypeCategoryService } from '@/services/postTypeCategoryService';

interface ConnectionCategories {
  connectionId: string;
  connectionName: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
    count: number;
  }>;
  isLoading: boolean;
  isLoaded: boolean;
  error?: string;
  lastRefresh?: Date;
}

export const useMultiConnectionData = () => {
  const { connections, activeConnectionId, setActiveConnection } = useConnectionsStore();
  const { selectedCategories, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage } = useWordPressStore();
  
  const [connectionData, setConnectionData] = useState<Map<string, ConnectionCategories>>(new Map());
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  // Memoize active connections to prevent infinite loops
  const activeConnections = useMemo(() => {
    return connections.filter(conn => conn.isActive);
  }, [connections]);

  // Create a stable key for active connections to prevent unnecessary re-renders
  const activeConnectionsKey = useMemo(() => {
    return activeConnections.map(c => `${c.id}-${c.name}-${c.isActive}`).join(',');
  }, [activeConnections]);

  // Garantir estado inicial limpo - "All Components"
  useEffect(() => {
    console.log('🏠 Ensuring initial clean state for "All Components"');
    
    // Se não há conexão ativa nem categorias selecionadas no carregamento inicial
    if (!activeConnectionId && selectedCategories.length === 0) {
      console.log('✅ Initial state confirmed: "All Components" mode');
    }
  }, []);

  // Initialize data for active connections only and auto-load categories
  useEffect(() => {
    const newConnectionData = new Map<string, ConnectionCategories>();
    
    // Only process active connections
    activeConnections.forEach(connection => {
      if (!connectionData.has(connection.id)) {
        newConnectionData.set(connection.id, {
          connectionId: connection.id,
          connectionName: connection.name,
          categories: [],
          isLoading: false,
          isLoaded: false
        });
      } else {
        newConnectionData.set(connection.id, connectionData.get(connection.id)!);
      }
    });

    // Remove data for connections that are no longer active
    const activeConnectionIds = new Set(activeConnections.map(c => c.id));
    for (const [connectionId] of connectionData.entries()) {
      if (!activeConnectionIds.has(connectionId)) {
        console.log(`Removing data for inactive connection: ${connectionId}`);
      }
    }
    
    setConnectionData(newConnectionData);

    // Auto-load categories for all active connections (but don't expand them)
    activeConnections.forEach(connection => {
      const existing = connectionData.get(connection.id);
      if (!existing || (!existing.isLoaded && !existing.isLoading)) {
        loadConnectionCategories(connection.id);
      }
    });
  }, [activeConnectionsKey]);

  // Clear selection if the active connection becomes inactive
  useEffect(() => {
    if (activeConnectionId) {
      const isActiveConnectionStillActive = activeConnections.some(conn => conn.id === activeConnectionId);
      if (!isActiveConnectionStillActive) {
        console.log('Active connection is no longer active, returning to "All Components"');
        clearAllFilters();
      }
    }
  }, [activeConnectionId, activeConnections]);

  const loadConnectionCategories = useCallback(async (connectionId: string) => {
    const connection = activeConnections.find(c => c.id === connectionId);
    if (!connection) {
      console.log(`Connection ${connectionId} not found in active connections`);
      return;
    }

    console.log(`Loading categories with components for active connection: ${connection.name} (${connection.post_type})`);

    setConnectionData(prev => {
      const newData = new Map(prev);
      const existing = newData.get(connectionId);
      if (existing) {
        newData.set(connectionId, { ...existing, isLoading: true, error: undefined });
      }
      return newData;
    });

    try {
      const connectionConfig = {
        baseUrl: connection.base_url,
        postType: connection.post_type,
        jsonField: connection.json_field,
        previewField: connection.preview_field,
        username: connection.username,
        applicationPassword: connection.application_password,
      };

      const categoriesWithComponents = await PostTypeCategoryService.fetchCategoriesWithComponents(connectionConfig);

      setConnectionData(prev => {
        const newData = new Map(prev);
        const existing = newData.get(connectionId);
        if (existing) {
          newData.set(connectionId, {
            ...existing,
            categories: categoriesWithComponents,
            isLoading: false,
            isLoaded: true,
            lastRefresh: new Date()
          });
        }
        return newData;
      });

      console.log(`Loaded ${categoriesWithComponents.length} categories with components for active connection: ${connection.name}`, categoriesWithComponents);
      
    } catch (error) {
      console.error(`Error loading categories for active connection ${connectionId}:`, error);
      
      setConnectionData(prev => {
        const newData = new Map(prev);
        const existing = newData.get(connectionId);
        if (existing) {
          newData.set(connectionId, {
            ...existing,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load categories'
          });
        }
        return newData;
      });
    }
  }, [activeConnections]);

  const refreshConnectionCategories = useCallback(async (connectionId: string) => {
    console.log(`Refreshing categories for active connection: ${connectionId}`);
    
    setConnectionData(prev => {
      const newData = new Map(prev);
      const existing = newData.get(connectionId);
      if (existing) {
        newData.set(connectionId, {
          ...existing,
          isLoaded: false,
          error: undefined
        });
      }
      return newData;
    });

    await loadConnectionCategories(connectionId);
  }, [loadConnectionCategories]);

  const toggleConnectionExpansion = useCallback(async (connectionId: string) => {
    const isCurrentlyExpanded = expandedConnections.has(connectionId);
    
    if (isCurrentlyExpanded) {
      setExpandedConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    } else {
      // Only expand the clicked connection, collapse others for clean UI
      setExpandedConnections(new Set([connectionId]));
    }
  }, [expandedConnections]);

  const selectConnection = useCallback((connectionId: string) => {
    const isConnectionActive = activeConnections.some(conn => conn.id === connectionId);
    if (!isConnectionActive) {
      console.log('Cannot select inactive connection:', connectionId);
      return;
    }

    console.log('Selecting active connection:', connectionId);
    
    // Set the selection and maintain it - do not clear anything
    setActiveConnection(connectionId);
    setSelectedCategories([]);
    
    // Only clear loaded pages for new data loading
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
    
    // Expand only the selected connection
    setExpandedConnections(new Set([connectionId]));
    
    console.log('Connection selected and maintained');
  }, [activeConnections, setActiveConnection, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const selectAllFromConnection = useCallback((connectionId: string) => {
    const isConnectionActive = activeConnections.some(conn => conn.id === connectionId);
    if (!isConnectionActive) {
      console.log('Cannot select all from inactive connection:', connectionId);
      return;
    }

    console.log('Selecting all components from active connection:', connectionId);
    
    // Set active connection and maintain the selection
    setActiveConnection(connectionId);
    setSelectedCategories([]);
    
    // Only clear loaded pages for new data loading
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
    
    // Keep the connection expanded when selecting "All" from it
    setExpandedConnections(new Set([connectionId]));
    
    console.log('All components from connection selected and maintained');
  }, [activeConnections, setActiveConnection, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const selectCategory = useCallback((connectionId: string, categoryId: number) => {
    const isConnectionActive = activeConnections.some(conn => conn.id === connectionId);
    if (!isConnectionActive) {
      console.log('Cannot select category from inactive connection:', connectionId);
      return;
    }

    console.log('Selecting category:', categoryId, 'from active connection:', connectionId);
    
    // Set the selection and maintain it
    setActiveConnection(connectionId);
    setSelectedCategories([categoryId]);
    setExpandedConnections(new Set([connectionId]));
    
    // Only clear loaded pages for new data loading
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
    
    console.log('Category selected and maintained');
  }, [activeConnections, setActiveConnection, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const clearAllFilters = useCallback(() => {
    console.log('🏠 Manually clearing all filters - returning to "All Components" state');
    
    setSelectedCategories([]);
    setActiveConnection(null);
    
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
    
    // Close all groups when returning to "All Components"
    setExpandedConnections(new Set());
    
    console.log('✅ All filters manually cleared - back to "All Components"');
  }, [setSelectedCategories, setActiveConnection, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const isCategorySelected = useCallback((categoryId: number) => {
    return selectedCategories.includes(categoryId);
  }, [selectedCategories]);

  const isConnectionAllSelected = useCallback((connectionId: string) => {
    // Connection is "all selected" when it's the active connection but no specific categories are selected
    return activeConnectionId === connectionId && selectedCategories.length === 0;
  }, [activeConnectionId, selectedCategories]);

  const getConnectionsArray = useCallback(() => {
    return Array.from(connectionData.values())
      .filter(data => activeConnections.some(conn => conn.id === data.connectionId))
      .sort((a, b) => a.connectionName.localeCompare(b.connectionName));
  }, [connectionData, activeConnections]);

  const hasActiveFilters = selectedCategories.length > 0;
  
  console.log('Multi-connection data state (active connections only):', {
    totalConnections: connections.length,
    activeConnectionsCount: activeConnections.length,
    selectedCategoriesCount: selectedCategories.length,
    hasActiveFilters,
    activeConnectionId,
    isInAllComponentsState: !activeConnectionId && selectedCategories.length === 0
  });

  return {
    connectionsData: getConnectionsArray(),
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
    refreshConnectionCategories,
    hasActiveFilters
  };
};
