import { WordPressComponent } from '@/store/wordpressStore';
import { debugComponentStructure, extractAllElementorData } from './componentDebugger';

export interface ComponentValidationResult {
  isValid: boolean;
  hasElementorData: boolean;
  hasValidJson: boolean;
  errors: string[];
  warnings: string[];
  debugInfo?: {
    dataLocations: string[];
    elementCount: number;
    hasRealData: boolean;
    allPossibleSources: string[];
    componentFields: string[];
  };
}

export interface ValidationStats {
  total: number;
  valid: number;
  invalid: number;
  missingElementorData: number;
  malformedJson: number;
  emptyComponents: number;
}

// Cache for validation results to avoid re-validating the same components
const validationCache = new Map<number, ComponentValidationResult>();
const statsCache = new Map<string, ValidationStats>();

/**
 * Validates if a string contains valid JSON
 */
const isValidJson = (jsonString: string): boolean => {
  if (!jsonString || typeof jsonString !== 'string') return false;
  
  try {
    const parsed = JSON.parse(jsonString);
    return parsed !== null && typeof parsed !== 'undefined';
  } catch {
    return false;
  }
};

/**
 * More flexible Elementor data validation
 */
const isValidElementorData = (data: any): boolean => {
  if (!data) return false;
  
  // If it's a string, try to parse it first
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return false;
    }
  }
  
  // Check if it's an array of elements or a single element
  if (Array.isArray(data)) {
    return data.length > 0 && data.some(item => 
      item && 
      typeof item === 'object' && 
      // Very lenient validation - accept any object with potential Elementor properties
      (item.elType || item.widgetType || item.id || item.settings || item.elements || 
       typeof item.content === 'string' || item.title)
    );
  }
  
  // Check if it's a single element - very lenient validation
  if (typeof data === 'object') {
    return !!(data.elType || data.widgetType || data.id || data.settings || 
              data.elements || typeof data.content === 'string' || data.title);
  }
  
  return false;
};

/**
 * Enhanced component validation with comprehensive debugging
 */
export const validateComponent = (component: WordPressComponent): ComponentValidationResult => {
  // Check cache first
  if (validationCache.has(component.id)) {
    return validationCache.get(component.id)!;
  }
  
  console.log('🔍 VALIDATING COMPONENT:', component.title?.rendered || component.id);
  
  // Deep debug the component structure
  const debugInfo = debugComponentStructure(component);
  
  const result: ComponentValidationResult = {
    isValid: false,
    hasElementorData: false,
    hasValidJson: false,
    errors: [],
    warnings: [],
    debugInfo: {
      dataLocations: debugInfo.elementorDataLocations,
      elementCount: 0,
      hasRealData: debugInfo.hasElementorData,
      allPossibleSources: debugInfo.potentialElementorFields,
      componentFields: debugInfo.allFields
    }
  };
  
  // Basic component structure validation
  if (!component) {
    result.errors.push('Component is null or undefined');
    validationCache.set(component.id, result);
    return result;
  }
  
  if (!component.id) {
    result.errors.push('Component missing ID');
  }
  
  if (!component.title || !component.title.rendered) {
    result.warnings.push('Component missing title');
  }
  
  // Use the comprehensive Elementor data extraction
  const allElementorData = extractAllElementorData(component);
  
  console.log('📊 All found Elementor data sources:', allElementorData);
  
  if (allElementorData.length > 0) {
    result.hasElementorData = true;
    result.hasValidJson = true;
    result.debugInfo!.hasRealData = true;
    result.debugInfo!.dataLocations = allElementorData.map(item => item.source);
    
    // Count total elements
    const totalElements = allElementorData.reduce((sum, item) => sum + item.data.length, 0);
    result.debugInfo!.elementCount = totalElements;
    
    console.log(`✅ Found ${allElementorData.length} Elementor data sources with ${totalElements} total elements`);
  } else {
    console.log('⚠️ No Elementor data found in any location');
    result.warnings.push('No Elementor data found - will use fallback structure');
  }
  
  // Much more lenient validation - component is valid if it has basic structure
  result.isValid = (
    component.id && 
    component.title && 
    component.title.rendered && 
    result.errors.length === 0
  );
  
  console.log('🎯 VALIDATION RESULT:', {
    isValid: result.isValid,
    hasElementorData: result.hasElementorData,
    elementorSources: result.debugInfo?.dataLocations,
    allFields: result.debugInfo?.componentFields,
    errors: result.errors,
    warnings: result.warnings
  });
  
  // Cache the result
  validationCache.set(component.id, result);
  
  return result;
};

/**
 * Filters out invalid components from an array
 */
export const filterValidComponents = (components: WordPressComponent[]): WordPressComponent[] => {
  console.log(`Validating ${components.length} components...`);
  
  const validComponents = components.filter(component => {
    const validation = validateComponent(component);
    
    if (!validation.isValid) {
      console.warn(`Invalid component filtered out: ${component.title?.rendered || component.id}`, {
        errors: validation.errors,
        warnings: validation.warnings
      });
      return false;
    }
    
    return true;
  });
  
  console.log(`Filtered ${components.length - validComponents.length} invalid components. ${validComponents.length} valid components remaining.`);
  
  return validComponents;
};

/**
 * Generates validation statistics for a set of components
 */
export const generateValidationStats = (components: WordPressComponent[]): ValidationStats => {
  const cacheKey = components.map(c => c.id).sort().join(',');
  
  if (statsCache.has(cacheKey)) {
    return statsCache.get(cacheKey)!;
  }
  
  const stats: ValidationStats = {
    total: components.length,
    valid: 0,
    invalid: 0,
    missingElementorData: 0,
    malformedJson: 0,
    emptyComponents: 0
  };
  
  components.forEach(component => {
    const validation = validateComponent(component);
    
    if (validation.isValid) {
      stats.valid++;
    } else {
      stats.invalid++;
    }
    
    if (!validation.hasElementorData) {
      stats.missingElementorData++;
    }
    
    if (!validation.hasValidJson && validation.hasElementorData) {
      stats.malformedJson++;
    }
    
    if (!component.title?.rendered) {
      stats.emptyComponents++;
    }
  });
  
  statsCache.set(cacheKey, stats);
  return stats;
};

/**
 * Clears validation cache (useful when components are updated)
 */
export const clearValidationCache = (): void => {
  validationCache.clear();
  statsCache.clear();
  console.log('Component validation cache cleared');
};

/**
 * Gets validation cache statistics
 */
export const getValidationCacheStats = () => {
  return {
    validationCacheSize: validationCache.size,
    statsCacheSize: statsCache.size
  };
};
