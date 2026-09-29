import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert, CloudUpload, FolderPlus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectCard } from '@/features/projects/ProjectCard'
import { ProjectDialog } from '@/features/projects/ProjectDialog'
import { browserProjects, moveBrowserProjects } from '@/features/projects/browserImport'
import { pendingInvite } from '@/features/projects/access'
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
  const { projects, create, update, remove, leave } = useProjectStore()
  // Sem projeto, o diálogo cria um novo; o projeto fica enquanto o diálogo fecha
  const [dialog, setDialog] = useState<{ open: boolean; project?: Project }>({ open: false })
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [leaving, setLeaving] = useState<Project | null>(null)

  // Entrou (ou criou a conta) pelo link de um convite: volta para ele
  useEffect(() => {
    const invite = pendingInvite()
    if (invite) navigate(`/convite/${invite}`, { replace: true })
  }, [navigate])

  const sorted = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects])
  const ready = status === 'ready'

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
    <div className="min-h-[calc(100vh-57px)] bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Projetos</h1>
            <p className="mt-1 text-sm text-gray-500">
              Um projeto por cliente: a marca, o contexto e as páginas montadas no canvas.
            </p>
          </div>
          {ready && sorted.length > 0 && (
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
        ) : sorted.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setDialog({ open: true, project })}
                onDelete={() => setDeleting(project)}
                onLeave={() => setLeaving(project)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
              <FolderPlus className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-gray-900">Nenhum projeto ainda</h2>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Crie um projeto para cada cliente e monte as páginas dele no canvas, já com a marca aplicada.
            </p>
            <Button onClick={() => setDialog({ open: true })} className="mt-5 gap-1.5">
              <Plus className="h-4 w-4" />
              Criar projeto
            </Button>
          </div>
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
