import { useJobs } from '@/features/operations/jobs'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { navigationMatches } from '@/features/navigation/workspace'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { areaPaths, type AreaId } from '@/features/navigation/AreaTabs'
import { Activity, Bot, Brain, Building2, CalendarRange, Filter, House, Building, Globe, ListChecks, Images, Instagram, Megaphone, PenLine, Presentation, KanbanSquare, LayoutTemplate, LogOut, MessageCircle, Radar, ScanSearch, Send, Users, Wand2, Workflow, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { PersonAvatar } from '@/features/profile/PersonAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { AccountSwitcher } from '@/features/crm/AccountSwitcher'
import { useCrm } from '@/features/crm/crmStore'
import { moduleOn, productInfo, type ModuleId, type ProductId } from '@/features/crm/modules'
import { useMenuBadges, useMenuFeed } from '@/features/crm/menuBadges'
import { plural } from '@/features/crm/ui'
import { AGENT_COLOR } from '@/features/agents/agentStatus'
import { useTick } from '@/features/agents/useTick'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'

/**
 * Menu lateral das telas da conta. Desde 2026-11-09 (nova jornada de criação, aprovada pelo usuário:
 * "Sites e projetos é a mesma coisa", "cérebro deve vir primeiro", "Pauta, conteúdo e texto é meio que
 * a mesma coisa") é um menu só para os três produtos, na ordem da jornada: o grupo Criação (Cérebro
 * primeiro, depois Pauta, Quadros, Sites e Criativos), Vendas e Resultados. Os módulos da conta só
 * escondem itens; não mudam a ordem nem os nomes. Telas irmãs viram abas no topo da área
 * (`AreaTabs`). Dentro de um projeto o Space ocupa a tela e o menu some.
 * Plano: cerebro/iniciativas/superelements/jornada-de-criacao.md.
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

/**
 * Um grupo do menu. `rail`: o grupo Criação, com os ícones em círculos (o Cérebro primeiro, porque é o
 * contexto de tudo; os outros não são um passo a passo).
 */
const Section: React.FC<{ title: string; rail?: boolean; children: React.ReactNode }> = ({ title, rail, children }) => {
  const key = `superelements-menu-grupo:${title}`
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) !== '0' } catch { return true } })
  const query = useContext(NavigationQuery)
  const collapsed = useContext(Collapsed)
  // Recolhido não há como abrir o grupo: mostra todos, separados por uma linha
  const shown = open || !!query || collapsed
  const toggle = () => setOpen((v) => { try { localStorage.setItem(key, v ? '0' : '1') } catch { /* sem armazenamento */ } return !v })
  return (
    <div className="se-sidebar-section mt-5 first:mt-0">
      {collapsed ? <div className="se-section-rule" role="separator" aria-label={title} /> : <button type="button" onClick={toggle} aria-expanded={shown} className="se-section-toggle group mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-0.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-700">
        {title}<ChevronDown className={cn('h-3 w-3 opacity-0 transition-[opacity,transform] group-hover:opacity-100 group-focus-visible:opacity-100', !shown && '-rotate-90 opacity-100')} aria-hidden />
      </button>}
      {shown && <div className={cn('grid gap-px', rail && 'se-nav-rail')}>{children}</div>}
    </div>
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
    <Item to="/crm/instagram" icon={Instagram} label="Instagram">
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

/** Visitas do site: quem está no site agora (verde, pulsando) e os contatos novos. */
const SiteItem: React.FC<{ label?: string }> = ({ label = 'Visitas do site' }) => {
  const live = useMenuBadges((s) => s.live)
  const contacts = useMenuBadges((s) => s.contacts)
  const liveLabel = live === 1 ? '1 pessoa no site agora' : `${live} pessoas no site agora`
  return (
    <Item to="/crm/site" icon={Globe} label={label}>
      {live > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold tabular-nums text-white" title={liveLabel}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
          <span aria-hidden>{live}</span>
          <span className="sr-only">, {liveLabel}</span>
        </span>
      )}
      <NewBadge count={contacts} label={plural(contacts, 'contato novo pelo site', 'contatos novos pelo site')} />
    </Item>
  )
}

/** O menu da jornada, o mesmo em todos os produtos. */
const JourneyNav: React.FC<{ on: (id: ModuleId) => boolean; teams: number; crm: boolean }> = ({ on, teams, crm }) => {
  const team = teams > 0
  const criar = on('projetos') || on('criativos')
  const vender = crm && (on('crm') || on('whatsapp') || on('formularios') || on('funis') || on('clientes') || on('social') || on('prospeccao') || on('diagnostico'))
  const resultados = crm && (on('instagram') || on('site') || on('crm'))
  return (
    <>
      {crm && (
        <div className="mb-4">
          <Item to="/inicio" icon={House} label="Início" />
        </div>
      )}
      {(team || criar || on('copy')) && (
        <Section title="Criação" rail>
          {team && <Item to="/cerebro" icon={Brain} label="Cérebro" area="cerebro" />}
          {team && on('copy') && <Item to="/pauta" icon={CalendarRange} label="Pauta" area="pauta" />}
          {team && <Item to="/quadros" icon={Presentation} label="Quadros" />}
          {/* sem conta de empresa não há Pauta: os Textos continuam com caminho próprio */}
          {!team && on('copy') && <Item to="/copy" icon={PenLine} label="Textos" />}
          {on('projetos') && <Item to="/" icon={LayoutTemplate} label="Sites" area="sites" />}
          {on('criativos') && <Item to="/criativos" icon={Images} label="Criativos" area="criativos" />}
        </Section>
      )}
      {vender && (
        <Section title="Vendas">
          {on('crm') && <OportunidadesItem />}
          {on('whatsapp') && <WhatsAppItem />}
          {on('whatsapp') && <Item to="/crm/fluxos" icon={Workflow} label="Automações" />}
          {on('formularios') && <Item to="/crm/formularios" icon={ListChecks} label="Formulários" />}
          {on('funis') && <Item to="/crm/funis" icon={Filter} label="Funis de venda" />}
          {on('clientes') && <Item to="/crm/clientes" icon={Building2} label="Clientes" />}
          {on('social') && <Item to="/crm/social" icon={Send} label="Relacionamento nas redes" />}
          {on('prospeccao') && <Item to="/prospeccao" icon={Radar} label="Prospecção" />}
          {on('diagnostico') && <Item to="/crm/diagnostico" icon={ScanSearch} label="Diagnóstico" />}
        </Section>
      )}
      {resultados && (
        <Section title="Resultados">
          {on('instagram') && <InstagramItem />}
          {on('instagram') && <Item to="/crm/anuncios" icon={Megaphone} label="Anúncios" />}
          {on('site') && <SiteItem />}
          {on('crm') && <Item to="/crm/operacao" icon={Activity} label="Operação" />}
        </Section>
      )}
      {(on('agentes') || on('skills') || crm) && (
        <Section title="IA e equipe">
          {on('agentes') && <AgentsItem />}
          {on('skills') && <Item to="/skills" icon={Wand2} label="Instruções de IA" />}
          {crm && <Item to="/crm/equipe" icon={Users} label="Equipe" />}
        </Section>
      )}
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
          <Logo />
        </Link>
        {onToggleCollapsed && (
          <button type="button" onClick={onToggleCollapsed} aria-label="Recolher menu" title="Recolher menu" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        </>}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar menu" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
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
        <JourneyNav on={on} teams={teams.length} crm={crm} />
        {platformAdmin && (
          <Section title="Plataforma">
            {product !== 'completo' && <p className="px-2.5 pb-1 text-[11px] text-gray-400">Produto desta conta: {productInfo(product).label}</p>}
            <Item to="/contas" icon={Building} label="Contas e módulos" />
          </Section>
        )}
        <p className="se-nav-no-results px-2.5 py-6 text-xs leading-relaxed text-gray-500" role="status">Nenhuma área encontrada. Tente outro nome.</p>
      </nav>
      </NavigationQuery.Provider>
      </Collapsed.Provider>

      <div className="se-sidebar-user shrink-0 space-y-2 px-3 py-3">
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
