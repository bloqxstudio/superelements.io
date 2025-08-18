
import { useCallback } from 'react';
import { useWordPressConnection } from '@/features/wordpress/hooks/useWordPressConnection';
import { getDesktopPreviewUrl, getPreviewUrl } from '../utils/urlUtils';

interface UseComponentGridCallbacksProps {
  config: any;
  reset: () => void;
}

export const useComponentGridCallbacks = ({ config, reset }: UseComponentGridCallbacksProps) => {
  const { resetConnection } = useWordPressConnection();

  // Memoized callbacks
  const handleCopyComponent = useCallback((component: any) => {
    console.log('Copy component requested (legacy callback):', component.id);
    // This is now handled by the OptimizedComponentCard itself using useEnhancedCopyComponent
  }, []);

  const handleCancelFetch = useCallback(() => {
    resetConnection();
    reset();
  }, [resetConnection, reset]);

  const memoizedGetDesktopPreviewUrl = useCallback((comp: any) => 
    getDesktopPreviewUrl(comp, config), [config]);
  
  const memoizedGetPreviewUrl = useCallback((comp: any) => 
    getPreviewUrl(comp, config), [config]);

  return {
    handleCopyComponent,
    handleCancelFetch,
    memoizedGetDesktopPreviewUrl,
    memoizedGetPreviewUrl
  };
};
