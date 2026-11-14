import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import { useCrm } from '@/features/crm/crmStore';
import { workspaceTitle } from '@/features/navigation/workspace';
import '@/styles/product.css';
import { AppSidebar } from '@/components/AppSidebar';
import { SinfyLogo } from '@/components/Logo';
import { useSinfyTheme } from '@/lib/sinfyTheme';
import { hasNews, useMenuBadges } from '@/features/crm/menuBadges';
import { useRoutineScheduler } from '@/features/ia/rotinas';
import { PreviewDrawer } from '@/features/operations/Preview';
import { GuardedOutlet } from '@/features/crm/GuardedOutlet';
import { lazyNamed } from '@/lib/lazyPage';
import { iaraEnabled } from '@/features/mcp/connect';
import { McpHost } from '@/features/mcp/McpHost';

// A Iara só abre com `?iara=1` (2026-11-12): o código dela não vem na primeira tela
const IaraPanel = lazyNamed(() => import('@/features/iara/IaraPanel'), 'IaraPanel');

/**
 * Telas da conta: menu lateral com Produção e CRM (no celular, uma barra com
 * o botão do menu). Dentro de um projeto quem desenha a barra é o próprio
 * Space, no desenho do Framer, e ele ocupa a tela.
 */
const COLLAPSED_KEY = 'superelements-menu-recolhido';

/**
 * A localização acompanha o container da tela aberta: mede o primeiro bloco
 * centralizado (`mx-auto`) do conteúdo e usa as mesmas margens, assim fica
 * alinhada com o título em telas de 6xl, 7xl ou largas.
 */
const usePageGutters = (main: React.RefObject<HTMLElement>, bar: React.RefObject<HTMLElement>, deps: unknown[]) => {
  const [gutters, setGutters] = useState<{ left: number; right: number } | null>(null);
  useLayoutEffect(() => {
    const root = main.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = bar.current?.getBoundingClientRect();
      const page = root.querySelector<HTMLElement>('.mx-auto');
      if (!box || !box.width || !page) return setGutters((g) => (g === null ? g : null));
      const r = page.getBoundingClientRect();
      const cs = getComputedStyle(page);
      const left = Math.max(0, Math.round(r.left - box.left + parseFloat(cs.paddingLeft)));
      const right = Math.max(0, Math.round(box.right - r.right + parseFloat(cs.paddingRight)));
      setGutters((g) => (g && g.left === left && g.right === right ? g : { left, right }));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    const mutation = new MutationObserver(schedule);
    mutation.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener('resize', schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return gutters;
};

const Layout: React.FC = () => {
  const inProject = !!useMatch('/projetos/:projectId');
  // O editor de um site em código também ocupa a tela inteira, com a Iara ao lado
  const inCodeSite = !!useMatch('/sites/:siteId');
  // Um quadro (canvas livre) também ocupa a tela inteira
  const inBoard = !!useMatch('/quadros/:boardId');
  const accountName = useCrm((s) => s.team?.name);
  const { pathname, search } = useLocation();
  // Aberto numa prévia (iframe da tela Agentes): só o conteúdo, sem o menu
  const embedded = new URLSearchParams(search).get('embed') === '1';
  const editorRoute = /^\/(copy|criativos|motion)\/[^/]+/.test(pathname);
  const [open, setOpen] = useState(false);
  // Menu lateral recolhido (só ícones), lembrado neste navegador
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false } });
  const toggleCollapsed = useCallback(() => setCollapsed((v) => {
    try { localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1') } catch { /* sem armazenamento */ }
    return !v;
  }), []);
  const mainRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  // As rotinas dos agentes rodam daqui (uma vez no app; a prévia embutida não dispara)
  useRoutineScheduler(!embedded);
  const close = useCallback(() => setOpen(false), []);
  // No celular o menu fica fechado: um ponto no botão avisa que há novidade nele
  const news = useMenuBadges(hasNews);

  // Trocou de tela pelo menu do celular: ele fecha
  useEffect(() => setOpen(false), [pathname]);
  useSinfyTheme();
  // A Iara saiu das telas (2026-11-12): a IA da pessoa entra pelo MCP. `?iara=1` religa neste navegador
  const [iara] = useState(iaraEnabled);
  const gutters = usePageGutters(mainRef, barRef, [pathname, collapsed, inProject, embedded, editorRoute]);

  // Dentro de um projeto a Iara também está (o iframe embutido de um agente fica sem ela)
  if (inProject || inCodeSite || inBoard || embedded)
    return (
      <div className="se-product se-project" style={embedded ? undefined : { paddingRight: 'var(--iara-dock, 0px)' }}>
        <GuardedOutlet />
        {!embedded && iara && <Suspense fallback={null}><IaraPanel /></Suspense>}
        {!embedded && <McpHost />}
      </div>
    );

  return (
    <div className={`se-product se-app min-h-screen w-full${collapsed ? ' se-menu-collapsed' : ''}`}>
      <AppSidebar open={open} onClose={close} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <a href="#workspace-content" className="se-skip-link">Pular para o conteúdo</a>
      <div style={{ paddingRight: 'var(--iara-dock, 0px)' }} className={`se-workspace flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ease-out motion-reduce:transition-none ${collapsed ? 'md:pl-[88px]' : 'md:pl-[264px]'}`}>
        {/* Nos editores (Copy, Criativos, Motion) a barra sai no celular: eles têm o próprio voltar e precisam da tela inteira */}
        {!editorRoute && <header className="se-mobile-bar sticky top-0 z-30 box-content flex h-14 items-center gap-3 px-4 md:hidden">
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
            <SinfyLogo />
          </Link>
        </header>}

        {!editorRoute && <nav
          ref={barRef}
          className="se-workspace-bar hidden items-center gap-2 px-8 md:flex"
          style={gutters ? { paddingLeft: gutters.left, paddingRight: gutters.right } : undefined}
          aria-label="Localização atual"
        >
          <Link to="/inicio" className="truncate text-sm text-gray-500 hover:text-gray-900">{accountName ?? 'Seu espaço'}</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
          <span className="truncate text-sm font-medium text-gray-700">{workspaceTitle(pathname)}</span>
        </nav>}
        <main ref={mainRef} id="workspace-content" tabIndex={-1} className="se-content min-w-0 flex-1 outline-none">
          <GuardedOutlet />
        </main>
        <PreviewDrawer />
        {iara && <Suspense fallback={null}><IaraPanel /></Suspense>}
        <McpHost />
      </div>
    </div>
  );
};

export default Layout;
