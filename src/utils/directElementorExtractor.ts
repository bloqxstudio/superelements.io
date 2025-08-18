
/**
 * Direct Elementor Data Extractor - Simple and focused approach
 * Extracts _elementor_data directly from WordPress API and formats it correctly
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

/**
 * Fetch component's _elementor_data directly from WordPress API
 */
export const fetchElementorDataDirect = async (
  componentId: number,
  config: WordPressConfig
): Promise<ElementorElement[]> => {
  console.log('🎯 FETCHING ELEMENTOR DATA DIRECTLY:', {
    componentId,
    baseUrl: config.baseUrl,
    postType: config.postType
  });

  try {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    
    // Make direct API call with edit context to access meta fields
    const apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}/${componentId}?context=edit&_fields=meta`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authentication if provided
    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    console.log('📡 Direct API Request:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('📦 API Response:', {
      hasMeta: !!data.meta,
      hasElementorData: !!data.meta?._elementor_data,
      elementorDataSize: data.meta?._elementor_data?.length || 0
    });

    // Extract _elementor_data
    const elementorDataRaw = data.meta?._elementor_data;
    
    if (!elementorDataRaw) {
      throw new Error('No _elementor_data found in component meta');
    }

    // Parse the JSON data
    let elementorData;
    try {
      elementorData = JSON.parse(elementorDataRaw);
    } catch (parseError) {
      console.error('Failed to parse _elementor_data:', parseError);
      throw new Error('Invalid _elementor_data format - not valid JSON');
    }

    // Ensure it's an array
    if (!Array.isArray(elementorData)) {
      throw new Error('_elementor_data is not an array');
    }

    console.log('✅ ELEMENTOR DATA EXTRACTED:', {
      elementsCount: elementorData.length,
      firstElementType: elementorData[0]?.elType,
      hasWidgetTypes: elementorData.some(el => el.widgetType)
    });

    return elementorData;

  } catch (error) {
    console.error('💥 DIRECT EXTRACTION ERROR:', error);
    throw error;
  }
};

/**
 * Format elements into the exact Elementor clipboard format
 */
export const formatElementorClipboard = (
  elements: ElementorElement[],
  siteUrl: string
): ElementorClipboardFormat => {
  console.log('📋 FORMATTING CLIPBOARD DATA:', {
    elementsCount: elements.length,
    siteUrl
  });

  // Ensure each element has the required structure
  const formattedElements = elements.map(validateElementorElement).filter(Boolean) as ElementorElement[];

  const clipboardData: ElementorClipboardFormat = {
    type: "elementor",
    siteurl: siteUrl,
    elements: formattedElements
  };

  console.log('✅ CLIPBOARD FORMATTED:', {
    type: clipboardData.type,
    siteurl: clipboardData.siteurl,
    elementsCount: clipboardData.elements.length
  });

  return clipboardData;
};

/**
 * Validate and ensure element has all required Elementor properties
 */
const validateElementorElement = (element: any): ElementorElement | null => {
  if (!element || typeof element !== 'object') {
    console.warn('⚠️ Invalid element structure:', element);
    return null;
  }

  // Build the validated element with all required properties
  const validatedElement: ElementorElement = {
    id: element.id || generateElementorId(),
    elType: element.elType || 'container',
    isInner: Boolean(element.isInner),
    isLocked: Boolean(element.isLocked),
    settings: element.settings || {},
    elements: []
  };

  // Add optional properties if they exist
  if (element.widgetType) {
    validatedElement.widgetType = element.widgetType;
  }

  if (element.defaultEditSettings) {
    validatedElement.defaultEditSettings = element.defaultEditSettings;
  }

  if (element.editSettings) {
    validatedElement.editSettings = element.editSettings;
  }

  if (element.htmlCache) {
    validatedElement.htmlCache = element.htmlCache;
  }

  // Recursively validate child elements
  if (element.elements && Array.isArray(element.elements)) {
    validatedElement.elements = element.elements
      .map(validateElementorElement)
      .filter(Boolean) as ElementorElement[];
  }

  return validatedElement;
};

/**
 * Generate Elementor-compatible ID
 */
const generateElementorId = (): string => {
  return Math.random().toString(36).substr(2, 7);
};

/**
 * Main function to extract and format component for clipboard
 */
export const extractComponentForClipboard = async (
  componentId: number,
  config: WordPressConfig
): Promise<string> => {
  console.log('🚀 EXTRACT COMPONENT FOR CLIPBOARD:', componentId);

  try {
    // Step 1: Fetch Elementor data directly
    const elements = await fetchElementorDataDirect(componentId, config);

    if (elements.length === 0) {
      throw new Error('No Elementor elements found');
    }

    // Step 2: Format for clipboard
    const clipboardData = formatElementorClipboard(elements, config.baseUrl);

    // Step 3: Convert to JSON string
    const jsonString = JSON.stringify(clipboardData, null, 2);

    console.log('✅ COMPONENT READY FOR CLIPBOARD:', {
      elementsCount: clipboardData.elements.length,
      jsonSize: jsonString.length,
      preview: jsonString.substring(0, 200) + '...'
    });

    return jsonString;

  } catch (error) {
    console.error('💥 EXTRACT FOR CLIPBOARD ERROR:', error);
    throw error;
  }
};
