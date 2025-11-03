import { useState, useEffect } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { logger } from '@/utils/logger';

interface PriorityComponentLoaderProps {
  connectionSlug?: string;
  componentSlug?: string;
  connectionId?: string;
  componentId?: string;
}

export const usePriorityComponentLoader = ({
  connectionSlug,
  componentSlug,
  connectionId,
  componentId
}: PriorityComponentLoaderProps) => {
  const { connections } = useConnectionsStore();
  const [component, setComponent] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPriorityComponent = async () => {
      // Wait for connections to load
      if (connections.length === 0) {
        return;
      }

      setIsLoading(true);
      setError(null);

      const startTime = Date.now();
      logger.info('🚀 PRIORITY LOADING: Starting fast component load', {
        connectionSlug,
        componentSlug,
        connectionId,
        componentId
      });

      try {
        // Step 1: Resolve connection
        let targetConnection = null;
        if (connectionSlug) {
          targetConnection = connections.find(c => c.slug === connectionSlug);
        } else if (connectionId) {
          targetConnection = connections.find(c => c.id === connectionId);
        }

        if (!targetConnection) {
          throw new Error('Conexão não encontrada');
        }

        setConnection(targetConnection);
        logger.info('✅ Connection resolved', {
          connectionName: targetConnection.name,
          connectionId: targetConnection.id,
          timeElapsed: `${Date.now() - startTime}ms`
        });

        // Step 2: Build API URL for single component
        const baseUrl = targetConnection.base_url.replace(/\/$/, '');
        let apiUrl: string;

        if (componentSlug) {
          // Use slug-based endpoint (more SEO friendly)
          apiUrl = `${baseUrl}/wp-json/wp/v2/${targetConnection.post_type}?slug=${componentSlug}&_fields=id,title,link,slug,categories,meta,acf,content`;
          logger.info('📍 Using slug-based endpoint', { apiUrl });
        } else if (componentId) {
          // Use ID-based endpoint (legacy)
          apiUrl = `${baseUrl}/wp-json/wp/v2/${targetConnection.post_type}/${componentId}?_fields=id,title,link,slug,categories,meta,acf,content`;
          logger.info('📍 Using ID-based endpoint', { apiUrl });
        } else {
          throw new Error('Nem slug nem ID do componente fornecido');
        }

        // Step 3: Fetch component (try public first, then authenticated)
        logger.info('🔄 Fetching component...');
        let response = await fetch(apiUrl);

        // If 401/403 and has credentials, try with auth
        if ((response.status === 401 || response.status === 403) && targetConnection.credentials) {
          logger.info('🔐 Public access denied, trying with authentication');
          const authHeader = btoa(
            `${targetConnection.credentials.username}:${targetConnection.credentials.application_password}`
          );
          response = await fetch(apiUrl, {
            headers: {
              'Authorization': `Basic ${authHeader}`
            }
          });
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const componentData = Array.isArray(data) ? data[0] : data;

        if (!componentData) {
          throw new Error('Componente não encontrado');
        }

        // Enrich component with connection data
        const enrichedComponent = {
          ...componentData,
          connection_id: targetConnection.id,
          connection_name: targetConnection.name,
          connection_access_level: targetConnection.accessLevel
        };

        setComponent(enrichedComponent);

        const loadTime = Date.now() - startTime;
        logger.info('✅ PRIORITY LOADING: Component loaded successfully', {
          componentTitle: componentData.title?.rendered,
          loadTime: `${loadTime}ms`,
          performance: loadTime < 1000 ? '🚀 FAST' : loadTime < 2000 ? '⚡ GOOD' : '🐌 SLOW'
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
        logger.error('❌ PRIORITY LOADING: Failed to load component', {
          error: errorMessage,
          timeElapsed: `${Date.now() - startTime}ms`
        });
      } finally {
        setIsLoading(false);
      }
    };

    if ((connectionSlug || connectionId) && (componentSlug || componentId)) {
      loadPriorityComponent();
    }
  }, [connectionSlug, componentSlug, connectionId, componentId, connections]);

  return {
    component,
    connection,
    isLoading,
    error
  };
};
