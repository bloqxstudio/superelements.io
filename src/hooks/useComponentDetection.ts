
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useConnectionsStore } from '@/store/connectionsStore';
import { toast } from '@/hooks/use-toast';

interface ComponentDetectionState {
  hasComponents: boolean;
  totalCount: number;
  isValidated: boolean;
  lastValidation: Date | null;
  issues: string[];
}

export const useComponentDetection = () => {
  const {
    getAllLoadedComponents,
    getPaginatedComponents,
    selectedCategories,
    isFastLoading,
    isConnected,
    config
  } = useWordPressStore();
  
  const { getActiveConnection } = useConnectionsStore();
  const [detectionState, setDetectionState] = useState<ComponentDetectionState>({
    hasComponents: false,
    totalCount: 0,
    isValidated: false,
    lastValidation: null,
    issues: []
  });
  const lastValidationRef = useRef<Date | null>(null);

  // Enhanced component detection with validation
  const detectComponents = useCallback(() => {
    const issues: string[] = [];
    
    try {
      // Get components from both sources
      const allComponents = getAllLoadedComponents();
      const paginatedComponents = getPaginatedComponents();
      
      console.log('Component detection analysis:', {
        allComponentsCount: allComponents.length,
        paginatedComponentsCount: paginatedComponents.length,
        selectedCategoriesCount: selectedCategories.length,
        isFastLoading,
        isConnected,
        hasConfig: !!config.baseUrl
      });

      // Validate component structure
      const validComponents = allComponents.filter(component => {
        if (!component) return false;
        if (!component.id) return false;
        if (!component.title?.rendered) return false;
        return true;
      });

      const invalidCount = allComponents.length - validComponents.length;
      if (invalidCount > 0) {
        issues.push(`${invalidCount} components have invalid structure`);
      }

      // Check for category filtering issues
      if (selectedCategories.length > 0 && paginatedComponents.length === 0 && allComponents.length > 0) {
        issues.push('Category filters may be too restrictive');
      }

      // Check connection status
      const activeConnection = getActiveConnection();
      if (!activeConnection) {
        issues.push('No active connection found');
      } else if (!isConnected) {
        issues.push('Connection is not established');
      }

      // Determine final component count
      const finalCount = isFastLoading ? paginatedComponents.length : allComponents.length;
      const hasComponents = finalCount > 0;

      const newState: ComponentDetectionState = {
        hasComponents,
        totalCount: finalCount,
        isValidated: true,
        lastValidation: new Date(),
        issues
      };

      setDetectionState(newState);
      lastValidationRef.current = new Date();

      console.log('Component detection result:', newState);
      
      return newState;
    } catch (error) {
      console.error('Component detection failed:', error);
      const errorState: ComponentDetectionState = {
        hasComponents: false,
        totalCount: 0,
        isValidated: false,
        lastValidation: lastValidationRef.current,
        issues: [`Detection error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
      setDetectionState(errorState);
      return errorState;
    }
  }, [
    getAllLoadedComponents,
    getPaginatedComponents,
    selectedCategories,
    isFastLoading,
    isConnected,
    config.baseUrl,
    getActiveConnection
  ]);

  // Auto-detection on relevant changes
  useEffect(() => {
    const result = detectComponents();
    
    // Show warnings for persistent issues
    if (result.issues.length > 0 && result.lastValidation) {
      const timeSinceLastValidation = Date.now() - result.lastValidation.getTime();
      if (timeSinceLastValidation > 5000) { // 5 seconds
        console.warn('Persistent component detection issues:', result.issues);
      }
    }
  }, [detectComponents]);

  // Force reload function
  const forceReload = useCallback(async () => {
    console.log('Force reloading components...');
    
    try {
      // Clear caches and reset state
      const { clearComponentCache, clearLoadedPages } = useWordPressStore.getState();
      clearComponentCache();
      clearLoadedPages();
      
      // Trigger re-detection
      setTimeout(() => {
        detectComponents();
        toast({
          title: "Components Reloaded",
          description: "Component cache cleared and reloaded successfully."
        });
      }, 100);
      
    } catch (error) {
      console.error('Force reload failed:', error);
      toast({
        title: "Reload Failed",
        description: "Failed to reload components. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  }, [detectComponents]);

  return {
    ...detectionState,
    detectComponents,
    forceReload,
    shouldShowEmptyState: !detectionState.hasComponents && detectionState.isValidated && isConnected
  };
};
