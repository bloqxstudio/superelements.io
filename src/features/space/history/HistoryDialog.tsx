import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArchiveRestore, History, Loader2, RotateCcw, ScrollText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { listVersions, type ProjectVersion } from '@/features/projects/storage'
import { displayName } from '@/features/space/presence/presence'
import { cn } from '@/lib/utils'
import { TRASH_ACTIONS, listEvents, restoreFromTrash, restoreVersion, type ActivityEvent } from './activity'

type Tab = 'activity' | 'trash' | 'versions'

/** O que cada ação diz na lista: "excluiu a página", seguido do alvo. */
const ACTION_TEXT: Record<string, string> = {
  'project.deleted': 'excluiu o projeto',
  'project.renamed': 'renomeou o projeto',
  'project.context': 'alterou o contexto do projeto',
  'member.joined': 'entrou no projeto',
  'member.left': 'saiu do projeto',
  'member.removed': 'tirou do projeto',
  'invite.created': 'criou um convite',
  'invite.canceled': 'cancelou um convite',
  'wordpress.connected': 'conectou o WordPress',
  'wordpress.updated': 'trocou a conexão do WordPress',
  'wordpress.disconnected': 'desconectou o WordPress',
  'approval.created': 'criou o link de aprovação de',
  'approval.deleted': 'apagou o link de aprovação de',
  'page.deleted': 'excluiu a página',
  'section.deleted': 'excluiu a seção',
  'canvas.cleared': 'limpou o canvas',
  'page.restored': 'restaurou a página',
  'section.restored': 'restaurou a seção',
  'canvas.restored': 'restaurou o canvas',
  'version.restored': 'voltou o projeto para a versão de',
  'publish.page': 'publicou no site',
  'publish.restored': 'desfez a última publicação de',
}

/** Ações que tiram ou mudam algo de forma grave: ficam marcadas em vermelho. */
const DANGER = new Set(['project.deleted', 'page.deleted', 'section.deleted', 'canvas.cleared', 'member.removed', 'wordpress.disconnected'])

const REASON_TEXT: Record<ProjectVersion['reason'], string> = {
  auto: 'Salva enquanto editava',
  delete: 'Antes de uma exclusão',
  restore: 'Antes de uma restauração',
}

const when = (at: number) => {
  const date = new Date(at)
  const today = new Date().toDateString() === date.toDateString()
  return today
    ? `hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const MISSING = 'O histórico ainda não está no banco. Aplique a migração 20261006190000_space_activity_log.sql no Supabase para começar a registrar.'

interface HistoryDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Histórico do projeto: quem fez o quê (Atividade), o que foi excluído e pode
 * voltar (Lixeira) e as versões guardadas do conteúdo (Versões).
 */
export const HistoryDialog: React.FC<HistoryDialogProps> = ({ projectId, open, onOpenChange }) => {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('activity')
  const [events, setEvents] = useState<ActivityEvent[] | null | undefined>(undefined)
  const [versions, setVersions] = useState<ProjectVersion[] | null | undefined>(undefined)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(undefined)
    try {
      const [e, v] = await Promise.all([listEvents(projectId), listVersions(projectId)])
      setEvents(e)
      setVersions(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [projectId])

  useEffect(() => {
    if (!open) return
    setEvents(undefined)
    setVersions(undefined)
    setConfirm(null)
    void reload()
  }, [open, reload])

  const who = (id: string | null, email: string) => (id && id === user?.id ? 'Você' : email ? displayName(email) : 'Alguém')

  // Na lixeira, o que foi excluído e ainda não voltou
  const trash = useMemo(() => {
    if (!events) return []
    const restored = new Set(events.map((e) => e.details.restores).filter((id): id is string => typeof id === 'string'))
    return events.filter((e) => (TRASH_ACTIONS as readonly string[]).includes(e.action) && !restored.has(e.id))
  }, [events])

  const restore = async (key: string, run: () => void | Promise<void>, done: string) => {
    if (confirm !== key) return setConfirm(key)
    setConfirm(null)
    setBusy(key)
    try {
      await run()
      toast.success(done, { description: 'Ctrl+Z desfaz, e o estado de antes ficou guardado em Versões.' })
      // O registro da restauração chega em instantes
      setTimeout(() => void reload(), 800)
    } catch (err) {
      toast.error('Não foi possível restaurar', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof History; count?: number }[] = [
    { id: 'activity', label: 'Atividade', icon: ScrollText },
    { id: 'trash', label: 'Lixeira', icon: Trash2, count: trash.length },
    { id: 'versions', label: 'Versões', icon: History, count: versions?.length },
  ]

  const loading = events === undefined || versions === undefined
  const missing = events === null || versions === null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80vh,720px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b px-5 pb-3 pt-5">
          <DialogTitle>Histórico do projeto</DialogTitle>
          <DialogDescription>Quem fez o quê, o que foi excluído e as versões guardadas do conteúdo.</DialogDescription>
          <div role="tablist" className="flex gap-1 pt-2">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
                  tab === id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {!!count && <span className="rounded-full bg-gray-200 px-1.5 text-[10px] tabular-nums text-gray-700">{count}</span>}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {error ? (
            <p className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : missing ? (
            <p className="m-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{MISSING}</p>
          ) : tab === 'activity' ? (
            events!.length ? (
              <ul className="divide-y divide-gray-100">
                {events!.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', DANGER.has(e.action) ? 'bg-red-500' : 'bg-gray-300')} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-gray-800">
                        <span className="font-medium text-gray-900">{who(e.actorId, e.actorEmail)}</span> {ACTION_TEXT[e.action] ?? e.action}
                        {e.target && <span className="font-medium text-gray-900"> {e.target}</span>}
                        {e.action === 'project.renamed' && typeof e.details.from === 'string' && <span className="text-gray-500"> (era “{e.details.from}”)</span>}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400" title={e.actorEmail}>
                        {when(e.at)}
                        {e.actorEmail && ` · ${e.actorEmail}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Nada registrado ainda. Exclusões, restaurações, publicações e mudanças de acesso aparecem aqui." />
            )
          ) : tab === 'trash' ? (
            trash.length ? (
              <ul className="divide-y divide-gray-100">
                {trash.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Trash2 className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-gray-900">
                        {e.action === 'page.deleted' ? 'Página' : e.action === 'section.deleted' ? 'Seção' : 'Canvas inteiro'} · {e.target}
                      </p>
                      <p className="truncate text-[11px] text-gray-400">
                        {who(e.actorId, e.actorEmail)} excluiu {when(e.at)}
                        {e.action === 'section.deleted' && typeof e.details.pageName === 'string' && ` · estava em ${e.details.pageName}`}
                      </p>
                    </div>
                    <RestoreButton
                      label="Restaurar"
                      confirming={confirm === e.id}
                      busy={busy === e.id}
                      onClick={() => restore(e.id, () => restoreFromTrash(e), `${e.target} voltou para o canvas`)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="A lixeira está vazia. Páginas e seções excluídas ficam aqui para voltar com um clique." />
            )
          ) : versions!.length ? (
            <ul className="divide-y divide-gray-100">
              {versions!.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                  <History className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-gray-900">
                      {when(v.savedAt)}
                      {i === 0 && <span className="ml-1.5 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500">mais recente</span>}
                    </p>
                    <p className="truncate text-[11px] text-gray-400">
                      {REASON_TEXT[v.reason]} · {who(v.savedBy, v.savedByEmail)}
                      {typeof v.summary.pages === 'number' && ` · ${v.summary.pages} ${v.summary.pages === 1 ? 'página' : 'páginas'}`}
                      {typeof v.summary.sections === 'number' && ` · ${v.summary.sections} ${v.summary.sections === 1 ? 'seção' : 'seções'}`}
                    </p>
                  </div>
                  <RestoreButton
                    label="Voltar para esta"
                    confirming={confirm === v.id}
                    busy={busy === v.id}
                    onClick={() => restore(v.id, () => restoreVersion(v), 'O projeto voltou para a versão escolhida')}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nenhuma versão guardada ainda. Editando, uma versão fica guardada a cada 15 minutos, e sempre antes de uma exclusão ou restauração." />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const RestoreButton: React.FC<{ label: string; confirming: boolean; busy: boolean; onClick: () => void }> = ({ label, confirming, busy, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    className={cn(
      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-colors disabled:opacity-50',
      confirming ? 'bg-gray-900 text-white hover:bg-gray-700' : 'text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
    )}
  >
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirming ? <ArchiveRestore className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
    {confirming ? 'Confirmar' : label}
  </button>
)

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="px-6 py-12 text-center text-[13px] leading-relaxed text-gray-500">{text}</p>
