import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ExternalLink, Plus, Search } from 'lucide-react';

const ClientAccounts = () => {
  const navigate = useNavigate();
  const { connections, isLoading, fetchConnections, getClientAccounts } = useConnectionsStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const clientAccounts = getClientAccounts();

  const filteredAccounts = clientAccounts.filter((account) =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.base_url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'connected':
        return 'default';
      case 'connecting':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const handleOpenSite = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleViewDetails = (accountId: string) => {
    navigate(`/client-accounts/${accountId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando contas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Client Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os sites WordPress dos seus clientes
          </p>
        </div>
        <Button onClick={() => navigate('/connections')}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                <p className="text-2xl font-bold">{clientAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conectados</p>
                <p className="text-2xl font-bold">
                  {clientAccounts.filter((a) => a.status === 'connected').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold">
                  {clientAccounts.filter((a) => a.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Accounts List */}
      {filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? 'Nenhum cliente encontrado com esse critério de busca.'
                  : 'Nenhuma conta de cliente cadastrada ainda.'}
              </p>
              {!searchTerm && (
                <Button onClick={() => navigate('/connections')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Cliente
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map((account) => (
            <Card
              key={account.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewDetails(account.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <CardDescription
                      className="mt-1 flex items-center gap-2 hover:underline"
                      onClick={(e) => handleOpenSite(account.base_url, e)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {account.base_url}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(account.status)}>
                      {account.status === 'connected' && 'Conectado'}
                      {account.status === 'connecting' && 'Conectando...'}
                      {account.status === 'error' && 'Erro'}
                      {account.status === 'disconnected' && 'Desconectado'}
                    </Badge>
                    {account.isActive && (
                      <Badge variant="outline">Ativo</Badge>
                    )}
                  </div>

                  {account.lastTested && (
                    <p className="text-xs text-muted-foreground">
                      Último teste: {new Date(account.lastTested).toLocaleDateString('pt-BR')}
                    </p>
                  )}

                  {account.error && (
                    <p className="text-xs text-red-600">{account.error}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientAccounts;
