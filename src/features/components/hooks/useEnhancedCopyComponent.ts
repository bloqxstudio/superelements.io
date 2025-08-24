import { useState, useCallback, useRef } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { toast } from '@/hooks/use-toast';
import { extractComponentForClipboard } from '@/utils/enhancedElementorExtractor';
import { copyToClipboardEnhanced } from '@/utils/enhancedRobustClipboard';

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
      
      // Get connection for WordPress config
      const connection = component.connection_id ? getConnectionById(component.connection_id) : null;
      
      if (!connection && !baseUrl) {
        throw new Error('No connection or baseUrl available for component extraction');
      }

      // Build WordPress config
      const wordpressConfig = {
        baseUrl: connection?.base_url || baseUrl,
        postType: connection?.post_type || 'posts',
        username: connection?.username || '',
        applicationPassword: connection?.application_password || ''
      };

      // Extract component data
      const elementorData = await extractComponentForClipboard(
        parseInt(componentId),
        wordpressConfig
      );

      // Copy to clipboard using enhanced system
      const result = await copyToClipboardEnhanced(elementorData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to copy to clipboard');
      }

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
        description: `Component copied using ${result.method}. Ready to paste in Elementor!`,
        duration: 4000
      });
      
    } catch (error) {
      console.error('Copy component error:', error);
      setCopyState(componentId, { copying: false, copied: false });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Copy Failed",
        description: errorMessage.includes('authentication') 
          ? "Authentication failed. Check your WordPress credentials."
          : errorMessage.includes('network')
          ? "Network error. Check your connection."
          : `Failed to copy component: ${errorMessage}`,
        variant: "destructive",
        duration: 5000
      });
    }
  }, [setCopyState, getConnectionById]);

  const getCopyState = useCallback((componentId: string): CopyState => {
    return copyStates[componentId] || { copying: false, copied: false };
  }, [copyStates]);

  return {
    copyToClipboard,
    getCopyState
  };
};