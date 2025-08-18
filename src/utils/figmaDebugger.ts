
// Utility for debugging Figma copy functionality
export const debugFigmaComponent = (component: any): void => {
  console.group('🔍 Figma Debug - Component Analysis');
  
  console.log('Component basic info:', {
    id: component.id,
    title: component.title?.rendered,
    type: component.type,
    hasLink: !!component.link
  });
  
  // Check all possible locations for Elementor data
  const elementorLocations = {
    '_elementor_data': component._elementor_data,
    'elementor_data': component.elementor_data,
    'meta._elementor_data': component.meta?._elementor_data,
    'meta.elementor_data': component.meta?.elementor_data,
    'acf._elementor_data': component.acf?._elementor_data,
    'custom_fields._elementor_data': component.custom_fields?._elementor_data
  };
  
  console.log('Elementor data locations:', elementorLocations);
  
  // Analyze found data
  Object.entries(elementorLocations).forEach(([location, data]) => {
    if (data) {
      console.log(`Found data at ${location}:`, {
        type: typeof data,
        isString: typeof data === 'string',
        length: typeof data === 'string' ? data.length : Array.isArray(data) ? data.length : 'object',
        preview: typeof data === 'string' ? data.substring(0, 100) + '...' : data
      });
      
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          console.log(`Parsed ${location}:`, {
            isArray: Array.isArray(parsed),
            length: Array.isArray(parsed) ? parsed.length : 'not array',
            firstElement: Array.isArray(parsed) ? parsed[0] : 'not array',
            hasElements: Array.isArray(parsed) && parsed.some(item => item.elType || item.widgetType)
          });
        } catch (e) {
          console.warn(`Failed to parse ${location}:`, e.message);
        }
      }
    }
  });
  
  console.groupEnd();
};

export const debugClipboardData = (htmlContent: string, metadata: any, bufferSize: number): void => {
  console.group('📋 Figma Debug - Clipboard Data');
  
  console.log('HTML structure preview:', htmlContent.substring(0, 500) + '...');
  console.log('Metadata:', metadata);
  console.log('Buffer size:', bufferSize);
  
  // Check HTML structure
  const hasMetadata = htmlContent.includes('data-metadata');
  const hasBuffer = htmlContent.includes('data-buffer');
  const hasFigmetaComments = htmlContent.includes('<!--(figmeta)') && htmlContent.includes('(figmeta)-->');
  const hasFigmaComments = htmlContent.includes('<!--(figma)') && htmlContent.includes('(figma)-->');
  
  console.log('HTML validation:', {
    hasMetadata,
    hasBuffer,
    hasFigmetaComments,
    hasFigmaComments,
    isValidStructure: hasMetadata && hasBuffer && hasFigmetaComments && hasFigmaComments
  });
  
  console.groupEnd();
};
