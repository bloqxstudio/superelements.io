import { useJobs } from '@/features/operations/jobs'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ChevronsUpDown, LayoutDashboard, LayoutGrid, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { navigationMatches } from '@/features/navigation/workspace'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { areaPaths, type AreaId } from '@/features/navigation/AreaTabs'
import { Activity, Bookmark, Bot, Brain, Building2, CalendarDays, CalendarRange, Filter, House, Building, Globe, ListChecks, Images, Instagram, Megaphone, Palette, PenLine, Presentation, KanbanSquare, LayoutTemplate, LogOut, MessageCircle, Radar, Radio, ScanSearch, Send, Sparkles, Users, Wand2, X } from 'lucide-react'
import { Logo, SinfyLogo } from '@/components/Logo'
import { PersonAvatar } from '@/features/profile/PersonAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { AccountSwitcher } from '@/features/crm/AccountSwitcher'
import { useCrm } from '@/features/crm/crmStore'
import { moduleOn, productInfo, type ModuleId, type ProductId } from '@/features/crm/modules'
import { useMenuBadges, useMenuFeed, type MenuBadges } from '@/features/crm/menuBadges'
import { plural } from '@/features/crm/ui'
import { AGENT_COLOR } from '@/features/agents/agentStatus'
import { useTick } from '@/features/agents/useTick'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'
import { useMcpConnect } from '@/features/mcp/connect'
import { moduleHomePath, useMenuModules } from '@/features/navigation/moduleHome'

/**
 * Menu lateral das telas da conta. Desde 2026-11-09 (nova jornada de criação, aprovada pelo usuário:
 * "Sites e projetos é a mesma coisa", "cérebro deve vir primeiro", "Pauta, conteúdo e texto é meio que
 * a mesma coisa") é um menu só para os três produtos, na ordem da jornada: o grupo Criação (Cérebro
 * primeiro, depois Pauta, Quadros, Sites e Criativos), Vendas e Resultados. Desde 2026-11-11 o menu é por módulo (o usuário:
 * "um menu global com todos os módulos; dentro do módulo vão as funcionalidades, no sidebar como é hoje",
 * "Criação é um módulo também" e, como referência, a janela de apps do Mac): Início, o botão do módulo atual,
 * que abre a janela com todos (`ModulesWindow`: Criação, Vendas, Prospecção, Instagram, Resultados, IA e equipe e
 * Plataforma), e logo abaixo só as telas do módulo atual. Automações saiu do menu (a rota segue). Os módulos da conta só
 * escondem itens; não mudam a ordem nem os nomes. Telas irmãs viram abas no topo da área
 * (`AreaTabs`). Dentro de um projeto o Space ocupa a tela e o menu some. Desde 2026-11-12 cada módulo com mais de uma
 * tela começa pela Visão geral (`/modulo/:id`, `pages/ModuleHome.tsx`), que é onde se cai ao escolher o módulo.
 * Plano: cerebro/iniciativas/sinfy-construtor/jornada-de-criacao.md.
 */

const NavigationQuery = createContext('')
/** Menu recolhido: só os ícones, com o nome no title. */
const Collapsed = createContext(false)

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'se-nav-item flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500/40 active:scale-[0.98]',
    isActive ? 'se-nav-active text-gray-900' : 'text-gray-600 hover:text-gray-900'
  )

/** Uma rota é da área quando é ela mesma ou está abaixo dela (`/` só conta sozinha e em `/projetos`). */
const inArea = (pathname: string, paths: string[]) =>
  paths.some((p) => (p === '/' ? pathname === '/' || pathname.startsWith('/projetos/') : pathname === p || pathname.startsWith(`${p}/`)))

const Item: React.FC<{ to: string; icon: React.ElementType; label: string; end?: boolean; area?: AreaId; children?: React.ReactNode }> = ({ to, icon: Icon, label, end, area, children }) => {
  const query = useContext(NavigationQuery)
  const collapsed = useContext(Collapsed)
  const { pathname } = useLocation()
  if (!navigationMatches(query, label, area ? areaPaths(area).join(' ') : to)) return null
  return (
  <NavLink to={to} end={end} className={({ isActive }) => itemClass({ isActive: area ? inArea(pathname, areaPaths(area)) : isActive })} title={collapsed ? label : undefined}>
    <Icon className="h-4 w-4 shrink-0" aria-hidden />
    <span className="se-nav-label min-w-0 flex-1 truncate">{label}</span>
    {children && <span className="se-nav-badges flex items-center gap-1">{children}</span>}
  </NavLink>
  )
}

/** Um módulo do menu: nome, cor do ícone na janela de módulos, rotas que são dele e as telas que aparecem no menu. */
interface MenuModule {
  id: string
  title: string
  hint: string
  icon: React.ElementType
  /** Cor do quadrado do ícone na janela de módulos. */
  color: string
  paths: string[]
  exact?: string[]
  news?: (b: MenuBadges) => boolean
  items: { to: string; label: string; node: React.ReactNode }[]
}

const STORED_MODULE = 'superelements-menu-modulo'

const ModuleTile: React.FC<{ module: MenuModule; size?: 'sm' | 'lg' }> = ({ module, size = 'sm' }) => {
  const Icon = module.icon
  return (
    <span className={cn('flex shrink-0 items-center justify-center text-white shadow-[inset_0_1px_0_rgb(255_255_255/.25),0_1px_2px_rgb(0_0_0/.12)]', size === 'lg' ? 'h-12 w-12 rounded-[14px]' : 'h-6 w-6 rounded-[7px]')} style={{ background: module.color }} aria-hidden>
      <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-3.5 w-3.5'} strokeWidth={size === 'lg' ? 1.8 : 2.2} />
    </span>
  )
}

const hasNews = (m: MenuModule, b: MenuBadges) => !!m.news?.(b)

/**
 * A janela com todos os módulos da conta, como a de apps do Mac (pedido do usuário, 2026-11-11): busca no
 * topo e a grade de ícones. Escolher um módulo abre a primeira tela dele; o menu passa a mostrar as telas dele.
 */
const ModulesWindow: React.FC<{ modules: MenuModule[]; current?: MenuModule; open: boolean; onOpenChange: (open: boolean) => void; onPick: (m: MenuModule) => void }> = ({ modules, current, open, onOpenChange, onPick }) => {
  const [query, setQuery] = useState('')
  const badges = useMenuBadges((b) => b)
  useEffect(() => { if (!open) setQuery('') }, [open])
  const shown = modules.filter((m) => !query || [m.title, m.hint, ...m.items.map((i) => i.label)].some((t) => navigationMatches(query, t, '')))
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-gray-900/20 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content onOpenAutoFocus={(e) => { if (window.matchMedia?.('(pointer: coarse)').matches) { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus() } }} className="fixed inset-x-0 top-[12vh] z-[61] mx-auto w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-black/5 bg-white/95 shadow-2xl outline-none backdrop-blur-xl duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-left-12 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-left-12">
          <DialogPrimitive.Description className="sr-only">Escolha um módulo; o menu passa a mostrar as telas dele.</DialogPrimitive.Description>
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4">
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <DialogPrimitive.Title className="sr-only">Módulos</DialogPrimitive.Title>
            <input type="search" aria-label="Buscar módulo" placeholder="Módulos" value={query} onChange={(e) => setQuery(e.target.value)} className="h-14 min-w-0 flex-1 bg-transparent text-lg font-medium tracking-tight text-gray-900 outline-none placeholder:text-gray-400" />
            <DialogPrimitive.Close aria-label="Fechar" className="flex h-10 w-10 items-center md:h-8 md:w-8 justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="grid max-h-[60dvh] grid-cols-2 gap-1 overflow-y-auto p-3 sm:grid-cols-3">
            {shown.map((m) => (
              <button key={m.id} type="button" onClick={() => onPick(m)} aria-current={m.id === current?.id ? 'true' : undefined} className={cn('relative flex flex-col items-center gap-2 rounded-xl px-2 pb-3 pt-4 text-center transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none', m.id === current?.id && 'bg-gray-100/80')}>
                <ModuleTile module={m} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-gray-900">{m.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-gray-500">{m.hint}</span>
                </span>
                {hasNews(m, badges) && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-violet-600" aria-label="Novidades" />}
              </button>
            ))}
            {shown.length === 0 && <p className="col-span-full px-2 py-8 text-center text-sm text-gray-500">Nenhum módulo com esse nome.</p>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** O botão do módulo atual, logo abaixo de Início: abre a janela de módulos. Um ponto avisa novidade em outro módulo. */
const ModuleSwitcher: React.FC<{ current: MenuModule; othersNews: boolean; onOpen: () => void }> = ({ current, othersNews, onOpen }) => {
  const collapsed = useContext(Collapsed)
  return (
    <button type="button" onClick={onOpen} title={collapsed ? `${current.title} · trocar de módulo` : 'Trocar de módulo'} aria-haspopup="dialog" className={cn('se-module-switcher relative flex w-full items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-black/[.045]', collapsed ? 'h-10 justify-center' : 'h-11 px-2')}>
      <ModuleTile module={current} />
      {!collapsed && <>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-400">Módulo</span>
          <span className="block truncate text-[13px] font-semibold text-gray-900">{current.title}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      </>}
      {othersNews && <span className={cn('absolute h-1.5 w-1.5 rounded-full bg-violet-600', collapsed ? 'right-2 top-2' : 'right-7 top-2.5')} aria-label="Novidades em outro módulo" />}
    </button>
  )
}

/** Agentes: sempre à vista, com quantos trabalham (agentes dos projetos e trabalhos de copy e criativos) e quantos esperam. */
const AgentsItem: React.FC = () => {
  const connected = useAgents((s) => s.connected)
  const agents = useAgents((s) => s.agents)
  const now = useTick()
  const jobsRunning = useJobs((s) => s.jobs.filter((j) => j.status === 'running').length)
  const working = (connected ? agents.filter((a) => agentStatus(a, now) === 'working').length : 0) + jobsRunning
  const asking = agents.filter((a) => agentStatus(a, now) === 'question').length
  return (
    <Item to="/agentes" icon={Bot} label="Agentes de IA">
      {working > 0 && (
        <span className="flex items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold tabular-nums text-white" style={{ background: AGENT_COLOR }} title={`${working} trabalhando`}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
          {working}
        </span>
      )}
      {asking > 0 && (
        <span className="rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold tabular-nums text-white" title={`${asking} esperando você`}>
          {asking}
        </span>
      )}
    </Item>
  )
}

/** "+3": o que chegou desde a última vez que a pessoa abriu a tela. */
const NewBadge: React.FC<{ count: number; label: string }> = ({ count, label }) =>
  count > 0 ? (
    <span className="rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold tabular-nums text-white" title={label}>
      <span aria-hidden>+{count > 99 ? 99 : count}</span>
      <span className="sr-only">, {label}</span>
    </span>
  ) : null

const OportunidadesItem: React.FC<{ label?: string }> = ({ label = 'Leads' }) => {
  const count = useMenuBadges((s) => s.opportunities)
  return (
    <Item to="/crm" end icon={KanbanSquare} label={label}>
      <NewBadge count={count} label={plural(count, 'novidade no funil', 'novidades no funil')} />
    </Item>
  )
}

const InstagramItem: React.FC = () => {
  const count = useMenuBadges((s) => s.followers)
  return (
    <Item to="/crm/instagram" icon={Instagram} label="Perfil">
      <NewBadge count={count} label={plural(count, 'seguidor novo', 'seguidores novos')} />
    </Item>
  )
}

/** WhatsApp: mensagens não lidas (verde, como no próprio WhatsApp); some quando a conversa é aberta. */
const WhatsAppItem: React.FC<{ name?: string }> = ({ name = 'Conversas' }) => {
  const count = useMenuBadges((s) => s.whatsapp)
  const label = plural(count, 'mensagem não lida', 'mensagens não lidas')
  return (
    <Item to="/crm/whatsapp" icon={MessageCircle} label={name}>
      {count > 0 && (
        <span className="rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold tabular-nums text-white" title={`${count} ${label}`}>
          <span aria-hidden>{count > 99 ? '99+' : count}</span>
          <span className="sr-only">, {count} {label}</span>
        </span>
      )}
    </Item>
  )
}

/** Ao vivo: quantas pessoas estão agora no site e nos formulários (verde, pulsando). */
const AoVivoItem: React.FC = () => {
  const site = useMenuBadges((s) => s.live)
  const formsLink = useMenuBadges((s) => s.liveFormsLink)
  const live = site + formsLink
  const liveLabel = live === 1 ? '1 pessoa ao vivo agora' : `${live} pessoas ao vivo agora`
  return (
    <Item to="/crm/ao-vivo" icon={Radio} label="Ao vivo">
      {live > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold tabular-nums text-white" title={liveLabel}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
          <span aria-hidden>{live}</span>
          <span className="sr-only">, {liveLabel}</span>
        </span>
      )}
    </Item>
  )
}

/** Visitas (site e formulários): os contatos novos pelo site. */
const SiteItem: React.FC<{ label?: string }> = ({ label = 'Visitas' }) => {
  const contacts = useMenuBadges((s) => s.contacts)
  return (
    <Item to="/crm/site" icon={Globe} label={label}>
      <NewBadge count={contacts} label={plural(contacts, 'contato novo pelo site', 'contatos novos pelo site')} />
    </Item>
  )
}

/** As telas do módulo Criação (as abas de cada área contam como dela). */
const CRIACAO_PATHS = [...(['cerebro', 'pauta', 'sites', 'criativos'] as AreaId[]).flatMap(areaPaths), '/quadros', '/referencias', '/copy']

/**
 * Os módulos da conta, na ordem da jornada, o mesmo em todos os produtos. Os módulos ligados na conta
 * escondem telas; módulo sem tela ligada não aparece.
 */
const buildModules = (on: (id: ModuleId) => boolean, team: boolean, crm: boolean, platformAdmin: boolean, product: ProductId): MenuModule[] => {
  const list: MenuModule[] = [
    {
      id: 'criacao', title: 'Criação', hint: 'Cérebro, pauta, sites e criativos', icon: Palette, color: 'linear-gradient(160deg,#a78bfa,#7c3aed)', paths: CRIACAO_PATHS,
      items: [
        team && { to: '/cerebro', label: 'Cérebro', node: <Item to="/cerebro" icon={Brain} label="Cérebro" area="cerebro" /> },
        team && on('copy') && { to: '/pauta', label: 'Pauta', node: <Item to="/pauta" icon={CalendarRange} label="Pauta" area="pauta" /> },
        team && { to: '/quadros', label: 'Quadros', node: <Item to="/quadros" icon={Presentation} label="Quadros" /> },
        team && { to: '/referencias', label: 'Referências', node: <Item to="/referencias" icon={Bookmark} label="Referências" /> },
        // sem conta de empresa não há Pauta: os Textos continuam com caminho próprio
        !team && on('copy') && { to: '/copy', label: 'Textos', node: <Item to="/copy" icon={PenLine} label="Textos" /> },
        on('projetos') && { to: '/', label: 'Sites', node: <Item to="/" icon={LayoutTemplate} label="Sites" area="sites" /> },
        on('criativos') && { to: '/criativos', label: 'Criativos', node: <Item to="/criativos" icon={Images} label="Criativos" area="criativos" /> },
      ].filter(Boolean) as MenuModule['items'],
    },
    {
      id: 'vendas', title: 'Vendas', hint: 'Leads, conversas e clientes', icon: KanbanSquare, color: 'linear-gradient(160deg,#fb7185,#e11d48)', exact: ['/crm'], paths: ['/crm/whatsapp', '/crm/fluxos', '/crm/agenda', '/crm/formularios', '/crm/funis', '/crm/clientes', '/crm/social'], news: (b) => b.opportunities > 0 || b.whatsapp > 0,
      items: (crm ? [
        on('crm') && { to: '/crm', label: 'Leads', node: <OportunidadesItem /> },
        on('whatsapp') && { to: '/crm/whatsapp', label: 'Conversas', node: <WhatsAppItem /> },
        on('crm') && { to: '/crm/agenda', label: 'Agenda', node: <Item to="/crm/agenda" icon={CalendarDays} label="Agenda" /> },
        on('formularios') && { to: '/crm/formularios', label: 'Formulários', node: <Item to="/crm/formularios" icon={ListChecks} label="Formulários" /> },
        on('funis') && { to: '/crm/funis', label: 'Funis de venda', node: <Item to="/crm/funis" icon={Filter} label="Funis de venda" /> },
        on('clientes') && { to: '/crm/clientes', label: 'Clientes', node: <Item to="/crm/clientes" icon={Building2} label="Clientes" /> },
        on('social') && { to: '/crm/social', label: 'Relacionamento nas redes', node: <Item to="/crm/social" icon={Send} label="Relacionamento nas redes" /> },
      ] : []).filter(Boolean) as MenuModule['items'],
    },
    {
      id: 'prospeccao', title: 'Prospecção', hint: 'Buscar empresas e diagnóstico de site', icon: Radar, color: 'linear-gradient(160deg,#fcd34d,#d97706)', paths: ['/prospeccao', '/crm/diagnostico'],
      items: (crm ? [
        on('prospeccao') && { to: '/prospeccao', label: 'Buscar empresas', node: <Item to="/prospeccao" icon={Radar} label="Buscar empresas" /> },
        on('diagnostico') && { to: '/crm/diagnostico', label: 'Diagnóstico', node: <Item to="/crm/diagnostico" icon={ScanSearch} label="Diagnóstico" /> },
      ] : []).filter(Boolean) as MenuModule['items'],
    },
    {
      id: 'instagram', title: 'Instagram', hint: 'Perfil, posts, caixa, stories e anúncios', icon: Instagram, color: 'linear-gradient(160deg,#fb923c,#db2777 70%)', paths: ['/crm/instagram', '/crm/anuncios'], news: (b) => b.followers > 0,
      items: (crm ? [
        on('instagram') && { to: '/crm/instagram', label: 'Perfil', node: <InstagramItem /> },
        on('instagram') && { to: '/crm/anuncios', label: 'Anúncios', node: <Item to="/crm/anuncios" icon={Megaphone} label="Anúncios" /> },
      ] : []).filter(Boolean) as MenuModule['items'],
    },
    {
      id: 'resultados', title: 'Resultados', hint: 'Ao vivo, visitas (site e formulários) e operação', icon: Activity, color: 'linear-gradient(160deg,#60a5fa,#2563eb)', paths: ['/crm/ao-vivo', '/crm/site', '/crm/operacao'], news: (b) => b.live > 0 || b.liveFormsLink > 0 || b.contacts > 0,
      items: (crm ? [
        (on('site') || on('formularios')) && { to: '/crm/ao-vivo', label: 'Ao vivo', node: <AoVivoItem /> },
        on('site') && { to: '/crm/site', label: 'Visitas', node: <SiteItem /> },
        on('crm') && { to: '/crm/operacao', label: 'Operação', node: <Item to="/crm/operacao" icon={Activity} label="Operação" /> },
      ] : []).filter(Boolean) as MenuModule['items'],
    },
    {
      id: 'ia', title: 'IA e equipe', hint: 'Agentes, instruções de IA e equipe', icon: Bot, color: 'linear-gradient(160deg,#34d399,#059669)', paths: ['/agentes', '/skills', '/crm/equipe'],
      items: [
        on('agentes') && { to: '/agentes', label: 'Agentes de IA', node: <AgentsItem /> },
        on('skills') && { to: '/skills', label: 'Instruções de IA', node: <Item to="/skills" icon={Wand2} label="Instruções de IA" /> },
        crm && { to: '/crm/equipe', label: 'Equipe', node: <Item to="/crm/equipe" icon={Users} label="Equipe" /> },
      ].filter(Boolean) as MenuModule['items'],
    },
  ]
  if (platformAdmin) list.push({
    id: 'plataforma', title: 'Plataforma', hint: product !== 'completo' ? `Contas e módulos · produto: ${productInfo(product).label}` : 'Contas e módulos', icon: Building, color: 'linear-gradient(160deg,#94a3b8,#475569)', paths: ['/contas'],
    items: [{ to: '/contas', label: 'Contas e módulos', node: <Item to="/contas" icon={Building} label="Contas e módulos" /> }],
  })
  // A Visão geral abre o módulo (o usuário não quer cair direto numa tela, como o Cérebro em Criação)
  return list.filter((m) => m.items.length > 0).map((m) => m.items.length < 2 ? m : {
    ...m,
    paths: [...m.paths, moduleHomePath(m.id)],
    items: [{ to: moduleHomePath(m.id), label: 'Visão geral', node: <Item to={moduleHomePath(m.id)} end icon={LayoutDashboard} label="Visão geral" /> }, ...m.items],
  })
}

/** O menu: Início, o módulo atual (que abre a janela de módulos) e as telas dele; a busca mostra as telas de todos. */
const ModuleNav: React.FC<{ modules: MenuModule[]; crm: boolean; onNavigate?: () => void }> = ({ modules, crm, onNavigate }) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const query = useContext(NavigationQuery)
  const collapsed = useContext(Collapsed)
  const [stored, setStored] = useState(() => { try { return localStorage.getItem(STORED_MODULE) ?? '' } catch { return '' } })
  const [windowOpen, setWindowOpen] = useState(false)
  const fromRoute = modules.find((m) => inArea(pathname, m.paths) || !!m.exact?.includes(pathname))
  const current = fromRoute ?? modules.find((m) => m.id === stored) ?? modules[0]
  const othersNews = useMenuBadges((b) => modules.some((m) => m.id !== current?.id && hasNews(m, b)))
  useEffect(() => {
    if (!fromRoute) return
    setStored(fromRoute.id)
    try { localStorage.setItem(STORED_MODULE, fromRoute.id) } catch { /* sem armazenamento */ }
  }, [fromRoute])
  const pick = (m: MenuModule) => {
    setWindowOpen(false)
    setStored(m.id)
    try { localStorage.setItem(STORED_MODULE, m.id) } catch { /* sem armazenamento */ }
    navigate(m.items[0].to)
    onNavigate?.()
  }
  return (
    <>
      {crm && (
        <div className="mb-3">
          <Item to="/inicio" icon={House} label="Início" />
        </div>
      )}
      {query ? (
        modules.map((m) => (
          <div key={m.id} className="se-sidebar-section mt-4 first:mt-0">
            <p className="mb-1 px-2.5 py-0.5 text-xs font-medium text-gray-400">{m.title}</p>
            <div className="grid gap-px">{m.items.map((i) => <React.Fragment key={i.to + i.label}>{i.node}</React.Fragment>)}</div>
          </div>
        ))
      ) : current && (
        <>
          <ModuleSwitcher current={current} othersNews={othersNews} onOpen={() => setWindowOpen(true)} />
          <div className={cn('grid gap-px', collapsed ? 'mt-1' : 'mt-1.5')}>
            {current.items.map((i) => <React.Fragment key={i.to + i.label}>{i.node}</React.Fragment>)}
          </div>
          {!collapsed && modules.length > 1 && (
            <button type="button" onClick={() => setWindowOpen(true)} className="mt-4 flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-gray-500 transition-colors hover:bg-black/[.045] hover:text-gray-900">
              <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
              Todos os módulos
            </button>
          )}
        </>
      )}
      <ModulesWindow modules={modules} current={current} open={windowOpen} onOpenChange={setWindowOpen} onPick={pick} />
    </>
  )
}

const SidebarContent: React.FC<{ onClose?: () => void; collapsed?: boolean; onToggleCollapsed?: () => void }> = ({ onClose, collapsed = false, onToggleCollapsed }) => {
  const { user, profile, signOut } = useAuth()
  const { teams, team } = useCrm()
  const [query, setQuery] = useState('')
  const platformAdmin = profile?.role === 'admin'
  const crm = teams.length > 0 || platformAdmin
  // Módulos ligados na conta aberta (a Avence liga e desliga em Contas)
  const on = (id: ModuleId) => moduleOn(team, id)
  // O produto só aparece como nota para o admin; o menu é o mesmo (os módulos é que escondem itens)
  const product: ProductId = team?.product ?? 'completo'
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `on` lê só `team`
  const modules = useMemo(() => buildModules(on, teams.length > 0, crm, platformAdmin, product), [team, teams.length, crm, platformAdmin, product])
  // A Visão geral de cada módulo lê daqui o que mostrar
  useEffect(() => {
    useMenuModules.setState({ modules: modules.map(({ id, title, hint, icon, color, items }) => ({ id, title, hint, icon, color, items: items.filter((i) => !i.to.startsWith('/modulo/')).map(({ to, label }) => ({ to, label })) })) })
  }, [modules])

  return (
    <>
      <div className="se-sidebar-brand flex h-16 shrink-0 items-center justify-between px-4">
        {collapsed && onToggleCollapsed ? (
          <button type="button" onClick={onToggleCollapsed} aria-label="Expandir menu" title="Expandir menu" className="se-collapse-toggle group relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100">
            <span className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"><Logo /></span>
            <PanelLeftOpen className="absolute h-4 w-4 text-gray-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
          </button>
        ) : <>
        <Link to={crm ? '/inicio' : '/'} aria-label={crm ? 'Início' : 'Sites'} className="transition-opacity hover:opacity-80">
          <SinfyLogo />
        </Link>
        {onToggleCollapsed && (
          <button type="button" onClick={onToggleCollapsed} aria-label="Recolher menu" title="Recolher menu" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        </>}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar menu" className="-mr-1 flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="shrink-0 px-3 pt-3">
        <AccountSwitcher inline={!!onClose} compact={collapsed} onPicked={onClose} />
      </div>

      {!collapsed && <label className="se-nav-search mx-3 mt-3 flex items-center gap-2 rounded-xl px-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
        <input type="search" aria-label="Encontrar uma área" placeholder="Encontrar uma área" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-gray-500" />
      </label>}
      <Collapsed.Provider value={collapsed}>
      <NavigationQuery.Provider value={collapsed ? '' : query}>
      <nav aria-label="Navegação" className="se-navigation flex-1 overflow-y-auto px-3 py-4">
        <ModuleNav modules={modules} crm={crm} onNavigate={onClose} />
        <p className="se-nav-no-results px-2.5 py-6 text-xs leading-relaxed text-gray-500" role="status">Nenhuma área encontrada. Tente outro nome.</p>
      </nav>
      </NavigationQuery.Provider>
      </Collapsed.Provider>

      <div className="se-sidebar-user shrink-0 space-y-2 px-3 py-3">
        {user && team && (on('site') || on('formularios')) && <LiveNowItem collapsed={collapsed} to="/crm/ao-vivo" onNavigate={onClose} />}
        {user && team && (
          <button
            type="button"
            onClick={() => { onClose?.(); useMcpConnect.getState().show() }}
            title="Conectar sua IA (Claude, ChatGPT, Cursor) a esta conta"
            aria-label={collapsed ? 'Conectar sua IA' : undefined}
            className={cn('flex h-8 w-full items-center gap-2.5 rounded-lg text-[13px] text-gray-600 transition-colors hover:bg-black/[.045] hover:text-gray-900', collapsed ? 'justify-center' : 'px-2.5')}
          >
            <Sparkles className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            {!collapsed && 'Conectar sua IA'}
          </button>
        )}
        {user && (
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            <NavLink
              to="/perfil"
              onClick={onClose}
              title="Meu perfil e configurações"
              aria-label={collapsed ? 'Meu perfil e configurações' : undefined}
              className={({ isActive }) => cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100', isActive && 'bg-gray-100')}
            >
              <PersonAvatar name={profile?.name ?? user.email ?? '?'} url={profile?.avatarUrl} size={32} />
              {!collapsed && <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-xs font-medium text-gray-900">{profile?.name ?? user.email}</span>
                <span className="block truncate text-[11px] text-gray-500">{user.email ?? profile?.email}</span>
              </span>}
            </NavLink>
            <button type="button" onClick={() => void signOut()} aria-label="Sair da conta" title="Sair" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Ao vivo (2026-11-14, o usuário: "um item acima do Conectar sua IA… vai dizer logo de cara e em qualquer tela
 * quantas pessoas estão no forms ou site ao vivo"). Soma o site (atividade nos últimos 5 min) e o formulário aberto
 * pelo link (sinal no último minuto); o formulário dentro do site já está na conta do site. Leva à tela
 * Ao vivo (`/crm/ao-vivo`).
 */
const LiveNowItem: React.FC<{ collapsed: boolean; to: string; onNavigate?: () => void }> = ({ collapsed, to, onNavigate }) => {
  const site = useMenuBadges((s) => s.live)
  const forms = useMenuBadges((s) => s.liveForms)
  const formsLink = useMenuBadges((s) => s.liveFormsLink)
  const total = site + formsLink
  const detail = `${site} no site · ${forms} no formulário${forms > formsLink ? ` (${forms - formsLink} dentro do site)` : ''}`
  const label = total === 0 ? 'Ninguém ao vivo agora' : `${plural(total, 'pessoa', 'pessoas')} ao vivo agora: ${detail}`
  return (
    <Link
      to={to}
      onClick={onNavigate}
      title={label}
      aria-label={label}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg transition-colors',
        collapsed ? 'h-8 justify-center' : 'min-h-[40px] px-2.5 py-1.5',
        total > 0 ? 'bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-600/15 hover:bg-emerald-100' : 'text-gray-500 hover:bg-black/[.045] hover:text-gray-900'
      )}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        {total > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', total > 0 ? 'bg-emerald-500' : 'bg-gray-300')} />
      </span>
      {collapsed ? (
        total > 0 && <span aria-hidden className="text-[11px] font-semibold tabular-nums">{total}</span>
      ) : (
        <span aria-hidden className="min-w-0 flex-1 leading-tight">
          <span className="block text-[13px] font-medium">{total === 0 ? 'Ninguém ao vivo' : `${total} ao vivo agora`}</span>
          <span className={cn('block truncate text-[11px]', total > 0 ? 'text-emerald-700' : 'text-gray-400')}>
            {site} no site · {forms} no formulário
          </span>
        </span>
      )}
    </Link>
  )
}

export const AppSidebar: React.FC<{ open: boolean; onClose: () => void; collapsed?: boolean; onToggleCollapsed?: () => void }> = ({ open, onClose, collapsed = false, onToggleCollapsed }) => {
  const { user } = useAuth()
  const load = useCrm((s) => s.load)
  // As equipes de quem entrou: decidem se o CRM aparece no menu
  useEffect(() => {
    if (user) void load(user.id)
  }, [user, load])
  // Os avisos ao lado dos nomes (seguidores, quem está no site, contatos): uma busca só para os dois menus
  useMenuFeed()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <aside className={cn('se-sidebar fixed bottom-3 left-3 top-3 z-30 hidden flex-col transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex', collapsed ? 'se-sidebar-collapsed w-16' : 'w-60')}>
        <SidebarContent collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </aside>

      <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="se-drawer-scrim fixed inset-0 z-40 md:hidden" />
          <DialogPrimitive.Content className="se-sidebar se-sidebar-mobile fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col outline-none md:hidden">
            <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Escolha uma área do seu espaço de trabalho.</DialogPrimitive.Description>
            <SidebarContent onClose={onClose} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
