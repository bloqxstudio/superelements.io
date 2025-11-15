import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';

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
  // Seletores específicos com shallow comparison
  const connections = useConnectionsStore(useCallback((state) => state.connections, []));
  const activeConnectionId = useConnectionsStore(useCallback((state) => state.activeConnectionId, []));
  const setActiveConnection = useConnectionsStore(useCallback((state) => state.setActiveConnection, []));
  
  const selectedCategories = useWordPressStore(useCallback((state) => state.selectedCategories, []));
  const setSelectedCategories = useWordPressStore(useCallback((state) => state.setSelectedCategories, []));
  const clearLoadedPages = useWordPressStore(useCallback((state) => state.clearLoadedPages, []));
  const setIsFastLoading = useWordPressStore(useCallback((state) => state.setIsFastLoading, []));
  const setFastLoadingPage = useWordPressStore(useCallback((state) => state.setFastLoadingPage, []));
  
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

  // ✅ Get categories from wordpressStore (populated by useOptimizedFastLoading)
  const availableCategories = useWordPressStore(useCallback((state) => state.availableCategories, []));

  // ✅ Initialize data for active connections and use cached categories
  useEffect(() => {
    const newConnectionData = new Map<string, ConnectionCategories>();
    
    // Only process active connections
    activeConnections.forEach(connection => {
      newConnectionData.set(connection.id, {
        connectionId: connection.id,
        connectionName: connection.name,
        categories: availableCategories, // ✅ Use categories from cache
        isLoading: false,
        isLoaded: availableCategories.length > 0, // Mark as loaded if categories exist
      });
    });
    
    setConnectionData(newConnectionData);
    
    if (availableCategories.length > 0) {
      console.log(`✅ Using ${availableCategories.length} cached categories for ${activeConnections.length} connections`);
    }
  }, [activeConnectionsKey, availableCategories]);

  // Clear selection if the active connection becomes inactive
  useEffect(() => {
    if (activeConnectionId) {
      const isActiveConnectionStillActive = activeConnections.some(conn => conn.id === activeConnectionId);
      if (!isActiveConnectionStillActive) {
        console.log('Active connection became inactive, clearing selection');
        setActiveConnection(undefined);
        setSelectedCategories([]);
      }
    }
  }, [activeConnectionId, activeConnections, setActiveConnection, setSelectedCategories]);

  const toggleConnectionExpansion = useCallback((connectionId: string) => {
    setExpandedConnections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(connectionId)) {
        newSet.delete(connectionId);
      } else {
        newSet.add(connectionId);
      }
      return newSet;
    });
  }, []);

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
    hasActiveFilters
  };
};
