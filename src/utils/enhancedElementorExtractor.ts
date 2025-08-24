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

  // Prepare API request - try with edit context first, fallback to view context
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  let apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}/${componentId}?context=edit&_fields=id,title,meta`;
  
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

  // Make API request - try with authentication first
  let response = await fetch(apiUrl, {
    method: 'GET',
    headers
  });

  console.log('📡 API RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get('content-type'),
    contentLength: response.headers.get('content-length')
  });

  // If 401 and we have auth, try fallback without context=edit
  if (response.status === 401 && config.username && config.applicationPassword) {
    console.log('🔄 401 ERROR - TRYING FALLBACK WITHOUT EDIT CONTEXT...');
    
    // Try without context=edit (public access)
    const fallbackUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}/${componentId}?_fields=id,title,meta`;
    
    const fallbackHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'SuperElements/1.0'
    };
    
    response = await fetch(fallbackUrl, {
      method: 'GET',
      headers: fallbackHeaders
    });
    
    console.log('📡 FALLBACK RESPONSE:', {
      status: response.status,
      statusText: response.statusText
    });
    
    if (response.ok) {
      debugInfo.authStatus = 'fallback_success';
      console.log('✅ FALLBACK SUCCESS - Using public access');
    } else {
      debugInfo.authStatus = 'fallback_failed';
    }
  }

  // Check final response status
  if (!response.ok) {
    debugInfo.authStatus = response.status === 401 ? 'failed' : debugInfo.authStatus;
    
    const errorText = await response.text().catch(() => 'Unknown error');
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    if (response.status === 401) {
      errorMessage = 'Authentication failed. Please check your WordPress username and application password.';
    } else if (response.status === 404) {
      errorMessage = 'Component not found. The post may have been deleted or moved.';
    } else if (response.status === 403) {
      errorMessage = 'Access denied. Your user account may not have permission to access this content.';
    } else if (errorText) {
      errorMessage += ` - ${errorText}`;
    }
    
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
    return createEnhancedFallbackStructure(responseData, debugInfo);
  }

  // Expanded search for Elementor data in multiple fields
  const elementorFields = [
    '_elementor_data',
    'elementor_data', 
    '_elementor_edit_mode',
    '_elementor_controls_usage',
    '_elementor_css',
    '_elementor_page_settings',
    '_elementor_version'
  ];

  let elementorDataRaw = null;
  let sourceField = '';

  console.log('🔍 Available meta fields:', Object.keys(responseData.meta));

  // Try each field until we find valid data
  for (const field of elementorFields) {
    if (responseData.meta[field]) {
      console.log(`🎯 Found potential data in field: ${field}`);
      try {
        let fieldData = responseData.meta[field];
        
        // Parse JSON if it's a string
        if (typeof fieldData === 'string' && fieldData.trim().startsWith('[')) {
          fieldData = JSON.parse(fieldData);
        }

        // Check if this looks like valid Elementor structure
        if (Array.isArray(fieldData) && fieldData.length > 0) {
          // Validate this is real Elementor data, not just fallback
          const hasValidElements = fieldData.some(element => 
            element && 
            typeof element === 'object' && 
            element.elType && 
            (element.widgetType || element.elements || Object.keys(element.settings || {}).length > 1)
          );

          if (hasValidElements) {
            elementorDataRaw = fieldData;
            sourceField = field;
            console.log(`✅ Valid Elementor data found in ${field}:`, {
              elementsCount: fieldData.length,
              firstElementType: fieldData[0]?.elType,
              hasWidgets: fieldData.some(el => el.widgetType),
              hasContainers: fieldData.some(el => el.elType === 'container'),
              hasSections: fieldData.some(el => el.elType === 'section')
            });
            break;
          } else {
            console.log(`⚠️ Data in ${field} appears to be simple/fallback structure`);
          }
        }
      } catch (parseError) {
        console.log(`❌ Failed to parse ${field}:`, parseError);
        continue;
      }
    }
  }

  if (!elementorDataRaw) {
    debugInfo.validationErrors.push('No valid Elementor data found in meta fields');
    console.log('⚠️ NO REAL ELEMENTOR DATA FOUND, CREATING ENHANCED FALLBACK');
    return createEnhancedFallbackStructure(responseData, debugInfo);
  }

  console.log('📊 ELEMENTOR DATA FOUND:', {
    sourceField,
    dataType: typeof elementorDataRaw,
    elementsCount: elementorDataRaw.length,
    complexity: elementorDataRaw.some(el => el.elements && el.elements.length > 0) ? 'complex' : 'simple'
  });

  // Validate and clean elements
  const cleanedElements = elementorDataRaw
    .map(element => validateAndCleanElement(element))
    .filter(Boolean) as ElementorElement[];

  if (cleanedElements.length === 0) {
    debugInfo.validationErrors.push('No valid Elementor elements after cleaning');
    return createEnhancedFallbackStructure(responseData, debugInfo);
  }

  console.log('✅ ELEMENTOR DATA VALIDATED:', {
    originalElements: elementorDataRaw.length,
    cleanedElements: cleanedElements.length,
    sourceField,
    complexElements: cleanedElements.filter(el => el.elements && el.elements.length > 0).length
  });

  debugInfo.dataSource = sourceField;
  return {
    success: true,
    data: cleanedElements,
    debugInfo
  };
};

/**
 * Create enhanced fallback structure when Elementor data is not available
 */
const createEnhancedFallbackStructure = (responseData: any, debugInfo: any): ExtractionResult => {
  console.log('🔄 CREATING ENHANCED FALLBACK STRUCTURE');
  
  const title = responseData.title?.rendered || responseData.title || 'Untitled Component';
  const content = responseData.content?.rendered || responseData.content || '';
  const excerpt = responseData.excerpt?.rendered || responseData.excerpt || '';
  const featuredImage = responseData.featured_media || responseData._links?.['wp:featuredmedia']?.[0]?.href;

  console.log('📝 Available content for fallback:', {
    hasTitle: !!title,
    hasContent: !!content,
    hasExcerpt: !!excerpt,
    hasFeaturedImage: !!featuredImage,
    contentLength: content.length
  });

  // Create a sophisticated container structure
  const containerElement: ElementorElement = {
    id: generateElementorId(),
    elType: 'container',
    isInner: false,
    isLocked: false,
    settings: {
      content_width: 'boxed',
      gap: { unit: 'px', size: 20, sizes: [] },
      background_background: 'classic',
      padding: { 
        unit: 'px', 
        top: 30, 
        right: 30, 
        bottom: 30, 
        left: 30, 
        isLinked: true 
      },
      border_radius: { 
        unit: 'px', 
        top: 8, 
        right: 8, 
        bottom: 8, 
        left: 8, 
        isLinked: true 
      },
      box_shadow: {
        horizontal: 0,
        vertical: 2,
        blur: 10,
        spread: 0,
        color: 'rgba(0,0,0,0.1)'
      }
    },
    elements: []
  };

  // Add title with enhanced styling
  if (title && title !== 'Untitled Component') {
    containerElement.elements!.push({
      id: generateElementorId(),
      elType: 'widget',
      isInner: false,
      isLocked: false,
      widgetType: 'heading',
      settings: {
        title: title,
        size: 'default',
        header_size: 'h2',
        color: '#2c3e50',
        typography_typography: 'custom',
        typography_font_weight: '600',
        typography_font_size: { unit: 'px', size: 28, sizes: [] },
        typography_line_height: { unit: 'em', size: 1.3, sizes: [] },
        _margin: { 
          unit: 'px', 
          top: 0, 
          right: 0, 
          bottom: 20, 
          left: 0, 
          isLinked: false 
        }
      },
      elements: []
    });
  }

  // Add featured image if available
  if (featuredImage) {
    containerElement.elements!.push({
      id: generateElementorId(),
      elType: 'widget',
      isInner: false,
      isLocked: false,
      widgetType: 'image',
      settings: {
        image: { url: featuredImage, id: '' },
        image_size: 'large',
        width: { unit: '%', size: 100, sizes: [] },
        border_radius: { 
          unit: 'px', 
          top: 5, 
          right: 5, 
          bottom: 5, 
          left: 5, 
          isLinked: true 
        },
        _margin: { 
          unit: 'px', 
          top: 0, 
          right: 0, 
          bottom: 25, 
          left: 0, 
          isLinked: false 
        }
      },
      elements: []
    });
  }

  // Process content with HTML structure preservation
  if (content) {
    // Clean but preserve some HTML structure
    const cleanContent = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/style\s*=\s*"[^"]*"/gi, '') // Remove inline styles
      .replace(/class\s*=\s*"[^"]*"/gi, ''); // Remove CSS classes
    
    // Check if content has meaningful HTML structure
    const hasStructure = /<(h[1-6]|p|div|ul|ol|li|blockquote|img|table|tr|td|th)\b[^>]*>/i.test(cleanContent);
    
    if (hasStructure) {
      console.log('📋 Content has HTML structure, preserving formatting');
      containerElement.elements!.push({
        id: generateElementorId(),
        elType: 'widget',
        isInner: false,
        isLocked: false,
        widgetType: 'html',
        settings: {
          html: cleanContent,
          _margin: { 
            unit: 'px', 
            top: 0, 
            right: 0, 
            bottom: 15, 
            left: 0, 
            isLinked: false 
          }
        },
        elements: []
      });
    } else {
      // Use text editor for plain content
      const textContent = cleanContent.replace(/<[^>]*>/g, '').trim();
      if (textContent) {
        containerElement.elements!.push({
          id: generateElementorId(),
          elType: 'widget',
          isInner: false,
          isLocked: false,
          widgetType: 'text-editor',
          settings: {
            editor: textContent,
            typography_typography: 'custom',
            typography_font_size: { unit: 'px', size: 16, sizes: [] },
            typography_line_height: { unit: 'em', size: 1.6, sizes: [] },
            text_color: '#555555',
            _margin: { 
              unit: 'px', 
              top: 0, 
              right: 0, 
              bottom: 15, 
              left: 0, 
              isLinked: false 
            }
          },
          elements: []
        });
      }
    }
  } else if (excerpt) {
    // Use excerpt as fallback
    const textContent = excerpt.replace(/<[^>]*>/g, '').trim();
    if (textContent) {
      containerElement.elements!.push({
        id: generateElementorId(),
        elType: 'widget',
        isInner: false,
        isLocked: false,
        widgetType: 'text-editor',
        settings: {
          editor: textContent,
          typography_typography: 'custom',
          typography_font_size: { unit: 'px', size: 16, sizes: [] },
          typography_line_height: { unit: 'em', size: 1.6, sizes: [] },
          text_color: '#666666',
          _margin: { 
            unit: 'px', 
            top: 0, 
            right: 0, 
            bottom: 0, 
            left: 0, 
            isLinked: true 
          }
        },
        elements: []
      });
    }
  }

  // Ensure we have at least one element
  if (containerElement.elements!.length === 0) {
    containerElement.elements!.push({
      id: generateElementorId(),
      elType: 'widget',
      isInner: false,
      isLocked: false,
      widgetType: 'text-editor',
      settings: {
        editor: '<p>Component content will be displayed here after proper configuration.</p>',
        typography_typography: 'custom',
        typography_font_style: 'italic',
        text_color: '#999999',
        text_align: 'center'
      },
      elements: []
    });
  }

  debugInfo.dataSource = 'enhanced-fallback';
  console.log('✅ Created enhanced fallback structure with preserved formatting:', {
    elementsCount: containerElement.elements!.length,
    hasTitle: containerElement.elements!.some(el => el.widgetType === 'heading'),
    hasImage: containerElement.elements!.some(el => el.widgetType === 'image'),
    hasContent: containerElement.elements!.some(el => el.widgetType === 'text-editor' || el.widgetType === 'html')
  });

  return {
    success: true,
    data: [containerElement],
    debugInfo
  };
};

/**
 * Validate and clean individual Elementor element with enhanced validation
 */
const validateAndCleanElement = (element: any): ElementorElement | null => {
  if (!element || typeof element !== 'object') {
    return null;
  }

  // Ensure required properties exist
  if (!element.elType) {
    return null;
  }

  const cleanedElement: ElementorElement = {
    id: element.id || generateElementorId(),
    elType: element.elType,
    isInner: Boolean(element.isInner),
    isLocked: Boolean(element.isLocked),
    settings: element.settings || {},
    elements: []
  };

  // Enhanced validation for Elementor elements
  // Ensure widgets have widgetType
  if (element.elType === 'widget') {
    if (!element.widgetType) {
      // Try to infer widget type from settings or default to text-editor
      if (element.settings?.title) {
        cleanedElement.widgetType = 'heading';
      } else if (element.settings?.editor || element.settings?.content) {
        cleanedElement.widgetType = 'text-editor';
      } else if (element.settings?.image) {
        cleanedElement.widgetType = 'image';
      } else {
        cleanedElement.widgetType = 'text-editor';
      }
    } else {
      cleanedElement.widgetType = element.widgetType;
    }
  }

  // Ensure containers have proper structure
  if (element.elType === 'container') {
    if (!cleanedElement.settings.content_width) {
      cleanedElement.settings.content_width = 'boxed';
    }
    if (!cleanedElement.settings.gap) {
      cleanedElement.settings.gap = { unit: 'px', size: 20, sizes: [] };
    }
  }

  // Ensure sections have proper structure
  if (element.elType === 'section') {
    if (!cleanedElement.settings.structure) {
      cleanedElement.settings.structure = '10';
    }
    if (!cleanedElement.settings.gap) {
      cleanedElement.settings.gap = 'default';
    }
  }

  // Ensure columns have proper size
  if (element.elType === 'column') {
    if (!cleanedElement.settings._column_size && !cleanedElement.settings.width) {
      cleanedElement.settings._column_size = 100;
    }
  }

  // Add optional properties with validation
  if (element.widgetType && element.elType === 'widget') {
    cleanedElement.widgetType = element.widgetType;
  }

  if (element.defaultEditSettings && typeof element.defaultEditSettings === 'object') {
    cleanedElement.defaultEditSettings = element.defaultEditSettings;
  }

  if (element.editSettings && typeof element.editSettings === 'object') {
    cleanedElement.editSettings = element.editSettings;
  }

  if (element.htmlCache && typeof element.htmlCache === 'string') {
    cleanedElement.htmlCache = element.htmlCache;
  }

  // Recursively clean child elements with improved validation
  if (element.elements && Array.isArray(element.elements)) {
    cleanedElement.elements = element.elements
      .map(validateAndCleanElement)
      .filter(Boolean) as ElementorElement[];
  }

  // Additional structure validation
  if (cleanedElement.elType === 'section' && cleanedElement.elements.length === 0) {
    // Sections should have at least one column
    cleanedElement.elements.push({
      id: generateElementorId(),
      elType: 'column',
      isInner: true,
      isLocked: false,
      settings: { _column_size: 100 },
      elements: []
    });
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
