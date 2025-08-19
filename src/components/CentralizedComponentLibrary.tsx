import React from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useConnectionSync } from '@/hooks/useConnectionSync';
import ComponentGrid from '@/features/components/ComponentGrid';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, Layers, Wifi, WifiOff } from 'lucide-react';
interface CentralizedComponentLibraryProps {
  onPreview: (url: string, title: string) => void;
}
const CentralizedComponentLibrary: React.FC<CentralizedComponentLibraryProps> = ({
  onPreview
}) => {
  const {
    connections
  } = useConnectionsStore();
  const {
    activeConnectionId
  } = useMultiConnectionData();
  const {
    syncConnection,
    isInSync
  } = useConnectionSync();
  const handleForceSync = () => {
    syncConnection();
  };
  const activeConnections = connections.filter(conn => conn.isActive);
  console.log('=== CENTRALIZED LIBRARY RENDER ===');

  // No connections available
  if (connections.length === 0) {
    return <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-6">
              <Layers className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-4">No Connections</h2>
            <p className="text-muted-foreground mb-6">
              No WordPress connections are available. Please check your connection settings.
            </p>
          </CardContent>
        </Card>
      </div>;
  }

  // No active connections
  if (activeConnections.length === 0) {
    return <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-yellow-50 rounded-lg flex items-center justify-center mx-auto mb-6">
              <WifiOff className="w-8 h-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">No Active Connections</h2>
            <p className="text-muted-foreground mb-6">
              You have {connections.length} connections, but none are currently active. 
              Please activate at least one connection to view components.
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