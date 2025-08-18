
import { useEffect, useRef } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressConnection } from '@/features/wordpress/hooks/useWordPressConnection';
import { useAuthStore } from '@/store/authStore';

export const useAutoSync = () => {
  const { user } = useAuthStore();
  const { 
    connections, 
    activeConnectionId, 
    getActiveConnection, 
    updateConnection, 
    fetchConnections 
  } = useConnectionsStore();
  const { config, isConnected, totalComponents, error } = useWordPressStore();
  const { handleConfigChange, testConnection, initializeCompleteMetadata } = useWordPressConnection();
  
  // Use refs to track previous values and prevent unnecessary operations
  const lastConfigRef = useRef<string>('');
  const lastConnectionIdRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);
  const hasLoadedConnections = useRef(false);
  const initializationAttempts = useRef(0);
  const maxInitializationAttempts = 3;

  // Fetch connections when user is authenticated
  useEffect(() => {
    if (user && !hasLoadedConnections.current) {
      console.log('🔗 Fetching connections from Supabase...');
      fetchConnections();
      hasLoadedConnections.current = true;
    } else if (!user) {
      hasLoadedConnections.current = false;
      initializationAttempts.current = 0;
    }
  }, [user, fetchConnections]);

  // REMOVED: Auto-selection logic to maintain "All Components" as initial state
  // The user should explicitly select a connection if they want to filter

  // Sync active connection to WordPress store (only when connection changes)
  useEffect(() => {
    const activeConnection = getActiveConnection();
    
    if (activeConnection && activeConnectionId && activeConnectionId !== lastConnectionIdRef.current) {
      lastConnectionIdRef.current = activeConnectionId;
      
      const connectionConfig = {
        baseUrl: activeConnection.base_url,
        postType: activeConnection.post_type,
        jsonField: activeConnection.json_field,
        previewField: activeConnection.preview_field,
        username: activeConnection.username,
        applicationPassword: activeConnection.application_password,
      };
      
      const newConfigString = JSON.stringify(connectionConfig);
      const currentConfigString = JSON.stringify(config);
      
      if (newConfigString !== currentConfigString && newConfigString !== lastConfigRef.current) {
        console.log('🔄 Syncing connection config to WordPress store:', activeConnection.name);
        lastConfigRef.current = newConfigString;
        handleConfigChange(connectionConfig);
      }
    } else if (!activeConnection && lastConnectionIdRef.current !== null) {
      lastConnectionIdRef.current = null;
      lastConfigRef.current = '';
      initializationAttempts.current = 0;
    }
  }, [activeConnectionId, getActiveConnection, config, handleConfigChange]);

  // Auto-initialization with retry logic (only when connection is explicitly selected)
  useEffect(() => {
    const activeConnection = getActiveConnection();
    
    if (
      activeConnection && 
      activeConnectionId && // Only initialize when explicitly selected
      config.baseUrl && 
      !isConnected && 
      !isInitializingRef.current &&
      config.baseUrl === activeConnection.base_url && // Ensure config is synced
      initializationAttempts.current < maxInitializationAttempts
    ) {
      isInitializingRef.current = true;
      initializationAttempts.current++;
      
      console.log(`🚀 Auto-initializing selected connection (attempt ${initializationAttempts.current}/${maxInitializationAttempts}):`, activeConnection.name);
      
      // Update connection status to show it's connecting
      updateConnection(activeConnection.id, { 
        status: 'connecting',
        error: undefined
      });
      
      // First test the connection, then initialize metadata
      testConnection()
        .then(() => {
          // If connection is successful, initialize complete metadata
          if (config.postType) {
            return initializeCompleteMetadata();
          }
        })
        .then(() => {
          // Update connection status on success
          const currentConnection = getActiveConnection();
          if (currentConnection) {
            updateConnection(currentConnection.id, { 
              status: 'connected',
              componentsCount: useWordPressStore.getState().totalComponents,
              lastTested: new Date(),
              error: undefined
            });
          }
          // Reset attempts on success
          initializationAttempts.current = 0;
        })
        .catch((error) => {
          console.warn(`⚠️ Auto-initialization attempt ${initializationAttempts.current} failed:`, error);
          
          // Update connection status on error
          const currentConnection = getActiveConnection();
          if (currentConnection) {
            updateConnection(currentConnection.id, { 
              status: 'error',
              error: error.message,
              lastTested: new Date()
            });
          }
          
          // If max attempts reached, stop trying
          if (initializationAttempts.current >= maxInitializationAttempts) {
            console.error(`❌ Max initialization attempts (${maxInitializationAttempts}) reached for connection:`, activeConnection.name);
          }
        })
        .finally(() => {
          isInitializingRef.current = false;
        });
    }
  }, [
    config.baseUrl, 
    config.postType, 
    isConnected, 
    activeConnectionId, // Added dependency
    getActiveConnection, 
    updateConnection, 
    testConnection, 
    initializeCompleteMetadata
  ]);

  // Update connection status when components are loaded or errors occur
  useEffect(() => {
    const activeConnection = getActiveConnection();
    
    if (activeConnection && activeConnectionId && !isInitializingRef.current) {
      if (isConnected && totalComponents > 0) {
        updateConnection(activeConnection.id, { 
          status: 'connected',
          componentsCount: totalComponents,
          lastTested: new Date(),
          error: undefined
        });
        // Reset attempts on successful component load
        initializationAttempts.current = 0;
      } else if (error && activeConnection.status !== 'error') {
        updateConnection(activeConnection.id, { 
          status: 'error',
          error: error,
          lastTested: new Date()
        });
      }
    }
  }, [isConnected, totalComponents, error, activeConnectionId, getActiveConnection, updateConnection]);

  return {
    activeConnectionId,
    isConnected,
    initializationAttempts: initializationAttempts.current,
    maxInitializationAttempts
  };
};
