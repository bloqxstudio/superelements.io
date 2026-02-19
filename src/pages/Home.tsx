import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useCartStore } from '@/store/cartStore';
import { useLibraryComponentCount } from '@/hooks/useLibraryComponentCount';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Plus,
  ArrowRight,
  ShoppingCart,
  Wifi,
  WifiOff,
  Clock,
  ExternalLink,
  Link,
  ClipboardCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const getRelativeTime = (date?: Date): string => {
  if (!date) return 'Nunca testado';
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return new Date(date).toLocaleDateString('pt-BR');
};

const getComponentTitle = (comp: any): string => {
  if (!comp) return 'Sem título';
  if (typeof comp.title === 'string') return comp.title;
  if (comp.title?.rendered) return comp.title.rendered;
  return 'Componente sem nome';
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [activeProposals, setActiveProposals] = React.useState<
    Array<{
      id: string;
      client_name: string;
      price: number;
      deadline: string | null;
      created_at: string;
      status: 'pending' | 'accepted' | 'rejected';
    }>
  >([]);
  const [isLoadingProposals, setIsLoadingProposals] = React.useState(false);
  // Layout.tsx já dispara fetchConnections — Home apenas lê o estado
  const { isLoading, getClientAccounts, getDesignerConnections } =
    useConnectionsStore();
  const { items: cartItems, openCart } = useCartStore();
  const { data: libraryCount, isLoading: isCountLoading } = useLibraryComponentCount(activeWorkspace?.id);

  const allClientAccounts = getClientAccounts();
  // Scope all workspace data to the selected workspace only.
  const clientAccounts = activeWorkspace
    ? allClientAccounts.filter((a) => a.workspace_id === activeWorkspace.id)
    : [];
  const allDesignerConns = getDesignerConnections();
  const designerConns = activeWorkspace
    ? allDesignerConns.filter((c) => c.workspace_id === activeWorkspace.id)
    : [];
  const errorAccounts = clientAccounts.filter((a) => a.status === 'error');
  const connectedAccounts = clientAccounts.filter((a) => a.status === 'connected');

  const prioritizedAccounts = [
    ...clientAccounts.filter((a) => a.status === 'error'),
    ...clientAccounts.filter((a) => a.status === 'disconnected'),
    ...clientAccounts.filter((a) => a.status === 'connecting'),
    ...clientAccounts.filter((a) => a.status === 'connected'),
  ].slice(0, 6);

  const libraryComponentCount =
    libraryCount?.total ?? designerConns.reduce((sum, c) => sum + (c.componentsCount || 0), 0);

  useEffect(() => {
    const fetchActiveProposals = async () => {
      if (!activeWorkspace?.id) {
        setActiveProposals([]);
        return;
      }

      setIsLoadingProposals(true);
      const { data, error } = await supabase
        .from('proposals')
        .select('id, client_name, price, deadline, created_at, status')
        .eq('workspace_id', activeWorkspace.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        setActiveProposals([]);
      } else {
        setActiveProposals((data as typeof activeProposals) ?? []);
      }
      setIsLoadingProposals(false);
    };

    fetchActiveProposals();
  }, [activeWorkspace?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-7">
          <Skeleton className="h-10 w-56" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
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
      {/* ── A: Header ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {profile?.email?.split('@')[0] || 'Admin'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da sua operação</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/connections')}>
            <Link className="h-4 w-4 mr-2" />
            Conexões
          </Button>
          <Button size="sm" onClick={() => navigate('/client-accounts')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>
      </motion.section>

      {/* ── B: Stats Row ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
      <motion.div variants={cardStagger} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total de Clientes */}
        <motion.div variants={cardItem}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                <p className="text-3xl font-bold mt-1">{clientAccounts.length}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Users className="h-5 w-5 text-muted-foreground" />
                {errorAccounts.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {errorAccounts.length} erro{errorAccounts.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Conectados */}
        <motion.div variants={cardItem}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conectados</p>
                <p className="text-3xl font-bold mt-1 text-green-600">
                  {connectedAccounts.length}
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Com Problema */}
        <motion.div variants={cardItem}>
        <Card
          className={errorAccounts.length > 0 ? 'border-destructive/50 bg-destructive/5 shadow-sm' : 'border-gray-200/70 bg-white shadow-sm'}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Com Problema</p>
                <p
                  className={`text-3xl font-bold mt-1 ${
                    errorAccounts.length > 0 ? 'text-red-600' : ''
                  }`}
                >
                  {errorAccounts.length}
                </p>
              </div>
              <AlertCircle
                className={`h-5 w-5 ${
                  errorAccounts.length > 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}
              />
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Componentes na Biblioteca */}
        <motion.div variants={cardItem}>
        <Card className="border-gray-200/70 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Na Biblioteca</p>
                {isCountLoading ? (
                  <Skeleton className="h-9 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold mt-1">{libraryComponentCount}</p>
                )}
              </div>
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">componentes</p>
          </CardContent>
        </Card>
        </motion.div>
      </motion.div>
      </motion.section>

      {/* ── C: Two-column layout ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* C1: Client Accounts */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200/70 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Contas de Clientes</CardTitle>
                  <CardDescription>
                    {errorAccounts.length > 0
                      ? `${errorAccounts.length} conta${errorAccounts.length > 1 ? 's' : ''} precisando de atenção`
                      : clientAccounts.length > 0
                      ? 'Todas as contas estão operando normalmente'
                      : 'Nenhuma conta cadastrada'}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/client-accounts')}
                >
                  Ver todos
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {clientAccounts.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhuma conta de cliente cadastrada ainda.
                  </p>
                  <Button size="sm" onClick={() => navigate('/connections')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Cliente
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {prioritizedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="px-6 py-4 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/client-accounts/${account.id}`)}
                    >
                      {/* Status dot */}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          account.status === 'connected'
                            ? 'bg-green-500'
                            : account.status === 'error'
                            ? 'bg-red-500'
                            : account.status === 'connecting'
                            ? 'bg-yellow-500 animate-pulse'
                            : 'bg-gray-400'
                        }`}
                      />

                      {/* Account info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {account.name}
                          </p>
                          {account.status === 'error' && account.error && (
                            <span className="text-xs text-red-500 truncate max-w-[180px] hidden sm:inline">
                              — {account.error}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {account.base_url}
                        </p>
                      </div>

                      {/* Right side */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge
                          variant={getStatusBadgeVariant(account.status)}
                          className="hidden sm:inline-flex"
                        >
                          {getStatusLabel(account.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden md:block">
                          {getRelativeTime(account.lastTested)}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
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
        </div>

        {/* C2: Right column */}
        <div className="space-y-4">
          {/* C2a: Cart — only when there are items */}
          {cartItems.length > 0 && (
            <Card className="border-gray-200/70 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Carrinho
                    <Badge variant="secondary">{cartItems.length}</Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={openCart}>
                    Abrir
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {cartItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {getComponentTitle(item.component)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.addedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {cartItems.length > 4 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                      +{cartItems.length - 4} mais itens
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* C2b: Designer connections status */}
          <Card className="border-gray-200/70 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Biblioteca de Componentes</CardTitle>
              <CardDescription>Fontes de componentes conectadas</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {designerConns.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhuma conexão configurada.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => navigate('/connections')}
                  >
                    Gerenciar conexões
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {designerConns.map((conn) => (
                    <div key={conn.id} className="px-4 py-3 flex items-center gap-3">
                      {conn.status === 'connected' ? (
                        <Wifi className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{conn.name}</p>
                        {isCountLoading ? (
                          <Skeleton className="h-3 w-20 mt-1" />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {(libraryCount?.byConnection?.[conn.id] ?? conn.componentsCount ?? 0)} componentes
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={getStatusBadgeVariant(conn.status)}
                        className="text-xs flex-shrink-0"
                      >
                        {getStatusLabel(conn.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </motion.section>

      {/* ── D: Propostas ativas ── */}
      <motion.section variants={itemVariants} className={sectionClass}>
        <div className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Propostas Ativas</h3>
              <p className="text-sm text-muted-foreground">Pendentes de resposta no workspace atual</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/proposals')}>
              Ver todas
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
        <div>
          {isLoadingProposals ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : activeProposals.length === 0 ? (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 mb-3">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma proposta pendente no momento.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeProposals.map((proposal) => (
                <button
                  key={proposal.id}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors px-2 rounded-md"
                  onClick={() => navigate('/proposals')}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{proposal.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Criada em {format(new Date(proposal.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      {proposal.deadline
                        ? ` • Prazo ${format(new Date(proposal.deadline + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-semibold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.price)}
                    </p>
                    <Badge variant="outline">Aguardando</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.section>
      </motion.div>
    </div>
  );
};

export default Home;
