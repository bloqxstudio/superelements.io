
import { useCallback } from 'react';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';

export const useCategoryPersistence = () => {
  const { 
    selectedCategories, 
    clearAllFilters,
    activeConnectionId,
    selectCategory
  } = useMultiConnectionData();

  // Função de reload que preserva as categorias selecionadas
  const reloadWithCategoryPersistence = useCallback((reloadFn: () => void) => {
    // Save current categories
    const currentCategories = [...selectedCategories];
    const currentConnectionId = activeConnectionId;
    
    // Executa o reload
    reloadFn();
    
    // Reaplica as categorias após um pequeno delay para garantir que o reload terminou
    setTimeout(() => {
      if (currentCategories.length > 0 && currentConnectionId) {
        
        // Reaplica cada categoria usando selectCategory
        currentCategories.forEach(categoryId => {
          selectCategory(currentConnectionId, categoryId);
        });
      }
    }, 100);
  }, [selectedCategories, activeConnectionId, selectCategory]);

  // Função de clear que realmente limpa e recarrega
  const clearFiltersAndReload = useCallback((reloadFn: () => void) => {
    clearAllFilters();
    reloadFn();
  }, [clearAllFilters]);

  return {
    selectedCategories,
    reloadWithCategoryPersistence,
    clearFiltersAndReload,
    hasActiveFilters: selectedCategories.length > 0
  };
};
