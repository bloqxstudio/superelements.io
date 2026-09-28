import React, { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Copy, ExternalLink, Link2, MessageSquareText, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProject } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { shareState, useApprovalStore } from './approvalStore'
import { DECISION_LABELS, when } from './format'
import { htmlHash, isLocalAppUrl, shareUrl, type ShareResponse } from './shares'

interface ApprovalPanelProps {
  pageId: string
  pageName: string
  /** O HTML que o player mostra: é ele que vira a foto do link. */
  html: string | null
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : undefined)

/** Uma resposta do cliente: decisão, quem, quando e o comentário. */
const ResponseLine: React.FC<{ response: ShareResponse; old?: boolean }> = ({ response, old }) => {
  const approved = response.decision === 'approved'
  const Icon = approved ? CircleCheck : MessageSquareText
  return (
    <li className={cn('flex gap-2 text-xs', old && 'opacity-70')}>
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', approved ? 'text-emerald-600' : 'text-amber-600')} aria-hidden />
      <div className="min-w-0">
        <p className="text-gray-900">
          <span className="font-medium">{DECISION_LABELS[response.decision]}</span>
          {response.name && <> por {response.name}</>}
          <span className="text-gray-500"> · {when(response.createdAt)}{old && ` · versão ${response.version}`}</span>
        </p>
        {response.note && <p className="mt-0.5 whitespace-pre-line text-gray-600">“{response.note}”</p>}
      </div>
    </li>
  )
}

/**
 * Link de aprovação da página, dentro do player: criar, copiar, ver o que o
 * cliente respondeu e trocar a foto quando a página mudar.
 */
export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ pageId, pageName, html }) => {
  const projectId = useProjectSync((s) => s.projectId)
  const project = useProject(projectId)
  const status = useApprovalStore((s) => (s.projectId === projectId ? s.status : 'idle'))
  const share = useApprovalStore((s) => s.shares[pageId])
  const { load, publish, revoke } = useApprovalStore.getState()
  const [busy, setBusy] = useState<'publish' | 'revoke' | 'refresh' | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [currentHash, setCurrentHash] = useState<string | null>(null)

  // Relê ao abrir: o cliente pode ter respondido enquanto o player estava fechado
  useEffect(() => {
    if (projectId) void load(projectId)
  }, [projectId, load])

  useEffect(() => {
    let alive = true
    setCurrentHash(null)
    if (html) void htmlHash(html).then((hash) => alive && setCurrentHash(hash))
    return () => {
      alive = false
    }
  }, [html])

  if (!projectId) return null

  const state = shareState(share)
  const changed = !!share && !!currentHash && currentHash !== share.htmlHash
  const url = share ? shareUrl(share.id) : ''
  const older = share ? share.responses.filter((r) => r !== (state.kind === 'approved' || state.kind === 'changes' ? state.latest : null)).slice(0, 4) : []

  const doPublish = async () => {
    if (!html) return
    setBusy('publish')
    try {
      const next = await publish(pageId, { projectName: project?.name ?? 'Projeto', pageName, html })
      const link = shareUrl(next.id)
      await navigator.clipboard.writeText(link).catch(() => {})
      toast.success(share ? 'Link atualizado com a página de agora' : 'Link de aprovação criado', {
        description: share ? 'O cliente vê a versão nova ao abrir o mesmo link.' : 'O endereço foi copiado. Mande para o cliente.',
      })
    } catch (error) {
      console.error('[aprovação] falha ao publicar', error)
      toast.error(share ? 'Não foi possível atualizar o link' : 'Não foi possível criar o link', { description: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  const doRevoke = async () => {
    setBusy('revoke')
    try {
      await revoke(pageId)
      setConfirmRevoke(false)
      toast.success('Link desativado', { description: 'Quem tiver o endereço não vê mais a página.' })
    } catch (error) {
      console.error('[aprovação] falha ao desativar', error)
      toast.error('Não foi possível desativar o link', { description: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  const refresh = async () => {
    setBusy('refresh')
    await load(projectId)
    setBusy(null)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar', { description: url })
    }
  }

  return (
    <section aria-label="Link de aprovação" className="border-b bg-white px-4 py-3 text-xs">
      {status === 'error' && !share ? (
        <div className="flex flex-wrap items-center justify-between gap-3" role="alert">
          <p className="flex items-center gap-2 text-gray-700">
            <CircleAlert className="h-3.5 w-3.5 text-destructive" aria-hidden />
            Não foi possível ler os links de aprovação deste projeto.
          </p>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={refresh} disabled={busy !== null}>
            Tentar de novo
          </Button>
        </div>
      ) : status !== 'ready' && !share ? (
        <p className="text-gray-500" aria-busy="true">Lendo o link de aprovação…</p>
      ) : !share ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-gray-600">
            Gere um link para o cliente ver <span className="font-medium text-gray-900">{pageName}</span> e aprovar ou pedir ajuste, sem login. O link mostra a página como ela está agora; o que você mudar depois só aparece quando atualizar o link.
          </p>
          <Button size="sm" className="h-8 gap-1.5 text-xs active:scale-[0.96]" onClick={doPublish} disabled={!html || busy !== null}>
            <Link2 className="h-3.5 w-3.5" />
            {busy === 'publish' ? 'Criando…' : 'Criar link'}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                value={url}
                aria-label="Endereço do link de aprovação"
                onFocus={(e) => e.currentTarget.select()}
                className="h-8 min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 font-mono text-[11px] text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs active:scale-[0.96]" onClick={copy}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 active:scale-[0.96]" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir o link em outra aba">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
            <p className="text-gray-500">
              Versão {share.version}, enviada em {when(share.sharedAt)}.{' '}
              {changed ? <span className="font-medium text-amber-700">A página mudou desde então.</span> : currentHash ? 'Igual à página de agora.' : null}
            </p>
            {isLocalAppUrl() && (
              <p className="text-amber-700">
                Este endereço só abre neste computador. Para o cliente abrir, o app precisa estar publicado (e o endereço dele em <code className="font-mono">VITE_PUBLIC_APP_URL</code>).
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Button
                size="sm"
                variant={changed ? 'default' : 'outline'}
                className="h-8 gap-1.5 text-xs active:scale-[0.96]"
                onClick={doPublish}
                disabled={!html || busy !== null}
                title="Troca a foto do link pela página de agora; as respostas recomeçam"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', busy === 'publish' && 'animate-spin motion-reduce:animate-none')} />
                {busy === 'publish' ? 'Atualizando…' : 'Atualizar link'}
              </Button>
              {confirmRevoke ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-700">O cliente deixa de ver a página.</span>
                  <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={doRevoke} disabled={busy !== null}>
                    {busy === 'revoke' ? 'Desativando…' : 'Desativar'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirmRevoke(false)} disabled={busy !== null}>
                    Cancelar
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-600" onClick={() => setConfirmRevoke(true)} disabled={busy !== null}>
                  Desativar link
                </Button>
              )}
            </div>
          </div>

          <div className="min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-gray-900">Resposta do cliente</h3>
              <button
                type="button"
                onClick={refresh}
                disabled={busy !== null}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3 w-3', busy === 'refresh' && 'animate-spin motion-reduce:animate-none')} aria-hidden />
                Ver se respondeu
              </button>
            </div>
            <ul className="mt-2 space-y-2">
              {state.kind === 'waiting' && <li className="text-gray-500">Ainda sem resposta para a versão {share.version}.</li>}
              {(state.kind === 'approved' || state.kind === 'changes') && <ResponseLine response={state.latest} />}
              {older.map((response, index) => (
                <ResponseLine key={response.id ?? index} response={response} old={response.version !== share.version} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
