import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, Check, ChevronDown, Cloud, CloudDownload, CloudOff, CloudUpload, Copy, Globe, History, LayoutGrid, NotebookText, Play, Plus, Redo2, Trash2, TriangleAlert, Undo2, Users, AlignHorizontalSpaceAround } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/Logo'
import { UserAvatar } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import { ChatGPTConnectionDialog, hasChatGPT } from '@/features/chatgpt/ChatGPTConnectionDialog'
import { ProjectAccessDialog } from '@/features/projects/ProjectAccessDialog'
import { ProjectDialog } from '@/features/projects/ProjectDialog'
import { useProject, useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync, type SyncStatus } from '@/features/projects/useProjectSession'
import { WordPressDialog } from '@/features/wordpress/WordPressDialog'
import { useWordPressUi } from '@/features/wordpress/uiStore'
import { useActiveWordPress, useWordPressConnection } from '@/features/wordpress/useWordPressConnection'
import { useAgents } from '@/features/space/bridge/agentsStore'
import { useSpaceStore } from '@/store/spaceStore'
import { copyLandingToElementor } from './exportLanding'
import { MOD_KEY } from './pages/clipboard'
import { PresenceStack } from './presence/PresenceStack'
import { useProjectPresence } from './presence/presence'
import { Hint } from './ToolbarIsland'
import { HistoryDialog } from './history/HistoryDialog'
import { useSpaceUi } from './spaceUi'

const SYNC: Record<SyncStatus, { icon: typeof Cloud; label: string; className: string }> = {
  saved: { icon: Cloud, label: 'Salvo na conta', className: 'text-gray-400' },
  saving: { icon: CloudUpload, label: 'Salvando…', className: 'text-gray-400' },
  offline: { icon: CloudOff, label: 'Sem conexão · guardado neste navegador', className: 'text-amber-600' },
  conflict: { icon: TriangleAlert, label: 'Salvo em outro lugar · escolha a versão', className: 'text-amber-600' },
}

/** Botão quadrado da barra: só o ícone, o nome na dica. */
const BarButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; pressed?: boolean }>(
  ({ label, pressed, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35',
        pressed ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
BarButton.displayName = 'BarButton'

/** Logo com o menu do projeto, como o "Canvas ▾" do Framer: projeto, conexões e o canvas. */
const ProjectMenu: React.FC<{ projectId: string }> = ({ projectId }) => {
  const project = useProject(projectId)
  const update = useProjectStore((s) => s.update)
  const { connection, reload } = useWordPressConnection(projectId)
  const bridge = useAgents((s) => s.connected)
  const pageCount = useSpaceStore((s) => s.pages.length)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'context' | 'wordpress' | 'chatgpt' | 'history' | null>(null)
  if (!project) return null

  const clear = () => {
    if (confirm('Limpar o canvas? Todas as páginas, seções e conexões serão removidas; fica uma página Home vazia.')) useSpaceStore.getState().clearCanvas()
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg pl-1 pr-1.5 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Menu do projeto"
          >
            <Logo />
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-60 rounded-xl p-1">
          <DropdownMenuLabel className="truncate px-2 text-xs font-semibold text-gray-900">{project.name}</DropdownMenuLabel>
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => navigate('/')}>
            <LayoutGrid className="h-3.5 w-3.5" /> Todos os projetos
          </DropdownMenuItem>
          {bridge && (
            <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => navigate('/agentes')}>
              <Bot className="h-3.5 w-3.5" /> Agentes trabalhando
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => setDialog('context')}>
            <NotebookText className="h-3.5 w-3.5" /> Contexto do projeto…
            {!project.context.trim() && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gray-300" aria-label="(vazio)" />}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => setDialog('wordpress')}>
            <Globe className="h-3.5 w-3.5" />
            <span className="min-w-0 truncate">{connection ? `WordPress · ${connection.site.name}` : 'Conectar o WordPress…'}</span>
            {connection && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="(conectado)" />}
          </DropdownMenuItem>
          {connection && (
            <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => useWordPressUi.getState().openImport()}>
              <CloudDownload className="h-3.5 w-3.5" /> Importar páginas do site…
            </DropdownMenuItem>
          )}
          {hasChatGPT(project.name) && (
            <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => setDialog('chatgpt')}>
              <Bot className="h-3.5 w-3.5" /> ChatGPT…
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="(POC)" />
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => setDialog('history')}>
            <History className="h-3.5 w-3.5" /> Histórico e lixeira…
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" disabled={pageCount < 2} onSelect={() => useSpaceStore.getState().arrangePages()}>
            <AlignHorizontalSpaceAround className="h-3.5 w-3.5" /> Organizar as páginas lado a lado
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-lg text-xs text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={clear}>
            <Trash2 className="h-3.5 w-3.5" /> Limpar o canvas…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog open={dialog === 'context'} onOpenChange={(open) => !open && setDialog(null)} project={project} onSubmit={(fields) => update(project.id, fields)} />
      <WordPressDialog
        open={dialog === 'wordpress'}
        onOpenChange={(open) => !open && setDialog(null)}
        projectId={projectId}
        projectName={project.name}
        connection={connection}
        reload={reload}
      />
      <HistoryDialog projectId={projectId} open={dialog === 'history'} onOpenChange={(open) => !open && setDialog(null)} />
      {hasChatGPT(project.name) && <ChatGPTConnectionDialog open={dialog === 'chatgpt'} onOpenChange={(open) => !open && setDialog(null)} projectName={project.name} />}
    </>
  )
}

/** Nome do projeto no meio, com o estado do salvamento. */
const ProjectTitle: React.FC<{ projectId: string }> = ({ projectId }) => {
  const project = useProject(projectId)
  const sync = useProjectSync()
  const pageName = useSpaceStore((s) => s.pages.find((p) => p.id === s.activePageId)?.name)
  const status = sync.projectId === projectId ? SYNC[sync.status] : null
  const label = status && (sync.status === 'saved' && sync.note ? sync.note : status.label)
  const time = sync.status === 'saved' && sync.savedAt ? ` às ${new Date(sync.savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''
  const Icon = status?.icon
  return (
    <div className="flex min-w-0 items-center justify-center gap-2 text-[13px]">
      <span className="truncate font-semibold text-gray-900" aria-current="page">
        {project?.name}
      </span>
      {pageName && (
        <>
          <span aria-hidden className="text-gray-300">·</span>
          <span className="truncate text-gray-500">{pageName}</span>
        </>
      )}
      {Icon && (
        <span className={cn('flex shrink-0 items-center', status.className)} role="status" title={label + time}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">{label}</span>
        </span>
      )}
    </div>
  )
}

/** Publicar no site (com o WordPress) ou copiar para o Elementor; a outra opção fica no menu ao lado. */
const PublishButton: React.FC = () => {
  const activePage = useSpaceStore((s) => s.pages.find((p) => p.id === s.activePageId))
  const hasSections = !!activePage?.sectionIds.length
  const wordpress = useActiveWordPress()
  const linked = !!activePage?.wordpress && activePage.wordpress.siteUrl === wordpress?.site.siteUrl
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    if (!(await copyLandingToElementor())) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1800)
  }
  const publish = () => activePage && useWordPressUi.getState().openPublish(activePage.id)

  const main = wordpress
    ? { label: linked ? 'Atualizar' : 'Publicar', hint: `${activePage?.name ?? 'A página'} em ${wordpress.site.name}`, run: publish, icon: CloudUpload }
    : { label: copied ? 'Copiado' : 'Copiar', hint: `${activePage?.name ?? 'A página'} para colar no Elementor`, run: copy, icon: copied ? Check : Copy }
  const MainIcon = main.icon

  return (
    <div className="flex shrink-0 items-center">
      <Hint label={main.label} hint={main.hint}>
        <button
          type="button"
          onClick={main.run}
          disabled={!hasSections}
          className="inline-flex h-8 items-center gap-1.5 rounded-l-lg bg-primary pl-3 pr-2.5 text-[13px] font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
        >
          <MainIcon className="h-3.5 w-3.5" />
          {main.label}
        </button>
      </Hint>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Mais formas de levar a página"
            className="inline-flex h-8 w-7 items-center justify-center rounded-r-lg border-l border-black/10 bg-primary text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-60 rounded-xl p-1">
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" disabled={!hasSections} onSelect={() => void copy()}>
            <Copy className="h-3.5 w-3.5" /> Copiar para o Elementor
          </DropdownMenuItem>
          {wordpress && (
            <DropdownMenuItem className="gap-2 rounded-lg text-xs" disabled={!hasSections} onSelect={publish}>
              <CloudUpload className="h-3.5 w-3.5" /> {linked ? 'Atualizar no site…' : 'Publicar no site…'}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" disabled={!activePage} onSelect={() => activePage && useWordPressUi.getState().openDetails(activePage.id)}>
            <Globe className="h-3.5 w-3.5" /> Detalhes e SEO da página…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface SpaceTopBarProps {
  projectId: string
}

/**
 * A barra de cima do projeto, no desenho do Framer: menu e ferramentas à
 * esquerda, o projeto no meio, e à direita quem está nele, o player, o
 * convite e publicar.
 */
export const SpaceTopBar: React.FC<SpaceTopBarProps> = ({ projectId }) => {
  const insertOpen = useSpaceUi((s) => s.panels && s.left === 'library')
  const canUndo = useSpaceStore((s) => s.past.length > 0)
  const canRedo = useSpaceStore((s) => s.future.length > 0)
  const activePage = useSpaceStore((s) => s.pages.find((p) => p.id === s.activePageId))
  const presence = useProjectPresence()
  const project = useProject(projectId)
  const [sharing, setSharing] = useState(false)
  const { undo, redo, openPlayer } = useSpaceStore.getState()

  return (
    <header className="relative z-50 grid h-12 shrink-0 select-none grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-gray-200 bg-white px-2">
      <div className="flex min-w-0 items-center gap-0.5">
        <ProjectMenu projectId={projectId} />
        <div aria-hidden className="mx-1 h-5 w-px bg-gray-200" />
        <Hint label="Inserir" hint="Seções, modelos e elementos da Biblioteca">
          <BarButton label="Inserir" pressed={insertOpen} onClick={useSpaceUi.getState().toggleInsert}>
            <Plus className="h-4 w-4" />
          </BarButton>
        </Hint>
        <Hint label="Desfazer" hint={`${MOD_KEY}Z`}>
          <BarButton label="Desfazer" onClick={() => undo()} disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </BarButton>
        </Hint>
        <Hint label="Refazer" hint={`${MOD_KEY}Shift+Z`}>
          <BarButton label="Refazer" onClick={() => redo()} disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </BarButton>
        </Hint>
      </div>

      <ProjectTitle projectId={projectId} />

      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <PresenceStack presence={presence} max={4} size={26} className="mr-1" />
        <Hint label={`Player da página ${activePage?.name ?? ''}`.trim()} hint="Só esta página, com a marca e as animações, rolando como no site">
          <BarButton label="Player" onClick={() => activePage && openPlayer(activePage.id)} disabled={!activePage?.sectionIds.length}>
            <Play className="h-4 w-4 fill-current" />
          </BarButton>
        </Hint>
        {project && (
          <BarButton label={project.role !== 'editor' ? 'Compartilhar' : 'Pessoas'} onClick={() => setSharing(true)} className="px-2.5 text-gray-700" title={project.role !== 'editor' ? 'Convidar o cliente para editar junto' : 'Quem tem acesso a este projeto'}>
            <Users className="h-4 w-4 lg:hidden" />
            <span className="hidden lg:inline">{project.role !== 'editor' ? 'Compartilhar' : 'Pessoas'}</span>
          </BarButton>
        )}
        <PublishButton />
        <div className="ml-1">
          <UserAvatar />
        </div>
      </div>
      <ProjectAccessDialog open={sharing} onOpenChange={setSharing} projectId={projectId} />
      {/* Atalho para quem chega pelo link: os projetos ficam no menu do logo */}
      <Link to="/" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-14 focus:z-50 focus:rounded focus:bg-white focus:px-2 focus:py-1 focus:text-xs">
        Voltar aos projetos
      </Link>
    </header>
  )
}
