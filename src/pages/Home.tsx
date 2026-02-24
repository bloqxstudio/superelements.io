import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { OUSEN_CONNECTIONS, OUSEN_CLIENT_PAGES } from '@/mocks/ousenWorkspace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AddClientDialog } from '@/components/AddClientDialog';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Plus,
  ArrowRight,
  ExternalLink,
  Globe,
} from 'lucide-react';
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

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getStatusBadgeVariant = (
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' => {
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

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'connected':
      return 'Conectado';
    case 'connecting':
      return 'Conectando...';
    case 'error':
      return 'Erro';
    default:
      return 'Desconectado';
  }
};

const quickActions = [
  { label: 'Clientes', description: 'Carteira de sites WordPress', icon: Users, path: '/client-accounts' },
  { label: 'Componentes', description: 'Biblioteca Elementor', icon: LayoutGrid, path: '/componentes' },
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const { isLoading, getClientAccounts, fetchConnections } = useConnectionsStore();
  const [showAddClient, setShowAddClient] = useState(false);

  const isMockOusen = activeWorkspace?.slug === 'ousen';

  const [pageCountByConnection, setPageCountByConnection] = useState<Record<string, number>>({});

  const { clientAccounts, errorAccounts, connectedAccounts, prioritizedAccounts } = useMemo(() => {
    if (isMockOusen) {
      const accounts = OUSEN_CONNECTIONS;
      const errorAccounts = accounts.filter((a) => a.status === 'error');
      const connectedAccounts = accounts.filter((a) => a.status === 'connected');
      const prioritizedAccounts = [
        ...errorAccounts,
        ...accounts.filter((a) => a.status === 'disconnected'),
        ...accounts.filter((a) => a.status === 'connecting'),
        ...connectedAccounts,
      ].slice(0, 6);
      return { clientAccounts: accounts, errorAccounts, connectedAccounts, prioritizedAccounts };
    }

    const allClientAccounts = getClientAccounts();
    const clientAccounts = activeWorkspace
      ? allClientAccounts.filter((a) => a.workspace_id === activeWorkspace.id)
      : [];
    const errorAccounts = clientAccounts.filter((a) => a.status === 'error');
    const connectedAccounts = clientAccounts.filter((a) => a.status === 'connected');
    const prioritizedAccounts = [
      ...errorAccounts,
      ...clientAccounts.filter((a) => a.status === 'disconnected'),
      ...clientAccounts.filter((a) => a.status === 'connecting'),
      ...connectedAccounts,
    ].slice(0, 6);
    return { clientAccounts, errorAccounts, connectedAccounts, prioritizedAccounts };
  }, [isMockOusen, getClientAccounts, activeWorkspace]);

  useEffect(() => {
    if (isMockOusen) {
      const counts: Record<string, number> = {};
      for (const page of OUSEN_CLIENT_PAGES) {
        counts[page.connection_id] = (counts[page.connection_id] ?? 0) + 1;
      }
      setPageCountByConnection(counts);
      return;
    }
    const ids = clientAccounts.map((a) => a.id);
    if (ids.length === 0) {
      setPageCountByConnection({});
      return;
    }
    supabase
      .from('client_pages')
      .select('connection_id')
      .in('connection_id', ids)
      .then(({ data, error }) => {
        if (!error && data) {
          const counts: Record<string, number> = {};
          for (const row of data) {
            counts[row.connection_id] = (counts[row.connection_id] ?? 0) + 1;
          }
          setPageCountByConnection(counts);
        }
      });
  }, [isMockOusen, clientAccounts.map((a) => a.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading && !isMockOusen) {
    return (
      <div className="min-h-screen bg-[#f7f7f8]">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-7">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <motion.div
        className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-7"
        variants={containerVariants}
        initial={false}
        animate="show"
      >

      {/* ── A: Header ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {getGreeting()}, {activeWorkspace?.name || 'Admin'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/client-accounts')}>
              <Users className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Clientes</span>
            </Button>
            <Button size="sm" onClick={() => setShowAddClient(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Cliente</span>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* ── B: Stats ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
        <motion.div variants={cardStagger} className="grid grid-cols-3 gap-4">
          <motion.div variants={cardItem}>
            <Card className="border-gray-200/70 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total de Clientes</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{clientAccounts.length}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    {errorAccounts.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] sm:text-xs">
                        {errorAccounts.length} erro{errorAccounts.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardItem}>
            <Card className="border-gray-200/70 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Conectados</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 text-green-600">
                      {connectedAccounts.length}
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardItem}>
            <Card
              className={errorAccounts.length > 0 ? 'border-destructive/50 bg-destructive/5 shadow-sm' : 'border-gray-200/70 bg-white shadow-sm'}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Com Problema</p>
                    <p className={`text-2xl sm:text-3xl font-bold mt-1 ${errorAccounts.length > 0 ? 'text-red-600' : ''}`}>
                      {errorAccounts.length}
                    </p>
                  </div>
                  <AlertCircle className={`h-4 w-4 sm:h-5 sm:w-5 ${errorAccounts.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ── C: Carteira de Clientes ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Carteira de Clientes</CardTitle>
                <CardDescription>
                  {errorAccounts.length > 0
                    ? `${errorAccounts.length} conta${errorAccounts.length > 1 ? 's' : ''} precisando de atenção`
                    : clientAccounts.length > 0
                    ? 'Todas as contas estão operando normalmente'
                    : 'Nenhuma conta cadastrada'}
                </CardDescription>
              </div>
              {clientAccounts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/client-accounts')}>
                  Ver todos
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {clientAccounts.length === 0 ? (
              <div className="px-6 py-10">
                <div className="max-w-sm mx-auto text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Globe className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    Conecte seu primeiro cliente
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Adicione o site WordPress de um cliente para acompanhar o status, páginas e histórico — tudo em um só lugar.
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
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar primeiro cliente
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {prioritizedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                    onClick={() => navigate(`/client-accounts/${account.id}`)}
                  >
                    <div
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${
                        account.status === 'connected'
                          ? 'bg-green-500'
                          : account.status === 'error'
                          ? 'bg-red-500'
                          : account.status === 'connecting'
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-gray-400'
                      }`}
                    />
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{account.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{account.base_url}</p>
                    </div>
                    {pageCountByConnection[account.id] !== undefined && (
                      <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>{pageCountByConnection[account.id]} páginas</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={getStatusBadgeVariant(account.status)} className="text-[10px] sm:text-xs">
                        {getStatusLabel(account.status)}
                      </Badge>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(account.base_url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {clientAccounts.length > 6 && (
              <div className="px-6 py-3 border-t bg-gray-50/50">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  onClick={() => navigate('/client-accounts')}
                >
                  <ArrowRight className="h-3 w-3" />
                  +{clientAccounts.length - 6} mais clientes
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* ── D: Acesso Rápido ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Acesso Rápido</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Atalhos para as principais áreas</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-start gap-3 rounded-2xl border border-gray-200/80 bg-gray-50 p-4 text-left transition-all hover:border-gray-300 hover:bg-white hover:shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.section>

      </motion.div>

      <AddClientDialog
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        onSuccess={() => fetchConnections()}
      />
    </div>
  );
};

export default Home;
