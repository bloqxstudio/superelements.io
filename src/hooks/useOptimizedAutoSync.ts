import { useEffect, useRef } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useAuthStore } from '@/store/authStore';

export const useOptimizedAutoSync = () => {
  const { user } = useAuthStore();
  const { connections, fetchConnections } = useConnectionsStore();
  
  // Use refs to track if we've already loaded connections
  const hasLoadedConnections = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Only fetch connections when user changes and we haven't loaded yet
  useEffect(() => {
    const currentUserId = user?.id || null;
    
    if (user && currentUserId !== lastUserIdRef.current && !hasLoadedConnections.current) {
      console.log('🔗 Loading connections for user...');
      fetchConnections()
        .then(() => {
          hasLoadedConnections.current = true;
          lastUserIdRef.current = currentUserId;
        })
        .catch((error) => {
          console.warn('Failed to fetch connections:', error);
        });
    } else if (!user) {
      // Reset when user logs out
      hasLoadedConnections.current = false;
      lastUserIdRef.current = null;
    }
  }, [user?.id, fetchConnections]);

  return {
    connectionsLoaded: hasLoadedConnections.current,
    totalConnections: connections.length
  };
};