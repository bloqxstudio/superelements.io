import { useQuery } from '@tanstack/react-query';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { useConnectionsForUserRole } from '@/hooks/useConnectionsForUserRole';
import { toast } from '@/hooks/use-toast';

interface UseSimpleFastLoadingProps {
  selectedCategories: number[];
  activeConnectionId?: string;
}

export const useSimpleFastLoading = ({
  selectedCategories,
  activeConnectionId,
}: UseSimpleFastLoadingProps) => {
  const { setComponents, setAvailableCategories } = useWordPressStore();
  const { getConnectionsForCurrentUser } = useConnectionsForUserRole();
  const { fetchComponents } = useWordPressApi();

  // Get user-filtered connections
  const allUserConnections = getConnectionsForCurrentUser();
  
  // Filter by activeConnectionId if specified
  const targetConnections = activeConnectionId 
    ? allUserConnections.filter(c => c.id === activeConnectionId)
    : allUserConnections;

  const queryKey = [
    'simpleComponents',
    activeConnectionId || 'user-allowed',
    selectedCategories,
    targetConnections.map(c => c.id).join(',')
  ];

  const queryFn = async () => {
    if (targetConnections.length === 0) {
      return { components: [], categories: [], totalLoaded: 0 };
    }

    try {
      let allComponents = [];
      let allCategories = [];
      let failedCount = 0;

      // Load only first page from each connection (parallel requests)
      const connectionPromises = targetConnections.map(async (connection) => {
        try {
          const connectionConfig = {
            baseUrl: connection.base_url,
            postType: connection.post_type,
            jsonField: connection.json_field,
            previewField: connection.preview_field,
            username: connection.username,
            applicationPassword: connection.application_password,
          };
          
          const result = await fetchComponents(connectionConfig, {
            page: 1,
            perPage: 30, // Reduced from 50
            categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined
          });

          if (result?.components && Array.isArray(result.components)) {
            return result.components.map(component => ({
              ...component,
              _connectionId: connection.id,
              _connectionName: connection.name,
              _connectionUserType: connection.userType
            }));
          }
          return [];
        } catch (error) {
          console.warn(`Failed to load from ${connection.name}:`, error);
          failedCount++;
          return [];
        }
      });

      const results = await Promise.all(connectionPromises);
      allComponents = results.flat();

      // Extract categories if not filtering
      if (selectedCategories.length === 0 && allComponents.length > 0) {
        const categoryMap = new Map();
        allComponents.forEach(component => {
          if (component.categories && Array.isArray(component.categories)) {
            component.categories.forEach(catId => {
              if (!categoryMap.has(catId)) {
                categoryMap.set(catId, {
                  id: catId,
                  name: `Category ${catId}`,
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

      // Show error only if all connections failed
      if (allComponents.length === 0 && failedCount === targetConnections.length) {
        toast({
          title: "Loading Failed",
          description: "Unable to load components. Please check your connection.",
          variant: "destructive",
          duration: 3000
        });
      }
      
      return { 
        components: allComponents, 
        categories: allCategories,
        totalLoaded: allComponents.length,
        successfulConnections: targetConnections.length - failedCount,
        failedConnections: failedCount
      };

    } catch (error) {
      console.error('Error loading components:', error);
      
      toast({
        title: "Loading Error",
        description: "Failed to load components. Please try again.",
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
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const totalComponents = data?.totalLoaded || 0;

  return {
    data,
    isLoading,
    isError,
    error: error?.message || null,
    isFetching,
    refetch,
    loadingState: isLoading ? 'loading' : isError ? 'error' : 'idle',
    progress: 0,
    isInitializing: isLoading,
    isApplyingFilters: isFetching && !isLoading,
    isLoadingPage: isLoading,
    isReady: !isLoading && !isError && !!data,
    hasExistingComponents: totalComponents > 0,
    initializeFastLoading: () => refetch(),
    loadNextPage: () => Promise.resolve(false),
    reset: () => refetch(),
    cancelOperation: () => {},
    retryCount: 0,
    maxRetries: 1,
    totalComponents,
    successfulConnections: data?.successfulConnections || 0,
    failedConnections: data?.failedConnections || 0
  };
};