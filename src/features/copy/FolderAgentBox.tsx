import React, { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAiAvailable } from '@/features/criativos/link'
import { JobFeed } from '@/features/operations/JobFeed'
import { stopJob, useJobs } from '@/features/operations/jobs'
import { runFolderRequest } from './folderAgent'
import { loadDoc } from './storage'
import type { CopyDoc, CopySummary } from './types'

/**
 * O pedido no nível da pasta: "5 posts sobre as dores, uma LP e um artigo".
 * O agente planeja os documentos, cria na pasta e escreve cada um em segundo
 * plano; o andamento aparece aqui logo após o clique.
 */

const EXAMPLES = ['Crie 5 posts de Instagram, um por dor da pesquisa', 'Escreva a copy da landing page e um artigo de blog', 'Faça 3 carrosséis e 2 e-mails de conversão']

export const FolderAgentBox: React.FC<{ folderId: string; docs: CopySummary[]; base?: CopyDoc; onDone?: () => void }> = ({ folderId, docs, base, onDone }) => {
  const available = useAiAvailable()
  const [text, setText] = useState('')
  const [starting, setStarting] = useState(false)
  const job = useJobs((s) => s.jobs.find((j) => j.kind === 'Pasta' && j.href === `/copy?pasta=${folderId}` && j.status === 'running'))

  const send = async () => {
    const request = text.trim()
    if (!request || starting || job) return
    setStarting(true)
    try {
      const first = docs[0]
      const doc = base ?? (first ? await loadDoc(first.id, first.shared ? first.projectId : undefined) : undefined)
      if (!doc) throw new Error('Crie ao menos um documento na pasta antes de pedir mais.')
      setText('')
      // Roda em segundo plano: o clique já mostra o andamento (o job aparece na hora)
      void runFolderRequest(doc, request).then(() => onDone?.()).catch(() => onDone?.())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui começar.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Sparkles className="h-4 w-4 text-violet-600" /> Peça à pasta</p>
      <p className="mt-0.5 text-xs text-gray-600">Descreva o que quer criar: posts, landing pages, sites, artigos, e-mails. O agente lê a pesquisa, cria os documentos aqui e escreve cada um. Pode sair da tela: ele continua.</p>
      {job ? (
        <div className="mt-2.5 space-y-2">
          <JobFeed job={job} lines={7} />
          <Button type="button" size="sm" variant="outline" className="h-7 bg-white" onClick={() => stopJob(job.id)}>Parar</Button>
        </div>
      ) : (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && void send()} rows={2} placeholder={EXAMPLES[0]} disabled={available !== true} className="mt-2 w-full resize-none rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm" />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {EXAMPLES.map((e) => (<button key={e} type="button" onClick={() => setText(e)} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">{e}</button>))}
            <Button type="button" size="sm" className="ml-auto h-8 gap-1.5" disabled={!text.trim() || starting || available !== true} onClick={() => void send()}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Criar documentos
            </Button>
          </div>
          {available === false && <p className="mt-1.5 text-xs text-amber-800">A IA não está conectada: abra o conector para pedir.</p>}
        </>
      )}
    </div>
  )
}
