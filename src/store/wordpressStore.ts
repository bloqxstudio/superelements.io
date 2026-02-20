import { create } from 'zustand';

export interface WordPressComponent {
  id: number;
  date: string;
  date_gmt: string;
  guid: {
    rendered: string;
  };
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  comment_status: string;
  ping_status: string;
  sticky: boolean;
  template: string;
  format: string;
  meta: any[];
  categories: number[];
  tags: any[];
  _links: any;
  _elementor_data?: string | any;
  elementor_data?: string | any;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WordPressPostType {
  name: string;
  slug: string;
  description: string;
  hierarchical: boolean;
  rest_base: string;
  labels?: {
    name?: string;
    singular_name?: string;
  };
}

export interface WordPressConfig {
  baseUrl: string;
  postType: string;
  jsonField: string;
  previewField: string;
  username: string; // Make required to match API expectations
  applicationPassword: string; // Make required to match API expectations
}

interface CompleteMetadata {
  categories: Category[];
  componentsByCategory: { [categoryId: number]: WordPressComponent[] };
  hasElementorData: number;
  totalWithoutElementorData: number;
}

interface WordPressStore {
  components: WordPressComponent[];
  config: WordPressConfig;
  selectedCategories: number[];
  availableCategories: Category[];
  completeMetadata: CompleteMetadata | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  loadedPages: Map<number, WordPressComponent[]>;
  fastLoadingPage: number;
  isFastLoading: boolean;
  
  // Initialize missing properties
  postTypes: WordPressPostType[];
  totalComponents: number;
  totalPages: number;
  perPage: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  selectedTerms: number[];
  isLazyLoading: boolean;
  currentInfiniteScrollPage: number;
  loadingProgress: number;
  isLoadingPostTypes: boolean;
  taxonomies: any[];
  termsByTaxonomy: Record<string, any[]>;
  
  setConfig: (config: WordPressConfig) => void;
  setComponents: (components: WordPressComponent[]) => void;
  setSelectedCategories: (categories: number[]) => void;
  setAvailableCategories: (categories: Category[]) => void;
  setCompleteMetadata: (metadata: CompleteMetadata) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsConnected: (isConnected: boolean) => void;
  setError: (error: string | null) => void;
  setLoadedPage: (page: number, components: WordPressComponent[]) => void;
  clearLoadedPages: () => void;
  isPageLoaded: (page: number) => boolean;
  getPageComponents: (page: number) => WordPressComponent[];
  setFastLoadingPage: (page: number) => void;
  setIsFastLoading: (isFastLoading: boolean) => void;
  getAllLoadedComponents: () => WordPressComponent[];
  getPaginatedComponents: () => WordPressComponent[];
  resetConnection: () => void;
  
  // Missing setters that other files expect
  setPostTypes: (postTypes: WordPressPostType[]) => void;
  setTotalComponents: (total: number) => void;
  setTotalPages: (pages: number) => void;
  setPerPage: (perPage: number) => void;
  setHasNextPage: (hasNext: boolean) => void;
  setIsFetchingNextPage: (isFetching: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  setIsLoadingPostTypes: (loading: boolean) => void;
  setTaxonomies: (taxonomies: any[]) => void;
  setTermsByTaxonomy: (terms: Record<string, any[]>) => void;
  setCurrentInfiniteScrollPage: (page: number) => void;
  extractCategoriesFromPosts: (components: WordPressComponent[]) => void;
  getRequiredPages: () => number[];
  updateCategoryCountsFromLoadedComponents: () => void;
  clearComponentCache: () => void;
}

const useWordPressStore = create<WordPressStore>()((set, get) => ({
  components: [],
  config: {
    baseUrl: '',
    postType: 'posts',
    jsonField: '_elementor_data',
    previewField: 'link',
    username: '',
    applicationPassword: ''
  },
  selectedCategories: [],
  availableCategories: [],
  completeMetadata: null,
  isLoading: false,
  isConnected: false,
  error: null,
  loadedPages: new Map(),
  fastLoadingPage: 0,
  isFastLoading: false,
  
  // Initialize missing properties
  postTypes: [],
  totalComponents: 0,
  totalPages: 0,
  perPage: 100,
  hasNextPage: false,
  isFetchingNextPage: false,
  selectedTerms: [],
  isLazyLoading: false,
  currentInfiniteScrollPage: 1,
  loadingProgress: 0,
  isLoadingPostTypes: false,
  taxonomies: [],
  termsByTaxonomy: {},

  // Enhanced setSelectedCategories with automatic reinitialization
  setSelectedCategories: (categories: number[]) => {
    console.log('=== SETTING SELECTED CATEGORIES ===');
    console.log('New categories:', categories);
    console.log('Previous categories:', get().selectedCategories);
    
    const hasChanged = JSON.stringify(categories) !== JSON.stringify(get().selectedCategories);
    
    set({ selectedCategories: categories });
    
    if (hasChanged) {
      console.log('Categories changed, clearing cache for reinitialization');
      // Clear cache to force reload with new categories
      set({
        loadedPages: new Map(),
        fastLoadingPage: 0,
        isFastLoading: false
      });
    }
  },

  // Enhanced setComponents with automatic category extraction
  setComponents: (components: WordPressComponent[]) => {
    console.log('=== SETTING COMPONENTS ===');
    console.log('Components count:', components.length);
    
    // Extract categories from components automatically
    const categorySet = new Set<number>();
    components.forEach(component => {
      if (component.categories && Array.isArray(component.categories)) {
        component.categories.forEach(catId => categorySet.add(catId));
      }
    });
    
    const extractedCategoryIds = Array.from(categorySet);
    console.log('Auto-extracted category IDs:', extractedCategoryIds);
    
    set({ 
      components,
      totalComponents: components.length,
      // Update available categories if we found any
      ...(extractedCategoryIds.length > 0 && {
        availableCategories: get().availableCategories.length === 0 
          ? extractedCategoryIds.map(id => ({ id, name: `Category ${id}`, slug: `cat-${id}`, count: 0 }))
          : get().availableCategories
      })
    });
  },
  
  setConfig: (config: WordPressConfig) => {
    set({ config });
  },
  setAvailableCategories: (categories: Category[]) => {
    set({ availableCategories: categories });
  },
  setCompleteMetadata: (metadata: CompleteMetadata) => {
    set({ completeMetadata: metadata });
  },
  setIsLoading: (isLoading: boolean) => {
    set({ isLoading });
  },
  setIsConnected: (isConnected: boolean) => {
    set({ isConnected });
  },
  setError: (error: string | null) => {
    set({ error });
  },
  setLoadedPage: (page: number, components: WordPressComponent[]) => {
    set((state) => {
      const MAX_CACHED_PAGES = 8;
      const updated = new Map(state.loadedPages).set(page, components);
      if (updated.size > MAX_CACHED_PAGES) {
        const oldestKey = updated.keys().next().value;
        updated.delete(oldestKey);
      }
      return { loadedPages: updated };
    });
  },
  clearLoadedPages: () => {
    set({ loadedPages: new Map() });
  },
  isPageLoaded: (page: number) => {
    return get().loadedPages.has(page);
  },
  getPageComponents: (page: number) => {
    return get().loadedPages.get(page) || [];
  },
  setFastLoadingPage: (page: number) => {
    set({ fastLoadingPage: page });
  },
  setIsFastLoading: (isFastLoading: boolean) => {
    set({ isFastLoading });
  },

  // Missing setters implementation
  setPostTypes: (postTypes: WordPressPostType[]) => {
    set({ postTypes });
  },
  setTotalComponents: (total: number) => {
    set({ totalComponents: total });
  },
  setTotalPages: (pages: number) => {
    set({ totalPages: pages });
  },
  setPerPage: (perPage: number) => {
    set({ perPage });
  },
  setHasNextPage: (hasNext: boolean) => {
    set({ hasNextPage: hasNext });
  },
  setIsFetchingNextPage: (isFetching: boolean) => {
    set({ isFetchingNextPage: isFetching });
  },
  setLoadingProgress: (progress: number) => {
    set({ loadingProgress: progress });
  },
  setIsLoadingPostTypes: (loading: boolean) => {
    set({ isLoadingPostTypes: loading });
  },
  setTaxonomies: (taxonomies: any[]) => {
    set({ taxonomies });
  },
  setTermsByTaxonomy: (terms: Record<string, any[]>) => {
    set({ termsByTaxonomy: terms });
  },
  setCurrentInfiniteScrollPage: (page: number) => {
    set({ currentInfiniteScrollPage: page });
  },
  
  extractCategoriesFromPosts: (components: WordPressComponent[]) => {
    const categoryMap = new Map<number, Category>();
    
    components.forEach(component => {
      if (component.categories && Array.isArray(component.categories)) {
        component.categories.forEach(catId => {
          if (!categoryMap.has(catId)) {
            categoryMap.set(catId, {
              id: catId,
              name: `Category ${catId}`,
              slug: `cat-${catId}`,
              count: 1
            });
          } else {
            const existing = categoryMap.get(catId)!;
            existing.count += 1;
          }
        });
      }
    });
    
    const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
    set({ availableCategories: categories });
  },
  
  getRequiredPages: () => {
    const state = get();
    // Simple implementation - return first few pages
    return [1, 2, 3].filter(page => page <= state.totalPages);
  },
  
  updateCategoryCountsFromLoadedComponents: () => {
    const state = get();
    get().extractCategoriesFromPosts(state.components);
  },
  
  clearComponentCache: () => {
    set({
      components: [],
      loadedPages: new Map(),
      fastLoadingPage: 0,
      isFastLoading: false,
      totalComponents: 0
    });
  },

  // Enhanced getAllLoadedComponents with better filtering
  getAllLoadedComponents: () => {
    const state = get();
    console.log('Getting all loaded components:', {
      componentsCount: state.components.length,
      selectedCategoriesCount: state.selectedCategories.length
    });
    
    let filteredComponents = state.components;
    
    // Apply category filtering if categories are selected
    if (state.selectedCategories.length > 0) {
      filteredComponents = state.components.filter(component => {
        if (!component.categories || !Array.isArray(component.categories)) {
          return false;
        }
        return component.categories.some(catId => 
          state.selectedCategories.includes(catId)
        );
      });
      
      console.log('Category filtering applied:', {
        originalCount: state.components.length,
        filteredCount: filteredComponents.length,
        selectedCategories: state.selectedCategories
      });
    }
    
    return filteredComponents;
  },

  // Enhanced getPaginatedComponents with better filtering
  getPaginatedComponents: () => {
    const state = get();
    const componentsPerPage = 100; // Increased from default
    const startIndex = (state.fastLoadingPage - 1) * componentsPerPage;
    const endIndex = startIndex + componentsPerPage;

    console.log('Getting paginated components:', {
      page: state.fastLoadingPage,
      startIndex,
      endIndex,
      totalComponents: state.components.length,
      selectedCategoriesCount: state.selectedCategories.length
    });

    let filteredComponents = state.components;
    
    // Apply category filtering if categories are selected
    if (state.selectedCategories.length > 0) {
      filteredComponents = state.components.filter(component => {
        if (!component.categories || !Array.isArray(component.categories)) {
          return false;
        }
        return component.categories.some(catId => 
          state.selectedCategories.includes(catId)
        );
      });
    }

    const paginatedComponents = filteredComponents.slice(startIndex, endIndex);
    
    console.log('Paginated result:', {
      filteredCount: filteredComponents.length,
      paginatedCount: paginatedComponents.length,
      page: state.fastLoadingPage
    });

    return paginatedComponents;
  },

  resetConnection: () => {
    set({
      components: [],
      config: {
        baseUrl: '',
        postType: 'posts',
        jsonField: '_elementor_data',
        previewField: 'link',
        username: '',
        applicationPassword: ''
      },
      selectedCategories: [],
      availableCategories: [],
      completeMetadata: null,
      isLoading: false,
      isConnected: false,
      error: null,
      loadedPages: new Map(),
      fastLoadingPage: 0,
      isFastLoading: false,
      postTypes: [],
      totalComponents: 0,
      totalPages: 0,
      hasNextPage: false,
      isFetchingNextPage: false,
      loadingProgress: 0
    });
  },
}));

export { useWordPressStore };
