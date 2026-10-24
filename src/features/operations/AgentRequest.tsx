import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { escapeHtml } from '@/features/copy/html'
import { FORMATS, formatById, NICHES } from '@/features/copy/knowledge'
import { docLink } from '@/features/copy/folder'
import { runFolderRequest, pickEngine } from '@/features/copy/folderAgent'
import { runCopyAgent, useCopyChat } from '@/features/copy/runner'
import { postsFromRequest } from '@/features/copy/send'
import { listDocs, loadDoc, saveDoc } from '@/features/copy/storage'
import { block, EMPTY_BRIEF, uid, type CopyDoc, type CopySummary, type FormatId } from '@/features/copy/types'
import { useAiAvailable } from '@/features/criativos/link'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import type { CopyAgentId } from '@/features/copy/agents'
import type { Area } from './jobs'

/**
 * Pedir direto ao agente, de dentro do escritório: clicou na pessoa, escreveu o
 * que quer e ela vai para a mesa. O pedido vira um documento novo (ou entra num
 * que já existe) escrito por aquele papel, posts em Criativos ou, para o
 * estrategista, vários documentos numa pasta. Roda em segundo plano.
 */

const input = 'h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm'

interface Who {
  area: Area
  role: string
  name: string
}

const COPY_ROLE: Record<string, { id: CopyAgentId; format: FormatId; web?: boolean }> = {
  Pesquisador: { id: 'pesquisador', format: 'pesquisa', web: true },
  Redator: { id: 'redator', format: 'post-instagram' },
  Editor: { id: 'editor', format: 'post-instagram' },
  Estrategista: { id: 'estrategista', format: 'campanha' },
  'Redator de LP': { id: 'redator', format: 'lp' },
  Construtor: { id: 'redator', format: 'site' },
}

const GROUP_FORMATS = FORMATS.filter((f) => f.id !== 'pesquisa' || true)

export const AgentRequest: React.FC<{ who: Who; compact?: boolean }> = ({ who, compact }) => {
  const [opts, setOpts] = useState(false)
  const available = useAiAvailable()
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  const projectIds = projects.map((p) => p.id).join(',')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [docs, setDocs] = useState<CopySummary[]>([])
  const [sets, setSets] = useState<SetSummary[]>([])
  const [target, setTarget] = useState('novo')
  const [format, setFormat] = useState<FormatId>(COPY_ROLE[who.role]?.format ?? 'post-instagram')
  const [folder, setFolder] = useState('')
  const [niche, setNiche] = useState('')
  const [setId, setSetId] = useState('')
  const [count, setCount] = useState(3)
  const isPosts = who.area === 'criativos'

  useEffect(() => {
    setFormat(COPY_ROLE[who.role]?.format ?? 'post-instagram')
    setTarget('novo')
    setText('')
  }, [who.role, who.name])
  useEffect(() => {
    const ids = projectIds ? projectIds.split(',') : []
    if (isPosts) void listSets(ids).then((s) => { setSets(s); setSetId((c) => c || s[0]?.id || '') }).catch(() => setSets([]))
    else void listDocs(ids).then(setDocs).catch(() => setDocs([]))
  }, [isPosts, projectIds])

  const folders = [...new Map(docs.filter((d) => d.folderId).map((d) => [d.folderId!, d.folderName ?? 'Pasta'])).entries()]

  const send = async () => {
    const request = text.trim()
    if (!request || busy) return
    setBusy(true)
    try {
      if (isPosts) {
        const set = sets.find((s) => s.id === setId)
        if (!set) throw new Error('Escolha um conjunto de criativos.')
        setText('')
        void postsFromRequest(request, set, count)
          .then((r) => toast.success(`${r.postNames.length} post${r.postNames.length > 1 ? 's criados' : ' criado'} em ${set.name}.`, { action: { label: 'Abrir', onClick: () => (window.location.href = `/criativos/${set.id}${set.shared && set.projectId ? `?projeto=${set.projectId}` : ''}`) } }))
          .catch((err) => (err as Error).name !== 'AbortError' && toast.error(err instanceof Error ? err.message : 'Não consegui criar os posts.'))
        return
      }
      const cfg = COPY_ROLE[who.role]
      if (!cfg) throw new Error('Este agente ainda não recebe pedidos.')
      const engine = pickEngine()
      let doc: CopyDoc | undefined
      if (target !== 'novo') {
        const s = docs.find((d) => d.id === target)
        doc = s ? await loadDoc(s.id, s.shared ? s.projectId : undefined) : undefined
        if (!doc) throw new Error('Não abri o documento.')
      } else {
        const spec = formatById(format)
        const inFolder = folders.find(([id]) => id === folder)
        const now = Date.now()
        doc = {
          id: uid(),
          title: `${spec.label} · ${request.slice(0, 50)}`,
          format,
          niche: niche || undefined,
          folderId: inFolder?.[0],
          folderName: inFolder?.[1],
          brief: { ...EMPTY_BRIEF, notes: format === 'pesquisa' ? request : '', objective: format === 'pesquisa' ? 'Mapear dores, desejos, objeções, clientes, jornada, campanhas e posts de referência para criar conteúdo' : '' },
          blocks: spec.skeleton.map((b) => block(b.type, escapeHtml(b.text ?? ''), b.label)),
          comments: [],
          createdAt: now,
          updatedAt: now,
        }
        await saveDoc(doc)
      }
      const created = doc
      setText('')
      // O estrategista com uma pasta escolhida planeja vários documentos
      if (who.role === 'Estrategista' && created.folderId) {
        void runFolderRequest(created, request, engine).catch(() => undefined)
        toast.success('O estrategista foi planejar a pasta.', { action: { label: 'Abrir pasta', onClick: () => (window.location.href = `/copy?pasta=${created.folderId}`) } })
        return
      }
      useCopyChat.getState().ensure(created.id)
      useCopyChat.getState().push(created.id, { id: crypto.randomUUID(), role: 'user', text: request, note: `${who.name} · pedido pelo escritório` })
      void runCopyAgent({ message: request, role: cfg.id, engine, web: cfg.web }, undefined, created)
        .then((r) => useCopyChat.getState().push(created.id, { id: crypto.randomUUID(), role: 'ai', text: r.reply || 'Pronto.', changed: r.applied, ops: r.applied ? r.summary : undefined }))
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return
          useCopyChat.getState().push(created.id, { id: crypto.randomUUID(), role: 'ai', text: err instanceof Error ? err.message : 'A IA não respondeu.', error: true })
          toast.error(`${who.name} não conseguiu terminar: ${err instanceof Error ? err.message : 'a IA não respondeu'}`)
        })
      toast.success(`${who.name} foi para a mesa.`, { action: { label: 'Abrir', onClick: () => (window.location.href = docLink(created)) } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar o pedido.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-2 border-t border-gray-100 pt-3'}>
      {!compact && <p className="text-xs font-semibold text-gray-900">Peça algo a {who.name}</p>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && void send()} rows={2} disabled={available !== true} placeholder={isPosts ? 'Ex.: 3 carrosséis sobre por que o Instagram não substitui um site' : who.role === 'Pesquisador' ? 'Ex.: como donos de clínica odontológica escolhem quem faz o site' : who.role === 'Estrategista' ? 'Ex.: 5 posts, uma LP e um artigo sobre as dores da pesquisa' : 'Ex.: escreva um post sobre site rápido para arquitetos'} className="w-full resize-none rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm" />
      {compact && <button type="button" onClick={() => setOpts((o) => !o)} aria-expanded={opts} className="text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline">{opts ? 'Esconder opções' : `Onde vai: ${isPosts ? sets.find((x) => x.id === setId)?.name ?? 'conjunto' : target === 'novo' ? `${formatById(format).label}, documento novo` : 'documento existente'} · mudar`}</button>}
      {(!compact || opts) && (isPosts ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_88px]">
          <select aria-label="Conjunto de criativos" value={setId} onChange={(e) => setSetId(e.target.value)} className={input} disabled={!sets.length}>
            {sets.length === 0 && <option value="">Nenhum conjunto de criativos</option>}
            {sets.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.projectName ? ` · ${s.projectName}` : ''}</option>))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">Posts<input type="number" min={1} max={6} value={count} onChange={(e) => setCount(Math.min(6, Math.max(1, Number(e.target.value) || 1)))} className="h-9 w-14 rounded-md border border-gray-200 px-1.5 text-sm" /></label>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="Onde" value={target} onChange={(e) => setTarget(e.target.value)} className={input}>
            <option value="novo">Em um documento novo</option>
            {docs.slice(0, 20).map((d) => (<option key={d.id} value={d.id}>{d.title}</option>))}
          </select>
          {target === 'novo' && (
            <>
              <select aria-label="Formato" value={format} onChange={(e) => setFormat(e.target.value as FormatId)} className={input}>
                {GROUP_FORMATS.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
              </select>
              <select aria-label="Pasta" value={folder} onChange={(e) => setFolder(e.target.value)} className={input}>
                <option value="">Sem pasta</option>
                {folders.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
              </select>
              <select aria-label="Nicho" value={niche} onChange={(e) => setNiche(e.target.value)} className={input}>
                <option value="">Sem nicho</option>
                {NICHES.map((n) => (<option key={n.id} value={n.id}>{n.label}</option>))}
              </select>
            </>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        {available === false && <span className="text-xs text-amber-800">A IA não está conectada: veja o conector acima.</span>}
        {who.role === 'Estrategista' && target === 'novo' && !folder && <span className="text-xs text-gray-500">Escolha uma pasta para ele planejar vários documentos.</span>}
        <Button type="button" size="sm" className="ml-auto h-8 gap-1.5" disabled={!text.trim() || busy || available !== true} onClick={() => void send()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Pedir
        </Button>
      </div>
      {!compact && <p className="text-[11px] text-gray-500">Roda em segundo plano: {who.name} vai para a mesa e você acompanha aqui. <Link to="/copy" className="underline">Abrir a Copy</Link></p>}
    </div>
  )
}
