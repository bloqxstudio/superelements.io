import { useState, useEffect, useCallback } from 'react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useSimpleFastLoading } from '@/hooks/useSimpleFastLoading';

interface UseEnhancedComponentGridStateProps {
  selectedCategories: number[];
  activeConnectionId?: string;
}

export const useEnhancedComponentGridState = ({
  selectedCategories,
  activeConnectionId
}: UseEnhancedComponentGridStateProps) => {
  const { config } = useWordPressStore();
  const [detectionIssues, setDetectionIssues] = useState<string[]>([]);

  const fastLoadingResult = useSimpleFastLoading({
    selectedCategories,
    activeConnectionId,
  });

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    loadingState,
    progress,
    isInitializing,
    isApplyingFilters,
    isLoadingPage,
    isReady,
    hasExistingComponents,
    initializeFastLoading,
    loadNextPage,
    reset,
    cancelOperation,
    retryCount,
    maxRetries,
    totalComponents
  } = fastLoadingResult;

  const { components: displayComponents } = data || { components: [] };
  const hasNextPage = false;
  const isFetchingNextPage = false;
  const isConnected = !isLoading && !isError;
  const canRetry = retryCount < maxRetries;

  // Enhanced empty state messages
  const enhancedEmptyState = useCallback(() => {
    if (!isConnected) {
      return 'Not connected to WordPress. Please check your connection settings.';
    }
    if (isInitializing) {
      return 'Initializing connection...';
    }
    if (isApplyingFilters) {
      return 'Applying filters...';
    }
    if (isLoadingPage) {
      return 'Loading page...';
    }
    if (error) {
      return `Error: ${error}`;
    }
    return 'No components found.';
  }, [isConnected, isInitializing, isApplyingFilters, isLoadingPage, error]);

  // Force reload
  const forceReload = useCallback(() => {
    window.location.reload();
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelOperation();
  }, [cancelOperation]);

  // Sync connection
  const syncConnection = useCallback(() => {
    return isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (config.baseUrl && config.postType) {
      setDetectionIssues([]);
    } else {
      const issues: string[] = [];
      if (!config.baseUrl) issues.push('Base URL is not set.');
      if (!config.postType) issues.push('Post Type is not set.');
      setDetectionIssues(issues);
    }
  }, [config.baseUrl, config.postType]);

  return {
    config,
    selectedCategories,
    isFastLoading: !isLoading && isReady,
    hasNextPage,
    isFetchingNextPage,
    isConnected,
    loadingState,
    error,
    isInitializing,
    isApplyingFilters,
    isLoadingPage,
    isReady,
    initializeFastLoading,
    loadNextPage,
    reset,
    handleCancel,
    displayComponents,
    retryCount,
    maxRetries,
    canRetry,
    hasExistingComponents,
    detectionIssues,
    enhancedEmptyState,
    forceReload,
    totalComponents: fastLoadingResult?.data?.totalLoaded || 0
  };
};
