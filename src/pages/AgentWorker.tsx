import React, { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useProject, useProjectList } from '@/features/projects/projectStore'
import { useProjectSession, whenClosed } from '@/features/projects/useProjectSession'
import { WORKER_REFRESH_EVENT } from '@/features/space/bridge/worker'

/**
 * Um projeto aberto em segundo plano para um agente: o mesmo conteúdo da conta
 * e o mesmo salvamento do Space, sem o canvas. Roda num iframe escondido que a
 * ponte do `npm run dev` cria dentro de uma aba do app (ver
 * `src/features/space/bridge/client.ts`), e responde aos pedidos do agente
 * daquele projeto enquanto a pessoa olha outra coisa.
 */
const AgentWorker: React.FC = () => {
  const { projectId } = useParams()
  const list = useProjectList()
  const project = useProject(projectId)
  // Ao fechar, o projeto sai daqui e o que faltava sobe para a conta
  const [released, setReleased] = useState(false)
  const { state } = useProjectSession(released ? undefined : project?.id)

  const failed =
    list === 'error'
      ? 'Não foi possível ler os projetos da conta'
      : (list === 'ready' && !project) || state === 'missing'
        ? 'Este projeto não está na conta, ou o acesso a ele foi removido'
        : state === 'error'
          ? 'O conteúdo do projeto não veio da conta'
          : undefined

  useEffect(() => {
    window.__spaceWorker = {
      failed,
      release: async () => {
        flushSync(() => setReleased(true))
        if (projectId) await whenClosed(projectId)
      },
    }
    window.dispatchEvent(new Event(WORKER_REFRESH_EVENT))
  }, [failed, projectId])

  return (
    <main className="p-4 text-sm text-gray-600">
      {project?.name ?? 'Projeto'} aberto em segundo plano para um agente ({released ? 'fechando' : failed ?? state}).
    </main>
  )
}

export default AgentWorker
