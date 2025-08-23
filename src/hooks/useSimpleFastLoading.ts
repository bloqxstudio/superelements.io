import { useQuery } from '@tanstack/react-query';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { useConnectionsStore } from '@/store/connectionsStore';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface UseSimpleFastLoadingProps {
  selectedCategories: number[];
  activeConnectionId?: string;
}

export const useSimpleFastLoading = ({
  selectedCategories,
  activeConnectionId,
}: UseSimpleFastLoadingProps) => {
  const { setComponents, setAvailableCategories } = useWordPressStore();
  const { connections } = useConnectionsStore();
  const { fetchComponents } = useWordPressApi();
  const { profile } = useAuth();

  // Filter connections based on user access level
  const getAccessibleConnections = () => {
    const activeConnections = connections.filter(c => c.isActive);
    
    // If no profile (not logged in), show all active connections
    if (!profile) return activeConnections;
    
    // Admin can see all connections
    if (profile.role === 'admin') return activeConnections;
    
    // Pro users can see connections marked as 'all', 'pro', or 'free'
    if (profile.role === 'pro') {
      return activeConnections.filter(c => 
        c.userType === 'all' || c.userType === 'pro' || c.userType === 'free'
      );
    }
    
    // Free users can only see connections marked as 'all' or 'free'
    return activeConnections.filter(c => c.userType === 'all' || c.userType === 'free');
  };

  const allConnections = getAccessibleConnections();
  
  // Filter by activeConnectionId if specified
  const targetConnections = activeConnectionId 
    ? allConnections.filter(c => c.id === activeConnectionId)
    : allConnections;

  const queryKey = [
    'simpleComponents',
    activeConnectionId || 'all-active',
    selectedCategories,
    targetConnections.map(c => c.id).join(',')
  ];

  const queryFn = async () => {
    console.log('🔄 Starting simple fast loading...');
    console.log('Target connections:', targetConnections.length);
    console.log('Selected categories:', selectedCategories);
    
    if (targetConnections.length === 0) {
      console.log('❌ No target connections available');
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
            perPage: 30,
            categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined
          });

          if (result?.components && Array.isArray(result.components)) {
            return result.components.map(component => ({
              ...component,
              connection_id: connection.id,
              connection_name: connection.name
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

      // Update store
      setComponents(allComponents);
      
      console.log('✅ Simple loading complete:', {
        totalComponents: allComponents.length,
        successful: targetConnections.length - failedCount,
        failed: failedCount
      });
      
      return {
        components: allComponents, 
        categories: allCategories,
        totalLoaded: allComponents.length,
        successfulConnections: targetConnections.length - failedCount,
        failedConnections: failedCount
      };

    } catch (error) {
      console.error('Error loading components:', error);
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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