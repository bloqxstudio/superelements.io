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
  console.log('🔍 ANALYZING API RESPONSE FOR ELEMENTOR DATA...', { context, componentId });
  
  // First, analyze what data we received
  analyzeAvailableData(data);
  
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

  // NO FALLBACK - Only return real Elementor data
  console.log('❌ NO ELEMENTOR DATA FOUND - REFUSING to create fallback');
  console.log('🔍 Detailed analysis of available data:', {
    hasContent: !!data.content,
    hasMeta: !!data.meta,
    hasAcf: !!data.acf,
    metaKeys: data.meta ? Object.keys(data.meta) : [],
    acfKeys: data.acf ? Object.keys(data.acf) : [],
    contentPreview: data.content?.rendered ? data.content.rendered.substring(0, 200) + '...' : 'No content',
    fullDataKeys: Object.keys(data)
  });
  
  debugInfo.dataSource = 'no_elementor_data_found';
  
  return {
    success: false,
    error: 'This component was not created with Elementor or does not contain Elementor data. Only Elementor components can be copied.',
    debugInfo: {
      ...debugInfo,
      validationErrors: [
        'No _elementor_data found in meta fields',
        'No Elementor data found in ACF fields',
        'Component appears to be a regular WordPress post/page, not an Elementor component'
      ]
    }
  };
};

/**
 * Debug function to analyze what data is actually available
 */
const analyzeAvailableData = (responseData: any): void => {
  console.log('🔍 DEEP DATA ANALYSIS - What data is actually available?');
  
  console.log('📦 Response structure:', {
    keys: Object.keys(responseData),
    hasId: !!responseData.id,
    hasTitle: !!responseData.title,
    hasContent: !!responseData.content,
    hasMeta: !!responseData.meta,
    hasAcf: !!responseData.acf
  });
  
  if (responseData.meta) {
    console.log('📊 Meta fields analysis:', {
      metaKeys: Object.keys(responseData.meta),
      hasElementorData: !!responseData.meta._elementor_data,
      hasElementorControls: !!responseData.meta._elementor_controls_usage,
      hasElementorCss: !!responseData.meta._elementor_css,
      hasElementorVersion: !!responseData.meta._elementor_version,
      elementorDataType: typeof responseData.meta._elementor_data,
      elementorDataLength: responseData.meta._elementor_data ? 
        (typeof responseData.meta._elementor_data === 'string' ? 
         responseData.meta._elementor_data.length : 
         JSON.stringify(responseData.meta._elementor_data).length) : 0
    });
    
    // Show first few characters of _elementor_data if it exists
    if (responseData.meta._elementor_data) {
      const dataStr = typeof responseData.meta._elementor_data === 'string' ? 
        responseData.meta._elementor_data : 
        JSON.stringify(responseData.meta._elementor_data);
      console.log('📄 _elementor_data preview (first 500 chars):', dataStr.substring(0, 500) + '...');
    }
  }
  
  if (responseData.acf) {
    console.log('📊 ACF fields analysis:', {
      acfKeys: Object.keys(responseData.acf),
      acfPreview: Object.keys(responseData.acf).reduce((acc, key) => {
        acc[key] = typeof responseData.acf[key];
        return acc;
      }, {} as Record<string, string>)
    });
  }
  
  console.log('📄 Content analysis:', {
    hasRenderedContent: !!responseData.content?.rendered,
    contentLength: responseData.content?.rendered?.length || 0,
    contentPreview: responseData.content?.rendered ? 
      responseData.content.rendered.substring(0, 200) + '...' : 'No content'
  });
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
    console.log('🚀 ENHANCED CLIPBOARD EXTRACTION - REAL ELEMENTOR DATA ONLY');
    console.log('📋 Component analysis:', {
      hasComponent: !!component,
      componentId,
      baseUrl: config.baseUrl
    });
    
    // DETAILED component inspection
    if (component) {
      console.log('🔍 DETAILED COMPONENT INSPECTION:');
      console.log('📦 Component keys:', Object.keys(component));
      console.log('📊 Component meta analysis:', {
        hasMeta: !!component.meta,
        metaKeys: component.meta ? Object.keys(component.meta) : [],
        hasElementorData: !!(component.meta && component.meta._elementor_data),
        elementorDataType: component.meta?._elementor_data ? typeof component.meta._elementor_data : 'undefined'
      });
      
      // Try to extract local data with enhanced debugging
      const localData = extractLocalElementorData(component);
      if (localData && localData.length > 0) {
        console.log('✅ FOUND VALID LOCAL ELEMENTOR DATA!');
        console.log('📊 Local data details:', {
          elementCount: localData.length,
          hasWidgets: localData.some(el => el.widgetType),
          hasSections: localData.some(el => el.elType === 'section'),
          hasContainers: localData.some(el => el.elType === 'container'),
          dataPreview: JSON.stringify(localData[0]).substring(0, 300) + '...'
        });
        return formatForElementorClipboard(localData, config.baseUrl);
      } else {
        console.log('❌ NO VALID LOCAL ELEMENTOR DATA FOUND');
      }
    }
    
    // Enhanced API extraction with detailed logging
    console.log('📡 ATTEMPTING API EXTRACTION (Local data not found or invalid)...');
    const result = await extractComponentRobust(componentId, config);
    
    if (result.success && result.data && result.data.length > 0) {
      console.log('✅ API EXTRACTION SUCCESSFUL!');
      console.log('📊 API data details:', {
        elementCount: result.data.length,
        dataSource: result.debugInfo.dataSource,
        hasWidgets: JSON.stringify(result.data).includes('"widgetType"'),
        hasSections: JSON.stringify(result.data).includes('"elType":"section"')
      });
      return formatForElementorClipboard(result.data, config.baseUrl);
    }
    
    // Enhanced error with detailed debugging info
    console.error('❌ EXTRACTION FAILED - NO ELEMENTOR DATA FOUND');
    console.error('🔍 Debug info:', result.debugInfo);
    
    const errorMessage = result.error || 'This component does not contain Elementor data. Only components created with Elementor can be copied.';
    const detailedError = result.debugInfo?.validationErrors ? 
      `${errorMessage}\n\nDetails: ${result.debugInfo.validationErrors.join(', ')}` : 
      errorMessage;
    
    throw new Error(detailedError);
    
  } catch (error) {
    console.error('❌ CLIPBOARD EXTRACTION FAILED:', error);
    throw error;
  }
};

// Extract Elementor data from local component object with ENHANCED validation and DEBUG
const extractLocalElementorData = (component: any): ElementorElement[] | null => {
  console.log('🔍 ENHANCED LOCAL ELEMENTOR DATA EXTRACTION - FULL DEBUG MODE');
  
  // STEP 1: Complete component analysis
  console.log('📦 COMPLETE COMPONENT ANALYSIS:', {
    hasComponent: !!component,
    componentType: typeof component,
    componentKeys: component ? Object.keys(component) : [],
    componentId: component?.id,
    componentTitle: component?.title?.rendered || component?.title,
    componentLink: component?.link,
    componentStatus: component?.status,
    postType: component?.type,
  });

  // STEP 2: Meta fields detailed analysis
  if (component?.meta) {
    console.log('📋 META FIELDS COMPLETE ANALYSIS:', {
      metaKeys: Object.keys(component.meta),
      metaData: component.meta,
      hasElementorData: '_elementor_data' in component.meta,
      hasElementorVersion: '_elementor_version' in component.meta,
      hasElementorCss: '_elementor_css' in component.meta,
      hasElementorEditMode: '_elementor_edit_mode' in component.meta,
      elementorDataExists: !!component.meta._elementor_data,
      elementorDataType: typeof component.meta._elementor_data,
      elementorDataLength: component.meta._elementor_data ? 
        (typeof component.meta._elementor_data === 'string' ? component.meta._elementor_data.length : JSON.stringify(component.meta._elementor_data).length) : 0
    });
    
    // Show raw _elementor_data if it exists
    if (component.meta._elementor_data) {
      console.log('🎯 RAW ELEMENTOR DATA FOUND:', {
        type: typeof component.meta._elementor_data,
        preview: typeof component.meta._elementor_data === 'string' ? 
          component.meta._elementor_data.substring(0, 500) : 
          JSON.stringify(component.meta._elementor_data).substring(0, 500),
        fullLength: typeof component.meta._elementor_data === 'string' ? 
          component.meta._elementor_data.length : 
          JSON.stringify(component.meta._elementor_data).length
      });
    }
  } else {
    console.log('❌ NO META FIELDS FOUND IN COMPONENT');
  }

  // STEP 3: Content analysis
  if (component?.content) {
    console.log('📄 CONTENT ANALYSIS:', {
      hasContent: !!component.content,
      contentKeys: typeof component.content === 'object' ? Object.keys(component.content) : [],
      hasRendered: !!(component.content?.rendered),
      hasProtected: !!(component.content?.protected),
      renderedLength: component.content?.rendered?.length || 0,
      renderedPreview: component.content?.rendered?.substring(0, 200) || 'No rendered content'
    });
  }

  // STEP 4: ACF fields analysis
  if (component?.acf) {
    console.log('🔧 ACF FIELDS ANALYSIS:', {
      hasAcf: !!component.acf,
      acfKeys: typeof component.acf === 'object' ? Object.keys(component.acf) : [],
      acfData: component.acf
    });
  }

  // STEP 5: Search in ALL possible locations for Elementor data
  const possibleSources = [
    // Primary meta locations
    { path: ['meta', '_elementor_data'], name: 'Primary Elementor Data' },
    { path: ['meta', 'elementor_data'], name: 'Alternative Elementor Data' },
    { path: ['meta', '_elementor_css'], name: 'Elementor CSS' },
    
    // Content locations
    { path: ['content', 'rendered'], name: 'Rendered Content' },
    { path: ['content', 'raw'], name: 'Raw Content' },
    { path: ['content', 'protected'], name: 'Protected Content' },
    
    // ACF locations
    { path: ['acf', '_elementor_data'], name: 'ACF Elementor Data' },
    { path: ['acf', 'elementor_data'], name: 'ACF Alternative Elementor Data' },
    { path: ['acf'], name: 'All ACF Fields' },
    
    // Direct properties
    { path: ['_elementor_data'], name: 'Direct Elementor Data' },
    { path: ['elementor_data'], name: 'Direct Alternative Elementor Data' },
    
    // Nested meta locations
    { path: ['meta', '_elementor_version'], name: 'Elementor Version' },
    { path: ['meta', '_elementor_edit_mode'], name: 'Elementor Edit Mode' },
    { path: ['meta', '_elementor_template_type'], name: 'Elementor Template Type' },
    
    // WordPress post meta variations
    { path: ['postmeta', '_elementor_data'], name: 'Post Meta Elementor Data' },
    { path: ['custom_fields', '_elementor_data'], name: 'Custom Fields Elementor Data' },
  ];

  let foundData = null;
  let dataSource = 'Not found';
  let isElementorRelated = false;

  // Check each possible source
  for (const source of possibleSources) {
    const data = getNestedValue(component, source.path);
    console.log(`🔍 Checking ${source.name} at ${source.path.join('.')}:`, {
      hasData: !!data,
      dataType: typeof data,
      dataLength: data ? (typeof data === 'string' ? data.length : JSON.stringify(data).length) : 0,
      preview: data ? (typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data).substring(0, 100)) : 'No data'
    });
    
    if (data) {
      // Check if this looks like Elementor data
      const isElementorData = validateElementorDataFlexible(data);
      console.log(`📊 ${source.name} validation:`, {
        isElementorData,
        hasElementorMarkers: hasElementorMarkers(data),
        isJSON: isValidJSON(data),
        dataPreview: typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200)
      });
      
      if (isElementorData && !foundData) {
        foundData = data;
        dataSource = source.name;
        isElementorRelated = true;
        console.log(`✅ FOUND VALID ELEMENTOR DATA in ${source.name}!`);
        break;
      } else if (hasElementorMarkers(data)) {
        isElementorRelated = true;
        console.log(`🔍 Found Elementor-related data in ${source.name}, but validation failed`);
      }
    }
  }

  // STEP 6: Final decision and enhanced error reporting
  console.log('🎯 FINAL EXTRACTION RESULT:', {
    foundData: !!foundData,
    dataSource,
    isElementorRelated,
    hasAnyElementorVersion: !!(component?.meta?._elementor_version),
    hasElementorEditMode: !!(component?.meta?._elementor_edit_mode),
    recommendedAction: foundData ? 'PROCEED_WITH_COPY' : (isElementorRelated ? 'NEEDS_FLEXIBLE_PARSING' : 'NOT_ELEMENTOR_COMPONENT')
  });

  if (!foundData) {
    // Enhanced error reporting
    if (isElementorRelated) {
      console.error('❌ ELEMENTOR COMPONENT DETECTED BUT DATA EXTRACTION FAILED:', {
        hasElementorVersion: !!(component?.meta?._elementor_version),
        hasElementorEditMode: !!(component?.meta?._elementor_edit_mode),
        possibleIssues: [
          'Elementor data may be encoded/escaped differently',
          'Component may use newer Elementor format',
          'Data may be stored in custom field location',
          'Authentication may be required for full meta access'
        ]
      });
    } else {
      console.error('❌ NO ELEMENTOR DATA FOUND - This appears to be a non-Elementor component');
    }
    return null;
  }

  // Try to parse the found data
  try {
    const parsedData = typeof foundData === 'string' ? JSON.parse(foundData) : foundData;
    console.log('✅ Successfully parsed Elementor data from:', dataSource);
    return Array.isArray(parsedData) ? parsedData : [parsedData];
  } catch (error) {
    console.error('❌ Failed to parse found Elementor data:', error);
    return null;
  }
};

// Helper functions for enhanced validation
const getNestedValue = (obj: any, path: string[]): any => {
  return path.reduce((current, key) => current?.[key], obj);
};

const isValidJSON = (str: any): boolean => {
  if (typeof str !== 'string') return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

const hasElementorMarkers = (data: any): boolean => {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  return dataStr.includes('elType') || 
         dataStr.includes('widgetType') || 
         dataStr.includes('elementor') || 
         dataStr.includes('_elementor');
};

const validateElementorDataFlexible = (data: any): boolean => {
  try {
    let parsed = data;
    if (typeof data === 'string') {
      parsed = JSON.parse(data);
    }
    
    if (Array.isArray(parsed)) {
      return parsed.some(item => 
        item && 
        typeof item === 'object' && 
        (item.elType || item.widgetType || item.elements)
      );
    }
    
    if (parsed && typeof parsed === 'object') {
      return !!(parsed.elType || parsed.widgetType || parsed.elements);
    }
    
    return false;
  } catch {
    return false;
  }
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