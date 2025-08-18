
import React, { useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useConnectionsStore } from '@/store/connectionsStore';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { initialize, isInitialized } = useAuthStore();
  const { fetchConnections } = useConnectionsStore();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initializeAuth = async () => {
      console.log('🔐 Initializing authentication...');
      cleanup = await initialize();
      console.log('✅ Authentication initialized');
      
      // Carregar conexões imediatamente após inicialização da auth
      console.log('🔗 Loading connections...');
      try {
        await fetchConnections();
        console.log('✅ Connections loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load connections:', error);
      }
    };

    initializeAuth();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [initialize, fetchConnections]);

  // Não bloquear renderização enquanto carrega
  return <>{children}</>;
};
