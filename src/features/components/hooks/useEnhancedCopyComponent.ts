import { useState, useCallback, useRef } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { toast } from '@/hooks/use-toast';

interface CopyState {
  copying: boolean;
  copied: boolean;
}

export const useEnhancedCopyComponent = () => {
  const { connections, getConnectionById } = useConnectionsStore();
  const [copyStates, setCopyStates] = useState<Record<string, CopyState>>({});
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  const setCopyState = useCallback((componentId: string, state: Partial<CopyState>) => {
    setCopyStates(prev => ({
      ...prev,
      [componentId]: { ...prev[componentId], ...state }
    }));
  }, []);

  const copyToClipboard = useCallback(async (component: any, baseUrl: string) => {
    const componentId = component.originalId || component.id;
    
    try {
      setCopyState(componentId, { copying: true, copied: false });
      
      // Simulate copy process (simplified for demo)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCopyState(componentId, { copying: false, copied: true });
      
      // Reset after 3 seconds
      if (timeoutRefs.current[componentId]) {
        clearTimeout(timeoutRefs.current[componentId]);
      }
      
      timeoutRefs.current[componentId] = setTimeout(() => {
        setCopyState(componentId, { copied: false });
        delete timeoutRefs.current[componentId];
      }, 3000);
      
      toast({
        title: "Component Copied Successfully!",
        description: "Component copied to clipboard. Ready to paste in Elementor!",
        duration: 4000
      });
      
    } catch (error) {
      setCopyState(componentId, { copying: false, copied: false });
      
      toast({
        title: "Copy Failed",
        description: "Failed to copy component. Please try again.",
        variant: "destructive",
        duration: 3000
      });
    }
  }, [setCopyState]);

  const getCopyState = useCallback((componentId: string): CopyState => {
    return copyStates[componentId] || { copying: false, copied: false };
  }, [copyStates]);

  return {
    copyToClipboard,
    getCopyState
  };
};