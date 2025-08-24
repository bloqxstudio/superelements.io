
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface WordPressComponent {
  id: number;
  title: { rendered: string };
  link: string;
  categories?: number[];
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

interface WordPressConfig {
  baseUrl: string;
  postType: string;
  jsonField: string;
  previewField: string;
  username: string;
  applicationPassword: string;
}

interface FetchComponentsOptions {
  page?: number;
  perPage?: number;
  categoryIds?: number[];
}

export const useWordPressApi = () => {
  const [components, setComponents] = useState<WordPressComponent[]>([]);
  const [postTypes, setPostTypes] = useState<WordPressPostType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPostTypes, setIsLoadingPostTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const clearPostTypes = () => {
    setPostTypes([]);
    setIsConnected(false);
    setError(null);
  };

  const resetConnection = () => {
    setComponents([]);
    setPostTypes([]);
    setIsConnected(false);
    setError(null);
  };

  const fetchPostTypes = async (config: { baseUrl: string; username: string; applicationPassword: string }) => {
    if (!config.baseUrl) {
      toast({
        title: "Configuration Error",
        description: "Please provide Base URL",
        variant: "destructive"
      });
      return;
    }

    if (!config.username || !config.applicationPassword) {
      toast({
        title: "Authentication Required",
        description: "Please provide both username and application password",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingPostTypes(true);
    setError(null);
    setIsConnected(false);
    
    try {
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

      setPostTypes(allPostTypes);
      setIsConnected(true);
      
      console.log('Connection successful! Found post types:', allPostTypes);
      
      return allPostTypes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsConnected(false);
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      console.error('Connection test failed:', error);
    } finally {
      setIsLoadingPostTypes(false);
    }
  };

  const fetchComponents = async (
    config: WordPressConfig, 
    options: FetchComponentsOptions = {}
  ) => {
    const { page = 1, perPage = 50, categoryIds } = options; // Reduced from 100 to 50
    
    console.log(`=== FETCH COMPONENTS API CALL ===`);
    console.log('Fetch request:', { page, perPage, postType: config.postType, categoryIds });

    if (!config.baseUrl || !config.postType) {
      const errorMsg = "Please provide both Base URL and Post Type";
      toast({
        title: "Configuration Error",
        description: errorMsg,
        variant: "destructive"
      });
      return { components: [], hasNextPage: false, totalComponents: 0 };
    }

    setIsLoading(true);
    setError(null);

    try {
      const baseUrl = config.baseUrl.replace(/\/$/, '');
      
      let apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?page=${page}&per_page=${perPage}&_fields=id,title,content,meta,acf,link,categories`;
      
      if (categoryIds && categoryIds.length > 0) {
        apiUrl += `&categories=${categoryIds.join(',')}`;
        console.log('Applying category filter:', categoryIds);
      }
      
      console.log('Fetching components from:', apiUrl);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (config.username && config.applicationPassword) {
        const credentials = btoa(`${config.username}:${config.applicationPassword}`);
        headers['Authorization'] = `Basic ${credentials}`;
        console.log('Using authentication with username:', config.username);
      } else {
        console.log('No authentication credentials provided, making public request');
      }
      
      // Enhanced retry logic with exponential backoff
      const maxRetries = 3;
      let retryCount = 0;
      const baseDelay = 1000;
      
      while (retryCount <= maxRetries) {
        try {
          // Increased timeout to 30 seconds
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorMessage = 'Unknown error occurred';
            
            if (response.status === 401) {
              errorMessage = 'Authentication failed. Please check your username and application password.';
            } else if (response.status === 403) {
              errorMessage = 'Access forbidden. You may not have permission to access this content.';
            } else if (response.status === 404) {
              errorMessage = `Endpoint not found. The post type "${config.postType}" may not exist or may not be exposed via REST API.`;
            } else if (response.status === 400) {
              console.log('Page not found - end of pages reached');
              return { components: [], hasNextPage: false, totalComponents: 0 };
            } else if (response.status === 0 || response.status >= 500) {
              errorMessage = `Server error (${response.status}). The WordPress site may be temporarily unavailable.`;
              
              // Retry on server errors
              if (retryCount < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), 10000);
                console.log(`Server error ${response.status}, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue;
              }
            } else {
              errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            
            throw new Error(errorMessage);
          }

          const data = await response.json();
          
          if (!Array.isArray(data)) {
            throw new Error('Invalid response format - expected an array');
          }

          const totalComponents = parseInt(response.headers.get('X-WP-Total') || '0');
          const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
          
          console.log('Response headers:', {
            'X-WP-Total': response.headers.get('X-WP-Total'),
            'X-WP-TotalPages': response.headers.get('X-WP-TotalPages'),
            currentPage: page,
            totalPages
          });

          const hasNextPage = page < totalPages && data.length === perPage;
          
          console.log('Page fetch result:', {
            page,
            componentsCount: data.length,
            hasNextPage,
            totalComponents,
            totalPages,
            filteredByCategory: !!categoryIds
          });

          if (page === 1) {
            setComponents(data);
          }
          
          const filterMessage = categoryIds ? ` (filtered by categories: ${categoryIds.join(', ')})` : '';
          const authMessage = config.username ? ' (authenticated)' : ' (public)';
          
          console.log(`✅ Fetched ${data.length} components from page ${page}${filterMessage}${authMessage}`);
          
          return { 
            components: data, 
            hasNextPage,
            totalComponents,
            totalPages,
            currentPage: page,
            perPage
          };
          
        } catch (fetchError) {
          if (fetchError.name === 'AbortError') {
            const timeoutMessage = 'Request timeout - the server took too long to respond (30s). This might indicate server overload.';
            
            if (retryCount < maxRetries) {
              const delay = Math.min(baseDelay * Math.pow(2, retryCount), 15000);
              console.log(`Request timeout, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
              
              toast({
                title: "Loading Timeout",
                description: `Connection timed out, retrying... (${retryCount + 1}/${maxRetries})`,
                duration: 3000
              });
              
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              continue;
            } else {
              throw new Error(timeoutMessage);
            }
          }
          
          // Check if it's a network error
          if (fetchError instanceof TypeError && fetchError.message === 'Failed to fetch') {
            const networkMessage = 'Network error - unable to connect to the WordPress site. Please check the URL and your internet connection.';
            
            if (retryCount < maxRetries) {
              const delay = Math.min(baseDelay * Math.pow(2, retryCount), 10000);
              console.log(`Network error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
              
              toast({
                title: "Network Error",
                description: `Connection failed, retrying... (${retryCount + 1}/${maxRetries})`,
                duration: 3000
              });
              
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              continue;
            } else {
              throw new Error(networkMessage);
            }
          }
          
          throw fetchError;
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Fetch Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      console.error('❌ Fetch error:', error);
      
      return { 
        components: [], 
        hasNextPage: false, 
        totalComponents: 0,
        totalPages: 0,
        currentPage: page,
        perPage
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    components,
    postTypes,
    isLoading,
    isLoadingPostTypes,
    isConnected,
    error,
    fetchComponents,
    fetchPostTypes,
    clearPostTypes,
    resetConnection
  };
};
