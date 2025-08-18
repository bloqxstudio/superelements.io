
export interface ComponentDebugInfo {
  componentId: number | string;
  title: string;
  hasElementorData: boolean;
  elementorDataLocations: string[];
  allFields: string[];
  metaStructure: any;
  potentialElementorFields: string[];
  dataPreview: Record<string, any>;
}

export const debugComponentStructure = (component: any): ComponentDebugInfo => {
  console.log('🔍 DEEP COMPONENT DEBUG STARTED');
  console.log('📦 Raw component structure:', {
    keys: Object.keys(component || {}),
    id: component?.id,
    title: component?.title?.rendered
  });
  
  const debugInfo: ComponentDebugInfo = {
    componentId: component?.id || 'unknown',
    title: component?.title?.rendered || 'No title',
    hasElementorData: false,
    elementorDataLocations: [],
    allFields: [],
    metaStructure: null,
    potentialElementorFields: [],
    dataPreview: {}
  };
  
  if (component) {
    debugInfo.allFields = Object.keys(component);
    console.log('📋 All component fields:', debugInfo.allFields);
  }
  
  const searchForElementorData = (obj: any, path: string = ''): void => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      
      if (key.toLowerCase().includes('elementor')) {
        console.log(`🎯 Found potential Elementor field: ${currentPath}`);
        debugInfo.potentialElementorFields.push(currentPath);
        debugInfo.dataPreview[currentPath] = value;
        
        if (isElementorDataLike(value)) {
          debugInfo.hasElementorData = true;
          debugInfo.elementorDataLocations.push(currentPath);
          console.log(`✅ Confirmed Elementor data at: ${currentPath}`);
        }
      }
      
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              searchForElementorData(item, `${currentPath}[${index}]`);
            }
          });
        } else {
          searchForElementorData(value, currentPath);
        }
      }
    });
  };
  
  searchForElementorData(component);
  
  if (component?.meta) {
    debugInfo.metaStructure = component.meta;
    console.log('📊 Meta structure found:', debugInfo.metaStructure);
    
    if (Array.isArray(component.meta)) {
      console.log('📋 Meta is array with length:', component.meta.length);
      component.meta.forEach((metaItem, index) => {
        console.log(`📋 Meta[${index}]:`, metaItem);
        searchForElementorData(metaItem, `meta[${index}]`);
      });
    }
  }
  
  console.log('🔍 DEBUG SUMMARY:', {
    hasElementorData: debugInfo.hasElementorData,
    elementorLocations: debugInfo.elementorDataLocations,
    potentialFields: debugInfo.potentialElementorFields.length,
    totalFields: debugInfo.allFields.length
  });
  
  return debugInfo;
};

const isElementorDataLike = (data: any): boolean => {
  if (!data) return false;
  
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return false;
    }
  }
  
  if (Array.isArray(parsed)) {
    return parsed.some(item => 
      item && typeof item === 'object' && 
      (item.elType || item.widgetType || item.id || item.settings)
    );
  }
  
  if (typeof parsed === 'object') {
    return !!(parsed.elType || parsed.widgetType || parsed.id || parsed.settings);
  }
  
  return false;
};

export const extractAllElementorData = (component: any): { data: any; source: string }[] => {
  console.log('🔍 EXTRACTING ALL ELEMENTOR DATA');
  const results: { data: any; source: string }[] = [];
  
  const searchAndExtract = (obj: any, path: string = ''): void => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      
      // Enhanced search - look for any field that might contain Elementor data
      const isElementorField = key.toLowerCase().includes('elementor') || 
                               key === '_elementor_data' ||
                               key === 'elementor_data' ||
                               key === 'pagebuilder_data';
      
      if (isElementorField && isElementorDataLike(value)) {
        console.log(`🎯 Found Elementor data at: ${currentPath}`);
        
        let parsed = value;
        if (typeof value === 'string') {
          try {
            parsed = JSON.parse(value);
          } catch (e) {
            console.warn(`⚠️ Failed to parse JSON at ${currentPath}:`, e);
            return;
          }
        }
        
        results.push({
          data: Array.isArray(parsed) ? parsed : [parsed],
          source: currentPath
        });
      }
      
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              searchAndExtract(item, `${currentPath}[${index}]`);
            }
          });
        } else {
          searchAndExtract(value, currentPath);
        }
      }
    });
  };
  
  searchAndExtract(component);
  
  console.log(`📊 Extraction complete: found ${results.length} Elementor data sources`);
  results.forEach((result, index) => {
    console.log(`📦 Source ${index + 1}: ${result.source} (${result.data.length} elements)`);
  });
  
  return results;
};

export const createSmartFallback = (component: any): any[] => {
  console.log('🔄 CREATING SMART FALLBACK STRUCTURE');
  console.log('📦 Component for fallback:', {
    hasTitle: !!component?.title?.rendered,
    hasContent: !!component?.content?.rendered,
    hasExcerpt: !!component?.excerpt?.rendered
  });
  
  const elements: any[] = [];
  
  if (component?.title?.rendered) {
    const titleElement = {
      id: generateId(),
      elType: 'widget',
      widgetType: 'heading',
      isInner: false,
      isLocked: false,
      settings: {
        title: component.title.rendered,
        size: 'h2',
        align: 'left'
      },
      elements: []
    };
    elements.push(titleElement);
    console.log('✅ Added title element');
  }
  
  if (component?.content?.rendered) {
    const contentElement = {
      id: generateId(),
      elType: 'widget',
      widgetType: 'text-editor',
      isInner: false,
      isLocked: false,
      settings: {
        editor: component.content.rendered
      },
      elements: []
    };
    elements.push(contentElement);
    console.log('✅ Added content element');
  }
  
  if (component?.excerpt?.rendered && component.excerpt.rendered !== component?.content?.rendered) {
    const excerptElement = {
      id: generateId(),
      elType: 'widget',
      widgetType: 'text-editor',
      isInner: false,
      isLocked: false,
      settings: {
        editor: component.excerpt.rendered
      },
      elements: []
    };
    elements.push(excerptElement);
    console.log('✅ Added excerpt element');
  }
  
  // If no content was found, create a basic text element
  if (elements.length === 0) {
    const basicElement = {
      id: generateId(),
      elType: 'widget',
      widgetType: 'text-editor',
      isInner: false,
      isLocked: false,
      settings: {
        editor: `<p>WordPress Component: ${component?.title?.rendered || 'Untitled'}</p>`
      },
      elements: []
    };
    elements.push(basicElement);
    console.log('✅ Added basic fallback element');
  }
  
  console.log(`🔄 Smart fallback created: ${elements.length} elements`);
  return elements;
};

const generateId = (): string => {
  return Math.random().toString(36).substr(2, 7);
};
