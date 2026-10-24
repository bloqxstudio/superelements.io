import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, Download, FolderKanban, FolderOpen, Images, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { folderDocs } from './folder'
import { formatById } from './knowledge'
import { loadDoc } from './storage'
import type { CopyDoc, CopySummary } from './types'
import { docText, pagesOf, sendToCriativos, sendToProject } from './send'
import { useCopy } from './store'

/** Enviar o texto para onde ele serve (Criativos ou Projetos), ou levá-lo para fora (copiar, baixar). */

const download = (text: string, name: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const SendDialog: React.FC<{ open: boolean; onClose: () => void; initial?: 'pasta' }> = ({ open, onClose, initial }) => {
  const doc = useCopy((s) => s.doc)
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  const [dest, setDest] = useState<'criativos' | 'projetos' | 'pasta'>('criativos')
  const [count, setCount] = useState(3)
  const [items, setItems] = useState<(CopySummary & { on: boolean; state?: 'run' | 'ok' | 'err'; note?: string })[]>([])
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  const [setId, setSetId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [busy, setBusy] = useState(false)

  const ids = projects.map((p) => p.id).join(',')
  useEffect(() => {
    if (!open) return
    void listSets(ids ? ids.split(',') : [])
      .then((s) => {
        setSets(s)
        setSetId((cur) => cur || s[0]?.id || '')
      })
      .catch(() => setSets([]))
  }, [open, ids])
  const folderId = doc?.folderId
  useEffect(() => {
    if (!open || !folderId) return
    void folderDocs(folderId).then((all) => {
      const list = all.filter((d) => d.words > 5 && (formatById(d.format).sendTo || d.format === 'pesquisa'))
      const hasPosts = list.some((d) => d.format !== 'pesquisa' && formatById(d.format).sendTo === 'criativos')
      setItems(list.map((d) => ({ ...d, on: d.format === 'pesquisa' ? !hasPosts : true })))
    }).catch(() => setItems([]))
  }, [open, folderId])
  useEffect(() => {
    if (!doc) return
    setDest(initial === 'pasta' && doc.folderId ? 'pasta' : formatById(doc.format).sendTo === 'projetos' ? 'projetos' : 'criativos')
    setProjectId((cur) => cur || doc.projectId || projects[0]?.id || '')
  }, [doc?.id, projects.length, initial, open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return null
  const text = docText(doc)

  const send = async () => {
    setBusy(true)
    try {
      await useCopy.getState().flush()
      if (dest === 'pasta') {
        const chosen = items.filter((i) => i.on)
        if (!chosen.length) throw new Error('Marque ao menos um documento.')
        const needSet = chosen.some((i) => formatById(i.format).sendTo !== 'projetos')
        const target = sets?.find((x) => x.id === setId)
        if (needSet && !target) throw new Error('Escolha um conjunto de criativos.')
        if (chosen.some((i) => formatById(i.format).sendTo === 'projetos') && !projectId) throw new Error('Escolha um projeto.')
        let ok = 0
        for (const item of chosen) {
          setItems((l) => l.map((x) => (x.id === item.id ? { ...x, state: 'run', note: undefined } : x)))
          try {
            const full: CopyDoc | undefined = item.id === useCopy.getState().doc?.id ? useCopy.getState().doc : await loadDoc(item.id, item.shared ? item.projectId : undefined)
            if (!full) throw new Error('Não abri o documento.')
            const toProject = formatById(item.format).sendTo === 'projetos'
            const note = toProject ? `${(await sendToProject(full, projectId)).pages.length} página(s) em Projetos` : (await sendToCriativos(full, target!, undefined, count)).postNames.length + ' post(s) em Criativos'
            ok += 1
            setItems((l) => l.map((x) => (x.id === item.id ? { ...x, state: 'ok', note } : x)))
          } catch (err) {
            setItems((l) => l.map((x) => (x.id === item.id ? { ...x, state: 'err', note: err instanceof Error ? err.message : 'Falhou' } : x)))
          }
        }
        if (ok === chosen.length) toast.success(`${ok} documento${ok > 1 ? 's enviados' : ' enviado'} para o lugar de cada um.`)
        else toast.error(`${ok} de ${chosen.length} enviados. Veja o que falhou na lista.`)
        return
      }
      if (dest === 'criativos') {
        const target = sets?.find((s) => s.id === setId)
        if (!target) throw new Error('Escolha um conjunto de criativos.')
        const r = await sendToCriativos(useCopy.getState().doc!, target, undefined, count)
        toast.success(`${r.postNames.length > 1 ? `${r.postNames.length} posts criados` : `Post "${r.postName}" criado`} com ${r.slides} ${r.slides === 1 ? 'slide' : 'slides'} em ${target.name}.`, { action: { label: 'Abrir', onClick: () => (window.location.href = `/criativos/${target.id}${target.shared && target.projectId ? `?projeto=${target.projectId}` : ''}`) } })
      } else {
        if (!projectId) throw new Error('Escolha um projeto.')
        const r = await sendToProject(useCopy.getState().doc!, projectId)
        toast.success(`${r.pages.length === 1 ? 'Página criada' : 'Páginas criadas'} no projeto: ${r.pages.join(', ')} (${r.sections} seções).`, { action: { label: 'Abrir projeto', onClick: () => (window.location.href = `/projetos/${projectId}`) } })
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar.')
    } finally {
      setBusy(false)
    }
  }

  const pages = pagesOf(doc)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dest === 'pasta' ? 'Enviar a pasta' : 'Enviar este texto'}</DialogTitle>
          <DialogDescription>{doc.format === 'pesquisa' ? 'Uma pesquisa vira posts; os outros textos vão como estão, sem reescrever.' : 'O texto vai como está: ele não é reescrito no caminho.'}</DialogDescription>
        </DialogHeader>
        <div className={cn('grid gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium', folderId ? 'grid-cols-3' : 'grid-cols-2')}>
          {([...(folderId ? [{ id: 'pasta' as const, label: 'Pasta toda', Icon: FolderOpen }] : []), { id: 'criativos' as const, label: 'Criativos', Icon: Images }, { id: 'projetos' as const, label: 'Projetos', Icon: FolderKanban }]).map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setDest(id)} className={cn('flex h-8 items-center justify-center gap-1.5 rounded-md', dest === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {dest === 'pasta' && (
          <div className="space-y-2.5 text-sm">
            <p className="text-gray-600">Cada documento da pasta vai para o seu lugar: posts e carrosséis para Criativos, landing page e site para Projetos. A pesquisa vira posts (um ângulo em cada).</p>
            <ul className="space-y-1">
              {items.length === 0 && <li className="text-xs text-gray-500">Nenhum documento escrito na pasta ainda.</li>}
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-2 rounded-md border border-gray-200 px-2 py-1.5">
                  <input type="checkbox" className="mt-1" checked={i.on} disabled={busy} onChange={(e) => setItems((l) => l.map((x) => (x.id === i.id ? { ...x, on: e.target.checked } : x)))} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-gray-900">{i.title}</span>
                    <span className="block text-[11px] text-gray-500">{i.format === 'pesquisa' ? `Pesquisa → ${count} posts em Criativos` : `${formatById(i.format).label} → ${formatById(i.format).sendTo === 'projetos' ? 'Projetos' : 'Criativos'}`}{i.note ? ` · ${i.note}` : ''}</span>
                  </span>
                  {i.state === 'run' && <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-violet-600" />}
                  {i.state === 'ok' && <Check className="mt-0.5 h-4 w-4 text-emerald-600" />}
                  {i.state === 'err' && <X className="mt-0.5 h-4 w-4 text-red-600" />}
                </li>
              ))}
            </ul>
            {items.some((i) => i.on && formatById(i.format).sendTo !== 'projetos') && (
              <select value={setId} onChange={(e) => setSetId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm" disabled={!sets?.length} aria-label="Conjunto de criativos">
                {sets?.length === 0 && <option value="">Nenhum conjunto de criativos ainda</option>}
                {sets?.map((x) => (<option key={x.id} value={x.id}>{x.name}{x.projectName ? ` · ${x.projectName}` : ''}</option>))}
              </select>
            )}
            {items.some((i) => i.on && formatById(i.format).sendTo === 'projetos') && (
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm" aria-label="Projeto da página">
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            )}
            {items.some((i) => i.on && i.format === 'pesquisa') && (
              <label className="flex items-center gap-2 text-xs text-gray-700">Posts da pesquisa
                <input type="number" min={1} max={6} value={count} onChange={(e) => setCount(Math.min(6, Math.max(1, Number(e.target.value) || 1)))} className="h-7 w-14 rounded-md border border-gray-200 px-1.5 text-sm" />
              </label>
            )}
          </div>
        )}

        {dest === 'criativos' ? (
          <div className="space-y-2 text-sm">
            {doc.format === 'pesquisa' ? (
              <p className="text-gray-600">O agente lê a pesquisa e cria posts (carrosséis) prontos em Criativos, um ângulo diferente em cada, com legenda. Você edita o visual lá.</p>
            ) : (
              <p className="text-gray-600">O agente (Claude Code desta máquina) escolhe o modelo de cada slide e distribui o texto. O post entra no conjunto que você escolher, e lá você edita o visual.</p>
            )}
            {doc.format === 'pesquisa' && (
              <label className="flex items-center gap-2 text-xs text-gray-700">Quantos posts
                <input type="number" min={1} max={6} value={count} onChange={(e) => setCount(Math.min(6, Math.max(1, Number(e.target.value) || 1)))} className="h-7 w-14 rounded-md border border-gray-200 px-1.5 text-sm" />
              </label>
            )}
            <select value={setId} onChange={(e) => setSetId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm" disabled={!sets?.length}>
              {sets === null && <option>Carregando…</option>}
              {sets?.length === 0 && <option value="">Nenhum conjunto de criativos ainda</option>}
              {sets?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.projectName ? ` · ${s.projectName}` : ''}</option>
              ))}
            </select>
          </div>
        ) : dest === 'projetos' ? (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">O texto vira {pages.length === 1 ? 'uma página nova' : `${pages.length} páginas novas`} no projeto, com seções nativas do Elementor (título, textos, cartões, lista, botão). A marca do projeto estiliza tudo ao abrir.</p>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Páginas: {pages.map((p) => `"Copy · ${p.name}"`).join(', ')}. Nada é publicado no WordPress.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success('Texto copiado.'))}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => download(text, `${(doc.title || 'copy').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`)}><Download className="h-4 w-4" /> .md</Button>
          </div>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="button" onClick={() => void send()} disabled={busy || (dest === 'pasta' ? !items.some((i) => i.on) : dest === 'criativos' ? !setId : !projectId)}>
              {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando…</> : 'Enviar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
