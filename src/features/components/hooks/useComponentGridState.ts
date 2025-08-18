
import { useEffect, useMemo } from 'react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useStreamlinedFastLoading } from '@/hooks/useStreamlinedFastLoading';
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
  } = useStreamlinedFastLoading({
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

  // Enhanced component retrieval with validation
  const displayComponents = useMemo(() => {
    if (loadingState === 'error') {
      return [];
    }
    
    // Get base components using existing logic
    const baseComponents = getDisplayComponents({
      isFastLoading,
      selectedCategories,
      getAllLoadedComponents,
      getPaginatedComponents
    });
    
    // Apply validation filter
    const validComponents = filterValidComponents(baseComponents);
    
    // Generate validation stats for debugging
    if (baseComponents.length > 0) {
      const stats = generateValidationStats(baseComponents);
      console.log('Component validation stats:', stats);
      
      if (stats.invalid > 0) {
        console.warn(`Filtered out ${stats.invalid} invalid components out of ${stats.total} total`);
      }
    }
    
    return validComponents;
  }, [
    loadingState,
    isFastLoading,
    selectedCategories,
    getAllLoadedComponents,
    getPaginatedComponents
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
