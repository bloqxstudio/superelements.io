
import { useEffect, useRef, useCallback } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';

/**
 * Enhanced connection sync hook that supports both specific connections and "All Components" mode
 * Only considers active connections
 */
export const useConnectionSync = () => {
  const { getActiveConnection, connections } = useConnectionsStore();
  const { setConfig, setIsConnected, config } = useWordPressStore();
  const syncCompletedRef = useRef(false);

  // Get only active connections
  const getActiveConnections = useCallback(() => {
    return connections.filter(conn => conn.isActive);
  }, [connections]);

  // Enhanced synchronization function that handles both cases
  const syncConnection = useCallback(() => {
    const activeConnection = getActiveConnection();
    const activeConnections = getActiveConnections();
    
    console.log('🔄 Enhanced sync (only active connections):', {
      hasActiveConnection: !!activeConnection,
      connectionId: activeConnection?.id,
      isActiveConnectionActive: activeConnection?.isActive,
      totalActiveConnections: activeConnections.length,
      totalConnections: connections.length,
      currentConfigUrl: config.baseUrl,
    });

    // If we have an active connection and it's still active, sync with it
    if (activeConnection && activeConnection.base_url && activeConnection.isActive) {
      console.log('✅ Syncing with active connection:', activeConnection.name);
      
      setConfig({
        baseUrl: activeConnection.base_url,
        postType: activeConnection.post_type,
        jsonField: activeConnection.json_field,
        previewField: activeConnection.preview_field,
        username: activeConnection.credentials?.username || '',
        applicationPassword: activeConnection.credentials?.application_password || ''
      });
      
      setIsConnected(true);
      syncCompletedRef.current = true;
      return true;
    }
    // If no specific active connection but we have active connections available, 
    // this is "All Components" mode - still valid
    else if (activeConnections.length > 0) {
      console.log('✅ All Components mode - multiple active connections available');
      setIsConnected(true); // Set as connected for "All Components" mode
      syncCompletedRef.current = true;
      return true;
    } 
    // Only fail if we have no active connections at all
    else {
      console.log('⚠️ No active connections available');
      setIsConnected(false);
      syncCompletedRef.current = false;
      return false;
    }
  }, [getActiveConnection, getActiveConnections, setConfig, setIsConnected, config.baseUrl, connections]);

  // Single sync on mount - no continuous effects
  useEffect(() => {
    if (!syncCompletedRef.current && connections.length > 0) {
      const timeoutId = setTimeout(() => {
        syncConnection();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [connections.length, syncConnection]);

  // Reset sync when connections change (to handle activation/deactivation)
  useEffect(() => {
    syncCompletedRef.current = false;
  }, [connections.map(c => `${c.id}-${c.isActive}`).join(',')]);

  // Determine if we're "in sync" - either have active connection OR multiple active connections for "All Components"
  const isInSync = syncCompletedRef.current || (getActiveConnections().length > 0);

  return {
    activeConnection: getActiveConnection(),
    syncConnection,
    isInSync,
    lastSyncConfig: config.baseUrl
  };
};
