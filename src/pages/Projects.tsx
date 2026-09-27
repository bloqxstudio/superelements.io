import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectCard } from '@/features/projects/ProjectCard'
import { ProjectDialog } from '@/features/projects/ProjectDialog'
import { importLegacySpace } from '@/features/projects/legacy'
import { useProjectStore } from '@/features/projects/projectStore'
import type { Project } from '@/features/projects/types'

const Projects: React.FC = () => {
  const navigate = useNavigate()
  const { projects, create, update, remove } = useProjectStore()
  // Sem projeto, o diálogo cria um novo; o projeto fica enquanto o diálogo fecha
  const [dialog, setDialog] = useState<{ open: boolean; project?: Project }>({ open: false })
  const [deleting, setDeleting] = useState<Project | null>(null)

  useEffect(() => {
    importLegacySpace()
  }, [])

  const sorted = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects])

  const submit = (fields: { name: string; context: string }) => {
    if (dialog.project) {
      update(dialog.project.id, fields)
      return
    }
    const project = create(fields)
    navigate(`/projetos/${project.id}`)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const { id, name } = deleting
    setDeleting(null)
    try {
      await remove(id)
      toast.success(`${name} excluído`)
    } catch {
      toast.error('O projeto saiu da lista, mas o conteúdo não pôde ser apagado do navegador')
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
          {sorted.length > 0 && (
            <Button onClick={() => setDialog({ open: true })} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo projeto
            </Button>
          )}
        </div>

        {sorted.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setDialog({ open: true, project })}
                onDelete={() => setDeleting(project)}
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

        <p className="mt-10 text-xs text-gray-400">Os projetos ficam salvos neste navegador.</p>
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
              O canvas, a marca e o contexto deste projeto são apagados deste navegador. Não dá para desfazer.
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
    </div>
  )
}

export default Projects
