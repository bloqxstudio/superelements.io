import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { useConnectionsStore } from '@/store/connectionsStore';
import { toast } from '@/hooks/use-toast';

interface UseOptimizedFastLoadingProps {
  selectedCategories: number[];
  activeConnectionId?: string;
}

const isDevelopment = import.meta.env.DEV;

export const useOptimizedFastLoading = ({
  selectedCategories,
  activeConnectionId,
}: UseOptimizedFastLoadingProps) => {
  const { setComponents, setAvailableCategories } = useWordPressStore();
  const { connections } = useConnectionsStore();
  const { fetchComponents } = useWordPressApi();

  // Get all active connections (simplified - no user role filtering)
  const allUserConnections = connections.filter(c => c.isActive);
  
  // Filter connections based on activeConnectionId
  const targetConnections = activeConnectionId 
    ? allUserConnections.filter(c => c.id === activeConnectionId)
    : allUserConnections;

  // ✅ Cache APENAS por connection - categorias são filtradas client-side
  const queryKey = [
    'optimizedComponents',
    activeConnectionId || 'all-connections',
    targetConnections.map(c => c.id).sort().join(',')
    // ❌ REMOVIDO: selectedCategories do queryKey para evitar refetch
  ];

  const queryFn = async () => {
    if (targetConnections.length === 0) {
      if (isDevelopment) {
        console.warn('❌ No connections available for current user role.');
      }
      return { components: [], categories: [], totalLoaded: 0 };
    }

    try {
      if (isDevelopment) {
        console.log('🚀 OPTIMIZED LOADING START');
        console.log('Target connections:', targetConnections.length);
      }

      // Parallel loading for all connections - SEM filtro de categoria
      const connectionPromises = targetConnections.map(async (connection) => {
        const connectionConfig = {
          baseUrl: connection.base_url,
          postType: connection.post_type,
          jsonField: connection.json_field,
          previewField: connection.preview_field,
          username: connection.credentials?.username || '',
          applicationPassword: connection.credentials?.application_password || '',
        };

        try {
          // Carregar páginas em paralelo SEM filtro de categoria
          const pagePromises = [1, 2, 3].map(page =>
            fetchComponents(connectionConfig, {
              page,
              perPage: 50
              // ✅ REMOVIDO: categoryIds - carregar TUDO para filtrar client-side
            })
          );

          const pageResults = await Promise.allSettled(pagePromises);
          
          let allComponents = [];
          let totalAvailable = 0;
          
          for (const result of pageResults) {
            if (result.status === 'fulfilled' && result.value?.components) {
              if (totalAvailable === 0 && result.value.totalComponents) {
                totalAvailable = result.value.totalComponents;
              }
              
              const componentsWithConnectionInfo = result.value.components.map(component => ({
                ...component,
                connection_id: connection.id,
                connection_name: connection.name,
                connection_user_type: connection.userType,
                connection_access_level: connection.accessLevel
              }));
              allComponents.push(...componentsWithConnectionInfo);
            }
          }

          if (isDevelopment) {
            console.log(`✅ Loaded ${allComponents.length} from ${connection.name}`);
          }

          return {
            connectionName: connection.name,
            components: allComponents,
            totalAvailable,
            success: true
          };

        } catch (error) {
          if (isDevelopment) {
            console.error(`❌ Failed to load ${connection.name}:`, error);
          }
          
          return {
            connectionName: connection.name,
            components: [],
            success: false,
            error: error.message
          };
        }
      });

      // Wait for all connections to complete
      const connectionResults = await Promise.all(connectionPromises);
      
      // Aggregate results
      let allComponents = [];
      let totalAvailable = 0;
      let successfulConnections = [];
      let failedConnections = [];

      connectionResults.forEach(result => {
        if (result.success) {
          allComponents.push(...result.components);
          totalAvailable += result.totalAvailable || 0;
          successfulConnections.push(result.connectionName);
        } else {
          failedConnections.push({
            name: result.connectionName,
            error: result.error
          });
        }
      });

      // Extract ALL categories from ALL components
      const categoryMap = new Map();
      allComponents.forEach(component => {
        if (component.categories && Array.isArray(component.categories)) {
          component.categories.forEach(catId => {
            if (!categoryMap.has(catId)) {
              categoryMap.set(catId, {
                id: catId,
                name: `Category ${catId}`,
                slug: `cat-${catId}`,
                count: 1
              });
            } else {
              categoryMap.get(catId).count += 1;
            }
          });
        }
      });
      const allCategories = Array.from(categoryMap.values());

      // Update store with ALL components (cache completo)
      setComponents(allComponents);
      setAvailableCategories(allCategories);

      // Show toast only for critical errors
      if (allComponents.length === 0 && failedConnections.length > 0) {
        toast({
          title: "Loading Failed",
          description: `Unable to load components from any connection.`,
          variant: "destructive",
          duration: 3000
        });
      }

      if (isDevelopment) {
        console.log('✅ CACHE LOADED:', allComponents.length, 'components');
      }

      // ✅ Retornar TODOS os componentes (sem filtro) - filtro será aplicado externamente
      return { 
        components: allComponents, // ✅ All components without filter
        categories: allCategories,
        totalLoaded: allComponents.length,
        totalAvailable: allComponents.length,
        successfulConnections: successfulConnections.length,
        failedConnections: failedConnections.length
      };

    } catch (error) {
      if (isDevelopment) {
        console.error('💥 OPTIMIZED LOADING ERROR:', error);
      }
      
      toast({
        title: "Loading Error", 
        description: `Failed to load components`,
        variant: "destructive",
        duration: 3000
      });
      
      throw error;
    }
  };

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey,
    queryFn,
    enabled: targetConnections.length > 0,
    retry: false, // Don't retry in React Query - we handle retries in fetch logic
    refetchOnMount: false, // Prevent constant reloads
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000, // 30 minutes - longer cache for resilience
    gcTime: 60 * 60 * 1000, // 1 hour garbage collection
    placeholderData: (previousData) => previousData, // Keep showing old data during errors
  });

  // ✅ FILTRO CLIENT-SIDE REATIVO - Re-executa quando selectedCategories muda
  const filteredComponents = React.useMemo(() => {
    const allComponents = data?.components || [];
    
    if (selectedCategories.length === 0) {
      return allComponents;
    }
    
    return allComponents.filter(comp => 
      comp.categories?.some(catId => selectedCategories.includes(catId))
    );
  }, [data?.components, selectedCategories]);

  const totalComponents = filteredComponents.length;

  if (isDevelopment) {
    console.log('📊 OPTIMIZED LOADING STATE:', {
      isLoading,
      totalComponents,
      connectionsCount: targetConnections.length,
      hasData: !!data,
      successfulConnections: data?.successfulConnections || 0
    });
  }

  return {
    data: data ? {
      ...data,
      components: filteredComponents, // ✅ Return filtered components
      totalLoaded: filteredComponents.length
    } : undefined,
    isLoading,
    isError,
    error: error?.message || null,
    isFetching,
    refetch,
    isReady: !isLoading && !isError && !!data,
    totalComponents,
    successfulConnections: data?.successfulConnections || 0,
    failedConnections: data?.failedConnections || 0,
    // Simplified API to match existing interface
    loadingState: isLoading ? 'loading' : isError ? 'error' : 'idle',
    progress: 0,
    isInitializing: isLoading,
    isApplyingFilters: isFetching && !isLoading,
    isLoadingPage: isLoading,
    hasExistingComponents: totalComponents > 0,
    reset: () => refetch(),
    initializeFastLoading: () => refetch(),
    loadNextPage: () => Promise.resolve(false),
    cancelOperation: () => {},
    retryCount: 0,
    maxRetries: 1
  };
};
