
import { useQuery } from '@tanstack/react-query';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { useConnectionsStore } from '@/store/connectionsStore';
import { toast } from '@/hooks/use-toast';
import { useComponentMetadataCache } from './useComponentMetadataCache';

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
  const { getCachedComponents, setCachedComponents, getCacheKey } = useComponentMetadataCache();

  // Get all active connections (simplified - no user role filtering)
  const allUserConnections = connections.filter(c => c.isActive);
  
  // Filter connections based on activeConnectionId
  const targetConnections = activeConnectionId 
    ? allUserConnections.filter(c => c.id === activeConnectionId)
    : allUserConnections;

  // Stable query key with reduced complexity
  const queryKey = [
    'optimizedComponents',
    activeConnectionId || 'all-user-connections',
    selectedCategories.length > 0 ? selectedCategories.sort().join(',') : 'no-categories',
    targetConnections.length
  ];

  const queryFn = async () => {
    if (targetConnections.length === 0) {
      if (isDevelopment) {
        console.warn('❌ No connections available for current user role.');
      }
      return { 
        components: [], 
        categories: [], 
        totalLoaded: 0,
        totalAvailable: 0,
        successfulConnections: 0,
        failedConnections: 0,
        fromCache: false
      };
    }

    // 1️⃣ Verificar cache primeiro
    const cachedComponents = getCachedComponents(activeConnectionId, selectedCategories);
    
    if (cachedComponents && cachedComponents.length > 0) {
      if (isDevelopment) {
        console.log(`✅ Loaded ${cachedComponents.length} components from cache`);
      }
      
      // Mostrar dados em cache imediatamente
      setComponents(cachedComponents as any);
      
      // Background refresh (buscar dados frescos silenciosamente)
      setTimeout(() => {
        if (isDevelopment) {
          console.log('🔄 Background refresh: fetching fresh data...');
        }
        fetchFreshData().then(freshData => {
          if (freshData && freshData.components.length > 0) {
            setComponents(freshData.components);
            if (isDevelopment) {
              console.log(`✅ Background refresh complete: ${freshData.components.length} components`);
            }
          }
        }).catch(err => {
          if (isDevelopment) {
            console.error('❌ Background refresh failed:', err);
          }
        });
      }, 100);
      
      return { 
        components: cachedComponents as any, 
        categories: [],
        totalLoaded: cachedComponents.length,
        totalAvailable: cachedComponents.length,
        successfulConnections: targetConnections.length,
        failedConnections: 0,
        fromCache: true
      };
    }

    // 2️⃣ Cache inválido ou ausente - buscar dados frescos
    return fetchFreshData();
  };

  const fetchFreshData = async () => {
    try {
      if (isDevelopment) {
        console.log('🚀 OPTIMIZED LOADING START');
        console.log('Target connections:', targetConnections.length);
        console.log('Selected categories:', selectedCategories.length);
      }

      // Parallel loading for all connections
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
          // Load first 3 pages in parallel (150 components max per connection)
          const pagePromises = [1, 2, 3].map(page =>
            fetchComponents(connectionConfig, {
              page,
              perPage: 50,
              categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined
            })
          );

          const pageResults = await Promise.allSettled(pagePromises);
          
          let allComponents = [];
          let totalAvailable = 0;
          
          for (const result of pageResults) {
            if (result.status === 'fulfilled' && result.value?.components) {
              // Capture total available from first page response
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
            console.log(`✅ Loaded ${allComponents.length} from ${connection.name} (${totalAvailable} total available)`);
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

      // 3️⃣ Cachear metadata (SEM elementor_data para economizar espaço)
      if (allComponents.length > 0) {
        const metadata = allComponents.map(comp => ({
          id: comp.id,
          slug: comp.slug,
          title: comp.title?.rendered || '',
          categories: comp.categories || [],
          preview_url: comp.link || '',
          connection_id: comp.connection_id,
          connection_name: comp.connection_name,
          link: comp.link || '',
          date: comp.date || '',
          modified: comp.modified || '',
          cached_at: Date.now()
        }));
        
        setCachedComponents(activeConnectionId, selectedCategories, metadata);
      }

      // Extract categories if not filtering
      let allCategories = [];
      if (selectedCategories.length === 0 && allComponents.length > 0) {
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
        allCategories = Array.from(categoryMap.values());
      }

      // Update store
      setComponents(allComponents);
      if (allCategories.length > 0) {
        setAvailableCategories(allCategories);
      }

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
        console.log('✅ OPTIMIZED LOADING COMPLETE');
        console.log(`📊 Loaded: ${allComponents.length} components`);
        console.log(`📊 Total Available: ${totalAvailable} components`);
        console.log(`✅ Success: ${successfulConnections.length} connections`);
        console.log(`❌ Failed: ${failedConnections.length} connections`);
      }

      return { 
        components: allComponents, 
        categories: allCategories,
        totalLoaded: allComponents.length,
        totalAvailable,
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

  const totalComponents = data?.totalLoaded || 0;

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
    data,
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
