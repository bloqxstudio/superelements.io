import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, MessageSquareText, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DECISION_LABELS, when } from '@/features/approval/format'
import { fetchShareHtml, getPublicShare, respondToShare, type Decision, type PublicShare, type RespondError } from '@/features/approval/shares'

/**
 * Página pública do link de aprovação: a foto da página, sem login, com
 * Aprovar e Pedir ajuste. Quem tem o endereço vê só esta página.
 */

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; share: PublicShare; html: string }

const NAME_KEY = 'aprovacao:nome'
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
const saveName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // Sem armazenamento (aba privada): só não lembra o nome
  }
}

const ERRORS: Record<Exclude<RespondError, 'link_inativo' | 'versao_antiga'>, string> = {
  comentario_obrigatorio: 'Escreva o que precisa mudar.',
  limite_respostas: 'Este link já recebeu respostas demais. Fale direto com quem te enviou.',
  erro: 'Não foi possível enviar. Confira a internet e tente de novo.',
}

const MOBILE_WIDTH = 390

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-100 px-4">{children}</div>
)

const Notice: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <Centered>
    <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-600">{text}</p>
          {action}
        </div>
      </div>
    </div>
  </Centered>
)

const PageApproval: React.FC = () => {
  const { shareId = '' } = useParams()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [name, setName] = useState(readName)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ decision: Decision; at: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const read = useCallback(async () => {
    try {
      const share = await getPublicShare(shareId)
      if (!share) return setLoad({ state: 'missing' })
      const html = await fetchShareHtml(share.htmlPath)
      setLoad({ state: 'ready', share, html })
    } catch (error) {
      console.error('[aprovação] link não lido', error)
      setLoad({ state: 'error' })
    }
  }, [shareId])

  useEffect(() => {
    void read()
  }, [read])

  // Página de prévia: fora dos buscadores
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const share = load.state === 'ready' ? load.share : null
  useEffect(() => {
    document.title = share ? `${share.pageName} · ${share.projectName} · aprovação` : 'Aprovação de página'
  }, [share])

  if (load.state === 'loading') {
    return (
      <Centered>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 motion-reduce:animate-none" aria-label="Abrindo a página" />
      </Centered>
    )
  }
  if (load.state === 'missing') {
    return <Notice title="Este link não está mais disponível" text="Ele foi desativado ou o endereço está incompleto. Peça um link novo para quem te enviou." />
  }
  if (load.state === 'error') {
    return (
      <Notice
        title="Não foi possível abrir a página"
        text="Confira a internet e tente de novo."
        action={
          <Button size="sm" className="mt-4" onClick={() => { setLoad({ state: 'loading' }); void read() }}>
            Tentar de novo
          </Button>
        }
      />
    )
  }

  const { share: current, html } = load
  const latest = current.responses[0]

  const choose = (next: Decision) => {
    setDecision(next)
    setFormError(null)
    setNotice(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!decision || sending) return
    if (decision === 'changes' && !note.trim()) return setFormError(ERRORS.comentario_obrigatorio)
    setSending(true)
    setFormError(null)
    saveName(name.trim())
    const result = await respondToShare(current.id, current.version, decision, name.trim(), note.trim())
    setSending(false)
    if ('at' in result) {
      setSent({ decision, at: result.at })
      setDecision(null)
      setNote('')
      void getPublicShare(current.id).then((share) => share && setLoad({ state: 'ready', share, html }))
      return
    }
    if (result.error === 'link_inativo') return setLoad({ state: 'missing' })
    if (result.error === 'versao_antiga') {
      setDecision(null)
      setNotice('A página foi atualizada enquanto você olhava. Esta já é a versão nova: veja e responda de novo.')
      setLoad({ state: 'loading' })
      return void read()
    }
    setFormError(ERRORS[result.error])
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-100">
      <header className="shrink-0 border-b bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Prévia para aprovação</p>
            <h1 className="truncate text-sm font-semibold text-gray-900">
              {current.pageName} <span className="font-normal text-gray-500">· {current.projectName}</span>
            </h1>
            <p className="truncate text-xs text-gray-500">
              Versão de {when(current.sharedAt)}
              {latest && !sent && (
                <>
                  {' · '}
                  <span className={latest.decision === 'approved' ? 'text-emerald-700' : 'text-amber-800'}>
                    {DECISION_LABELS[latest.decision]}
                    {latest.name && ` por ${latest.name}`} em {when(latest.createdAt)}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="hidden items-center gap-1 rounded-lg bg-muted p-1 md:flex" role="group" aria-label="Tamanho da tela">
            {([['desktop', 'Computador', Monitor], ['mobile', 'Celular', Smartphone]] as const).map(([key, label, Icon]) => (
              <Button
                key={key}
                size="sm"
                variant={device === key ? 'default' : 'ghost'}
                className="h-7 gap-1.5 px-2.5 text-xs active:scale-[0.96]"
                aria-pressed={device === key}
                onClick={() => setDevice(key)}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={decision === 'changes' ? 'secondary' : 'outline'}
              className="h-9 gap-1.5 active:scale-[0.96]"
              aria-expanded={decision === 'changes'}
              onClick={() => choose('changes')}
            >
              <MessageSquareText className="h-4 w-4" /> Pedir ajuste
            </Button>
            <Button size="sm" className="h-9 gap-1.5 active:scale-[0.96]" aria-expanded={decision === 'approved'} onClick={() => choose('approved')}>
              <CircleCheck className="h-4 w-4" /> Aprovar
            </Button>
          </div>
        </div>

        {decision && (
          <form onSubmit={submit} className="border-t bg-zinc-50 px-4 py-3 md:px-6" aria-label={decision === 'approved' ? 'Aprovar a página' : 'Pedir ajuste'}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="aprovacao-nome" className="text-xs">
                  Seu nome <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input id="aprovacao-nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" className="h-9 bg-white" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="aprovacao-nota" className="text-xs">
                  {decision === 'changes' ? 'O que precisa mudar?' : 'Comentário'}{' '}
                  {decision === 'approved' && <span className="font-normal text-muted-foreground">(opcional)</span>}
                </Label>
                <Textarea
                  id="aprovacao-nota"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={4000}
                  rows={decision === 'changes' ? 3 : 1}
                  autoFocus
                  placeholder={decision === 'changes' ? 'Diga a parte da página e o que trocar. Ex.: no topo, trocar a foto; nos planos, o valor do avulso é R$ 80.' : ''}
                  aria-invalid={!!formError}
                  aria-describedby={formError ? 'aprovacao-erro' : undefined}
                  className="min-h-9 resize-y bg-white text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setDecision(null)} disabled={sending}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="h-9 active:scale-[0.96]" disabled={sending}>
                  {sending ? 'Enviando…' : decision === 'approved' ? 'Enviar aprovação' : 'Enviar pedido'}
                </Button>
              </div>
            </div>
            {formError && (
              <p id="aprovacao-erro" className="mt-2 text-xs text-destructive" role="alert">
                {formError}
              </p>
            )}
          </form>
        )}

        {(sent || notice) && !decision && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 text-sm md:px-6',
              notice ? 'bg-amber-50 text-amber-900' : sent?.decision === 'approved' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
            )}
            role="status"
          >
            {notice ?? (sent?.decision === 'approved' ? 'Aprovação enviada. Obrigado!' : 'Pedido de ajuste enviado. Obrigado! Quem te mandou o link vai ver o seu comentário.')}
            {sent && !notice && (
              <button type="button" className="text-xs font-medium underline underline-offset-2" onClick={() => setSent(null)}>
                Fechar
              </button>
            )}
          </div>
        )}
      </header>

      <main className={cn('min-h-0 flex-1', device === 'mobile' && 'flex justify-center overflow-hidden px-4 py-4')}>
        <iframe
          title={`Prévia de ${current.pageName}`}
          // Os scripts da página (menu, animações) rodam isolados; links externos abrem em outra aba
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          srcDoc={html}
          className={cn('block h-full border-0 bg-white', device === 'mobile' ? 'rounded-xl shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_32px_-8px_rgb(0_0_0/0.18)]' : 'w-full')}
          style={device === 'mobile' ? { width: MOBILE_WIDTH, maxWidth: '100%' } : undefined}
        />
      </main>
    </div>
  )
}

export default PageApproval
