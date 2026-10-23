import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Download, FolderKanban, Images, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { formatById } from './knowledge'
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

export const SendDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const doc = useCopy((s) => s.doc)
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  const [dest, setDest] = useState<'criativos' | 'projetos'>('criativos')
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
  useEffect(() => {
    if (!doc) return
    setDest(formatById(doc.format).sendTo === 'projetos' ? 'projetos' : 'criativos')
    setProjectId((cur) => cur || doc.projectId || projects[0]?.id || '')
  }, [doc?.id, projects.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return null
  const text = docText(doc)

  const send = async () => {
    setBusy(true)
    try {
      await useCopy.getState().flush()
      if (dest === 'criativos') {
        const target = sets?.find((s) => s.id === setId)
        if (!target) throw new Error('Escolha um conjunto de criativos.')
        const r = await sendToCriativos(useCopy.getState().doc!, target)
        toast.success(`Post "${r.postName}" criado com ${r.slides} ${r.slides === 1 ? 'slide' : 'slides'} em ${target.name}.`, { action: { label: 'Abrir', onClick: () => (window.location.href = `/criativos/${target.id}${target.shared && target.projectId ? `?projeto=${target.projectId}` : ''}`) } })
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
          <DialogTitle>Enviar este texto</DialogTitle>
          <DialogDescription>O texto vai como está: ele não é reescrito no caminho.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium">
          {([['criativos', 'Post em Criativos', Images], ['projetos', 'Página em Projetos', FolderKanban]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setDest(id)} className={cn('flex h-8 items-center justify-center gap-1.5 rounded-md', dest === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {dest === 'criativos' ? (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">O agente (Claude Code desta máquina) escolhe o modelo de cada slide e distribui o texto. O post entra no conjunto que você escolher, e lá você edita o visual.</p>
            <select value={setId} onChange={(e) => setSetId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm" disabled={!sets?.length}>
              {sets === null && <option>Carregando…</option>}
              {sets?.length === 0 && <option value="">Nenhum conjunto de criativos ainda</option>}
              {sets?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.projectName ? ` · ${s.projectName}` : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">O texto vira {pages.length === 1 ? 'uma página nova' : `${pages.length} páginas novas`} no projeto, com seções nativas do Elementor (título, textos, cartões, lista, botão). A marca do projeto estiliza tudo ao abrir.</p>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Páginas: {pages.map((p) => `"Copy · ${p.name}"`).join(', ')}. Nada é publicado no WordPress.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success('Texto copiado.'))}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => download(text, `${(doc.title || 'copy').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`)}><Download className="h-4 w-4" /> .md</Button>
          </div>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="button" onClick={() => void send()} disabled={busy || (dest === 'criativos' ? !setId : !projectId)}>
              {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando…</> : 'Enviar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
