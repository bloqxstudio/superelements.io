import React, { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reloadProjects, useProject, useProjectList } from '@/features/projects/projectStore'
import { useProjectSession } from '@/features/projects/useProjectSession'
import { loadApprovals } from '@/features/approval/approvalStore'
import { ProjectOpening } from '@/features/projects/ProjectOpening'
import Space from '@/pages/Space'

const FULL_HEIGHT = { height: 'calc(100vh - 57px)' }

const Failure: React.FC<{ title: string; text: string; onRetry: () => void }> = ({ title, text, onRetry }) => (
  <div className="flex items-center justify-center bg-zinc-100 px-4" style={FULL_HEIGHT}>
    <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-600">{text}</p>
          <Button size="sm" className="mt-4" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      </div>
    </div>
  </div>
)

/** O canvas de um projeto: abre o conteúdo salvo na conta e mostra o Space. */
const ProjectSpace: React.FC = () => {
  const { projectId } = useParams()
  const list = useProjectList()
  const project = useProject(projectId)
  const { state, retry } = useProjectSession(project?.id)

  // Links de aprovação das páginas, para o selo no canvas; falhar aqui não impede abrir o projeto
  useEffect(() => {
    if (state === 'ready' && project?.id) void loadApprovals(project.id)
  }, [state, project?.id])

  if (list === 'error') {
    return (
      <Failure
        title="Não foi possível ler os projetos da conta"
        text="Confira a internet e tente de novo."
        onRetry={reloadProjects}
      />
    )
  }
  if (list !== 'loading' && (!project || state === 'missing')) return <Navigate to="/" replace />
  if (state === 'error') {
    // Sem o conteúdo, abrir um canvas vazio arriscaria salvar o vazio por cima
    return <Failure title="Não foi possível abrir o projeto" text="O conteúdo dele não veio da conta. Confira a internet e tente de novo." onRetry={retry} />
  }

  // O canvas monta por baixo da tela de abertura, que sai quando o que aparece na tela carregou
  return (
    <div className="relative" style={FULL_HEIGHT}>
      {project && state === 'ready' && <Space key={project.id} />}
      <ProjectOpening key={`abertura-${projectId}`} name={project?.name} ready={!!project && state === 'ready'} />
    </div>
  )
}

export default ProjectSpace
