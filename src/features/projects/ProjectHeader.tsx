import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, NotebookText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectDialog } from './ProjectDialog'
import { useProject, useProjectStore } from './projectStore'

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
    </>
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
