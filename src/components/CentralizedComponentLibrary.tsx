import React, { useEffect } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useConnectionSync } from '@/hooks/useConnectionSync';
import ComponentGrid from '@/features/components/ComponentGrid';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, Layers, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UpgradePrompt } from '@/components/UpgradePrompt';
interface CentralizedComponentLibraryProps {
  onPreview: (url: string, title: string) => void;
}
const CentralizedComponentLibrary: React.FC<CentralizedComponentLibraryProps> = ({
  onPreview
}) => {
  const {
    connections,
    isLoading,
    fetchConnections
  } = useConnectionsStore();
  const {
    activeConnectionId
  } = useMultiConnectionData();
  const {
    syncConnection,
    isInSync
  } = useConnectionSync();
  const { profile } = useAuth();

  // Auto-fetch connections on mount if not already loaded
  useEffect(() => {
    if (connections.length === 0 && !isLoading) {
      fetchConnections();
    }
  }, [connections.length, isLoading, fetchConnections]);
  
  const handleForceSync = () => {
    syncConnection();
  };

  // Filter connections based on user access level
  const getAccessibleActiveConnections = () => {
    const activeConnections = connections.filter(conn => conn.isActive);
    
    // If no profile (not logged in), show all active connections
    if (!profile) return activeConnections;
    
    // Admin can see all connections
    if (profile.role === 'admin') return activeConnections;
    
    // Pro users can see connections marked as 'all', 'pro', or 'free'
    if (profile.role === 'pro') {
      return activeConnections.filter(conn => 
        conn.userType === 'all' || conn.userType === 'pro' || conn.userType === 'free'
      );
    }
    
    // Free users can only see connections marked as 'all' or 'free'
    return activeConnections.filter(conn => conn.userType === 'all' || conn.userType === 'free');
  };

  const activeConnections = getAccessibleActiveConnections();

  // Show loading state while fetching connections
  if (isLoading && connections.length === 0) {
    return <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Carregando Conexões</h2>
            <p className="text-muted-foreground mb-6">
              Buscando conexões WordPress...
            </p>
          </CardContent>
        </Card>
      </div>;
  }

  // No connections available
  if (connections.length === 0) {
    return <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-6">
              <Layers className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Nenhuma Conexão</h2>
            <p className="text-muted-foreground mb-6">
              Nenhuma conexão WordPress disponível. Verifique suas configurações de conexão.
            </p>
          </CardContent>
        </Card>
      </div>;
  }

  // No active connections
  if (activeConnections.length === 0) {
    const hasRestrictedConnections = connections.filter(conn => conn.isActive).length > 0;
    
    if (hasRestrictedConnections && profile?.role === 'free') {
      // Check if there are connections restricted to 'pro' only
      const hasProOnlyConnections = connections.some(conn => 
        conn.isActive && conn.userType === 'pro'
      );
      
      if (hasProOnlyConnections) {
        return <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md mx-auto space-y-6">
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-yellow-50 rounded-lg flex items-center justify-center mx-auto mb-6">
                    <WifiOff className="w-8 h-8 text-yellow-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Nenhuma Conexão Ativa</h2>
                  <p className="text-muted-foreground mb-6">
                    Existem conexões disponíveis exclusivas para usuários Pro. Faça upgrade para acessá-las.
                  </p>
                </CardContent>
              </Card>
              <UpgradePrompt 
                requiredLevel="pro" 
                currentLevel="free"
                onUpgrade={() => {}} 
              />
            </div>
          </div>;
      }
    }
    
    return <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-yellow-50 rounded-lg flex items-center justify-center mx-auto mb-6">
              <WifiOff className="w-8 h-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Nenhuma Conexão Ativa</h2>
            <p className="text-muted-foreground mb-6">
              Você tem {connections.length} conexões, mas nenhuma está ativa no momento. 
              Ative pelo menos uma conexão para visualizar componentes.
            </p>
          </CardContent>
        </Card>
      </div>;
  }

  // Main component grid - works for both "All Components" and specific connections
  return <div className="h-full">
      {/* Connection Status Indicator */}
      

      <ComponentGrid onPreview={onPreview} />
    </div>;
};
export default CentralizedComponentLibrary;