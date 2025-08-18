import { extractComponentForClipboard } from './directElementorExtractor';

/**
 * Legacy compatibility wrapper for the new direct extraction method
 */
export const copyCompleteComponent = async (component: any, siteUrl: string): Promise<void> => {
  console.log('🔄 LEGACY WRAPPER - redirecting to direct extraction');
  
  try {
    // Get config from store
    const { useWordPressStore } = await import('@/store/wordpressStore');
    const { config } = useWordPressStore.getState();

    const extractConfig = {
      baseUrl: siteUrl,
      postType: config.postType || 'posts',
      username: config.username,
      applicationPassword: config.applicationPassword
    };

    // Use the new direct extraction method
    const clipboardJson = await extractComponentForClipboard(component.id, extractConfig);
    await navigator.clipboard.writeText(clipboardJson);
    
    console.log('✅ LEGACY WRAPPER SUCCESS');
    
  } catch (error) {
    console.error('💥 LEGACY WRAPPER ERROR:', error);
    throw error;
  }
};

// Keep other functions for compatibility but mark as deprecated
export const isValidElementorData = (data: any): boolean => {
  console.warn('⚠️ DEPRECATED: isValidElementorData - use direct extraction instead');
  return false;
};

export const copyElementorToClipboard = async (elementorData: any, siteUrl: string): Promise<void> => {
  console.warn('⚠️ DEPRECATED: copyElementorToClipboard - use copyCompleteComponent instead');
  throw new Error('This function is deprecated. Use copyCompleteComponent instead.');
};

export const detectAvailableJsonFields = (component: any): any[] => {
  console.warn('⚠️ DEPRECATED: detectAvailableJsonFields - not needed with direct extraction');
  return [];
};

export const copyDataToClipboard = async (fieldInfo: any, siteUrl: string, asElementorFormat: boolean = false): Promise<void> => {
  console.warn('⚠️ DEPRECATED: copyDataToClipboard - use copyCompleteComponent instead');
  return copyCompleteComponent(fieldInfo, siteUrl);
};

export const formatElementorClipboardData = (data: any, siteUrl: string, forceElementorFormat: boolean = true, component?: any): any => {
  console.warn('⚠️ DEPRECATED: formatElementorClipboardData - use direct extraction instead');
  return {};
};

export interface JsonFieldInfo {
  fieldName: string;
  data: any;
  type: 'elementor' | 'json' | 'content';
  isValid: boolean;
  preview: string;
}
