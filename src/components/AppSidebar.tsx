import { useJobs } from '@/features/operations/jobs'
import React, { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Bot, Building2, FolderKanban, Globe, Images, Instagram, PenLine, KanbanSquare, LogOut, MessageCircle, Radar, ScanSearch, Send, Users, Wand2, Workflow, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/features/crm/crmStore'
import { useMenuBadges, useMenuFeed } from '@/features/crm/menuBadges'
import { plural } from '@/features/crm/ui'
import { AGENT_COLOR } from '@/features/agents/agentStatus'
import { useTick } from '@/features/agents/useTick'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'

/**
 * Menu lateral das telas da conta, com as duas frentes do produto: Produção
 * (os projetos no Space, os agentes e as skills) e CRM (oportunidades,
 * clientes, prospecção e a equipe). O CRM aparece para quem é de uma equipe e
 * para o admin da plataforma, que cria a primeira. Dentro de um projeto o
 * Space ocupa a tela e o menu some.
 */

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  )

const Item: React.FC<{ to: string; icon: React.ElementType; label: string; end?: boolean; children?: React.ReactNode }> = ({ to, icon: Icon, label, end, children }) => (
  <NavLink to={to} end={end} className={itemClass}>
    <Icon className="h-4 w-4 shrink-0" aria-hidden />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {children}
  </NavLink>
)

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-5 first:mt-0">
    <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
    <div className="grid gap-0.5">{children}</div>
  </div>
)

/** Agentes: sempre à vista, com quantos trabalham (agentes dos projetos e trabalhos de copy e criativos) e quantos esperam. */
const AgentsItem: React.FC = () => {
  const connected = useAgents((s) => s.connected)
  const agents = useAgents((s) => s.agents)
  const now = useTick()
  const jobsRunning = useJobs((s) => s.jobs.filter((j) => j.status === 'running').length)
  const working = (connected ? agents.filter((a) => agentStatus(a, now) === 'working').length : 0) + jobsRunning
  const asking = agents.filter((a) => agentStatus(a, now) === 'question').length
  return (
    <Item to="/agentes" icon={Bot} label="Agentes">
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

const OportunidadesItem: React.FC = () => {
  const count = useMenuBadges((s) => s.opportunities)
  return (
    <Item to="/crm" end icon={KanbanSquare} label="Oportunidades">
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

/** Site: quem está no site agora (verde, pulsando) e os contatos novos. */
const SiteItem: React.FC = () => {
  const live = useMenuBadges((s) => s.live)
  const contacts = useMenuBadges((s) => s.contacts)
  const liveLabel = live === 1 ? '1 pessoa no site agora' : `${live} pessoas no site agora`
  return (
    <Item to="/crm/site" icon={Globe} label="Site">
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

const TeamSwitch: React.FC = () => {
  const { teams, team, select } = useCrm()
  if (!team) return null
  if (teams.length < 2) return <p className="truncate px-2.5 text-xs text-gray-500">Equipe {team.name}</p>
  return (
    <label className="block px-2.5">
      <span className="sr-only">Equipe aberta no CRM</span>
      <select value={team.id} onChange={(e) => void select(e.target.value)} className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700">
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            Equipe {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}

const SidebarContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user, profile, signOut } = useAuth()
  const { teams, status } = useCrm()
  const crm = teams.length > 0 || profile?.role === 'admin'

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <Link to="/" aria-label="Projetos" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar menu" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav aria-label="Navegação" className="flex-1 overflow-y-auto px-3 py-4">
        <Section title="Produção">
          <Item to="/" end icon={FolderKanban} label="Projetos" />
          <AgentsItem />
          <Item to="/copy" icon={PenLine} label="Copy" />
          <Item to="/criativos" icon={Images} label="Criativos" />
          <Item to="/skills" icon={Wand2} label="Skills" />
        </Section>
        {crm && (
          <Section title="CRM">
            <OportunidadesItem />
            <Item to="/crm/whatsapp" icon={MessageCircle} label="WhatsApp" />
            <Item to="/crm/fluxos" icon={Workflow} label="Fluxos" />
            <Item to="/crm/clientes" icon={Building2} label="Clientes" />
            <Item to="/crm/social" icon={Send} label="Social" />
            <InstagramItem />
            <SiteItem />
            <Item to="/prospeccao" icon={Radar} label="Prospecção" />
            <Item to="/crm/diagnostico" icon={ScanSearch} label="Diagnóstico" />
            <Item to="/crm/equipe" icon={Users} label="Equipe" />
          </Section>
        )}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-gray-100 px-3 py-3">
        {status === 'ready' && <TeamSwitch />}
        {user && (
          <div className="flex items-center gap-2 px-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white" aria-hidden>
              {(profile?.email ?? user.email ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-gray-600" title={profile?.email ?? user.email ?? ''}>
              {profile?.email ?? user.email}
            </span>
            <button type="button" onClick={() => void signOut()} aria-label="Sair da conta" title="Sair" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export const AppSidebar: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-gray-200 bg-white md:flex">
        <SidebarContent />
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-[transform,visibility] duration-200 motion-reduce:transition-none md:hidden',
          // Fechado fica invisível: fora da ordem do Tab e dos leitores de tela
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        )}
      >
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  )
}
