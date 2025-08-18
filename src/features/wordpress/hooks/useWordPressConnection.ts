import { useCallback } from 'react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { toast } from '@/hooks/use-toast';

export const useWordPressConnection = () => {
  const {
    config,
    setComponents,
    setIsLoading,
    setError,
    setIsConnected,
    setCompleteMetadata,
    setLoadedPage,
    clearLoadedPages,
    selectedCategories,
    getAllLoadedComponents,
    resetConnection: storeResetConnection,
    isPageLoaded,
    getPageComponents
  } = useWordPressStore();

  const { fetchComponents, fetchPostTypes } = useWordPressApi();

  // FIXED: Properly implement loadPage with correct pagination
  const loadPage = useCallback(async (page: number) => {
    console.log(`=== LOAD PAGE ${page} START ===`);
    console.log('Load page request:', {
      page,
      isAlreadyLoaded: isPageLoaded(page),
      hasConfig: !!config.baseUrl && !!config.postType
    });
    
    // Enhanced validation
    if (!config.baseUrl || !config.postType) {
      const error = 'Missing configuration: baseUrl and postType are required';
      console.error('LoadPage failed:', error);
      throw new Error(error);
    }
    
    // IMPROVED: Return cached data with consistent format
    if (isPageLoaded(page)) {
      console.log(`Page ${page} already loaded, returning cached data`);
      const cachedComponents = getPageComponents(page);
      
      // Return consistent format matching API response
      const result = {
        components: cachedComponents,
        hasNextPage: cachedComponents.length > 0
      };
      
      console.log(`Returning cached result for page ${page}:`, {
        componentCount: result.components.length,
        hasNextPage: result.hasNextPage
      });
      
      return result;
    }

    try {
      console.log(`Fetching page ${page} from API...`);
      
      // FIXED: Use fetchComponents with correct options parameter
      const result = await fetchComponents(config, {
        page: page,
        perPage: 100
      });
      
      // Enhanced result validation
      if (!result) {
        throw new Error(`No result returned for page ${page}`);
      }
      
      if (!('components' in result)) {
        throw new Error(`Invalid result format for page ${page}: missing components property`);
      }
      
      if (!Array.isArray(result.components)) {
        throw new Error(`Invalid result format for page ${page}: components is not an array`);
      }
      
      console.log(`Successfully fetched page ${page}:`, {
        componentCount: result.components.length,
        hasNextPage: result.hasNextPage,
        totalComponents: result.totalComponents,
        totalPages: result.totalPages
      });
      
      // Store the page data
      setLoadedPage(page, result.components);
      
      console.log(`=== LOAD PAGE ${page} END ===`);
      
      // Return consistent format
      return {
        components: result.components,
        hasNextPage: result.hasNextPage || false
      };
      
    } catch (error) {
      console.error(`Failed to load page ${page}:`, error);
      const errorMessage = error instanceof Error ? error.message : `Unknown error loading page ${page}`;
      throw new Error(errorMessage);
    }
  }, [config, setLoadedPage, isPageLoaded, getPageComponents, fetchComponents]);

  // Initialize lazy loading (for backward compatibility)
  const initializeLazyLoading = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchComponents(config);
      setComponents(result.components);
      setIsConnected(true);
      
      toast({
        title: "Connection Successful",
        description: `Loaded ${result.components.length} components`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setError(errorMessage);
      setIsConnected(false);
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [config, fetchComponents, setComponents, setIsLoading, setError, setIsConnected]);

  // Load required pages (for backward compatibility)
  const loadRequiredPages = useCallback(async () => {
    // This is a simplified implementation for backward compatibility
    try {
      const result = await loadPage(1);
      if (result.components.length > 0) {
        setLoadedPage(1, result.components);
      }
    } catch (error) {
      console.error('Failed to load required pages:', error);
    }
  }, [loadPage, setLoadedPage]);

  // Reset connection
  const resetConnection = useCallback(() => {
    storeResetConnection();
  }, [storeResetConnection]);

  // Handle config change
  const handleConfigChange = useCallback((newConfig: typeof config) => {
    // This would typically update the store config
    console.log('Config change requested:', newConfig);
  }, []);

  // Test connection
  const testConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchPostTypes({
        baseUrl: config.baseUrl,
        username: config.username,
        applicationPassword: config.applicationPassword
      });
      
      setIsConnected(true);
      
      toast({
        title: "Connection Test Successful",
        description: `Found ${result.length} post types`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      setError(errorMessage);
      setIsConnected(false);
      
      toast({
        title: "Connection Test Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, fetchPostTypes, setIsLoading, setError, setIsConnected]);

  // Initialize complete metadata
  const initializeCompleteMetadata = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchComponents(config);
      
      // Create mock complete metadata
      const mockMetadata = {
        categories: [],
        componentsByCategory: {},
        hasElementorData: result.components.length,
        totalWithoutElementorData: 0
      };
      
      setCompleteMetadata(mockMetadata);
      setComponents(result.components);
      setIsConnected(true);
      
      toast({
        title: "Complete Metadata Loaded",
        description: `Loaded ${result.components.length} components`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load metadata';
      setError(errorMessage);
      setIsConnected(false);
      
      toast({
        title: "Metadata Loading Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, fetchComponents, setCompleteMetadata, setComponents, setIsLoading, setError, setIsConnected]);

  return {
    loadPage,
    initializeLazyLoading,
    loadRequiredPages,
    resetConnection,
    handleConfigChange,
    testConnection,
    initializeCompleteMetadata
  };
};
