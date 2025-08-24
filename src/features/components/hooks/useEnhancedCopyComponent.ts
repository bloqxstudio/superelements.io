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

      // Validate connection if available
      if (connection && connection.status !== 'connected') {
        throw new Error('WordPress connection is not active. Please check your connection settings.');
      }

      // Build WordPress config
      const wordpressConfig = {
        baseUrl: connection?.base_url || baseUrl,
        postType: connection?.post_type || 'posts',
        username: connection?.username || '',
        applicationPassword: connection?.application_password || ''
      };

      // Validate required fields
      if (!wordpressConfig.baseUrl) {
        throw new Error('WordPress site URL is required');
      }

      console.log('🚀 Starting component copy:', {
        componentId,
        baseUrl: wordpressConfig.baseUrl,
        postType: wordpressConfig.postType,
        hasAuth: !!(wordpressConfig.username && wordpressConfig.applicationPassword)
      });

      // Extract component data - pass the full component object for local data priority
      const elementorData = await extractComponentForClipboard(
        parseInt(componentId),
        wordpressConfig,
        component // Pass the component object for local data extraction
      );

      console.log('📋 Extracted data analysis:', {
        length: elementorData.length,
        isRealElementorData: elementorData.includes('"elType"') && elementorData.includes('"widgetType"'),
        hasComplexStructure: elementorData.includes('"elements":[') && elementorData.split('"elements":').length > 2,
        hasSections: elementorData.includes('"elType":"section"'),
        hasContainers: elementorData.includes('"elType":"container"'),
        hasWidgets: elementorData.includes('"widgetType"'),
        dataPreview: elementorData.substring(0, 500) + '...'
      });

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
      
      // Enhanced success feedback - only for real Elementor data
      const hasElementorStructure = elementorData.includes('"elType"') || 
        elementorData.includes('"widgetType"') || 
        elementorData.includes('"elements":');
      
      if (hasElementorStructure) {
        toast({
          title: "✅ Elementor Component Copied!",
          description: "Original Elementor component data copied successfully. Ready to paste in Elementor editor!",
          variant: "default",
          duration: 4000
        });
      } else {
        // This should not happen with the new system, but just in case
        throw new Error('Copied data does not contain valid Elementor structure');
      }
      
    } catch (error) {
      console.error('Copy component error:', error);
      setCopyState(componentId, { copying: false, copied: false });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Enhanced error handling with specific messages for Elementor components
      let userMessage = '';
      let title = "Copy Failed";
      
      if (errorMessage.includes('not created with Elementor') || errorMessage.includes('does not contain Elementor data')) {
        title = "Not an Elementor Component";
        userMessage = "This component was not created with Elementor. Only Elementor components can be copied and pasted into Elementor editor.";
      } else if (errorMessage.includes('Authentication failed')) {
        title = "Authentication Error";
        userMessage = "WordPress credentials are invalid or expired. Please check your username and application password in connection settings.";
      } else if (errorMessage.includes('Component not found')) {
        title = "Component Not Found";
        userMessage = "The component was not found. It may have been deleted or moved.";
      } else if (errorMessage.includes('Access denied')) {
        title = "Access Denied";
        userMessage = "Your WordPress user doesn't have permission to access this content. Contact your administrator.";
      } else if (errorMessage.includes('connection is not active')) {
        title = "Connection Error";
        userMessage = "WordPress connection is not active. Please reconnect to your WordPress site.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        title = "Network Error";
        userMessage = "Network connection failed. Please check your internet connection and try again.";
      } else if (errorMessage.includes('site URL is required')) {
        title = "Configuration Error";
        userMessage = "WordPress site URL is missing. Please check your connection settings.";
      } else {
        userMessage = `Failed to copy component: ${errorMessage}`;
      }
      
      toast({
        title,
        description: userMessage,
        variant: "destructive",
        duration: 6000
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