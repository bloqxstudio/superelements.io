
import { useEffect } from 'react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressConnection } from '@/features/wordpress/hooks/useWordPressConnection';

export const useInfiniteScrollSetup = () => {
  const {
    selectedTerms,
    selectedCategories,
    isLazyLoading,
    getRequiredPages,
    currentInfiniteScrollPage,
    setCurrentInfiniteScrollPage,
    setHasNextPage,
    updateCategoryCountsFromLoadedComponents
  } = useWordPressStore();
  
  const { loadRequiredPages, loadPage } = useWordPressConnection();

  // Load required pages when pagination changes or filters change
  useEffect(() => {
    if (isLazyLoading) {
      const requiredPages = getRequiredPages();
      if (requiredPages.length > 0) {
        loadRequiredPages();
      }
    }
  }, [selectedTerms, selectedCategories, isLazyLoading]);

  // Initialize infinite scroll when enabled
  useEffect(() => {
    if (isLazyLoading) {
      // Reset to first page when enabling infinite scroll
      setCurrentInfiniteScrollPage(1);
      setHasNextPage(true);

      // Load first page if not already loaded
      if (currentInfiniteScrollPage === 1) {
        const requiredPages = getRequiredPages();
        if (requiredPages.length > 0) {
          loadRequiredPages();
        }
      }
    }
  }, [isLazyLoading]);

  // Handle infinite scroll fetch
  const handleFetchNextPage = async () => {
    if (!isLazyLoading) return;
    try {
      await loadPage(currentInfiniteScrollPage);

      // Update store state and category counts
      const store = useWordPressStore.getState();
      store.setCurrentInfiniteScrollPage(currentInfiniteScrollPage + 1);
      store.setHasNextPage(currentInfiniteScrollPage < store.totalPages);

      // Update category counts with newly loaded components
      updateCategoryCountsFromLoadedComponents();
    } catch (error) {
      console.error('Failed to fetch next page:', error);
    }
  };

  return { handleFetchNextPage };
};
