import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Cloud, CloudOff, CloudUpload, NotebookText, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectDialog } from './ProjectDialog'
import { useProject, useProjectStore } from './projectStore'
import { useProjectSync, type SyncStatus } from './useProjectSession'

/** "Projetos / Nome do projeto" no header, dentro de um projeto. */
export const ProjectBreadcrumb: React.FC<{ projectId: string }> = ({ projectId }) => {
  const project = useProject(projectId)
  return (
    <>
      <Link to="/" className="shrink-0 text-sm text-gray-500 transition-colors hover:text-gray-900">
        Projetos
      </Link>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden />
      <span className="truncate text-sm font-semibold text-gray-900" aria-current="page">
        {project?.name}
      </span>
      <ProjectSaveStatus projectId={projectId} />
    </>
  )
}

const SYNC: Record<SyncStatus, { icon: typeof Cloud; label: string; className: string }> = {
  saved: { icon: Cloud, label: 'Salvo na conta', className: 'text-gray-400' },
  saving: { icon: CloudUpload, label: 'Salvando…', className: 'text-gray-400' },
  offline: { icon: CloudOff, label: 'Sem conexão · guardado neste navegador', className: 'text-amber-600' },
  conflict: { icon: TriangleAlert, label: 'Salvo em outro lugar · escolha a versão', className: 'text-amber-600' },
}

/** Se o que está no canvas já chegou à conta. */
const ProjectSaveStatus: React.FC<{ projectId: string }> = ({ projectId }) => {
  const sync = useProjectSync()
  if (sync.projectId !== projectId) return null
  const { icon: Icon, className } = SYNC[sync.status]
  const label = sync.status === 'saved' && sync.note ? sync.note : SYNC[sync.status].label
  const time =
    sync.status === 'saved' && sync.savedAt
      ? ` às ${new Date(sync.savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : ''
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-xs ${className}`} role="status" title={label + time}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {/* No celular fica só o ícone; o texto continua para leitor de tela */}
      <span className="sr-only md:not-sr-only">{label}</span>
    </span>
  )
}

/** Abre nome e contexto do projeto aberto. */
export const ProjectContextButton: React.FC<{ projectId: string }> = ({ projectId }) => {
  const project = useProject(projectId)
  const update = useProjectStore((s) => s.update)
  const [open, setOpen] = useState(false)
  if (!project) return null

  return (
    <>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-gray-600" onClick={() => setOpen(true)}>
        <NotebookText className="h-4 w-4" />
        Contexto
        {!project.context.trim() && <span className="h-1.5 w-1.5 rounded-full bg-gray-300" aria-label="(vazio)" />}
      </Button>
      <ProjectDialog open={open} onOpenChange={setOpen} project={project} onSubmit={(fields) => update(project.id, fields)} />
    </>
  )
}
