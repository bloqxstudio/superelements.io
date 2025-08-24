import { toast } from '@/hooks/use-toast';

interface WordPressConfig {
  baseUrl: string;
  postType: string;
  jsonField: string;
  previewField: string;
  username: string;
  applicationPassword: string;
}

interface WordPressComponent {
  id: number;
  title: { rendered: string };
  link: string;
  [key: string]: any;
}

interface WordPressPostType {
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

interface WordPressTaxonomy {
  name: string;
  slug: string;
  rest_base: string;
  hierarchical: boolean;
  labels?: {
    name?: string;
    singular_name?: string;
  };
}

interface WordPressTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
  count: number;
  parent?: number;
}

interface CategoryInfo {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface FetchProgress {
  loaded: number;
  total?: number;
  currentPage: number;
  totalPages: number;
  status: 'loading' | 'retrying' | 'rate-limited' | 'completed' | 'cancelled' | 'error';
  message?: string;
}

interface ComponentsMetadata {
  totalComponents: number;
  totalPages: number;
  perPage: number;
  taxonomies: WordPressTaxonomy[];
  termsByTaxonomy: Record<string, WordPressTerm[]>;
}

interface CompleteMetadata {
  totalComponents: number;
  totalPages: number;
  perPage: number;
  taxonomies: WordPressTaxonomy[];
  termsByTaxonomy: Record<string, WordPressTerm[]>;
  categories: CategoryInfo[];
  componentsByCategory: Record<number, number>;
  hasElementorData: number;
  totalWithoutElementorData: number;
}

interface PageFetchResult {
  components: WordPressComponent[];
  page: number;
  totalPages: number;
  totalComponents: number;
}

interface MultiPostTypeResult {
  allComponents: WordPressComponent[];
  totalComponents: number;
  postTypeStats: Record<string, { count: number; limited: boolean }>;
}

interface FilterParams {
  categories?: string;
  terms?: string;
}

// Sleep utility function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry utility with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error('All retry attempts failed');
};

export class WordPressApiService {
  private static abortController: AbortController | null = null;

  static cancelCurrentFetch() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  static async fetchCompleteMetadata(
    config: WordPressConfig,
    onProgress?: (progress: FetchProgress) => void
  ): Promise<CompleteMetadata> {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    onProgress?.({
      loaded: 0,
      currentPage: 1,
      totalPages: 3,
      status: 'loading',
      message: 'Fetching complete metadata...'
    });

    try {
      // Step 1: Get basic metadata from first page
      onProgress?.({
        loaded: 1,
        currentPage: 1,
        totalPages: 3,
        status: 'loading',
        message: 'Fetching post metadata...'
      });

      const apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?per_page=100&page=1`;
      const response = await retryWithBackoff(() => 
        fetch(apiUrl, { method: 'GET', headers })
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }

      const totalComponents = parseInt(response.headers.get('X-WP-Total') || '0', 10);
      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
      const perPage = 100;

      // Step 2: Fetch all categories with real counts from WordPress
      onProgress?.({
        loaded: 2,
        currentPage: 2,
        totalPages: 3,
        status: 'loading',
        message: 'Fetching categories...'
      });

      const categories = await this.fetchCategories(config);

      // Step 3: Fetch taxonomies
      onProgress?.({
        loaded: 3,
        currentPage: 3,
        totalPages: 3,
        status: 'loading',
        message: 'Fetching taxonomies...'
      });

      let taxonomies: WordPressTaxonomy[] = [];
      let termsByTaxonomy: Record<string, WordPressTerm[]> = {};

      try {
        taxonomies = await this.fetchTaxonomies(config);
        const termsPromises = taxonomies.map(async (taxonomy) => {
          try {
            const terms = await this.fetchTerms(config, taxonomy.rest_base);
            return { taxonomy: taxonomy.slug, terms };
          } catch (error) {
            console.warn(`Failed to fetch terms for ${taxonomy.slug}:`, error);
            return { taxonomy: taxonomy.slug, terms: [] };
          }
        });

        const termsResults = await Promise.all(termsPromises);
        termsByTaxonomy = termsResults.reduce((acc, { taxonomy, terms }) => {
          acc[taxonomy] = terms;
          return acc;
        }, {} as Record<string, WordPressTerm[]>);
      } catch (error) {
        console.warn('Failed to fetch taxonomies:', error);
      }

      // Use real category counts from WordPress, not extrapolated data
      const componentsByCategory: Record<number, number> = {};
      categories.forEach(category => {
        componentsByCategory[category.id] = category.count;
      });

      onProgress?.({
        loaded: 3,
        currentPage: 3,
        totalPages: 3,
        status: 'completed',
        message: 'Complete metadata loaded successfully'
      });

      return {
        totalComponents,
        totalPages,
        perPage,
        taxonomies,
        termsByTaxonomy,
        categories,
        componentsByCategory,
        hasElementorData: 0, // Will be calculated as pages load
        totalWithoutElementorData: 0 // Will be calculated as pages load
      };

    } catch (error) {
      onProgress?.({
        loaded: 0,
        currentPage: 1,
        totalPages: 3,
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch complete metadata'
      });
      throw error;
    }
  }

  static async fetchCategories(config: WordPressConfig): Promise<CategoryInfo[]> {
    if (!config.baseUrl) {
      throw new Error('Please provide Base URL');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    
    console.log('Fetching ALL categories from WordPress...');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    try {
      let allCategories: CategoryInfo[] = [];
      let page = 1;
      let totalPages = 1;
      
      // Fetch first page to get total pages
      const firstPageUrl = `${baseUrl}/wp-json/wp/v2/categories?per_page=100&page=1`;
      console.log('Fetching first page of categories from:', firstPageUrl);
      
      const firstResponse = await retryWithBackoff(() => 
        fetch(firstPageUrl, { method: 'GET', headers })
      );

      if (!firstResponse.ok) {
        if (firstResponse.status === 404) {
          console.warn('Categories endpoint not found, returning empty array');
          return [];
        }
        throw new Error(`Failed to fetch categories: ${firstResponse.statusText}`);
      }

      // Get total pages from headers
      const totalPagesHeader = firstResponse.headers.get('X-WP-TotalPages');
      const totalCategoriesHeader = firstResponse.headers.get('X-WP-Total');
      
      if (totalPagesHeader) {
        totalPages = parseInt(totalPagesHeader, 10);
      }
      
      const totalCategories = totalCategoriesHeader ? parseInt(totalCategoriesHeader, 10) : 0;
      
      console.log(`Found ${totalCategories} total categories across ${totalPages} pages`);

      // Process first page
      const firstPageData = await firstResponse.json();
      if (Array.isArray(firstPageData)) {
        const firstPageCategories = firstPageData.map((category: any) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          count: category.count || 0
        }));
        allCategories.push(...firstPageCategories);
        console.log(`Processed page 1: ${firstPageCategories.length} categories`);
      }

      // Fetch remaining pages if any
      if (totalPages > 1) {
        const remainingPages = [];
        for (let p = 2; p <= totalPages; p++) {
          remainingPages.push(p);
        }

        // Fetch remaining pages in parallel (but limit concurrent requests)
        const batchSize = 3; // Max 3 concurrent requests
        for (let i = 0; i < remainingPages.length; i += batchSize) {
          const batch = remainingPages.slice(i, i + batchSize);
          const batchPromises = batch.map(async (pageNum) => {
            const pageUrl = `${baseUrl}/wp-json/wp/v2/categories?per_page=100&page=${pageNum}`;
            console.log(`Fetching page ${pageNum} of categories...`);
            
            try {
              const response = await retryWithBackoff(() => 
                fetch(pageUrl, { method: 'GET', headers })
              );
              
              if (!response.ok) {
                console.warn(`Failed to fetch page ${pageNum}: ${response.statusText}`);
                return [];
              }
              
              const data = await response.json();
              if (!Array.isArray(data)) {
                console.warn(`Invalid response format for page ${pageNum}`);
                return [];
              }
              
              const pageCategories = data.map((category: any) => ({
                id: category.id,
                name: category.name,
                slug: category.slug,
                count: category.count || 0
              }));
              
              console.log(`Processed page ${pageNum}: ${pageCategories.length} categories`);
              return pageCategories;
            } catch (error) {
              console.warn(`Error fetching page ${pageNum}:`, error);
              return [];
            }
          });

          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);
          batchResults.forEach(pageCategories => {
            allCategories.push(...pageCategories);
          });
          
          // Small delay between batches to avoid overwhelming the server
          if (i + batchSize < remainingPages.length) {
            await sleep(300);
          }
        }
      }

      console.log(`Successfully fetched ALL ${allCategories.length} categories (expected: ${totalCategories})`);
      
      // Sort categories by name for consistent display
      allCategories.sort((a, b) => a.name.localeCompare(b.name));
      
      return allCategories;
    } catch (error) {
      console.warn('Failed to fetch categories:', error);
      return [];
    }
  }

  static async fetchPostTypes(config: { 
    baseUrl: string; 
    username: string; 
    applicationPassword: string 
  }): Promise<WordPressPostType[]> {
    if (!config.baseUrl) {
      throw new Error('Please provide Base URL');
    }

    if (!config.username || !config.applicationPassword) {
      throw new Error('Please provide both username and application password');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/wp-json/wp/v2/types`;
    
    console.log('Testing connection to:', apiUrl);
    
    const credentials = btoa(`${config.username}:${config.applicationPassword}`);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`
    };
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error occurred';
      
      if (response.status === 401) {
        errorMessage = 'Authentication failed. Please check your username and application password.';
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden. You may not have permission to access this content.';
      } else if (response.status === 404) {
        errorMessage = 'Post types endpoint not found. Please check your base URL.';
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Include all post types that are exposed in REST API
    const allPostTypes = Object.entries(data)
      .filter(([slug, postType]: [string, any]) => {
        return postType.show_in_rest === true;
      })
      .map(([slug, postType]: [string, any]) => ({
        name: postType.name,
        slug: slug,
        description: postType.description || '',
        hierarchical: postType.hierarchical || false,
        rest_base: postType.rest_base || slug,
        labels: postType.labels || {}
      }))
      .sort((a, b) => {
        const builtInTypes = ['post', 'page', 'attachment'];
        const aIsBuiltIn = builtInTypes.includes(a.slug);
        const bIsBuiltIn = builtInTypes.includes(b.slug);
        
        if (aIsBuiltIn && !bIsBuiltIn) return -1;
        if (!aIsBuiltIn && bIsBuiltIn) return 1;
        return a.name.localeCompare(b.name);
      });

    return allPostTypes;
  }

  static async fetchMultiplePostTypes(
    config: WordPressConfig,
    postTypes: string[],
    limitPerPostType: number = Number.MAX_SAFE_INTEGER,
    onProgress?: (progress: FetchProgress & { postType?: string }) => void
  ): Promise<MultiPostTypeResult> {
    if (!config.baseUrl || postTypes.length === 0) {
      throw new Error('Please provide Base URL and at least one post type');
    }

    // Create new abort controller for this fetch
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const allComponents: WordPressComponent[] = [];
    const postTypeStats: Record<string, { count: number; limited: boolean }> = {};
    let totalProcessed = 0;
    let totalEstimated = 0;

    try {
      // First, get metadata for all post types to calculate total
      const metadataPromises = postTypes.map(async (postType) => {
        try {
          const metadata = await this.fetchComponentsMetadata({ ...config, postType });
          return { postType, metadata };
        } catch (error) {
          console.warn(`Failed to get metadata for ${postType}:`, error);
          return { postType, metadata: null };
        }
      });

      const metadataResults = await Promise.all(metadataPromises);
      totalEstimated = metadataResults.reduce((sum, result) => {
        if (result.metadata) {
          const actualCount = limitPerPostType === Number.MAX_SAFE_INTEGER 
            ? result.metadata.totalComponents 
            : Math.min(result.metadata.totalComponents, limitPerPostType);
          return sum + actualCount;
        }
        return sum;
      }, 0);

      for (let i = 0; i < postTypes.length; i++) {
        const postType = postTypes[i];
        
        // Check if cancelled
        if (signal.aborted) {
          throw new Error('Fetch cancelled by user');
        }

        onProgress?.({
          loaded: totalProcessed,
          total: totalEstimated,
          currentPage: i + 1,
          totalPages: postTypes.length,
          status: 'loading',
          message: `Loading ${postType}...`,
          postType
        });

        try {
          // Use unlimited loading if limitPerPostType is max safe integer
          const components = limitPerPostType === Number.MAX_SAFE_INTEGER
            ? await this.fetchAllComponentsFromPostType(
                { ...config, postType },
                (progress) => {
                  onProgress?.({
                    ...progress,
                    loaded: totalProcessed + progress.loaded,
                    total: totalEstimated,
                    postType,
                    message: `Loading ${postType}: ${progress.message || ''}`
                  });
                }
              )
            : await this.fetchLimitedComponents(
                { ...config, postType },
                limitPerPostType,
                (progress) => {
                  onProgress?.({
                    ...progress,
                    loaded: totalProcessed + progress.loaded,
                    total: totalEstimated,
                    postType,
                    message: `Loading ${postType}: ${progress.message || ''}`
                  });
                }
              );

          // Add source post type to each component
          const taggedComponents = components.map(component => ({
            ...component,
            _source_post_type: postType
          }));

          allComponents.push(...taggedComponents);
          
          const metadata = metadataResults.find(r => r.postType === postType)?.metadata;
          const wasLimited = limitPerPostType !== Number.MAX_SAFE_INTEGER && 
                           metadata && 
                           components.length < metadata.totalComponents;

          postTypeStats[postType] = {
            count: components.length,
            limited: wasLimited
          };

          totalProcessed += components.length;

          console.log(`Fetched ${components.length} components from ${postType}`);

        } catch (error) {
          console.warn(`Failed to fetch components from ${postType}:`, error);
          postTypeStats[postType] = {
            count: 0,
            limited: false
          };
        }

        // Small delay between post types
        if (i < postTypes.length - 1) {
          await sleep(500);
        }
      }

      onProgress?.({
        loaded: totalProcessed,
        total: totalEstimated,
        currentPage: postTypes.length,
        totalPages: postTypes.length,
        status: 'completed',
        message: `Loaded ${totalProcessed} components from ${postTypes.length} post types`
      });

      return {
        allComponents,
        totalComponents: totalProcessed,
        postTypeStats
      };

    } catch (error) {
      console.error('Failed to fetch from multiple post types:', error);
      
      onProgress?.({
        loaded: totalProcessed,
        total: totalEstimated,
        currentPage: 0,
        totalPages: postTypes.length,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      throw error;
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  static async fetchLimitedComponents(
    config: WordPressConfig,
    limit: number = 1000,
    onProgress?: (progress: FetchProgress) => void
  ): Promise<WordPressComponent[]> {
    const perPage = 100;
    const maxPages = Math.ceil(limit / perPage);
    const components: WordPressComponent[] = [];
    
    for (let page = 1; page <= maxPages && components.length < limit; page++) {
      try {
        const result = await this.fetchComponentsPage(config, page, onProgress);
        
        // Add components up to the limit
        const remainingSlots = limit - components.length;
        const componentsToAdd = result.components.slice(0, remainingSlots);
        components.push(...componentsToAdd);
        
        // If we got fewer components than requested, we've reached the end
        if (result.components.length < perPage) {
          break;
        }
        
      } catch (error) {
        console.warn(`Failed to fetch page ${page} for ${config.postType}:`, error);
        break; // Stop trying more pages for this post type
      }
    }
    
    return components;
  }

  static async fetchTaxonomies(config: WordPressConfig): Promise<WordPressTaxonomy[]> {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/wp-json/wp/v2/taxonomies`;
    
    console.log('Fetching taxonomies from:', apiUrl);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch taxonomies: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Filter taxonomies that are associated with the current post type
    const relevantTaxonomies = Object.entries(data)
      .filter(([slug, taxonomy]: [string, any]) => {
        return taxonomy.object_type && taxonomy.object_type.includes(config.postType);
      })
      .map(([slug, taxonomy]: [string, any]) => ({
        name: taxonomy.name,
        slug: slug,
        rest_base: taxonomy.rest_base || slug,
        hierarchical: taxonomy.hierarchical || false,
        labels: taxonomy.labels || {}
      }));

    return relevantTaxonomies;
  }

  static async fetchTerms(config: WordPressConfig, taxonomy: string): Promise<WordPressTerm[]> {
    if (!config.baseUrl || !taxonomy) {
      throw new Error('Please provide both Base URL and Taxonomy');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/wp-json/wp/v2/${taxonomy}?per_page=100`;
    
    console.log('Fetching terms from:', apiUrl);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      // Don't throw error for 404 - taxonomy might not exist
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch terms: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((term: any) => ({
      id: term.id,
      name: term.name,
      slug: term.slug,
      taxonomy: taxonomy,
      count: term.count || 0,
      parent: term.parent || undefined
    }));
  }

  static async fetchComponentsMetadata(config: WordPressConfig): Promise<ComponentsMetadata> {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Fetch first page to get metadata
    const apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?per_page=100&page=1`;
    
    console.log('Fetching components metadata from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error occurred';
      
      if (response.status === 401) {
        errorMessage = 'Authentication failed. Please check your username and application password.';
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden. You may not have permission to access this content.';
      } else if (response.status === 404) {
        errorMessage = `Endpoint not found. The post type "${config.postType}" may not exist or may not be exposed via REST API.`;
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    // Get metadata from headers
    const totalComponents = parseInt(response.headers.get('X-WP-Total') || '0', 10);
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
    const perPage = 100; // We're using 100 per page

    // Fetch taxonomies in parallel
    let taxonomies: WordPressTaxonomy[] = [];
    let termsByTaxonomy: Record<string, WordPressTerm[]> = {};

    try {
      taxonomies = await this.fetchTaxonomies(config);

      // Fetch terms for each taxonomy
      const termsPromises = taxonomies.map(async (taxonomy) => {
        try {
          const terms = await this.fetchTerms(config, taxonomy.rest_base);
          return { taxonomy: taxonomy.slug, terms };
        } catch (error) {
          console.warn(`Failed to fetch terms for ${taxonomy.slug}:`, error);
          return { taxonomy: taxonomy.slug, terms: [] };
        }
      });

      const termsResults = await Promise.all(termsPromises);
      termsByTaxonomy = termsResults.reduce((acc, { taxonomy, terms }) => {
        acc[taxonomy] = terms;
        return acc;
      }, {} as Record<string, WordPressTerm[]>);
    } catch (error) {
      console.warn('Failed to fetch taxonomies:', error);
      // Continue without taxonomies
    }

    return {
      totalComponents,
      totalPages,
      perPage,
      taxonomies,
      termsByTaxonomy
    };
  }

  static async fetchComponentsPage(
    config: WordPressConfig,
    page: number,
    onProgress?: (progress: FetchProgress) => void,
    categoryFilter?: number
  ): Promise<PageFetchResult> {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    // Create abort controller for this fetch if needed
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    const signal = this.abortController.signal;

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Build API URL with category filter if provided and include ALL fields needed for Elementor
    let apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?per_page=100&page=${page}&_fields=id,title,content,meta,acf,link,categories`;
    
    if (categoryFilter) {
      apiUrl += `&categories=${categoryFilter}`;
      console.log(`Fetching components page ${page} filtered by category ${categoryFilter}`);
    }
    
    console.log(`Fetching components page ${page} from:`, apiUrl);
    
    onProgress?.({
      loaded: 0,
      currentPage: page,
      totalPages: 1,
      status: 'loading',
      message: `Loading page ${page}${categoryFilter ? ` (category ${categoryFilter})` : ''}...`
    });

    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000;

    while (retryCount <= maxRetries) {
      try {
        // Check if cancelled
        if (signal.aborted) {
          throw new Error('Fetch cancelled by user');
        }

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          signal
        });

        // Handle rate limiting and server errors
        if (response.status === 429 || response.status >= 500) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(baseDelay * Math.pow(2, retryCount), 10000);
          
          console.log(`Server returned ${response.status}, waiting ${delay}ms before retry...`);
          
          onProgress?.({
            loaded: 0,
            currentPage: page,
            totalPages: 1,
            status: 'rate-limited',
            message: `Rate limited, waiting ${Math.round(delay/1000)}s before retry...`
          });

          await sleep(delay);
          retryCount++;
          continue;
        }

        if (!response.ok) {
          let errorMessage = 'Unknown error occurred';
          
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please check your username and application password.';
          } else if (response.status === 403) {
            errorMessage = 'Access forbidden. You may not have permission to access this content.';
          } else if (response.status === 404) {
            errorMessage = `Endpoint not found. The post type "${config.postType}" may not exist or may not be exposed via REST API.`;
          } else {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format - expected an array');
        }

        // Get metadata from headers
        const totalComponents = parseInt(response.headers.get('X-WP-Total') || '0', 10);
        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

        // Handle empty category results (not an error, just no components)
        if (data.length === 0 && categoryFilter) {
          console.log(`Category ${categoryFilter} has no components on page ${page}`);
          
          onProgress?.({
            loaded: 0,
            currentPage: page,
            totalPages: Math.max(totalPages, 1),
            status: 'completed',
            message: `Category ${categoryFilter} has no components`
          });

          return {
            components: [],
            page,
            totalPages: Math.max(totalPages, 1),
            totalComponents: 0
          };
        }

        onProgress?.({
          loaded: data.length,
          currentPage: page,
          totalPages,
          status: 'completed',
          message: `Loaded page ${page} with ${data.length} components${categoryFilter ? ` (category ${categoryFilter})` : ''}`
        });

        console.log(`Successfully fetched page ${page}: ${data.length} components${categoryFilter ? ` filtered by category ${categoryFilter}` : ''}`);

        return {
          components: data,
          page,
          totalPages,
          totalComponents
        };

      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Fetch cancelled by user');
        }

        console.error(`Error fetching page ${page}:`, fetchError);
        retryCount++;
        
        if (retryCount > maxRetries) {
          // For category filters, provide more specific error handling
          if (categoryFilter) {
            throw new Error(`Category ${categoryFilter} could not be loaded: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
          }
          throw fetchError;
        }
        
        const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 10000);
        console.log(`Retrying page ${page} in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
        
        onProgress?.({
          loaded: 0,
          currentPage: page,
          totalPages: 1,
          status: 'retrying',
          message: `Error on page ${page}, retrying in ${Math.round(delay/1000)}s...`
        });

        await sleep(delay);
      }
    }

    throw new Error(`Failed to fetch page ${page} after ${maxRetries} retries`);
  }

  static async fetchAllComponentsFromPostType(
    config: WordPressConfig,
    onProgress?: (progress: FetchProgress) => void
  ): Promise<WordPressComponent[]> {
    return this.fetchAllComponents(config, onProgress);
  }

  static async fetchAllComponents(
    config: WordPressConfig, 
    onProgress?: (progress: FetchProgress) => void,
    filterParams?: FilterParams
  ): Promise<WordPressComponent[]> {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    // Create new abort controller for this fetch
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    let allComponents: WordPressComponent[] = [];
    let page = 1;
    let totalPages = 1;
    
    console.log('Starting to fetch all components with enhanced error handling...');
    if (filterParams) {
      console.log('Applying filters:', filterParams);
    }

    try {
      while (page <= totalPages) {
        // Check if cancelled
        if (signal.aborted) {
          console.log('Fetch cancelled by user');
          onProgress?.({
            loaded: allComponents.length,
            currentPage: page,
            totalPages,
            status: 'cancelled',
            message: 'Fetch cancelled by user'
          });
          throw new Error('Fetch cancelled by user');
        }

        // Build API URL with filters
        let apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?per_page=100&page=${page}`;
        
        if (filterParams?.categories) {
          apiUrl += `&categories=${filterParams.categories}`;
        }
        if (filterParams?.terms) {
          apiUrl += `&tags=${filterParams.terms}`;
        }
        
        console.log(`Fetching page ${page} from:`, apiUrl);
        
        onProgress?.({
          loaded: allComponents.length,
          currentPage: page,
          totalPages,
          status: 'loading',
          message: `Loading page ${page}${filterParams ? ' (filtered)' : ''}`
        });

        try {
          const response = await retryWithBackoff(() => 
            fetch(apiUrl, { method: 'GET', headers, signal })
          );

          if (!response.ok) {
            let errorMessage = 'Unknown error occurred';
            
            if (response.status === 401) {
              errorMessage = 'Authentication failed. Please check your username and application password.';
            } else if (response.status === 403) {
              errorMessage = 'Access forbidden. You may not have permission to access this content.';
            } else if (response.status === 404) {
              errorMessage = `Endpoint not found. The post type "${config.postType}" may not exist or may not be exposed via REST API.`;
            } else {
              errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            
            throw new Error(errorMessage);
          }

          // Get total pages from response headers
          const totalPagesHeader = response.headers.get('X-WP-TotalPages');
          if (totalPagesHeader && page === 1) {
            totalPages = parseInt(totalPagesHeader, 10);
            console.log(`Total pages to fetch: ${totalPages}`);
          }

          const data = await response.json();
          
          if (!Array.isArray(data)) {
            throw new Error('Invalid response format - expected an array');
          }

          allComponents = [...allComponents, ...data];
          
          // Call progress callback
          const totalExpected = totalPagesHeader ? parseInt(response.headers.get('X-WP-Total') || '0', 10) : undefined;
          onProgress?.({
            loaded: allComponents.length,
            total: totalExpected,
            currentPage: page,
            totalPages,
            status: 'loading',
            message: `Loaded page ${page} of ${totalPages}${filterParams ? ' (filtered)' : ''}`
          });

          console.log(`Fetched page ${page}/${totalPages}, total components so far: ${allComponents.length}`);
          
          // Move to next page
          page++;
          
          // Add delay between requests to avoid overwhelming the server
          if (page <= totalPages) {
            const delay = Math.min(500 + (Math.random() * 500), 1000);
            console.log(`Waiting ${Math.round(delay)}ms before next request...`);
            await sleep(delay);
          }

        } catch (fetchError) {
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.log('Fetch aborted');
            throw new Error('Fetch cancelled by user');
          }
          throw fetchError;
        }
      }

      console.log(`Successfully fetched all components. Total: ${allComponents.length}`);
      
      onProgress?.({
        loaded: allComponents.length,
        currentPage: totalPages,
        totalPages,
        status: 'completed',
        message: `Successfully loaded ${allComponents.length} components${filterParams ? ' (filtered)' : ''}`
      });

      return allComponents;

    } catch (error) {
      console.error('Failed to fetch all components:', error);
      
      onProgress?.({
        loaded: allComponents.length,
        currentPage: page,
        totalPages,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      throw error;
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  static async fetchComponents(config: WordPressConfig): Promise<WordPressComponent[]> {
    if (!config.baseUrl || !config.postType) {
      throw new Error('Please provide both Base URL and Post Type');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?per_page=100&_fields=id,title,content,meta,acf,link,categories`;
    
    console.log('Fetching components with Elementor data from:', apiUrl);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.username && config.applicationPassword) {
      const credentials = btoa(`${config.username}:${config.applicationPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error occurred';
      
      if (response.status === 401) {
        errorMessage = 'Authentication failed. Please check your username and application password.';
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden. You may not have permission to access this content.';
      } else if (response.status === 404) {
        errorMessage = `Endpoint not found. The post type "${config.postType}" may not exist or may not be exposed via REST API.`;
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format - expected an array');
    }

    return data;
  }
}
