import React from 'react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { Logo } from '@/components/Logo';
import { AgentsButton } from '@/features/agents/AgentsButton';
import { ProspectsButton } from '@/features/prospects/ProspectsButton';

/**
 * Header das telas da conta (56px + 1px de borda). Dentro de um projeto quem
 * desenha a barra é o próprio Space, no desenho do Framer, e ele ocupa a tela.
 */
const Layout: React.FC = () => {
  const inProject = !!useMatch('/projetos/:projectId');

  if (inProject) return <Outlet />;

  return (
    <div className="min-h-screen bg-background w-full flex flex-col">
      <header className="h-14 box-content border-b bg-white sticky top-0 z-30 w-full">
        <div className="h-full w-full px-4 md:px-6 flex items-center justify-between gap-3">
          <nav aria-label="Navegação" className="flex min-w-0 items-center gap-2.5">
            <Link to="/" aria-label="Projetos" className="shrink-0 transition-opacity hover:opacity-80">
              <Logo />
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <ProspectsButton />
            <AgentsButton />
            <UserAvatar />
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
