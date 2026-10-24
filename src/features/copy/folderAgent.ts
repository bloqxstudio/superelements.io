import { toast } from 'sonner'
import { callAi } from '@/features/criativos/link'
import { useCreativeLink } from '@/features/criativos/link'
import { finishJob, noteJob, patchJob, startJob } from '@/features/operations/jobs'
import type { ChatAgentId } from '@/features/space/chat/protocol'
import { resolveIa } from '@/features/ia/porTarefa'
import { engineInfo } from './agentStore'
import { createInFolder, folderDocs, folderMaterial } from './folder'
import { formatById } from './knowledge'
import { runCopyAgent, useCopyChat, WRITE_REQUEST } from './runner'
import type { CopyDoc, FormatId } from './types'

/**
 * O agente da pasta: um pedido no nível da pasta ("5 posts, uma LP e um
 * artigo") vira vários documentos. O estrategista planeja a lista, cada
 * documento é criado na pasta e um agente escreve cada um, dois por vez. Tudo
 * roda em segundo plano (jobs): dá para sair da tela e acompanhar na tela
 * Agentes.
 */

interface Plan {
  reply: string
  docs: { format: string; title: string; angle: string }[]
}

/** O motor da Copy: o escolhido em Agentes (ou no painel do documento). */
export const pickEngine = (): ChatAgentId => resolveIa('copy')

export async function runFolderRequest(base: CopyDoc, request: string, engine: ChatAgentId = pickEngine()): Promise<number> {
  const folderId = base.folderId
  if (!folderId) throw new Error('Este documento não está numa pasta.')
  const controller = new AbortController()
  const jobId = startJob({ area: 'copy', kind: 'Pasta', label: base.folderName ?? base.title, agent: `Estrategista · ${engineInfo(engine).name}`, color: engineInfo(engine).color, href: `/copy?pasta=${folderId}`, step: 'Lendo a pasta' }, controller)
  let error: unknown
  let made = 0
  try {
    const [material, existing] = await Promise.all([folderMaterial(folderId), folderDocs(folderId)])
    noteJob(jobId, `Lendo ${material.length} documento${material.length === 1 ? '' : 's'} da pasta`)
    patchJob(jobId, { step: 'Planejando os documentos' })
    const plan = await callAi<Plan>(
      'copy-plan',
      { engine, folder: base.folderName ?? base.title, niche: base.niche, request, context: material.map((m) => `### ${m.kind}: ${m.label}\n${m.text}`).join('\n\n'), existing: existing.map((d) => ({ title: d.title, format: d.format })) },
      controller.signal,
      (_step, detail) => detail && noteJob(jobId, detail)
    )
    const items = (plan.docs ?? []).filter((d) => formatById(d.format).id === d.format).slice(0, 12)
    if (!items.length) throw new Error('O agente não definiu documentos para criar. Descreva melhor o que você quer.')
    noteJob(jobId, plan.reply || `${items.length} documentos planejados`)

    // Cria todos já (aparecem na pasta com "escrevendo") e depois escreve dois por vez
    const docs: CopyDoc[] = []
    for (const item of items) {
      const doc = await createInFolder({ base, format: item.format as FormatId, objective: item.angle, title: item.title })
      docs.push(doc)
      noteJob(jobId, `Criado: ${doc.title}`)
    }
    made = docs.length
    let next = 0
    let done = 0
    const worker = async () => {
      while (next < docs.length && !controller.signal.aborted) {
        const doc = docs[next++]
        const role = doc.format === 'pesquisa' ? 'pesquisador' : 'redator'
        const message = `${WRITE_REQUEST}\n\nÂngulo deste documento: ${doc.brief.objective}`
        useCopyChat.getState().ensure(doc.id)
        useCopyChat.getState().push(doc.id, { id: crypto.randomUUID(), role: 'user', text: message, note: `Pasta · ${base.folderName ?? ''}` })
        try {
          const r = await runCopyAgent({ message, role, engine }, controller.signal, doc)
          useCopyChat.getState().push(doc.id, { id: crypto.randomUUID(), role: 'ai', text: r.reply || 'Pronto.', changed: r.applied, ops: r.applied ? r.summary : undefined })
        } catch (err) {
          useCopyChat.getState().push(doc.id, { id: crypto.randomUUID(), role: 'ai', text: (err as Error).name === 'AbortError' ? 'Parei.' : err instanceof Error ? err.message : 'A IA não respondeu.', error: true })
          noteJob(jobId, `Falhou: ${doc.title}`)
        }
        done += 1
        patchJob(jobId, { step: `Escrevendo: ${done} de ${docs.length} prontos` })
      }
    }
    patchJob(jobId, { step: `Escrevendo: 0 de ${docs.length} prontos` })
    await Promise.all([worker(), worker()])
    toast.success(`${docs.length} documento${docs.length > 1 ? 's escritos' : ' escrito'} na pasta "${base.folderName ?? ''}".`, { action: { label: 'Abrir', onClick: () => (window.location.href = `/copy?pasta=${folderId}`) } })
    return made
  } catch (err) {
    error = err
    if ((err as Error).name !== 'AbortError') toast.error(err instanceof Error ? err.message : 'O agente da pasta não terminou.')
    throw err
  } finally {
    finishJob(jobId, error)
  }
}
