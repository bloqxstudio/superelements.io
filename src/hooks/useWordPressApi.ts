
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';

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
        title: "Erro de Configuração",
        description: "Por favor, forneça a URL Base",
        variant: "destructive"
      });
      return;
    }

    if (!config.username || !config.applicationPassword) {
      toast({
        title: "Autenticação Obrigatória",
        description: "Por favor, forneça nome de usuário e senha de aplicativo",
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
          errorMessage = 'Falha na autenticação. Verifique seu nome de usuário e senha de aplicativo.';
        } else if (response.status === 403) {
          errorMessage = 'Acesso proibido. Você pode não ter permissão para acessar este conteúdo.';
        } else if (response.status === 404) {
          errorMessage = 'Endpoint de tipos de post não encontrado. Verifique sua URL base.';
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
        title: "Falha na Conexão",
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
    const requestStartTime = Date.now(); // Track total request time
    
    console.log(`=== FETCH COMPONENTS API CALL ===`);
    console.log('Fetch request:', { page, perPage, postType: config.postType, categoryIds });

    if (!config.baseUrl || !config.postType) {
      const errorMsg = "Por favor, forneça URL Base e Tipo de Post";
      toast({
        title: "Erro de Configuração",
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
      }
      
      // Enhanced retry logic with exponential backoff and jitter
      const maxRetries = 3; // Reduced from 5 for faster failure detection // Increased from 3 to 5
      let retryCount = 0;
      const baseDelay = 1000;
      const requestStartTime = Date.now();
      
      // Log request start
      logger.logNetworkRequest('fetchComponents', {
        url: apiUrl,
        method: 'GET',
        timestamp: requestStartTime,
        hasAuth: !!(config.username && config.applicationPassword),
        retryCount: 0
      });
      
      while (retryCount <= maxRetries) {
        try {
          // Increased timeout to 30 seconds
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced from 30s to 10s
          
          const fetchStartTime = Date.now();
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers,
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const responseTime = Date.now() - fetchStartTime;

          if (!response.ok) {
            let errorMessage = 'Unknown error occurred';
            let shouldRetry = false;
            
            if (response.status === 401) {
              errorMessage = 'Falha na autenticação. Verifique seu nome de usuário e senha de aplicativo.';
            } else if (response.status === 403) {
              errorMessage = 'Acesso proibido. Você pode não ter permissão para acessar este conteúdo.';
            } else if (response.status === 404) {
              errorMessage = `Endpoint não encontrado. O tipo de post "${config.postType}" pode não existir ou não estar exposto via REST API.`;
            } else if (response.status === 400) {
              console.log('Página não encontrada - fim das páginas alcançado');
              return { components: [], hasNextPage: false, totalComponents: 0 };
            } else if (response.status === 429) {
              // Rate limiting - retry with longer delay
              errorMessage = 'Limite de taxa excedido. Aguardando antes de tentar novamente...';
              shouldRetry = true;
            } else if (response.status === 0 || response.status >= 500) {
              errorMessage = `Erro do servidor (${response.status}). O site WordPress pode estar temporariamente indisponível.`;
              shouldRetry = true;
            } else {
              errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            
            // Log error with details
            logger.logNetworkError('fetchComponents HTTP error', {
              url: apiUrl,
              method: 'GET',
              status: response.status,
              statusText: response.statusText,
              responseTime,
              retryCount,
              maxRetries,
              error: errorMessage
            });
            
            // Retry logic for server errors and rate limiting
            if (shouldRetry && retryCount < maxRetries) {
              // Faster exponential backoff: 1s, 2s, 4s (max)
              const exponentialDelay = baseDelay * Math.pow(1.5, retryCount); // Slower growth
              const jitter = Math.random() * 500; // Reduced jitter
              const delay = Math.min(exponentialDelay + jitter, 4000); // Max 4s instead of 15s
              
              logger.warn(`Retrying after ${Math.round(delay)}ms (attempt ${retryCount + 1}/${maxRetries})`);
              
              // Only show toast on first retry to avoid spam
              if (retryCount === 0) {
                toast({
                  title: "Tentando reconectar...",
                  description: `Problema temporário detectado. Tentando novamente...`,
                  duration: 2000
                });
              }
              
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              continue;
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
          
          // Log success
          logger.logNetworkSuccess('fetchComponents', {
            url: apiUrl,
            status: response.status,
            responseTime,
            dataSize: data.length
          });

          console.log('Page fetch result:', {
            page,
            componentsCount: data.length,
            hasNextPage,
            totalComponents,
            totalPages,
            filteredByCategory: !!categoryIds,
            responseTime: `${responseTime}ms`
          });

          if (page === 1) {
            setComponents(data);
          }
          
          const filterMessage = categoryIds ? ` (filtered by categories: ${categoryIds.join(', ')})` : '';
          const authMessage = config.username ? ' (authenticated)' : ' (public)';
          
          console.log(`✅ Fetched ${data.length} components from page ${page}${filterMessage}${authMessage} in ${responseTime}ms`);
          
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
            const timeoutMessage = 'Tempo limite da solicitação - o servidor demorou muito para responder (30s). Isso pode indicar sobrecarga do servidor.';
            
            logger.logNetworkError('fetchComponents timeout', {
              url: apiUrl,
              method: 'GET',
              retryCount,
              maxRetries,
              error: 'AbortError'
            });
            
            if (retryCount < maxRetries) {
              const exponentialDelay = baseDelay * Math.pow(2, retryCount);
              const jitter = Math.random() * 1000;
              const delay = Math.min(exponentialDelay + jitter, 15000);
              
              logger.warn(`Timeout - retrying after ${Math.round(delay)}ms (attempt ${retryCount + 1}/${maxRetries})`);
              
              // Only show toast on first retry
              if (retryCount === 0) {
                toast({
                  title: "Tentando reconectar...",
                  description: `Servidor demorou muito. Tentando novamente...`,
                  duration: 2000
                });
              }
              
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              continue;
            } else {
              throw new Error(timeoutMessage);
            }
          }
          
          // Check if it's a network error
          if (fetchError instanceof TypeError && fetchError.message === 'Failed to fetch') {
            const networkMessage = 'Erro de rede - não foi possível conectar ao site WordPress. Verifique a URL e sua conexão com a internet.';
            
            logger.logNetworkError('fetchComponents network error', {
              url: apiUrl,
              method: 'GET',
              retryCount,
              maxRetries,
              error: fetchError.message
            });
            
            if (retryCount < maxRetries) {
              const exponentialDelay = baseDelay * Math.pow(2, retryCount);
              const jitter = Math.random() * 1000;
              const delay = Math.min(exponentialDelay + jitter, 15000);
              
              logger.warn(`Network error - retrying after ${Math.round(delay)}ms (attempt ${retryCount + 1}/${maxRetries})`);
              
              // Only show toast on first retry
              if (retryCount === 0) {
                toast({
                  title: "Tentando reconectar...",
                  description: `Falha na conexão. Tentando novamente...`,
                  duration: 2000
                });
              }
              
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              continue;
            } else {
              throw new Error(networkMessage);
            }
          }
          
          // Log unexpected errors
          logger.logNetworkError('fetchComponents unexpected error', {
            url: apiUrl,
            method: 'GET',
            retryCount,
            maxRetries,
            error: fetchError
          });
          
          throw fetchError;
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Final error logging
      logger.logNetworkError('fetchComponents final error', {
        url: `${config.baseUrl}/wp-json/wp/v2/${config.postType}`,
        method: 'GET',
        error: errorMessage,
        responseTime: Date.now() - requestStartTime
      });
      
      // Only show toast for final failure (after all retries)
      toast({
        title: "Erro de Busca",
        description: errorMessage,
        variant: "destructive"
      });
      
      console.error('❌ Fetch error after all retries:', error);
      
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
