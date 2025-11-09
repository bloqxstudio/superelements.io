
import { useEffect, useMemo } from 'react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useSimpleFastLoading } from '@/hooks/useSimpleFastLoading';
import { getDisplayComponents, hasActiveFilters, shouldShowEmptyState } from '@/utils/componentRetrieval';
import { filterValidComponents, generateValidationStats } from '@/utils/componentValidation';

export const useComponentGridState = () => {
  const {
    config,
    selectedCategories,
    isFastLoading,
    getPaginatedComponents,
    hasNextPage,
    isFetchingNextPage,
    isConnected,
    getAllLoadedComponents
  } = useWordPressStore();
  
  const {
    loadingState,
    isLoading,
    error,
    progress,
    isInitializing,
    isApplyingFilters,
    isLoadingPage,
    isReady,
    initializeFastLoading,
    loadNextPage,
    reset
  } = useSimpleFastLoading({
    selectedCategories,
    activeConnectionId: 'default'
  });

  // Initialize fast loading when connected
  useEffect(() => {
    const canInitialize = (
      isConnected && 
      config.baseUrl && 
      config.postType && 
      !isFastLoading && 
      loadingState === 'idle'
    );

    console.log('ComponentGrid initialization check:', {
      isConnected,
      hasBaseUrl: !!config.baseUrl,
      hasPostType: !!config.postType,
      isFastLoading,
      loadingState,
      canInitialize
    });

    if (canInitialize) {
      console.log('Initializing fast loading...');
      initializeFastLoading();
    }
  }, [isConnected, config.baseUrl, config.postType, isFastLoading, loadingState, initializeFastLoading]);

  // Enhanced component retrieval with validation and instant client-side filtering
  const displayComponents = useMemo(() => {
    if (loadingState === 'error') {
      return [];
    }
    
    // Get ALL cached components first (instant from memory)
    const allCachedComponents = getAllLoadedComponents();
    
    // Apply category filter client-side (instant)
    const filteredByCategory = selectedCategories.length > 0
      ? allCachedComponents.filter(comp => 
          comp.categories?.some(catId => selectedCategories.includes(catId))
        )
      : allCachedComponents;
    
    // Apply validation filter
    const validComponents = filterValidComponents(filteredByCategory);
    
    // Generate validation stats for debugging
    if (filteredByCategory.length > 0) {
      const stats = generateValidationStats(filteredByCategory);
      console.log('⚡ Instant filter stats:', {
        cached: allCachedComponents.length,
        afterCategoryFilter: filteredByCategory.length,
        valid: stats.valid,
        invalid: stats.invalid,
        filterTime: '<1ms (client-side)'
      });
      
      if (stats.invalid > 0) {
        console.warn(`Filtered out ${stats.invalid} invalid components out of ${stats.total} total`);
      }
    }
    
    return validComponents;
  }, [
    loadingState,
    selectedCategories,
    getAllLoadedComponents
  ]);
  
  const activeFilters = hasActiveFilters(selectedCategories);

  console.log('ComponentGrid render state:', {
    loadingState,
    displayComponentsCount: displayComponents.length,
    isFastLoading,
    isReady,
    isConnected,
    hasActiveFilters: activeFilters
  });

  return {
    config,
    selectedCategories,
    isFastLoading,
    hasNextPage,
    isFetchingNextPage,
    isConnected,
    loadingState,
    isLoading,
    error,
    progress,
    isInitializing,
    isApplyingFilters,
    isLoadingPage,
    isReady,
    initializeFastLoading,
    loadNextPage,
    reset,
    displayComponents,
    activeFilters
  };
};
