
import React, { useState, useEffect } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConnectionWizard } from '@/features/connections/components/ConnectionWizard';
import { 
  Plus, 
  Search, 
  Filter, 
  Globe, 
  Settings, 
  Trash2, 
  RefreshCw,
  Users,
  Crown,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

const Connections = () => {
  const { 
    connections, 
    isLoading, 
    fetchConnections, 
    updateConnection, 
    removeConnection, 
    validateConnection 
  } = useConnectionsStore();

  const [showWizard, setShowWizard] = useState(false);
  const [editingConnection, setEditingConnection] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Filter connections based on search and filters
  const filteredConnections = connections.filter(connection => {
    const matchesSearch = connection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         connection.base_url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || connection.status === statusFilter;
    const matchesUserType = userTypeFilter === 'all' || connection.userType === userTypeFilter;
    
    return matchesSearch && matchesStatus && matchesUserType;
  });

  // Statistics
  const stats = {
    total: connections.length,
    active: connections.filter(c => c.isActive).length,
    connected: connections.filter(c => c.status === 'connected').length,
    totalComponents: connections.reduce((sum, c) => sum + (c.componentsCount || 0), 0)
  };

  const handleToggleActive = async (connectionId: string, currentActive: boolean) => {
    try {
      await updateConnection(connectionId, { isActive: !currentActive });
      toast.success(!currentActive ? 'Connection activated' : 'Connection deactivated');
    } catch (error) {
      toast.error('Failed to update connection status');
      console.error('Error toggling connection:', error);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    try {
      const isValid = await validateConnection(connectionId);
      toast.success(isValid ? 'Connection test successful' : 'Connection test failed');
    } catch (error) {
      toast.error('Failed to test connection');
      console.error('Error testing connection:', error);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (window.confirm('Are you sure you want to delete this connection?')) {
      try {
        await removeConnection(connectionId);
        toast.success('Connection deleted successfully');
      } catch (error) {
        toast.error('Failed to delete connection');
        console.error('Error deleting connection:', error);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'connecting':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'connecting':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'free':
        return <Users className="h-4 w-4" />;
      case 'pro':
        return <Crown className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">WordPress Connections</h1>
            <p className="text-muted-foreground mt-2">
              Manage your WordPress connections to access components
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Connection
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Connections</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Connections</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <Zap className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Connected</p>
                  <p className="text-2xl font-bold">{stats.connected}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Components</p>
                  <p className="text-2xl font-bold">{stats.totalComponents}</p>
                </div>
                <Settings className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search connections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="connecting">Connecting</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="disconnected">Disconnected</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Users className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="User Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="free">Free Users</SelectItem>
                    <SelectItem value="pro">Pro Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connections Grid */}
        {filteredConnections.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No connections found</h3>
              <p className="text-muted-foreground mb-6">
                {connections.length === 0 
                  ? "Get started by creating your first WordPress connection."
                  : "Try adjusting your search or filter criteria."
                }
              </p>
              {connections.length === 0 && (
                <Button onClick={() => setShowWizard(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Connection
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredConnections.map((connection) => (
              <Card key={connection.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{connection.name}</CardTitle>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {connection.base_url}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Switch
                        checked={connection.isActive}
                        onCheckedChange={() => handleToggleActive(connection.id, connection.isActive)}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Status and Type Badges */}
                  <div className="flex items-center justify-between">
                    <Badge className={`flex items-center gap-1 ${getStatusColor(connection.status)}`}>
                      {getStatusIcon(connection.status)}
                      {connection.status}
                    </Badge>
                    
                    <Badge variant="outline" className="flex items-center gap-1">
                      {getUserTypeIcon(connection.userType)}
                      {connection.userType === 'all' ? 'All Users' : connection.userType}
                    </Badge>
                  </div>

                  {/* Connection Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Components:</span>
                      <span className="font-medium">{connection.componentsCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Post Type:</span>
                      <span className="font-medium">{connection.post_type}</span>
                    </div>
                    {connection.lastTested && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Tested:</span>
                        <span className="font-medium">
                          {connection.lastTested.toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {connection.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{connection.error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => handleTestConnection(connection.id)}
                      className="flex-1 flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Test
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => setEditingConnection(connection.id)}
                      className="flex-1 flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteConnection(connection.id)}
                      className="flex items-center gap-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Connection Wizard */}
        {showWizard && (
          <ConnectionWizard
            isOpen={showWizard}
            onClose={() => setShowWizard(false)}
            onSuccess={() => {
              setShowWizard(false);
              fetchConnections();
            }}
          />
        )}

        {/* Edit Connection Wizard */}
        {editingConnection && (
          <ConnectionWizard
            isOpen={!!editingConnection}
            onClose={() => setEditingConnection(null)}
            onSuccess={() => {
              setEditingConnection(null);
              fetchConnections();
            }}
            editingConnectionId={editingConnection}
          />
        )}
      </div>
    </div>
  );
};

export default Connections;
