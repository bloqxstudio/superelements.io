
import { useState, useEffect, useCallback } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useAuthStore } from '@/store/authStore';
import { useAccessControl } from '@/hooks/useAccessControl';

export interface ComponentItem {
  id: string; // Composite ID for React keys
  originalId: number; // Original WordPress post ID (numeric)
  title: string | { rendered: string }; // Handle both formats
  url: string;
  category: string;
  connection_id?: string;
  thumbnail?: string;
  post_type?: string;
  status?: string;
}

interface UseSimplifiedComponentLoadingProps {
  selectedCategories?: number[];
  activeConnectionId?: string;
}

export const useSimplifiedComponentLoading = (props?: UseSimplifiedComponentLoadingProps) => {
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connections } = useConnectionsStore();
  const { profile } = useAuthStore();
  const { userRole, isAdmin, isPro } = useAccessControl();

  const { selectedCategories = [], activeConnectionId } = props || {};

  const filterConnectionsByAccess = useCallback(() => {
    // ADMIN users have access to ALL connections
    if (isAdmin) {
      return connections.filter(conn => conn.isActive);
    }
    
    // PRO and FREE users have access to all connections - no restrictions
    return connections.filter(conn => conn.isActive);
  }, [connections, isAdmin]);

  const loadComponents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const accessibleConnections = filterConnectionsByAccess();
      
      // Filter by active connection if specified
      const connectionsToLoad = activeConnectionId 
        ? accessibleConnections.filter(conn => conn.id === activeConnectionId)
        : accessibleConnections;
      
      if (connectionsToLoad.length === 0) {
        setComponents([]);
        setLoading(false);
        return;
      }

      console.log('🔗 Loading components from connections:', connectionsToLoad.map(c => ({
        id: c.id,
        name: c.name,
        base_url: c.base_url,
        post_type: c.post_type,
        hasCredentials: !!(c.username && c.application_password)
      })));

      // Load components from accessible connections
      const allComponents: ComponentItem[] = [];
      
      for (const connection of connectionsToLoad) {
        try {
          // Use the correct endpoint with the post_type from the connection
          const apiUrl = `${connection.base_url}/wp-json/wp/v2/${connection.post_type}?per_page=50&status=publish`;
          
          console.log('📡 Fetching from:', apiUrl);
          
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };

          // Add authentication if available
          if (connection.username && connection.application_password) {
            const credentials = btoa(`${connection.username}:${connection.application_password}`);
            headers['Authorization'] = `Basic ${credentials}`;
            console.log('🔐 Added authentication for connection:', connection.name);
          } else {
            console.warn('⚠️ No credentials found for connection:', connection.name);
          }

          const response = await fetch(apiUrl, { headers });
          
          if (response.ok) {
            const posts = await response.json();
            console.log(`✅ Loaded ${posts.length} components from ${connection.name}`);
            
            const connectionComponents = posts.map((post: any) => {
              const component: ComponentItem = {
                id: `${connection.id}-${post.id}`, // Composite ID for React keys
                originalId: post.id, // Keep original numeric ID for WordPress API calls
                title: post.title, // Preserve original structure (object with .rendered)
                url: `${connection.base_url}/?p=${post.id}`,
                category: 'General',
                connection_id: connection.id, // CRITICAL: Ensure connection_id is set
                thumbnail: post.featured_media ? `${connection.base_url}/wp-content/uploads/` : undefined,
                post_type: connection.post_type,
                status: post.status
              };
              
              console.log('🧩 Created component with enhanced debug:', {
                id: component.id,
                originalId: component.originalId,
                connection_id: component.connection_id,
                connectionName: connection.name,
                connectionUserType: connection.userType,
                title: typeof component.title === 'object' ? component.title.rendered : component.title,
                hasConnectionId: !!component.connection_id,
                // Ensure connection_id is definitely set
                connectionIdCheck: component.connection_id === connection.id
              });
              
              return component;
            });
            
            allComponents.push(...connectionComponents);
          } else {
            console.warn(`❌ Failed to load from ${connection.name}: ${response.status} ${response.statusText}`);
          }
        } catch (connError) {
          console.error(`💥 Error loading from connection ${connection.name}:`, connError);
        }
      }

      console.log(`🎯 Total components loaded: ${allComponents.length}`);
      console.log('📊 Sample components with connection debug:', allComponents.slice(0, 3).map(c => ({
        id: c.id,
        originalId: c.originalId,
        connection_id: c.connection_id,
        hasConnectionId: !!c.connection_id,
        connectionIdValue: c.connection_id
      })));
      
      setComponents(allComponents);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load components';
      console.error('💥 Component loading error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filterConnectionsByAccess, activeConnectionId]);

  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  return {
    data: { components },
    components,
    loading,
    isLoading: loading,
    isError: !!error,
    error,
    isReady: !loading && !error,
    refetch: loadComponents,
    loadingState: loading ? 'loading' : 'idle',
    totalComponents: components.length,
    hasAccess: (componentLevel: string = 'free') => {
      // ADMIN users have access to everything
      if (isAdmin) return true;
      // PRO users have access to everything
      if (isPro) return true;
      // FREE users have access to free components
      if (componentLevel === 'free') return true;
      return false;
    }
  };
};
