import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ExternalLink, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardStagger = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const sectionClass =
  'rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm sm:p-6';

const ClientAccounts = () => {
  const navigate = useNavigate();
  const { connections, isLoading, fetchConnections, getClientAccounts } = useConnectionsStore();
  const { activeWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const allClientAccounts = getClientAccounts();
  // Scope all workspace data to the selected workspace only.
  const clientAccounts = activeWorkspace
    ? allClientAccounts.filter((acc) => acc.workspace_id === activeWorkspace.id)
    : [];

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
      <div className="min-h-screen bg-[#f7f7f8] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Carregando contas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-6xl space-y-7"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
      {/* Resumo */}
      <motion.section variants={itemVariants} className={sectionClass}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os sites WordPress dos seus clientes
          </p>
        </div>
        <Button onClick={() => navigate('/connections')}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Cliente
        </Button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou URL..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <motion.div variants={cardStagger} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={cardItem}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                <p className="text-2xl font-bold">{clientAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>
        <motion.div variants={cardItem}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
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
        </motion.div>
        <motion.div variants={cardItem}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
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
        </motion.div>
      </motion.div>
      </motion.section>

      {/* Lista de Clientes */}
      {filteredAccounts.length === 0 ? (
        <motion.section variants={itemVariants} className={sectionClass}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
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
        </motion.section>
      ) : (
        <motion.section variants={itemVariants} className={sectionClass}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Lista de clientes</h2>
          <p className="text-sm text-gray-500">Contas cadastradas e status atual de conexão.</p>
        </div>
        <motion.div variants={cardStagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map((account) => (
            <motion.div key={account.id} variants={cardItem}>
              <Card
                className="border-gray-200/70 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
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
            </motion.div>
          ))}
        </motion.div>
        </motion.section>
      )}
      </motion.div>
    </div>
  );
};

export default ClientAccounts;
