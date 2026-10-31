import React, { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useMatch } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import { useCrm } from '@/features/crm/crmStore';
import { workspaceTitle } from '@/features/navigation/workspace';
import '@/styles/product.css';
import { AppSidebar } from '@/components/AppSidebar';
import { Logo } from '@/components/Logo';
import { hasNews, useMenuBadges } from '@/features/crm/menuBadges';
import { useRoutineScheduler } from '@/features/ia/rotinas';
import { PreviewDrawer } from '@/features/operations/Preview';
import { GuardedOutlet } from '@/features/crm/GuardedOutlet';

/**
 * Telas da conta: menu lateral com Produção e CRM (no celular, uma barra com
 * o botão do menu). Dentro de um projeto quem desenha a barra é o próprio
 * Space, no desenho do Framer, e ele ocupa a tela.
 */
const Layout: React.FC = () => {
  const inProject = !!useMatch('/projetos/:projectId');
  const accountName = useCrm((s) => s.team?.name);
  const { pathname, search } = useLocation();
  // Aberto numa prévia (iframe da tela Agentes): só o conteúdo, sem o menu
  const embedded = new URLSearchParams(search).get('embed') === '1';
  const editorRoute = /^\/(copy|criativos)\/[^/]+/.test(pathname);
  const [open, setOpen] = useState(false);
  // As rotinas dos agentes rodam daqui (uma vez no app; a prévia embutida não dispara)
  useRoutineScheduler(!embedded);
  const close = useCallback(() => setOpen(false), []);
  // No celular o menu fica fechado: um ponto no botão avisa que há novidade nele
  const news = useMenuBadges(hasNews);

  // Trocou de tela pelo menu do celular: ele fecha
  useEffect(() => setOpen(false), [pathname]);

  if (inProject || embedded) return <div className="se-product se-project"><GuardedOutlet /></div>;

  return (
    <div className="se-product se-app min-h-screen w-full">
      <AppSidebar open={open} onClose={close} />
      <a href="#workspace-content" className="se-skip-link">Pular para o conteúdo</a>
      <div className="se-workspace flex min-h-screen min-w-0 flex-col md:pl-[264px]">
        <header className="se-mobile-bar sticky top-0 z-30 box-content flex h-14 items-center gap-3 px-4 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={news ? 'Abrir o menu (há novidades)' : 'Abrir o menu'}
            aria-expanded={open}
            className="relative -ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:scale-[0.96]"
          >
            <Menu className="h-5 w-5" />
            {news && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-600 ring-2 ring-white" />}
          </button>
          <Link to="/" aria-label="Projetos" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
        </header>

        {!editorRoute && <div className="se-workspace-bar hidden items-center gap-2 px-8 md:flex" aria-label="Localização atual">
          <Link to="/inicio" className="truncate text-sm text-gray-500 hover:text-gray-900">{accountName ?? 'Seu espaço'}</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
          <span className="truncate text-sm font-medium text-gray-700">{workspaceTitle(pathname)}</span>
        </div>}
        <main id="workspace-content" tabIndex={-1} className="se-content min-w-0 flex-1 outline-none">
          <GuardedOutlet />
        </main>
        <PreviewDrawer />
      </div>
    </div>
  );
};

export default Layout;
