import { WordPressComponent } from '@/store/wordpressStore';

export interface ComponentValidationResult {
  validComponents: WordPressComponent[];
  invalidComponents: WordPressComponent[];
  validationStats: {
    total: number;
    valid: number;
    invalid: number;
    missingId: number;
    missingTitle: number;
    missingCategories: number;
    validWithCategories: number;
  };
  categoryStats: Record<number, number>;
}

export const validateAndFilterComponents = (
  components: WordPressComponent[],
  selectedCategories: number[] = []
): ComponentValidationResult => {
  console.log('=== ENHANCED COMPONENT VALIDATION START ===');
  console.log('Validation input:', {
    totalComponents: components.length,
    selectedCategories: selectedCategories.length,
    filteringEnabled: selectedCategories.length > 0,
    sampleComponent: components[0] ? {
      id: components[0].id,
      title: components[0].title?.rendered,
      categories: components[0].categories
    } : null
  });

  const validComponents: WordPressComponent[] = [];
  const invalidComponents: WordPressComponent[] = [];
  const categoryStats: Record<number, number> = {};
  
  let missingId = 0;
  let missingTitle = 0;
  let missingCategories = 0;
  let validWithCategories = 0;

  components.forEach((component, index) => {
    // More lenient validation - only require ID
    const hasValidId = component && (typeof component.id === 'number' || typeof component.id === 'string') && component.id;
    
    // Fix the type narrowing issue by using the helper function
    const hasTitle = getComponentTitle(component) !== 'No title';
    
    const hasCategories = component && Array.isArray(component.categories);

    if (!hasValidId) {
      console.log(`Component ${index} missing valid ID:`, component);
      missingId++;
    }
    if (!hasTitle) {
      console.log(`Component ${index} missing title:`, component?.title);
      missingTitle++;
    }
    if (!hasCategories) {
      console.log(`Component ${index} missing categories:`, component?.categories);
      missingCategories++;
    }

    // Component is valid if it has at least an ID (more lenient)
    const isValidComponent = hasValidId;

    if (!isValidComponent) {
      console.log('Invalid component filtered out:', {
        componentId: component?.id,
        hasValidId,
        componentTitle: component?.title
      });
      invalidComponents.push(component);
      return;
    }

    // Count categories for valid components
    if (hasCategories && component.categories) {
      validWithCategories++;
      component.categories.forEach(categoryId => {
        categoryStats[categoryId] = (categoryStats[categoryId] || 0) + 1;
      });
    }

    // Apply category filtering if categories are selected
    if (selectedCategories.length > 0) {
      if (!hasCategories || !component.categories || component.categories.length === 0) {
        console.log('Component filtered out (no categories for filtering):', {
          componentId: component.id,
          componentTitle: getComponentTitle(component),
          hasCategories,
          categoriesArray: component.categories,
          selectedCategoriesCount: selectedCategories.length
        });
        return; // Filter out components without categories when filtering is active
      }

      // Check if component has ANY of the selected categories (OR logic)
      const hasMatchingCategory = selectedCategories.some(selectedCategoryId => 
        component.categories!.includes(selectedCategoryId)
      );

      if (!hasMatchingCategory) {
        console.log('Component filtered out (no matching categories):', {
          componentId: component.id,
          componentTitle: getComponentTitle(component),
          componentCategories: component.categories,
          selectedCategories
        });
        return; // Filter out components that don't match any selected category
      }
    }

    // Component passed all validations and filters
    console.log('Component included:', {
      componentId: component.id,
      componentTitle: getComponentTitle(component),
      componentCategories: component.categories,
      passedCategoryFilter: selectedCategories.length === 0 || (hasCategories && component.categories?.some(cat => selectedCategories.includes(cat)))
    });
    validComponents.push(component);
  });

  const validationStats = {
    total: components.length,
    valid: validComponents.length,
    invalid: invalidComponents.length,
    missingId,
    missingTitle,
    missingCategories,
    validWithCategories
  };

  console.log('Enhanced component validation completed:', {
    ...validationStats,
    categoryStats,
    selectedCategories,
    validComponentsSample: validComponents.slice(0, 3).map(c => ({
      id: c.id,
      title: c.title,
      categories: c.categories
    }))
  });
  console.log('=== ENHANCED COMPONENT VALIDATION END ===');

  return {
    validComponents,
    invalidComponents,
    validationStats,
    categoryStats
  };
};

// Helper function to safely get component title
const getComponentTitle = (component: WordPressComponent): string => {
  if (!component || !component.title) {
    return 'No title';
  }
  
  if (typeof component.title === 'string') {
    return component.title;
  }
  
  if (component.title && typeof component.title === 'object' && 'rendered' in component.title) {
    return typeof component.title.rendered === 'string' ? component.title.rendered : 'No title';
  }
  
  return 'No title';
};

export const shouldShowNoComponentsMessage = (
  validationResult: ComponentValidationResult,
  selectedCategories: number[],
  isConnected: boolean,
  isReady: boolean
): { shouldShow: boolean; reason: string; suggestion: string } => {
  console.log('=== NO COMPONENTS MESSAGE CHECK START ===');
  
  const { validationStats } = validationResult;
  
  console.log('Checking if should show no components message:', {
    totalComponents: validationStats.total,
    validComponents: validationStats.valid,
    invalidComponents: validationStats.invalid,
    selectedCategoriesCount: selectedCategories.length,
    isConnected,
    isReady
  });
  
  if (!isConnected) {
    console.log('Not showing empty state: not connected');
    return {
      shouldShow: false,
      reason: 'Not connected',
      suggestion: 'Establish connection first'
    };
  }

  if (!isReady) {
    console.log('Not showing empty state: not ready');
    return {
      shouldShow: false,
      reason: 'Not ready',
      suggestion: 'Wait for initialization'
    };
  }

  if (validationStats.total === 0) {
    console.log('Showing empty state: no components loaded');
    return {
      shouldShow: true,
      reason: 'No components loaded',
      suggestion: 'Check connection and try reloading'
    };
  }

  if (validationStats.valid === 0 && validationStats.invalid > 0) {
    console.log('Showing empty state: all components invalid');
    return {
      shouldShow: true,
      reason: 'All components are invalid',
      suggestion: 'Check component data structure'
    };
  }

  if (selectedCategories.length > 0 && validationStats.valid === 0) {
    console.log('Showing empty state: no matches for selected categories');
    return {
      shouldShow: true,
      reason: 'No components match selected categories',
      suggestion: 'Try different categories or clear filters'
    };
  }

  console.log('Not showing empty state: components available');
  console.log('=== NO COMPONENTS MESSAGE CHECK END ===');
  
  return {
    shouldShow: false,
    reason: 'Components available',
    suggestion: ''
  };
};
