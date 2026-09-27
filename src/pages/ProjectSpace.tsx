import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useProject } from '@/features/projects/projectStore'
import { useProjectSession } from '@/features/projects/useProjectSession'
import Space from '@/pages/Space'

/** O canvas de um projeto: abre o conteúdo salvo dele e mostra o Space. */
const ProjectSpace: React.FC = () => {
  const { projectId } = useParams()
  const project = useProject(projectId)
  const ready = useProjectSession(project?.id)

  if (!project) return <Navigate to="/" replace />

  if (!ready) {
    return (
      <div className="flex items-center justify-center bg-zinc-100" style={{ height: 'calc(100vh - 57px)' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" aria-label="Abrindo projeto" />
      </div>
    )
  }

  return <Space key={project.id} />
}

export default ProjectSpace
