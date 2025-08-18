import { useCallback } from 'react';
import { useWordPressStore, type WordPressComponent } from '@/store/wordpressStore';
import { WordPressApiService } from '@/services/wordpressApi';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { toast } from '@/hooks/use-toast';

export const useWordPressConnection = () => {
  const {
    config,
    setIsLoading,
    setComponents,
    setTotalComponents,
    setTotalPages,
    setPerPage,
    setLoadedPage,
    clearLoadedPages,
    setLoadingProgress,
    setError,
    setIsConnected,
    setPostTypes,
    setIsLoadingPostTypes,
    setTaxonomies,
    setTermsByTaxonomy,
    setCompleteMetadata,
    extractCategoriesFromPosts,
    isPageLoaded,
    getPageComponents
  } = useWordPressStore();

  // FIXED: Use the corrected useWordPressApi hook
  const { fetchComponents } = useWordPressApi();

  const initializeConnection = useCallback(async () => {
    if (!config.baseUrl || !config.username || !config.applicationPassword) {
      return false;
    }

    setIsLoadingPostTypes(true);
    setError(null);

    try {
      // FIXED: Remove postType from this call as it's not needed for fetching post types
      const postTypes = await WordPressApiService.fetchPostTypes({
        baseUrl: config.baseUrl,
        username: config.username,
        applicationPassword: config.applicationPassword
      });

      setPostTypes(postTypes);
      setIsConnected(true);
      
      console.log('Connection initialized successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setError(errorMessage);
      setIsConnected(false);
      console.error('Connection initialization failed:', error);
      return false;
    } finally {
      setIsLoadingPostTypes(false);
    }
  }, [config, setIsLoadingPostTypes, setError, setPostTypes, setIsConnected]);

  const initializeCompleteMetadata = useCallback(async () => {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    setIsLoading(true);
    setError(null);

    try {
      const completeMetadata = await WordPressApiService.fetchCompleteMetadata(
        config,
        (progress) => {
          setLoadingProgress(progress.loaded / progress.total * 100);
        }
      );

      // Set all the metadata
      setTotalComponents(completeMetadata.totalComponents);
      setTotalPages(completeMetadata.totalPages);
      setPerPage(completeMetadata.perPage);
      setTaxonomies(completeMetadata.taxonomies);
      setTermsByTaxonomy(completeMetadata.termsByTaxonomy);
      
      // FIXED: Set complete metadata with proper type structure - use empty object for componentsByCategory
      setCompleteMetadata({
        categories: completeMetadata.categories,
        componentsByCategory: {}, // Initialize as empty object instead of Record<number, number>
        hasElementorData: completeMetadata.hasElementorData,
        totalWithoutElementorData: completeMetadata.totalWithoutElementorData
      });

      setLoadingProgress(100);

      // REMOVED: Success toast - only console log remains
      console.log(`🎯 Complete Metadata Loaded: Found ${completeMetadata.totalComponents} components across ${completeMetadata.categories.length} categories. ${completeMetadata.hasElementorData} have Elementor data.`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setLoadingProgress(0);
      
      toast({
        title: "Metadata Loading Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, setIsLoading, setError, setTotalComponents, setTotalPages, setPerPage, setTaxonomies, setTermsByTaxonomy, setCompleteMetadata, setLoadingProgress]);

  const loadComponentsFromMultiplePostTypes = useCallback(async (
    selectedPostTypes: string[],
    limitPerPostType: number = Number.MAX_SAFE_INTEGER
  ) => {
    if (!config.baseUrl || selectedPostTypes.length === 0) {
      throw new Error('Please provide base URL and select at least one post type');
    }

    setIsLoading(true);
    setError(null);
    clearLoadedPages();

    try {
      const result = await WordPressApiService.fetchMultiplePostTypes(
        config,
        selectedPostTypes,
        limitPerPostType,
        (progress) => {
          setLoadingProgress(progress.loaded / progress.total * 100);
        }
      );

      // FIXED: Use the components directly with proper typing
      const typedComponents = result.allComponents as WordPressComponent[];
      setComponents(typedComponents);
      setTotalComponents(result.totalComponents);
      
      // Extract categories from all components with improved extraction
      await extractCategoriesFromComponents(typedComponents);

      // REMOVED: Success toast - only console log remains
      const limitedTypes = Object.entries(result.postTypeStats)
        .filter(([, stats]) => stats.limited)
        .map(([type]) => type);

      const isUnlimited = limitPerPostType === Number.MAX_SAFE_INTEGER;
      let message = `Loaded ${result.totalComponents} components from ${selectedPostTypes.length} post types`;
      
      if (!isUnlimited && limitedTypes.length > 0) {
        message += `. Limited to ${limitPerPostType} components for: ${limitedTypes.join(', ')}`;
      } else if (isUnlimited) {
        message += ` (unlimited mode)`;
      }

      console.log(`Multi-post type loading complete: ${message}`);
      setLoadingProgress(100);
      
      console.log('Multi-post type loading completed:', result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setLoadingProgress(0);
      
      toast({
        title: "Loading Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, setIsLoading, setError, clearLoadedPages, setComponents, setTotalComponents, setLoadingProgress]);

  const extractCategoriesFromComponents = useCallback(async (components: WordPressComponent[]) => {
    try {
      // First try to get real category names from WordPress API
      const categoriesFromApi = await WordPressApiService.fetchCategories(config);
      const categoryNamesMap = new Map<number, string>();
      
      categoriesFromApi.forEach(cat => {
        categoryNamesMap.set(cat.id, cat.name);
      });

      // Enhanced category extraction with real names
      const categoryMap = new Map<number, any>();
      const termMap = new Map<string, Set<number>>();

      components.forEach(component => {
        // Extract categories (WordPress built-in taxonomy)
        if (component.categories && Array.isArray(component.categories)) {
          component.categories.forEach((categoryId: number) => {
            if (!categoryMap.has(categoryId)) {
              // Use real name from API or fallback to generic name
              const realName = categoryNamesMap.get(categoryId) || `Category ${categoryId}`;
              categoryMap.set(categoryId, {
                id: categoryId,
                name: realName,
                slug: `category-${categoryId}`,
                count: 1,
                taxonomy: 'category'
              });
            } else {
              const existing = categoryMap.get(categoryId)!;
              existing.count += 1;
            }
          });
        }

        // Extract terms from all taxonomies
        Object.keys(component).forEach(key => {
          if (key.endsWith('_terms') || key === 'tags' || key.includes('tax_')) {
            const terms = (component as any)[key];
            if (Array.isArray(terms)) {
              terms.forEach((termId: number) => {
                if (!termMap.has(key)) {
                  termMap.set(key, new Set());
                }
                termMap.get(key)!.add(termId);
              });
            }
          }
        });
      });

      // Update the store with extracted categories
      const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
      extractCategoriesFromPosts(components);
      
      console.log(`Enhanced category extraction: ${categories.length} categories found with real names`);
    } catch (error) {
      console.warn('Failed to fetch category details, using fallback extraction:', error);
      
      // Fallback extraction without API names
      const categoryMap = new Map<number, any>();
      
      components.forEach(component => {
        if (component.categories && Array.isArray(component.categories)) {
          component.categories.forEach((categoryId: number) => {
            if (!categoryMap.has(categoryId)) {
              categoryMap.set(categoryId, {
                id: categoryId,
                name: `Category ${categoryId}`,
                slug: `category-${categoryId}`,
                count: 1,
                taxonomy: 'category'
              });
            } else {
              const existing = categoryMap.get(categoryId)!;
              existing.count += 1;
            }
          });
        }
      });
      
      extractCategoriesFromPosts(components);
    }
  }, [config, extractCategoriesFromPosts]);

  const loadComponents = useCallback(async () => {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    setIsLoading(true);
    setError(null);

    try {
      // SIMPLIFIED: No local filtering - let the API handle all filtering
      const components = await WordPressApiService.fetchAllComponents(
        config,
        (progress) => {
          setLoadingProgress(progress.loaded / progress.total * 100);
        }
      );

      // FIXED: Type the components properly
      const typedComponents = components as WordPressComponent[];
      setComponents(typedComponents);
      setTotalComponents(components.length);
      
      // Enhanced category extraction
      await extractCategoriesFromComponents(typedComponents);

      // REMOVED: Success toast - only console log remains
      console.log(`Successfully loaded ${components.length} components`);
      setLoadingProgress(100);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setLoadingProgress(0);
      
      toast({
        title: "Loading Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, setIsLoading, setError, setComponents, setTotalComponents, setLoadingProgress, extractCategoriesFromComponents]);

  const initializeLazyLoading = useCallback(async () => {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    setIsLoading(true);
    setError(null);
    clearLoadedPages();

    try {
      // Get metadata first
      const metadata = await WordPressApiService.fetchComponentsMetadata(config);
      
      setTotalComponents(metadata.totalComponents);
      setTotalPages(metadata.totalPages);
      setPerPage(metadata.perPage);

      // REMOVED: Success toast - only console log remains
      console.log(`Connection Initialized: Found ${metadata.totalComponents} components across ${metadata.totalPages} pages. Components will load as you browse.`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Initialization Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, setIsLoading, setError, clearLoadedPages, setTotalComponents, setTotalPages, setPerPage]);

  const loadRequiredPages = useCallback(async () => {
    const store = useWordPressStore.getState();
    const requiredPages = store.getRequiredPages();
    
    if (requiredPages.length === 0) return;

    try {
      for (const page of requiredPages) {
        const result = await WordPressApiService.fetchComponentsPage(config, page);
        const typedComponents = result.components as WordPressComponent[];
        setLoadedPage(page, typedComponents);
      }
    } catch (error) {
      console.error('Failed to load required pages:', error);
      throw error;
    }
  }, [config, setLoadedPage]);

  // FIXED: Completely rewrite loadPage to use the corrected fetchComponents with pagination
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
        totalComponents: cachedComponents.length,
        page: page,
        hasNextPage: cachedComponents.length > 0 // Will be determined by caller if needed
      };
      
      console.log(`Returning cached result for page ${page}:`, {
        componentCount: result.components.length,
        hasNextPage: result.hasNextPage
      });
      
      return result;
    }

    try {
      console.log(`Fetching page ${page} from API using corrected fetchComponents...`);
      
      // FIXED: Use the corrected fetchComponents with proper options
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
      return result;
      
    } catch (error) {
      console.error(`Failed to load page ${page}:`, error);
      const errorMessage = error instanceof Error ? error.message : `Unknown error loading page ${page}`;
      throw new Error(errorMessage);
    }
  }, [config, setLoadedPage, isPageLoaded, getPageComponents, fetchComponents]);

  const cancelFetch = useCallback(() => {
    WordPressApiService.cancelCurrentFetch();
    setLoadingProgress(0);
  }, [setLoadingProgress]);

  // Handle config change
  const handleConfigChange = useCallback((newConfig: typeof config) => {
    // This would typically update the store config through the store's setConfig method
    const { setConfig } = useWordPressStore.getState();
    setConfig(newConfig);
  }, []);

  // Test connection
  const testConnection = useCallback(async () => {
    return initializeConnection();
  }, [initializeConnection]);

  return {
    initializeConnection,
    initializeCompleteMetadata,
    loadComponents,
    loadComponentsFromMultiplePostTypes,
    initializeLazyLoading,
    loadRequiredPages,
    loadPage,
    cancelFetch,
    handleConfigChange,
    testConnection
  };
};
