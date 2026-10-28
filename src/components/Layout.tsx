import React, { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useMatch } from 'react-router-dom';
import { Menu } from 'lucide-react';
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
  const { pathname, search } = useLocation();
  // Aberto numa prévia (iframe da tela Agentes): só o conteúdo, sem o menu
  const embedded = new URLSearchParams(search).get('embed') === '1';
  const [open, setOpen] = useState(false);
  // As rotinas dos agentes rodam daqui (uma vez no app; a prévia embutida não dispara)
  useRoutineScheduler(!embedded);
  const close = useCallback(() => setOpen(false), []);
  // No celular o menu fica fechado: um ponto no botão avisa que há novidade nele
  const news = useMenuBadges(hasNews);

  // Trocou de tela pelo menu do celular: ele fecha
  useEffect(() => setOpen(false), [pathname]);

  if (inProject || embedded) return <GuardedOutlet />;

  return (
    <div className="min-h-screen w-full bg-zinc-50">
      <AppSidebar open={open} onClose={close} />
      <div className="flex min-h-screen min-w-0 flex-col md:pl-60">
        <header className="sticky top-0 z-30 box-content flex h-14 items-center gap-3 border-b bg-white px-4 md:hidden">
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

        <main className="min-w-0 flex-1">
          <GuardedOutlet />
        </main>
        <PreviewDrawer />
      </div>
    </div>
  );
};

export default Layout;
