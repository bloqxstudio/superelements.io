import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AddClientDialog } from '@/components/AddClientDialog';
import { ExternalLink, Plus, Search, Globe } from 'lucide-react';
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
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
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
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const sectionClass =
  'rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm sm:p-6';

const ClientAccounts = () => {
  const navigate = useNavigate();
  const { isLoading, fetchConnections, getClientAccounts } = useConnectionsStore();
  const { activeWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);

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
      <div className="min-h-screen bg-[#f7f7f8]">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Carregando contas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <motion.div
        className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-7"
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
        <Button onClick={() => setShowAddClient(true)}>
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
          <CardContent className="p-10">
            {searchTerm ? (
              <div className="text-center">
                <p className="text-muted-foreground">
                  Nenhum cliente encontrado com esse critério de busca.
                </p>
              </div>
            ) : (
              <div className="max-w-sm mx-auto text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  Nenhum cliente ainda
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Adicione o site WordPress de um cliente para acompanhar o status e as páginas em um só lugar.
                </p>
                <ol className="text-left space-y-3 mb-6">
                  {[
                    'Informe a URL do site WordPress do cliente',
                    'Insira o usuário e a senha de aplicação',
                    'Pronto — o cliente aparece aqui automaticamente',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700">{step}</span>
                    </li>
                  ))}
                </ol>
                <Button className="w-full sm:w-auto" onClick={() => setShowAddClient(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar primeiro cliente
                </Button>
              </div>
            )}
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

      <AddClientDialog
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        onSuccess={() => fetchConnections()}
      />
    </div>
  );
};

export default ClientAccounts;
