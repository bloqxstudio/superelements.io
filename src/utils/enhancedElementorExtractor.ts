/**
 * Enhanced Elementor Data Extractor - Prioritizes ORIGINAL data over fallbacks
 */

interface ElementorClipboardFormat {
  type: "elementor";
  siteurl: string;
  elements: ElementorElement[];
}

interface ElementorElement {
  id: string;
  elType: string;
  isInner: boolean;
  isLocked: boolean;
  settings: Record<string, any>;
  defaultEditSettings?: Record<string, any>;
  elements: ElementorElement[];
  widgetType?: string;
  htmlCache?: string;
  editSettings?: Record<string, any>;
}

interface WordPressConfig {
  baseUrl: string;
  postType: string;
  username?: string;
  applicationPassword?: string;
}

interface ExtractionResult {
  success: boolean;
  data?: ElementorElement[];
  error?: string;
  debugInfo: {
    componentId?: number;
    attempts?: number;
    dataSource: string;
    rawDataSize?: number;
    parsedElements?: number;
    validationErrors?: string[];
    authStatus?: string;
    context?: string;
    elementorValidation?: {
      found: boolean;
      isValid: boolean;
      elementCount: number;
      hasComplexStructure: boolean;
    };
    warning?: string;
  };
}

/**
 * Main extraction function - prioritizes original Elementor data
 */
export const extractComponentRobust = async (
  componentId: number,
  config: WordPressConfig
): Promise<ExtractionResult> => {
  console.log('🚀 ENHANCED EXTRACTION START - PRIORITIZING ORIGINAL DATA:', {
    componentId,
    baseUrl: config.baseUrl,
    postType: config.postType,
    hasAuth: !!(config.username && config.applicationPassword)
  });

  return await attemptExtraction(componentId, config, 1);
};

/**
 * Enhanced extraction attempt with multiple contexts and complete field access
 */
const attemptExtraction = async (
  componentId: number,
  config: WordPressConfig,
  attempt: number
): Promise<ExtractionResult> => {
  const maxRetries = 3;
  
  try {
    console.log(`🔄 Extraction attempt ${attempt}/${maxRetries} for component ${componentId}`);
    
    // Try with edit context first for complete meta data access
    const contexts = ['edit', 'view'];
    let lastError: Error | null = null;
    
    for (const context of contexts) {
      try {
        // Build API URL with full meta fields and context
        const apiUrl = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/${config.postType}/${componentId}?context=${context}&_fields=id,title,content,meta,acf`;
        
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        
        // Use authentication for edit context
        if (context === 'edit' && config.username && config.applicationPassword) {
          const auth = btoa(`${config.username}:${config.applicationPassword}`);
          headers['Authorization'] = `Basic ${auth}`;
        }

        console.log(`📡 Making API request with ${context} context:`, { url: apiUrl, hasAuth: !!headers.Authorization });
        
        const response = await fetch(apiUrl, { 
          method: 'GET',
          headers,
          credentials: 'omit'
        });

        if (!response.ok) {
          console.log(`❌ ${context} context failed: HTTP ${response.status}`);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        console.log(`📦 ${context.toUpperCase()} context response:`, {
          hasContent: !!data.content,
          hasMeta: !!data.meta,
          metaKeys: data.meta ? Object.keys(data.meta) : [],
          hasElementorData: !!(data.meta && data.meta._elementor_data),
          elementorDataLength: data.meta?._elementor_data ? 
            (typeof data.meta._elementor_data === 'string' ? data.meta._elementor_data.length : JSON.stringify(data.meta._elementor_data).length) : 0
        });
        
        return await extractElementorDataFromResponse(data, config, componentId, context);
        
      } catch (contextError) {
        console.log(`❌ ${context} context error:`, contextError);
        lastError = contextError instanceof Error ? contextError : new Error(String(contextError));
        continue;
      }
    }
    
    // If both contexts failed, throw the last error
    throw lastError || new Error('All contexts failed');
    
  } catch (error) {
    console.error(`❌ Attempt ${attempt} failed:`, error);
    
    if (attempt >= maxRetries) {
      return {
        success: false,
        error: `Failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        debugInfo: {
          dataSource: 'failed',
          attempts: attempt,
          validationErrors: [error instanceof Error ? error.message : String(error)],
          authStatus: 'failed'
        }
      };
    }
    
    // Exponential backoff for retries
    const delay = Math.pow(2, attempt - 1) * 1000;
    console.log(`⏳ Waiting ${delay}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return attemptExtraction(componentId, config, attempt + 1);
  }
};

/**
 * Extract and preserve original Elementor data exactly as stored
 */
const extractElementorDataFromResponse = async (
  data: any,
  config: WordPressConfig,
  componentId: number,
  context: string = 'view'
): Promise<ExtractionResult> => {
  console.log('🔍 Analyzing response for Elementor data...', { context, componentId });
  
  const debugInfo = {
    hasContent: !!data.content,
    hasMeta: !!data.meta,
    contentLength: data.content?.rendered?.length || 0,
    metaKeys: data.meta ? Object.keys(data.meta) : [],
    dataSource: 'unknown' as string,
    context,
    elementorValidation: {
      found: false,
      isValid: false,
      elementCount: 0,
      hasComplexStructure: false
    }
  };

  // Priority 1: Direct _elementor_data extraction (PRESERVE ORIGINAL STRUCTURE)
  if (data.meta && data.meta._elementor_data) {
    console.log('🎯 Found _elementor_data in meta');
    
    let elementorData;
    try {
      // Parse the data but preserve it exactly as stored
      elementorData = typeof data.meta._elementor_data === 'string' 
        ? JSON.parse(data.meta._elementor_data)
        : data.meta._elementor_data;
      
      console.log('📊 Raw Elementor data analysis:', {
        type: Array.isArray(elementorData) ? 'array' : typeof elementorData,
        length: Array.isArray(elementorData) ? elementorData.length : 'N/A',
        firstElementKeys: Array.isArray(elementorData) && elementorData[0] ? Object.keys(elementorData[0]) : [],
        hasElType: Array.isArray(elementorData) && elementorData[0] ? !!elementorData[0].elType : false,
        hasElements: Array.isArray(elementorData) && elementorData[0] ? !!elementorData[0].elements : false,
        dataPreview: JSON.stringify(elementorData).substring(0, 200) + '...'
      });
      
      // Minimal validation - accept if it looks like Elementor data
      const hasElementorStructure = elementorData && 
        (Array.isArray(elementorData) || typeof elementorData === 'object') &&
        JSON.stringify(elementorData).includes('elType');
      
      debugInfo.elementorValidation = {
        found: true,
        isValid: hasElementorStructure,
        elementCount: Array.isArray(elementorData) ? elementorData.length : 1,
        hasComplexStructure: JSON.stringify(elementorData).includes('"elements":[')
      };
      
      if (hasElementorStructure) {
        debugInfo.dataSource = 'elementor_meta_original';
        console.log('✅ USING ORIGINAL ELEMENTOR DATA - No modifications');
        
        // Return the data EXACTLY as found - no validation or cleaning
        const finalData = Array.isArray(elementorData) ? elementorData : [elementorData];
        
        console.log('🚀 Returning original Elementor data:', {
          elementsCount: finalData.length,
          totalSize: JSON.stringify(finalData).length,
          hasWidgets: JSON.stringify(finalData).includes('"widgetType"'),
          hasSections: JSON.stringify(finalData).includes('"elType":"section"'),
          hasContainers: JSON.stringify(finalData).includes('"elType":"container"')
        });
        
        return {
          success: true,
          data: finalData,
          debugInfo
        };
      } else {
        console.log('⚠️ _elementor_data exists but does not contain elType structure');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse _elementor_data:', parseError);
    }
  }

  // Priority 2: Check other Elementor meta fields
  const elementorFields = [
    '_elementor_controls_usage',
    '_elementor_css', 
    '_elementor_page_settings',
    '_elementor_version',
    '_elementor_pro_version'
  ];
  
  for (const field of elementorFields) {
    if (data.meta && data.meta[field]) {
      console.log(`🔍 Checking Elementor field: ${field}`);
      console.log(`📄 ${field} content:`, data.meta[field]);
      
      try {
        const fieldData = typeof data.meta[field] === 'string' 
          ? JSON.parse(data.meta[field])
          : data.meta[field];
          
        if (fieldData && JSON.stringify(fieldData).includes('elType')) {
          debugInfo.dataSource = `elementor_${field}_original`;
          console.log(`✅ Found Elementor structure in ${field}, using original data`);
          
          const finalData = Array.isArray(fieldData) ? fieldData : [fieldData];
          return {
            success: true,
            data: finalData,
            debugInfo
          };
        }
      } catch (error) {
        console.log(`❌ Failed to parse ${field}:`, error);
      }
    }
  }

  // Priority 3: Check ACF fields for Elementor data
  if (data.acf && typeof data.acf === 'object') {
    console.log('🔍 Checking ACF fields...');
    const acfKeys = Object.keys(data.acf);
    
    for (const key of acfKeys) {
      const acfValue = data.acf[key];
      if (acfValue && JSON.stringify(acfValue).includes('elType')) {
        debugInfo.dataSource = `acf_${key}_original`;
        console.log(`✅ Found Elementor data in ACF field: ${key}`);
        
        const finalData = Array.isArray(acfValue) ? acfValue : [acfValue];
        return {
          success: true,
          data: finalData,
          debugInfo
        };
      }
    }
  }

  // Only use fallback as last resort when NO Elementor data exists
  console.log('❌ NO ELEMENTOR DATA FOUND - Creating fallback (will not work properly in Elementor)');
  debugInfo.dataSource = 'fallback_warning';
  
  const fallbackElements = await createMinimalFallback(data, config);
  
  return {
    success: true,
    data: fallbackElements,
    debugInfo: {
      ...debugInfo,
      warning: 'Using fallback structure - component may not work properly in Elementor'
    }
  };
};

/**
 * Create minimal fallback when no Elementor data exists
 */
const createMinimalFallback = async (
  responseData: any,
  config: WordPressConfig
): Promise<ElementorElement[]> => {
  console.log('⚠️ CREATING MINIMAL FALLBACK - THIS IS NOT IDEAL');
  
  const title = responseData.title?.rendered || responseData.title || 'Untitled Component';
  const content = responseData.content?.rendered || responseData.content || '';
  
  // Create basic text widget with warning
  const fallbackElement: ElementorElement = {
    id: generateElementorId(),
    elType: 'widget',
    isInner: false,
    isLocked: false,
    widgetType: 'text-editor',
    settings: {
      editor: `<h3>${title}</h3>${content}<p><strong>Note:</strong> This is a fallback structure. The original component may not have been built with Elementor.</p>`,
      text_color: '#e74c3c'
    },
    elements: []
  };

  return [fallbackElement];
};

/**
 * Generate unique Elementor element ID
 */
const generateElementorId = (): string => {
  return Math.random().toString(36).substr(2, 7);
};

/**
 * Format extracted elements for Elementor clipboard
 */
export const formatForElementorClipboard = (
  elements: ElementorElement[],
  siteUrl: string
): string => {
  const clipboardData: ElementorClipboardFormat = {
    type: "elementor",
    siteurl: siteUrl.replace(/\/$/, ''),
    elements: elements
  };

  return JSON.stringify(clipboardData);
};

/**
 * Main export function for clipboard usage
 */
export const extractComponentForClipboard = async (
  componentId: number,
  config: WordPressConfig,
  component?: any
): Promise<string> => {
  try {
    console.log('🚀 Starting clipboard extraction for component:', componentId);
    console.log('📋 Component object received:', {
      hasComponent: !!component,
      componentKeys: component ? Object.keys(component) : [],
      componentId,
      componentData: component ? JSON.stringify(component).substring(0, 500) + '...' : 'No component'
    });
    
    // Priority 1: Use local component data if available
    if (component) {
      const localData = extractLocalElementorData(component);
      if (localData) {
        console.log('✅ Using LOCAL component data - no API call needed');
        return formatForElementorClipboard(localData, config.baseUrl);
      }
    }
    
    // Priority 2: Fallback to API extraction only if no local data
    console.log('📡 No local data found, attempting API extraction...');
    const result = await extractComponentRobust(componentId, config);
    
    if (result.success && result.data) {
      console.log('✅ Successfully extracted from API');
      return formatForElementorClipboard(result.data, config.baseUrl);
    }
    
    console.warn('⚠️ Failed to extract component data from any source');
    throw new Error(result.error || 'Failed to extract component data');
    
  } catch (error) {
    console.error('❌ Clipboard extraction error:', error);
    throw error;
  }
};

// Extract Elementor data from local component object
const extractLocalElementorData = (component: any): ElementorElement[] | null => {
  console.log('🔍 Analyzing local component for Elementor data...');
  
  // Check various possible locations for Elementor data
  const possibleSources = [
    component._elementor_data,
    component.elementor_data,
    component.meta?._elementor_data,
    component.meta?.elementor_data,
    component.content?.raw,
    component.content?.rendered,
    component.content,
    component.data,
    component.elementor,
    component._meta?._elementor_data
  ];
  
  for (const [index, source] of possibleSources.entries()) {
    if (!source) continue;
    
    console.log(`🔍 Checking source ${index}:`, {
      type: typeof source,
      isString: typeof source === 'string',
      isArray: Array.isArray(source),
      hasLength: source?.length,
      preview: typeof source === 'string' ? source.substring(0, 200) + '...' : 'Not string'
    });
    
    try {
      let parsed = source;
      
      // Parse if it's a JSON string
      if (typeof source === 'string') {
        // Check if it looks like JSON
        if (source.trim().startsWith('[') || source.trim().startsWith('{')) {
          parsed = JSON.parse(source);
        } else {
          continue; // Skip non-JSON strings
        }
      }
      
      // Validate if it's Elementor data
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasElementorStructure = parsed.some(item => 
          item && typeof item === 'object' && (
            item.elType || 
            item.widgetType || 
            item.elements ||
            item.id
          )
        );
        
        if (hasElementorStructure) {
          console.log('✅ Found valid Elementor data in local component!', {
            source: `possibleSources[${index}]`,
            elementCount: parsed.length,
            firstElement: parsed[0]
          });
          return parsed;
        }
      }
    } catch (parseError) {
      console.log(`⚠️ Failed to parse source ${index}:`, parseError);
      continue;
    }
  }
  
  console.log('❌ No valid Elementor data found in local component');
  return null;
};

/**
 * Enhanced error message generator
 */
export const getEnhancedErrorMessage = (error: Error | null, debugInfo: any): string => {
  if (!error) return 'Unknown error occurred';
  
  const message = error.message.toLowerCase();
  
  if (message.includes('401') || message.includes('authentication')) {
    return 'WordPress authentication failed. Please check your username and application password in connection settings.';
  } else if (message.includes('404')) {
    return 'Component not found. The post may have been deleted or moved.';
  } else if (message.includes('403') || message.includes('access denied')) {
    return 'Access denied. Your WordPress user account may not have permission to access this content.';
  } else if (message.includes('network') || message.includes('fetch')) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }
  
  return `Failed to extract component: ${error.message}`;
};