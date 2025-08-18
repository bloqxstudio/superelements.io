/**
 * Enhanced Elementor Data Extractor with robust error handling and validation
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
    componentId: number;
    attempts: number;
    dataSource: string;
    rawDataSize: number;
    parsedElements: number;
    validationErrors: string[];
    authStatus: string;
  };
}

/**
 * Enhanced component extraction with comprehensive error handling
 */
export const extractComponentRobust = async (
  componentId: number,
  config: WordPressConfig
): Promise<ExtractionResult> => {
  console.log('🚀 ENHANCED EXTRACTION START:', {
    componentId,
    baseUrl: config.baseUrl,
    postType: config.postType,
    hasAuth: !!(config.username && config.applicationPassword)
  });

  const debugInfo = {
    componentId,
    attempts: 0,
    dataSource: 'none',
    rawDataSize: 0,
    parsedElements: 0,
    validationErrors: [] as string[],
    authStatus: 'unknown'
  };

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    debugInfo.attempts = attempt;
    console.log(`📡 EXTRACTION ATTEMPT ${attempt}/${maxRetries}`);

    try {
      const result = await attemptExtraction(componentId, config, debugInfo);
      
      if (result.success) {
        console.log('✅ EXTRACTION SUCCESS:', {
          attempt,
          elementsCount: result.data?.length || 0,
          source: debugInfo.dataSource
        });
        return result;
      } else {
        lastError = new Error(result.error || 'Unknown extraction error');
        console.warn(`⚠️ ATTEMPT ${attempt} FAILED:`, result.error);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`💥 ATTEMPT ${attempt} ERROR:`, lastError.message);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ WAITING ${delay}ms BEFORE RETRY...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  console.error('💥 ALL EXTRACTION ATTEMPTS FAILED:', {
    attempts: maxRetries,
    lastError: lastError?.message,
    debugInfo
  });

  return {
    success: false,
    error: getEnhancedErrorMessage(lastError, debugInfo),
    debugInfo
  };
};

/**
 * Single extraction attempt with detailed logging
 */
const attemptExtraction = async (
  componentId: number,
  config: WordPressConfig,
  debugInfo: any
): Promise<ExtractionResult> => {
  // Validate configuration
  if (!config.baseUrl || !config.postType) {
    debugInfo.validationErrors.push('Missing baseUrl or postType');
    return {
      success: false,
      error: 'Invalid configuration: baseUrl and postType are required',
      debugInfo
    };
  }

  // Prepare API request
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}/${componentId}?context=edit&_fields=id,title,meta`;
  
  console.log('🔗 API REQUEST:', {
    url: apiUrl,
    hasAuth: !!(config.username && config.applicationPassword)
  });

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'SuperElements/1.0'
  };

  // Add authentication if provided
  if (config.username && config.applicationPassword) {
    try {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
      debugInfo.authStatus = 'provided';
      console.log('🔐 AUTHENTICATION ADDED');
    } catch (authError) {
      debugInfo.authStatus = 'invalid';
      debugInfo.validationErrors.push('Invalid authentication credentials');
      return {
        success: false,
        error: 'Failed to encode authentication credentials',
        debugInfo
      };
    }
  } else {
    debugInfo.authStatus = 'none';
    console.log('⚠️ NO AUTHENTICATION PROVIDED');
  }

  // Make API request - removed timeout property
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers
  });

  console.log('📡 API RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get('content-type'),
    contentLength: response.headers.get('content-length')
  });

  // Check response status
  if (!response.ok) {
    debugInfo.authStatus = response.status === 401 ? 'failed' : debugInfo.authStatus;
    
    const errorText = await response.text().catch(() => 'Unknown error');
    const errorMessage = `HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`;
    
    return {
      success: false,
      error: errorMessage,
      debugInfo
    };
  }

  // Parse response
  const responseText = await response.text();
  debugInfo.rawDataSize = responseText.length;
  
  console.log('📦 RESPONSE DATA:', {
    size: responseText.length,
    preview: responseText.substring(0, 200) + '...'
  });

  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (parseError) {
    debugInfo.validationErrors.push('Failed to parse JSON response');
    return {
      success: false,
      error: 'Invalid JSON response from WordPress API',
      debugInfo
    };
  }

  // Validate response structure
  if (!responseData || typeof responseData !== 'object') {
    debugInfo.validationErrors.push('Invalid response structure');
    return {
      success: false,
      error: 'Invalid response structure from WordPress API',
      debugInfo
    };
  }

  console.log('🔍 RESPONSE STRUCTURE:', {
    hasId: !!responseData.id,
    hasTitle: !!responseData.title,
    hasMeta: !!responseData.meta,
    metaKeys: responseData.meta ? Object.keys(responseData.meta) : []
  });

  // Extract Elementor data
  const extractionResult = extractElementorDataFromResponse(responseData, debugInfo);
  
  if (extractionResult.success) {
    debugInfo.dataSource = 'elementor_meta';
    debugInfo.parsedElements = extractionResult.data?.length || 0;
  }

  return extractionResult;
};

/**
 * Extract Elementor data from WordPress response
 */
const extractElementorDataFromResponse = (responseData: any, debugInfo: any): ExtractionResult => {
  console.log('🎯 EXTRACTING ELEMENTOR DATA...');

  // Check for meta data
  if (!responseData.meta) {
    debugInfo.validationErrors.push('No meta data found in response');
    return createFallbackStructure(responseData, debugInfo);
  }

  // Look for Elementor data in various meta fields
  const possibleFields = ['_elementor_data', 'elementor_data', '_elementor_edit_mode'];
  let elementorDataRaw = null;
  let sourceField = '';

  for (const field of possibleFields) {
    if (responseData.meta[field]) {
      elementorDataRaw = responseData.meta[field];
      sourceField = field;
      break;
    }
  }

  if (!elementorDataRaw) {
    debugInfo.validationErrors.push('No Elementor data found in meta fields');
    console.log('⚠️ NO ELEMENTOR DATA FOUND, CREATING FALLBACK');
    return createFallbackStructure(responseData, debugInfo);
  }

  console.log('📊 ELEMENTOR DATA FOUND:', {
    sourceField,
    dataType: typeof elementorDataRaw,
    dataSize: String(elementorDataRaw).length
  });

  // Parse Elementor data
  let elementorData;
  try {
    if (typeof elementorDataRaw === 'string') {
      elementorData = JSON.parse(elementorDataRaw);
    } else if (Array.isArray(elementorDataRaw)) {
      elementorData = elementorDataRaw;
    } else {
      throw new Error('Unexpected Elementor data format');
    }
  } catch (parseError) {
    debugInfo.validationErrors.push(`Failed to parse Elementor data: ${parseError}`);
    console.error('💥 PARSE ERROR:', parseError);
    return createFallbackStructure(responseData, debugInfo);
  }

  // Validate Elementor data structure
  if (!Array.isArray(elementorData)) {
    debugInfo.validationErrors.push('Elementor data is not an array');
    return createFallbackStructure(responseData, debugInfo);
  }

  if (elementorData.length === 0) {
    debugInfo.validationErrors.push('Elementor data array is empty');
    return createFallbackStructure(responseData, debugInfo);
  }

  // Validate and clean elements
  const cleanedElements = elementorData
    .map(element => validateAndCleanElement(element))
    .filter(Boolean) as ElementorElement[];

  if (cleanedElements.length === 0) {
    debugInfo.validationErrors.push('No valid Elementor elements after cleaning');
    return createFallbackStructure(responseData, debugInfo);
  }

  console.log('✅ ELEMENTOR DATA VALIDATED:', {
    originalElements: elementorData.length,
    cleanedElements: cleanedElements.length,
    sourceField
  });

  return {
    success: true,
    data: cleanedElements,
    debugInfo
  };
};

/**
 * Create fallback structure when Elementor data is not available
 */
const createFallbackStructure = (responseData: any, debugInfo: any): ExtractionResult => {
  console.log('🔄 CREATING FALLBACK STRUCTURE');
  
  const fallbackElements: ElementorElement[] = [];
  
  // Create basic structure from available data
  if (responseData.title?.rendered || responseData.title) {
    const title = responseData.title?.rendered || responseData.title;
    fallbackElements.push({
      id: generateElementorId(),
      elType: 'widget',
      isInner: false,
      isLocked: false,
      widgetType: 'heading',
      settings: {
        title: title,
        size: 'h2',
        align: 'left'
      },
      elements: []
    });
  }

  if (responseData.excerpt?.rendered || responseData.content?.rendered) {
    const content = responseData.excerpt?.rendered || responseData.content?.rendered || '';
    fallbackElements.push({
      id: generateElementorId(),
      elType: 'widget',
      isInner: false,
      isLocked: false,
      widgetType: 'text-editor',
      settings: {
        editor: content.replace(/<[^>]*>/g, ''), // Strip HTML
        align: 'left'
      },
      elements: []
    });
  }

  // Wrap in container if multiple elements
  if (fallbackElements.length > 1) {
    const containerElement: ElementorElement = {
      id: generateElementorId(),
      elType: 'container',
      isInner: false,
      isLocked: false,
      settings: {
        content_width: 'boxed',
        gap: { size: 20, unit: 'px' }
      },
      elements: fallbackElements
    };

    debugInfo.dataSource = 'fallback_container';
    return {
      success: true,
      data: [containerElement],
      debugInfo
    };
  } else if (fallbackElements.length === 1) {
    debugInfo.dataSource = 'fallback_single';
    return {
      success: true,
      data: fallbackElements,
      debugInfo
    };
  }

  // Last resort: create empty container
  debugInfo.dataSource = 'fallback_empty';
  debugInfo.validationErrors.push('Created empty fallback structure');
  
  return {
    success: true,
    data: [{
      id: generateElementorId(),
      elType: 'container',
      isInner: false,
      isLocked: false,
      settings: {
        content_width: 'boxed'
      },
      elements: []
    }],
    debugInfo
  };
};

/**
 * Validate and clean individual Elementor element
 */
const validateAndCleanElement = (element: any): ElementorElement | null => {
  if (!element || typeof element !== 'object') {
    return null;
  }

  const cleanedElement: ElementorElement = {
    id: element.id || generateElementorId(),
    elType: element.elType || 'container',
    isInner: Boolean(element.isInner),
    isLocked: Boolean(element.isLocked),
    settings: element.settings || {},
    elements: []
  };

  // Add optional properties
  if (element.widgetType) {
    cleanedElement.widgetType = element.widgetType;
  }

  if (element.defaultEditSettings) {
    cleanedElement.defaultEditSettings = element.defaultEditSettings;
  }

  if (element.editSettings) {
    cleanedElement.editSettings = element.editSettings;
  }

  if (element.htmlCache) {
    cleanedElement.htmlCache = element.htmlCache;
  }

  // Recursively clean child elements
  if (element.elements && Array.isArray(element.elements)) {
    cleanedElement.elements = element.elements
      .map(validateAndCleanElement)
      .filter(Boolean) as ElementorElement[];
  }

  return cleanedElement;
};

/**
 * Generate Elementor-compatible ID
 */
const generateElementorId = (): string => {
  return Math.random().toString(36).substr(2, 7);
};

/**
 * Format for Elementor clipboard
 */
export const formatForElementorClipboard = (
  elements: ElementorElement[],
  siteUrl: string
): string => {
  const clipboardData: ElementorClipboardFormat = {
    type: "elementor",
    siteurl: siteUrl,
    elements: elements
  };

  return JSON.stringify(clipboardData, null, 2);
};

/**
 * Get enhanced error message based on debug info
 */
const getEnhancedErrorMessage = (error: Error | null, debugInfo: any): string => {
  if (!error) return 'Unknown error occurred';

  const errorMessage = error.message.toLowerCase();

  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
    return 'Authentication failed. Please check your WordPress username and application password.';
  }

  if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
    return 'Access denied. Your account may not have permission to access this component.';
  }

  if (errorMessage.includes('404') || errorMessage.includes('not found')) {
    return 'Component not found. It may have been deleted or the URL is incorrect.';
  }

  // Network errors
  if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
    return 'Network timeout. Please check your internet connection and try again.';
  }

  // Data errors
  if (debugInfo.validationErrors.length > 0) {
    return `Data validation failed: ${debugInfo.validationErrors[0]}`;
  }

  // Parsing errors
  if (errorMessage.includes('json') || errorMessage.includes('parse')) {
    return 'Data format error. The component data may be corrupted.';
  }

  return `Extraction failed: ${error.message}`;
};

/**
 * Main extraction function for clipboard
 */
export const extractComponentForClipboard = async (
  componentId: number,
  config: WordPressConfig
): Promise<string> => {
  console.log('🎯 EXTRACT FOR CLIPBOARD:', componentId);

  const result = await extractComponentRobust(componentId, config);
  
  if (!result.success) {
    console.error('💥 EXTRACTION FAILED:', result.error);
    throw new Error(result.error || 'Component extraction failed');
  }

  if (!result.data || result.data.length === 0) {
    throw new Error('No valid component data found');
  }

  const clipboardJson = formatForElementorClipboard(result.data, config.baseUrl);
  
  console.log('✅ CLIPBOARD READY:', {
    elementsCount: result.data.length,
    jsonSize: clipboardJson.length,
    source: result.debugInfo.dataSource
  });

  return clipboardJson;
};
