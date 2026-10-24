import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, FolderOpen, Microscope, Plus, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createInFolder, DERIVED, docLink, folderDocs, WRITE_FIRST } from './folder'
import { formatById } from './knowledge'
import { useCopy } from './store'
import type { CopySummary } from './types'

/** A pasta do assunto: os documentos irmãos (cada um com o seu destino) e a criação de novos a partir da pesquisa. */

const SEND_LABEL = { criativos: 'Criativos', projetos: 'Projetos' } as const

export const FolderPanel: React.FC = () => {
  const doc = useCopy((s) => s.doc)!
  const navigate = useNavigate()
  const [docs, setDocs] = useState<CopySummary[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const folderId = doc.folderId

  useEffect(() => {
    if (!folderId) return
    let live = true
    void folderDocs(folderId).then((d) => live && setDocs(d)).catch(() => live && setDocs([]))
    return () => {
      live = false
    }
  }, [folderId, doc.id, doc.title])

  const create = async () => {
    setBusy(true)
    try {
      await useCopy.getState().flush()
      const made = []
      for (const id of picked) {
        const d = DERIVED.find((x) => x.id === id)!
        made.push(await createInFolder({ base: useCopy.getState().doc!, format: d.format, objective: d.objective, title: `${d.label} · ${doc.folderName ?? doc.title}` }))
      }
      toast.success(`${made.length} documento${made.length > 1 ? 's criados' : ' criado'} na pasta.`)
      setPicked([])
      if (made.length === 1) navigate(docLink(made[0], { rodar: WRITE_FIRST }))
      else setDocs(await folderDocs(folderId!))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui criar os documentos.')
    } finally {
      setBusy(false)
    }
  }

  if (!folderId) return <p className="p-3 text-sm text-gray-500">Este documento não está numa pasta.</p>

  return (
    <div className="h-full space-y-4 overflow-y-auto p-3" data-scroll>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><FolderOpen className="h-4 w-4 text-violet-600" />{doc.folderName}</p>
        <p className="mt-0.5 text-xs text-gray-500">Tudo deste assunto fica aqui. Os agentes leem a pesquisa e os outros documentos da pasta antes de escrever, e cada documento é enviado para o seu lugar.</p>
      </div>

      <ul className="space-y-1.5">
        {(docs ?? []).map((d) => {
          const f = formatById(d.format)
          const here = d.id === doc.id
          const empty = d.words < 6
          return (
            <li key={d.id} className={cn('rounded-lg border p-2', here ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white')}>
              <Link to={docLink(d)} className="flex items-start gap-1.5 text-sm font-medium text-gray-900 hover:underline">
                {d.format === 'pesquisa' ? <Microscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" /> : <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />}
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
              </Link>
              <p className="mt-0.5 text-[11px] text-gray-500">{f.label}{f.sendTo ? ` → ${SEND_LABEL[f.sendTo]}` : ''} · {empty ? 'vazio' : `${d.words} palavras`}</p>
              {!here && (
                <div className="mt-1.5 flex gap-1">
                  {empty && <Button asChild size="sm" variant="outline" className="h-6 gap-1 bg-white px-2 text-[11px]"><Link to={docLink(d, { rodar: WRITE_FIRST })}><Sparkles className="h-3 w-3" /> Escrever</Link></Button>}
                  {f.sendTo && !empty && <Button asChild size="sm" variant="outline" className="h-6 gap-1 bg-white px-2 text-[11px]"><Link to={docLink(d, { enviar: true })}><Send className="h-3 w-3" /> Enviar</Link></Button>}
                </div>
              )}
            </li>
          )
        })}
        {docs === null && <li className="h-12 animate-pulse rounded-lg bg-gray-100" />}
      </ul>

      <div className="space-y-1.5 rounded-xl border border-dashed border-gray-300 p-2.5">
        <p className="text-xs font-semibold text-gray-800">Criar a partir {doc.format === 'pesquisa' ? 'desta pesquisa' : 'deste assunto'}</p>
        {DERIVED.map((d) => (
          <label key={d.id} className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className="mt-1" checked={picked.includes(d.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))} />
            <span>{d.label}<span className="block text-[11px] text-gray-500">{d.hint}</span></span>
          </label>
        ))}
        <Button size="sm" className="h-8 w-full gap-1.5" disabled={!picked.length || busy} onClick={() => void create()}><Plus className="h-4 w-4" />{busy ? 'Criando…' : picked.length > 1 ? `Criar ${picked.length} documentos` : 'Criar documento'}</Button>
        {picked.length > 1 && <p className="text-[11px] text-gray-500">Depois, abra cada um e peça ao agente em "Escrever".</p>}
      </div>
    </div>
  )
}
