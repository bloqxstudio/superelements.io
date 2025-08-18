
import { WordPressComponent } from '@/store/wordpressStore';

interface ComponentRetrievalOptions {
  isFastLoading: boolean;
  selectedCategories: number[];
  getAllLoadedComponents: () => WordPressComponent[];
  getPaginatedComponents: () => WordPressComponent[];
}

export const getDisplayComponents = ({
  isFastLoading,
  selectedCategories,
  getAllLoadedComponents,
  getPaginatedComponents
}: ComponentRetrievalOptions): WordPressComponent[] => {
  console.log('=== GETTING DISPLAY COMPONENTS ===');
  console.log('Retrieval options:', {
    isFastLoading,
    selectedCategoriesCount: selectedCategories.length,
    selectedCategories
  });

  let baseComponents: WordPressComponent[] = [];
  
  try {
    // Get components from appropriate source
    if (isFastLoading) {
      baseComponents = getPaginatedComponents();
      if (baseComponents.length === 0) {
        baseComponents = getAllLoadedComponents();
      }
    } else {
      baseComponents = getAllLoadedComponents();
    }
    
    console.log('Base components retrieved:', {
      count: baseComponents.length,
      method: isFastLoading ? 'fast-loading' : 'standard',
      sampleTitles: baseComponents.slice(0, 3).map(c => c.title?.rendered || 'No title')
    });
    
    // Filter out invalid components
    const validComponents = baseComponents.filter(component => {
      const isValid = (
        component && 
        component.id && 
        component.title && 
        (component.title.rendered || component.title)
      );
      
      if (!isValid) {
        console.warn('Invalid component filtered out:', {
          id: component?.id,
          hasTitle: !!component?.title,
          title: component?.title
        });
      }
      
      return isValid;
    });
    
    // Apply category filtering if categories are selected
    let filteredComponents = validComponents;
    if (selectedCategories.length > 0) {
      filteredComponents = validComponents.filter(component => {
        const componentCategories = component.categories || [];
        const hasMatchingCategory = componentCategories.some(catId => 
          selectedCategories.includes(catId)
        );
        
        if (!hasMatchingCategory) {
          console.log('Component filtered by category:', {
            componentId: component.id,
            componentTitle: component.title?.rendered || component.title,
            componentCategories,
            selectedCategories
          });
        }
        
        return hasMatchingCategory;
      });
      
      console.log('Category filtering applied:', {
        originalCount: validComponents.length,
        filteredCount: filteredComponents.length,
        selectedCategories
      });
    }
    
    console.log('Final components after all filtering:', {
      validCount: validComponents.length,
      finalCount: filteredComponents.length,
      filteredOut: baseComponents.length - filteredComponents.length
    });
    
    return filteredComponents;
    
  } catch (error) {
    console.error('Error getting display components:', error);
    return [];
  }
};

export const hasActiveFilters = (selectedCategories: number[]): boolean => {
  const result = selectedCategories.length > 0;
  console.log('Checking active filters:', {
    selectedCategoriesCount: selectedCategories.length,
    selectedCategories,
    hasActiveFilters: result
  });
  return result;
};

export const shouldShowEmptyState = (
  displayComponents: WordPressComponent[],
  isFastLoading: boolean,
  isReady: boolean,
  isConnected: boolean,
  selectedCategories: number[] = []
): boolean => {
  const hasActiveFilters = selectedCategories.length > 0;
  
  const result = (
    isConnected && 
    isReady && 
    displayComponents.length === 0
  );
  
  console.log('Should show empty state check:', {
    displayComponentsCount: displayComponents.length,
    isFastLoading,
    isReady,
    isConnected,
    hasActiveFilters,
    selectedCategoriesCount: selectedCategories.length,
    shouldShow: result
  });
  
  return result;
};

// New utility to help debug component loading
export const debugComponentLoading = (
  components: WordPressComponent[],
  selectedCategories: number[]
) => {
  console.log('=== COMPONENT LOADING DEBUG ===');
  console.log('Components summary:', {
    total: components.length,
    withCategories: components.filter(c => c.categories && c.categories.length > 0).length,
    withoutCategories: components.filter(c => !c.categories || c.categories.length === 0).length,
    selectedCategoriesCount: selectedCategories.length
  });
  
  // Show category distribution
  const categoryDistribution: Record<number, number> = {};
  components.forEach(component => {
    if (component.categories) {
      component.categories.forEach(catId => {
        categoryDistribution[catId] = (categoryDistribution[catId] || 0) + 1;
      });
    }
  });
  
  console.log('Category distribution:', categoryDistribution);
  console.log('Selected categories:', selectedCategories);
  
  if (selectedCategories.length > 0) {
    const matchingComponents = components.filter(component => 
      component.categories && 
      component.categories.some(catId => selectedCategories.includes(catId))
    );
    console.log('Components matching selected categories:', matchingComponents.length);
  }
};
