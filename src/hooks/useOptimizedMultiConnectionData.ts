
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

const isDevelopment = import.meta.env.DEV;

export const useOptimizedMultiConnectionData = () => {
  const { connections, activeConnectionId, setActiveConnection } = useConnectionsStore();
  const { selectedCategories, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage } = useWordPressStore();
  
  const [connectionData, setConnectionData] = useState<Map<string, ConnectionCategories>>(new Map());
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  // Stable memoized active connections
  const activeConnections = useMemo(() => {
    return connections.filter(conn => conn.isActive);
  }, [connections]);

  // Stable key for active connections
  const activeConnectionsKey = useMemo(() => {
    return activeConnections.map(c => `${c.id}-${c.isActive}`).join(',');
  }, [activeConnections]);

  // Ensure initial clean state - "All Components"
  useEffect(() => {
    if (isDevelopment && !activeConnectionId && selectedCategories.length === 0) {
      console.log('✅ Initial state: "All Components" mode');
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
        if (isDevelopment) {
          console.log(`Removing data for inactive connection: ${connectionId}`);
        }
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
        if (isDevelopment) {
          console.log('Active connection is no longer active, returning to "All Components"');
        }
        clearAllFilters();
      }
    }
  }, [activeConnectionId, activeConnections]);

  const loadConnectionCategories = useCallback(async (connectionId: string) => {
    const connection = activeConnections.find(c => c.id === connectionId);
    if (!connection) {
      if (isDevelopment) {
        console.log(`Connection ${connectionId} not found in active connections`);
      }
      return;
    }

    if (isDevelopment) {
      console.log(`Loading categories for: ${connection.name}`);
    }

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
        username: connection.credentials?.username || '',
        applicationPassword: connection.credentials?.application_password || '',
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

      if (isDevelopment) {
        console.log(`✅ Loaded ${categoriesWithComponents.length} categories for: ${connection.name}`);
      }
      
    } catch (error) {
      if (isDevelopment) {
        console.error(`❌ Error loading categories for ${connectionId}:`, error);
      }
      
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
    if (isDevelopment) {
      console.log(`Refreshing categories for: ${connectionId}`);
    }
    
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
      // Only expand the clicked connection
      setExpandedConnections(new Set([connectionId]));
    }
  }, [expandedConnections]);

  const selectConnection = useCallback((connectionId: string) => {
    const isConnectionActive = activeConnections.some(conn => conn.id === connectionId);
    if (!isConnectionActive) {
      if (isDevelopment) {
        console.log('Cannot select inactive connection:', connectionId);
      }
      return;
    }

    if (isDevelopment) {
      console.log('Selecting connection:', connectionId);
    }
    
    setActiveConnection(connectionId);
    setSelectedCategories([]);
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
    setExpandedConnections(new Set([connectionId]));
  }, [activeConnections, setActiveConnection, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const selectAllFromConnection = useCallback((connectionId: string) => {
    const isConnectionActive = activeConnections.some(conn => conn.id === connectionId);
    if (!isConnectionActive) {
      if (isDevelopment) {
        console.log('Cannot select all from inactive connection:', connectionId);
      }
      return;
    }

    if (isDevelopment) {
      console.log('Selecting all from connection:', connectionId);
    }
    
    setActiveConnection(connectionId);
    setSelectedCategories([]);
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
    setExpandedConnections(new Set([connectionId]));
  }, [activeConnections, setActiveConnection, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const selectCategory = useCallback((connectionId: string, categoryId: number) => {
    const isConnectionActive = activeConnections.some(conn => conn.id === connectionId);
    if (!isConnectionActive) {
      if (isDevelopment) {
        console.log('Cannot select category from inactive connection:', connectionId);
      }
      return;
    }

    if (isDevelopment) {
      console.log('Selecting category:', categoryId, 'from connection:', connectionId);
    }
    
    setActiveConnection(connectionId);
    setSelectedCategories([categoryId]);
    setExpandedConnections(new Set([connectionId]));
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
  }, [activeConnections, setActiveConnection, setSelectedCategories, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const clearAllFilters = useCallback(() => {
    if (isDevelopment) {
      console.log('🏠 Clearing all filters - returning to "All Components"');
    }
    
    setSelectedCategories([]);
    setActiveConnection(null);
    clearLoadedPages();
    setIsFastLoading(false);
    setFastLoadingPage(0);
    setExpandedConnections(new Set());
  }, [setSelectedCategories, setActiveConnection, clearLoadedPages, setIsFastLoading, setFastLoadingPage]);

  const isCategorySelected = useCallback((categoryId: number) => {
    return selectedCategories.includes(categoryId);
  }, [selectedCategories]);

  const isConnectionAllSelected = useCallback((connectionId: string) => {
    return activeConnectionId === connectionId && selectedCategories.length === 0;
  }, [activeConnectionId, selectedCategories]);

  const getConnectionsArray = useCallback(() => {
    return Array.from(connectionData.values())
      .filter(data => activeConnections.some(conn => conn.id === data.connectionId))
      .sort((a, b) => a.connectionName.localeCompare(b.connectionName));
  }, [connectionData, activeConnections]);

  const hasActiveFilters = selectedCategories.length > 0;
  
  if (isDevelopment) {
    console.log('Multi-connection state:', {
      activeConnectionsCount: activeConnections.length,
      selectedCategoriesCount: selectedCategories.length,
      hasActiveFilters,
      activeConnectionId
    });
  }

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
