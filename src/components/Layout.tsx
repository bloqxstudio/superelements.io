import React from 'react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { Logo } from '@/components/Logo';
import { ProjectBreadcrumb, ProjectContextButton } from '@/features/projects/ProjectHeader';
import { ProjectChatGPTButton } from '@/features/chatgpt/ChatGPTConnectionDialog';
import { ProjectWordPressButton } from '@/features/wordpress/WordPressDialog';
import { ProjectShareButton } from '@/features/projects/ProjectAccessDialog';

/** Altura do header (56px + 1px de borda): o Space ocupa o resto da tela. */
const Layout: React.FC = () => {
  const projectId = useMatch('/projetos/:projectId')?.params.projectId;

  return (
    <div className="min-h-screen bg-background w-full flex flex-col">
      <header className="h-14 box-content border-b bg-white sticky top-0 z-30 w-full">
        <div className="h-full w-full px-4 md:px-6 flex items-center justify-between gap-3">
          <nav aria-label="Navegação" className="flex min-w-0 items-center gap-2.5">
            <Link to="/" aria-label="Projetos" className="shrink-0 transition-opacity hover:opacity-80">
              <Logo />
            </Link>
            {projectId && <ProjectBreadcrumb projectId={projectId} />}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {projectId && <ProjectShareButton projectId={projectId} />}
            {projectId && <ProjectChatGPTButton projectId={projectId} />}
            {projectId && <ProjectWordPressButton projectId={projectId} />}
            {projectId && <ProjectContextButton projectId={projectId} />}
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
