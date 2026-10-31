import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, CircleAlert, CloudUpload, FolderPlus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectCard } from '@/features/projects/ProjectCard'
import { ProjectDialog } from '@/features/projects/ProjectDialog'
import { browserProjects, moveBrowserProjects } from '@/features/projects/browserImport'
import { pendingInvite } from '@/features/projects/access'
import { pendingTeamInvite } from '@/features/crm/teams'
import { reloadProjects, useProjectList, useProjectStore } from '@/features/projects/projectStore'
import type { Project } from '@/features/projects/types'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Projetos que só este navegador tem, com o botão para levar para a conta. */
const BrowserProjectsBanner: React.FC = () => {
  const [waiting, setWaiting] = useState(() => browserProjects())
  const [moving, setMoving] = useState(false)
  if (!waiting.length) return null

  const move = async () => {
    setMoving(true)
    try {
      const { moved, failed } = await moveBrowserProjects()
      reloadProjects()
      if (moved) {
        toast.success(`${plural(moved, 'projeto foi', 'projetos foram')} para a sua conta`, {
          description: 'A cópia deste navegador continua guardada aqui, por segurança.',
        })
      }
      if (failed) toast.error(`${plural(failed, 'projeto não subiu', 'projetos não subiram')}`, { description: 'Confira a internet e tente de novo.' })
    } catch (error) {
      toast.error('Não foi possível levar os projetos', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setMoving(false)
      setWaiting(browserProjects())
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">
          Este navegador tem {plural(waiting.length, 'projeto que ainda não está', 'projetos que ainda não estão')} na sua conta
        </p>
        <p className="mt-0.5 truncate text-sm text-gray-600">{waiting.map((p) => p.name).join(', ')}</p>
      </div>
      <Button size="sm" onClick={move} disabled={moving} className="gap-1.5">
        <CloudUpload className="h-4 w-4" />
        {moving ? 'Levando…' : 'Levar para a conta'}
      </Button>
    </div>
  )
}

const Projects: React.FC = () => {
  const navigate = useNavigate()
  // Voltar à lista relê da conta: outro aparelho pode ter mudado
  const status = useProjectList({ refresh: true })
  const { projects, create, update, remove, leave, archive } = useProjectStore()
  // Sem projeto, o diálogo cria um novo; o projeto fica enquanto o diálogo fecha
  const [dialog, setDialog] = useState<{ open: boolean; project?: Project }>({ open: false })
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [leaving, setLeaving] = useState<Project | null>(null)

  // Entrou (ou criou a conta) pelo link de um convite, de projeto ou da equipe do CRM: volta para ele
  useEffect(() => {
    const invite = pendingInvite()
    if (invite) return navigate(`/convite/${invite}`, { replace: true })
    const team = pendingTeamInvite()
    if (team) navigate(`/equipe/convite/${team}`, { replace: true })
  }, [navigate])

  const sorted = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects])
  // A conta admin também vê os projetos das outras contas (migração 20261006180000): ficam numa parte separada
  const active = useMemo(() => sorted.filter((p) => !p.archivedAt), [sorted])
  const mine = useMemo(() => active.filter((p) => p.role !== 'admin'), [active])
  const others = useMemo(() => active.filter((p) => p.role === 'admin'), [active])
  const archived = useMemo(() => sorted.filter((p) => p.archivedAt), [sorted])
  const [showArchived, setShowArchived] = useState(false)
  const ready = status === 'ready'
  const card = (project: Project) => (
    <ProjectCard
      key={project.id}
      project={project}
      onEdit={() => setDialog({ open: true, project })}
      onArchive={() => toggleArchive(project)}
      onDelete={() => setDeleting(project)}
      onLeave={() => setLeaving(project)}
    />
  )

  const toggleArchive = async (project: Project) => {
    const archiving = !project.archivedAt
    try {
      await archive(project.id, archiving)
      toast.success(archiving ? `${project.name} arquivado` : `${project.name} voltou para a lista`)
    } catch (error) {
      console.error('[projetos] falha ao arquivar', error)
      toast.error(`Não foi possível ${archiving ? 'arquivar' : 'desarquivar'} ${project.name}`, { description: 'Confira a internet e tente de novo.' })
    }
  }

  const submit = async (fields: { name: string; context: string }) => {
    if (dialog.project) {
      await update(dialog.project.id, fields)
      return
    }
    try {
      const project = await create(fields)
      navigate(`/projetos/${project.id}`)
    } catch (error) {
      console.error('[projetos] falha ao criar', error)
      toast.error('Não foi possível criar o projeto', { description: 'Confira a internet e tente de novo.' })
      throw error
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const { id, name } = deleting
    setDeleting(null)
    try {
      await remove(id)
      toast.success(`${name} excluído`)
    } catch (error) {
      console.error('[projetos] falha ao excluir', error)
      toast.error(`Não foi possível excluir ${name}`, { description: 'Confira a internet e tente de novo.' })
    }
  }

  const confirmLeave = async () => {
    if (!leaving) return
    const { id, name } = leaving
    setLeaving(null)
    try {
      await leave(id)
      toast.success(`Você saiu de ${name}`)
    } catch (error) {
      console.error('[projetos] falha ao sair', error)
      toast.error(`Não foi possível sair de ${name}`, { description: 'Confira a internet e tente de novo.' })
    }
  }

  return (
    <div className="se-page min-h-[calc(100vh-57px)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Projetos</h1>
            <p className="mt-1 text-sm text-gray-500">
              Um projeto por cliente: a marca, o contexto e as páginas montadas no canvas.
            </p>
          </div>
          {ready && mine.length > 0 && (
            <Button onClick={() => setDialog({ open: true })} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo projeto
            </Button>
          )}
        </div>

        {ready && <BrowserProjectsBanner />}

        {status === 'loading' ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Carregando projetos">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" />
            ))}
          </div>
        ) : status === 'error' ? (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center" role="alert">
            <CircleAlert className="h-5 w-5 text-destructive" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold text-gray-900">Não foi possível ler os projetos da conta</h2>
            <p className="mt-1 max-w-sm text-sm text-gray-500">Confira a internet e tente de novo.</p>
            <Button onClick={reloadProjects} className="mt-5">
              Tentar de novo
            </Button>
          </div>
        ) : mine.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mine.map(card)}</div>
        ) : (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
              <FolderPlus className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-gray-900">Nenhum projeto ainda</h2>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Organize as páginas e a identidade de cada cliente em um projeto. Comece criando o primeiro.
            </p>
            <Button onClick={() => setDialog({ open: true })} className="mt-5 gap-1.5">
              <Plus className="h-4 w-4" />
              Criar projeto
            </Button>
          </div>
        )}

        {ready && others.length > 0 && (
          <section className="mt-12" aria-labelledby="projetos-outras-contas">
            <h2 id="projetos-outras-contas" className="text-sm font-semibold text-gray-900">
              De outras contas
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-gray-500">
              Você vê e edita estes projetos porque é admin, como os que a equipe cria pela Prospecção. Publicar, conectar o WordPress e convidar pessoas continuam com quem criou.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{others.map(card)}</div>
          </section>
        )}

        {ready && archived.length > 0 && (
          <section className="mt-12" aria-labelledby="projetos-arquivados">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Archive className="h-4 w-4 text-gray-500" aria-hidden />
              <span id="projetos-arquivados">Arquivados ({archived.length})</span>
              <span className="text-xs font-normal text-gray-500">{showArchived ? 'esconder' : 'mostrar'}</span>
            </button>
            {showArchived && <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{archived.map(card)}</div>}
          </section>
        )}

        <p className="mt-10 text-xs text-gray-400">Os projetos ficam salvos na sua conta e abrem em qualquer navegador em que você entrar.</p>
      </div>

      <ProjectDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        project={dialog.project}
        onSubmit={submit}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {deleting?.name}?</DialogTitle>
            <DialogDescription>
              O canvas, a marca, o contexto e a conexão com o WordPress deste projeto são apagados da sua conta, e quem você convidou perde o acesso. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!leaving} onOpenChange={(open) => !open && setLeaving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sair de {leaving?.name}?</DialogTitle>
            <DialogDescription>
              O projeto continua com quem te convidou; você só deixa de ver e editar. Para voltar, precisa de um convite novo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaving(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              Sair do projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Projects
