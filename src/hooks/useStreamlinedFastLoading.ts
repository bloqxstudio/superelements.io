import { useQuery } from '@tanstack/react-query';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { useConnectionsForUserRole } from '@/hooks/useConnectionsForUserRole';
import { toast } from '@/hooks/use-toast';

interface UseStreamlinedFastLoadingProps {
  selectedCategories: number[];
  activeConnectionId?: string;
}

export const useStreamlinedFastLoading = ({
  selectedCategories,
  activeConnectionId,
}: UseStreamlinedFastLoadingProps) => {
  const { setComponents, setAvailableCategories } = useWordPressStore();
  const { getConnectionsForCurrentUser } = useConnectionsForUserRole();
  const { fetchComponents } = useWordPressApi();

  // Obter conexões filtradas baseado no role do usuário
  const allUserConnections = getConnectionsForCurrentUser();
  
  // Se há activeConnectionId, filtrar apenas essa conexão (se permitida para o usuário)
  const targetConnections = activeConnectionId 
    ? allUserConnections.filter(c => c.id === activeConnectionId)
    : allUserConnections;

  const queryKey = [
    'fastComponents',
    activeConnectionId || 'user-allowed',
    selectedCategories,
    targetConnections.map(c => `${c.id}-${c.base_url}-${c.post_type}-${c.userType}`).join(',')
  ];

  const queryFn = async () => {
    if (targetConnections.length === 0) {
      console.warn('❌ No connections available for current user role.');
      return { components: [], categories: [], totalLoaded: 0 };
    }

    try {
      console.log('=== STREAMLINED FAST LOADING START (ROLE-FILTERED) ===');
      console.log('Target connections for user:', targetConnections.map(c => ({
        id: c.id,
        name: c.name,
        baseUrl: c.base_url,
        postType: c.post_type,
        userType: c.userType
      })));
      console.log('Selected categories:', selectedCategories);

      let allComponents = [];
      let allCategories = [];
      let failedConnections = [];
      let successfulConnections = [];

      // Carrega componentes de todas as conexões permitidas para o usuário (sequencialmente)
      for (const connection of targetConnections) {
        console.log(`🔄 Loading from connection: ${connection.name} (${connection.userType})`);
        
        try {
          let connectionComponents = [];
          let currentPage = 1;
          const perPage = 50; // Reduced from 100
          let hasNextPage = true;

          // Carrega todas as páginas desta conexão (sequencialmente)
          while (hasNextPage && currentPage <= 10) {
            console.log(`📄 Loading page ${currentPage} from ${connection.name}...`);
            
            const connectionConfig = {
              baseUrl: connection.base_url,
              postType: connection.post_type,
              jsonField: connection.json_field,
              previewField: connection.preview_field,
              username: connection.username,
              applicationPassword: connection.application_password,
            };
            
            const pageResult = await fetchComponents(connectionConfig, {
              page: currentPage,
              perPage: perPage,
              categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined
            });

            if (!pageResult || !pageResult.components || !Array.isArray(pageResult.components)) {
              console.warn(`⚠️ Invalid result for page ${currentPage} from ${connection.name}`);
              break;
            }

            // Adiciona metadados de conexão aos componentes
            const componentsWithConnectionInfo = pageResult.components.map(component => ({
              ...component,
              _connectionId: connection.id,
              _connectionName: connection.name,
              _connectionUserType: connection.userType
            }));

            connectionComponents.push(...componentsWithConnectionInfo);
            hasNextPage = pageResult.hasNextPage || false;
            currentPage++;

            if (pageResult.components.length === 0) {
              break;
            }

            // Add small delay between pages to avoid overwhelming the server
            if (hasNextPage) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          console.log(`✅ Loaded ${connectionComponents.length} components from ${connection.name} (${connection.userType})`);
          allComponents.push(...connectionComponents);
          successfulConnections.push(connection.name);

        } catch (error) {
          console.error(`💥 Error loading from connection ${connection.name}:`, error);
          failedConnections.push({ name: connection.name, error: error.message });
          
          // Show error toast but continue with other connections
          toast({
            title: `Connection Failed: ${connection.name}`,
            description: `Failed to load components. Continuing with other connections...`,
            variant: "destructive",
            duration: 3000
          });
        }

        // Add delay between connections to avoid server overload
        if (targetConnections.indexOf(connection) < targetConnections.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`📊 Total components loaded for user: ${allComponents.length}`);
      console.log(`✅ Successful connections: ${successfulConnections.join(', ')}`);
      
      if (failedConnections.length > 0) {
        console.log(`❌ Failed connections:`, failedConnections);
      }

      // Show error toast only if ALL connections failed
      if (allComponents.length === 0 && failedConnections.length > 0) {
        toast({
          title: "Loading Failed",
          description: `All connections failed to load. Please check your internet connection and try again.`,
          variant: "destructive",
          duration: 5000
        });
      }

      // Extrai categorias se não está filtrando
      if (selectedCategories.length === 0) {
        try {
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
          console.log(`📋 Categories extracted: ${allCategories.length}`);
        } catch (error) {
          console.warn('⚠️ Failed to extract categories:', error);
        }
      }

      // Atualiza o store
      setComponents(allComponents);
      if (allCategories.length > 0) {
        setAvailableCategories(allCategories);
      }

      console.log('=== STREAMLINED FAST LOADING COMPLETE (ROLE-FILTERED) ===');
      
      return { 
        components: allComponents, 
        categories: allCategories,
        totalLoaded: allComponents.length,
        successfulConnections: successfulConnections.length,
        failedConnections: failedConnections.length
      };

    } catch (error) {
      console.error('💥 Error during role-filtered component loading:', error);
      
      toast({
        title: "Loading Error",
        description: `Failed to load components: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
        duration: 5000
      });
      
      throw new Error(`Failed to load components: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    retry: 1, // Reduced from 2 to 1 since we handle retries internally
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // Increased to 2 minutes for better caching
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
  });

  const loadingState = isLoading ? 'loading' : isError ? 'error' : 'idle';
  const totalComponents = data?.totalLoaded || 0;

  console.log('=== STREAMLINED FAST LOADING STATE (ROLE-FILTERED) ===');
  console.log('Hook state:', {
    loadingState,
    totalComponents,
    selectedCategoriesCount: selectedCategories.length,
    targetConnectionsCount: targetConnections.length,
    isEnabled: targetConnections.length > 0,
    error: error?.message,
    activeConnectionId: activeConnectionId || 'user-allowed',
    successfulConnections: data?.successfulConnections || 0,
    failedConnections: data?.failedConnections || 0
  });

  return {
    data,
    isLoading,
    isError,
    error: error?.message || null,
    isFetching,
    refetch,
    loadingState,
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
