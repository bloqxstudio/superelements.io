
import React, { useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useConnectionsStore } from '@/store/connectionsStore';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { initialize, isInitialized, user } = useAuthStore();
  const { fetchConnections } = useConnectionsStore();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initializeAuth = async () => {
      console.log('🔐 AuthProvider: Initializing authentication...');
      cleanup = await initialize();
      console.log('✅ AuthProvider: Authentication initialized');
    };

    initializeAuth();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [initialize]);

  // Load connections only when user is authenticated and auth is initialized
  useEffect(() => {
    if (isInitialized && user) {
      console.log('🔗 AuthProvider: Loading connections for authenticated user...');
      fetchConnections()
        .then(() => {
          console.log('✅ AuthProvider: Connections loaded successfully');
        })
        .catch((error) => {
          console.error('❌ AuthProvider: Failed to load connections:', error);
        });
    } else if (isInitialized && !user) {
      console.log('🔒 AuthProvider: User not authenticated - skipping connection load');
    }
  }, [isInitialized, user, fetchConnections]);

  // Não bloquear renderização enquanto carrega
  return <>{children}</>;
};
