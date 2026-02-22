import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaces as useAdminWorkspaces } from '@/hooks/useWorkspaceManagement';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Building2, Users, LogOut, ArrowRight, Settings, FlaskConical } from 'lucide-react';
import { motion } from 'framer-motion';
import { MOCK_OUSEN_ENABLED_KEY } from '@/store/connectionsStore';
import { OUSEN_WORKSPACE } from '@/mocks/ousenWorkspace';

const WorkspaceSelect: React.FC = () => {
  const navigate = useNavigate();
  const { profile, signOut, loading: authLoading, user } = useAuth();
  const { workspaces, enterWorkspace, switchWorkspace, isAdmin, isLoading } = useWorkspace();
  const [mockEnabled, setMockEnabled] = useState(
    () => localStorage.getItem(MOCK_OUSEN_ENABLED_KEY) === 'true'
  );

  const toggleMock = () => {
    const next = !mockEnabled;
    if (next) localStorage.setItem(MOCK_OUSEN_ENABLED_KEY, 'true');
    else localStorage.removeItem(MOCK_OUSEN_ENABLED_KEY);
    setMockEnabled(next);
    window.location.reload();
  };

  // Admin: busca todos os workspaces da plataforma
  const { data: allWorkspaces, isLoading: adminLoading } = useAdminWorkspaces();

  // Redireciona para /auth se não autenticado
  // Usa `user` (não `profile`) para evitar loop: user é setado junto com loading=true,
  // profile só fica disponível depois do fetch async — mas loading ainda está true nesse período
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSelectOwn = (workspaceId: string) => {
    switchWorkspace(workspaceId);
    navigate('/', { replace: true });
  };

  const handleAdminEnter = (ws: { id: string; name: string; slug: string }) => {
    enterWorkspace({ id: ws.id, name: ws.name, slug: ws.slug, role: 'owner' });
    navigate('/', { replace: true });
  };

  const loading = authLoading || isLoading || (isAdmin && adminLoading);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Lista para admin: todos os workspaces da plataforma
  // Lista para membros: apenas os seus
  type DisplayItem = {
    id: string;
    name: string;
    slug: string;
    member_count: number | null;
    connection_count: number | null;
    owner_email: string | null;
    isOwn: boolean;
  };

  const ousenMockItem: DisplayItem = {
    id: OUSEN_WORKSPACE.id,
    name: OUSEN_WORKSPACE.name,
    slug: OUSEN_WORKSPACE.slug,
    member_count: 8,
    connection_count: 8,
    owner_email: null,
    isOwn: true,
  };

  const adminBase: DisplayItem[] = (allWorkspaces ?? []).map((ws) => ({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    member_count: ws.member_count,
    connection_count: ws.connection_count,
    owner_email: ws.owner_email,
    isOwn: workspaces.some((w) => w.id === ws.id),
  }));

  const displayList: DisplayItem[] = isAdmin
    ? (mockEnabled ? [...adminBase, ousenMockItem] : adminBase)
    : workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        member_count: null,
        connection_count: null,
        owner_email: null,
        isOwn: true,
      }));

  return (
    <div className="min-h-screen bg-[#f7f7f8] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-3">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/workspaces')}
              className="hidden sm:inline-flex"
            >
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar Workspaces
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/workspaces')}
              className="sm:hidden px-2"
              title="Gerenciar Workspaces"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <span className="text-sm text-muted-foreground hidden md:block truncate max-w-[160px]">{profile?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="px-2 sm:px-3">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Dev mock toggle */}
      {import.meta.env.DEV && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-800">
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Modo dev — Workspace mock Ousen {mockEnabled ? 'ativado' : 'desativado'}
          </span>
          <button
            onClick={toggleMock}
            className="font-semibold underline underline-offset-2 hover:text-amber-900"
          >
            {mockEnabled ? 'Desativar' : 'Ativar mock Ousen'}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Selecione um workspace</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isAdmin
                ? 'Como admin, você pode entrar em qualquer workspace da plataforma.'
                : 'Escolha o workspace que deseja acessar.'}
            </p>
          </div>

          {displayList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Nenhum workspace disponível</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {isAdmin
                  ? 'Crie o primeiro workspace da plataforma.'
                  : 'Você ainda não foi adicionado a nenhum workspace. Fale com o administrador.'}
              </p>
              {isAdmin && (
                <Button onClick={() => navigate('/admin/workspaces')}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Criar Workspace
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayList.map((ws, i) => (
                <motion.button
                  key={ws.id}
                  className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-primary/40 transition-all text-left group"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                  onClick={() => ws.isOwn ? handleSelectOwn(ws.id) : handleAdminEnter(ws)}
                >
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{ws.name}</span>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                        {ws.slug}
                      </code>
                    </div>
                    {isAdmin && ws.owner_email && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Owner: {ws.owner_email}
                      </p>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ws.member_count ?? 0} membros
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ws.connection_count ?? 0} conexões
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default WorkspaceSelect;
