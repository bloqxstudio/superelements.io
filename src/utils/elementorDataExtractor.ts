import { extractAllElementorData, createSmartFallback } from './componentDebugger';

// Enhanced Elementor data extraction with multiple fallback strategies
export interface ElementorDataResult {
  data: any[];
  source: string;
  isValid: boolean;
  hasRealElementorData: boolean;
  filteredElements: any[];
  debugInfo: {
    totalElements: number;
    filteredElements: number;
    sources: string[];
    hasPageStructure: boolean;
  };
}

export const extractElementorDataEnhanced = (component: any): ElementorDataResult => {
  console.log('🔍 Enhanced Elementor data extraction starting for:', component.title?.rendered);
  
  const debugInfo = {
    totalElements: 0,
    filteredElements: 0,
    sources: [] as string[],
    hasPageStructure: false
  };
  
  // Use the comprehensive extraction from debugger
  const allElementorData = extractAllElementorData(component);
  
  if (allElementorData.length > 0) {
    const bestSource = allElementorData[0];
    debugInfo.sources = allElementorData.map(item => item.source);
    debugInfo.totalElements = bestSource.data.length;
    debugInfo.hasPageStructure = true;
    
    // Filter component-specific elements
    const filteredElements = filterComponentElements(bestSource.data);
    debugInfo.filteredElements = filteredElements.length;
    
    console.log(`✅ Using Elementor data from ${bestSource.source} with ${filteredElements.length} filtered elements`);
    
    return {
      data: bestSource.data,
      source: bestSource.source,
      isValid: true,
      hasRealElementorData: true,
      filteredElements: filteredElements,
      debugInfo
    };
  }
  
  // Fallback to smart structure creation
  console.log('⚠️ No Elementor data found, creating smart fallback...');
  const fallbackElements = createSmartFallback(component);
  debugInfo.filteredElements = fallbackElements.length;
  
  return {
    data: fallbackElements,
    source: 'smart_fallback',
    isValid: fallbackElements.length > 0,
    hasRealElementorData: false,
    filteredElements: fallbackElements,
    debugInfo
  };
};

/**
 * Filters Elementor elements to extract only the component-specific parts
 * Removes page structure elements (headers, footers, navigation)
 */
const filterComponentElements = (elements: any[]): any[] => {
  console.log('🎯 Starting component filtering...');
  
  const filteredElements: any[] = [];
  
  elements.forEach((element, index) => {
    if (!element || typeof element !== 'object') {
      console.log(`⚠️ Skipping invalid element at index ${index}`);
      return;
    }
    
    // Skip common page structure elements
    if (shouldSkipElement(element)) {
      console.log(`⏭️ Skipping page structure element: ${element.elType}/${element.widgetType}`);
      return;
    }
    
    // Process and clean the element
    const processedElement = processElementForComponent(element);
    if (processedElement) {
      filteredElements.push(processedElement);
      console.log(`✅ Added component element: ${element.elType}/${element.widgetType || 'container'}`);
    }
  });
  
  console.log(`🎯 Component filtering complete: ${filteredElements.length} elements extracted`);
  return filteredElements;
};

/**
 * Determines if an element should be skipped (page structure elements)
 */
const shouldSkipElement = (element: any): boolean => {
  // Skip common page structure widgets
  const pageStructureWidgets = [
    'theme-site-logo',
    'theme-site-title',
    'nav-menu',
    'wp-widget-nav_menu',
    'header',
    'footer',
    'sidebar',
    'breadcrumb',
    'search-form',
    'wp-widget-search',
    'wp-widget-calendar',
    'wp-widget-tag_cloud',
    'wp-widget-categories'
  ];
  
  if (element.widgetType && pageStructureWidgets.includes(element.widgetType)) {
    return true;
  }
  
  // Skip elements with page structure classes/IDs
  if (element.settings) {
    const cssClass = element.settings.css_classes || element.settings._css_classes || '';
    const cssId = element.settings.css_id || element.settings._element_id || '';
    
    const pageStructureClasses = ['header', 'footer', 'nav', 'menu', 'sidebar', 'breadcrumb'];
    
    if (pageStructureClasses.some(cls => 
      cssClass.toLowerCase().includes(cls) || cssId.toLowerCase().includes(cls)
    )) {
      return true;
    }
  }
  
  return false;
};

/**
 * Processes an element to ensure it's component-ready
 */
const processElementForComponent = (element: any): any | null => {
  if (!element) return null;
  
  // Create a clean copy of the element
  const processedElement = {
    ...element,
    id: element.id || generateElementorId(),
    elType: element.elType || 'container',
    isInner: Boolean(element.isInner),
    isLocked: Boolean(element.isLocked),
    settings: element.settings || {}
  };
  
  // Process children recursively
  if (element.elements && Array.isArray(element.elements)) {
    const processedChildren = element.elements
      .map(processElementForComponent)
      .filter(Boolean);
    
    if (processedChildren.length > 0) {
      processedElement.elements = processedChildren;
    }
  }
  
  // Preserve widget-specific properties
  if (element.widgetType) {
    processedElement.widgetType = element.widgetType;
  }
  
  return processedElement;
};

/**
 * Generates a unique Elementor ID
 */
const generateElementorId = (): string => {
  return Math.random().toString(36).substr(2, 7);
};

const createFallbackElementorStructure = (component: any): any[] => {
  const elements: any[] = [];
  
  // Create a basic structure from component data
  if (component.title?.rendered) {
    elements.push({
      id: generateElementorId(),
      elType: 'widget',
      widgetType: 'heading',
      settings: {
        title: component.title.rendered,
        size: 'h2',
        align: 'left'
      },
      elements: []
    });
  }
  
  if (component.excerpt?.rendered) {
    elements.push({
      id: generateElementorId(),
      elType: 'widget',
      widgetType: 'text-editor',
      settings: {
        editor: component.excerpt.rendered.replace(/<[^>]*>/g, ''), // Strip HTML
        align: 'left'
      },
      elements: []
    });
  }
  
  // Add a container if we have multiple elements
  if (elements.length > 1) {
    return [{
      id: generateElementorId(),
      elType: 'container',
      settings: {
        content_width: 'boxed',
        gap: { size: 20, unit: 'px' }
      },
      elements: elements
    }];
  }
  
  return elements;
};
