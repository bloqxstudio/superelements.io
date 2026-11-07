import React, { useEffect, useState } from 'react'
import { ExternalLink, GitPullRequest, Loader2, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { callSites } from './link'
import type { CodeSite, PublishMode, PublishResult, SiteStatus } from './protocol'
import { errorText } from './ui'

/**
 * Publicar um site em código: conferir o que mudou e escolher entre mandar direto para a branch
 * principal (a hospedagem publica a partir dela) ou abrir uma revisão (branch + PR no GitHub).
 */

const lineClass = (line: string) =>
  line.startsWith('+++') || line.startsWith('---')
    ? 'text-gray-400'
    : line.startsWith('+')
      ? 'bg-emerald-50 text-emerald-800'
      : line.startsWith('-')
        ? 'bg-red-50 text-red-700'
        : line.startsWith('@@')
          ? 'text-violet-600'
          : line.startsWith('diff ')
            ? 'mt-2 font-semibold text-gray-900'
            : 'text-gray-600'

export const PublishDialog: React.FC<{ site: CodeSite; status: SiteStatus; onClose: () => void; onDone: (status: SiteStatus) => void }> = ({ site, status, onClose, onDone }) => {
  const onReview = status.branch !== status.defaultBranch
  const [mode, setMode] = useState<PublishMode>(onReview ? 'revisao' : 'direto')
  const [message, setMessage] = useState('')
  const [diff, setDiff] = useState<string | null>(null)
  const [busy, setBusy] = useState<'publicar' | 'descartar' | 'voltar' | null>(null)
  const [result, setResult] = useState<PublishResult | null>(null)

  useEffect(() => {
    void callSites<string>('diff', { siteId: site.id })
      .then(setDiff)
      .catch((e) => setDiff(`Não consegui ler o que mudou: ${errorText(e)}`))
  }, [site.id])

  const nothing = !status.changes.length && !status.ahead

  const publish = async () => {
    setBusy('publicar')
    try {
      const done = await callSites<PublishResult>('publish', { siteId: site.id, mode, message: message.trim() || `Edição de ${status.changes.length} arquivo(s) pelo Superelements` })
      setResult(done)
      onDone(await callSites<SiteStatus>('status', { siteId: site.id }))
      if (done.warning) toast.warning('A revisão subiu sem o PR')
      else toast.success(done.mode === 'direto' ? 'Publicado no GitHub' : 'Revisão aberta no GitHub')
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  const discard = async () => {
    if (!window.confirm('Descartar todas as edições ainda não publicadas? Os arquivos voltam ao último commit.')) return
    setBusy('descartar')
    try {
      onDone(await callSites<SiteStatus>('discard', { siteId: site.id }))
      toast.success('Edições descartadas')
      onClose()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  const backToMain = async () => {
    setBusy('voltar')
    try {
      onDone(await callSites<SiteStatus>('pull', { siteId: site.id, toDefault: true }))
      toast.success(`De volta para ${status.defaultBranch}`)
      onClose()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{result ? 'Pronto' : `Publicar ${site.name}`}</DialogTitle>
          <DialogDescription>
            {result
              ? result.mode === 'direto'
                ? `Commit ${result.commit} enviado para ${result.branch}. A hospedagem que publica a partir dessa branch atualiza o site em alguns minutos.`
                : `Commit ${result.commit} na revisão ${result.branch}. Ao aprovar e juntar o PR, o site é publicado.`
              : nothing
                ? 'Nada a publicar: o código está igual ao do GitHub.'
                : `${status.changes.length} arquivo(s) mudaram desde a última publicação.`}
          </DialogDescription>
        </DialogHeader>

        {result?.warning && <p className="rounded-md bg-amber-50 p-2.5 text-sm text-amber-800">{result.warning}</p>}
        {result ? (
          <div className="flex flex-wrap gap-2">
            {result.pr && (
              <Button asChild>
                <a href={result.pr} target="_blank" rel="noreferrer">
                  <GitPullRequest className="mr-1.5 h-4 w-4" aria-hidden /> Abrir o PR
                </a>
              </Button>
            )}
            {site.repo && (
              <Button asChild variant="outline">
                <a href={`https://github.com/${site.repo}/commits/${result.branch}`} target="_blank" rel="noreferrer">
                  Ver no GitHub <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            )}
            {site.url && (
              <Button asChild variant="outline">
                <a href={site.url} target="_blank" rel="noreferrer">
                  Ver o site no ar <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            )}
            {result.mode === 'revisao' && (
              <Button variant="ghost" onClick={() => void backToMain()} disabled={busy !== null}>
                Voltar para {status.defaultBranch}
              </Button>
            )}
          </div>
        ) : (
          <>
            {status.changes.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {status.changes.map((c) => (
                  <li key={c.file} className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700">
                    {c.file} <span className="text-gray-400">· {c.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <pre className="max-h-[38vh] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-[11px] leading-relaxed">
              {diff === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden />
              ) : diff.trim() ? (
                diff.split('\n').map((line, i) => (
                  <div key={i} className={`whitespace-pre-wrap px-1 ${lineClass(line)}`}>
                    {line || ' '}
                  </div>
                ))
              ) : (
                <span className="text-gray-500">Sem diferença de texto (só imagens novas, ou commits ainda não enviados).</span>
              )}
            </pre>

            <label className="block">
              <span className="text-sm font-medium text-gray-900">O que mudou</span>
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex.: novo título na primeira dobra" maxLength={200} className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" />
            </label>

            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Como publicar</legend>
              {(
                [
                  ['direto', Rocket, 'Publicar no site', `Envia para ${status.defaultBranch}. A hospedagem ligada ao GitHub publica sozinha.`],
                  ['revisao', GitPullRequest, 'Mandar para revisão', onReview ? `Envia para a revisão ${status.branch} (o PR já aberto).` : 'Cria uma branch e um PR no GitHub. Publica quando o PR for juntado.'],
                ] as const
              ).map(([id, Icon, title, text]) => {
                const disabled = id === 'direto' && onReview
                return (
                  <label key={id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === id ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                    <input type="radio" name="modo" value={id} checked={mode === id} disabled={disabled} onChange={() => setMode(id)} className="sr-only" />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-700" aria-hidden />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{title}</span>
                      <span className="block text-xs text-gray-500">{disabled ? `Você está na revisão ${status.branch}. Volte para ${status.defaultBranch} para publicar direto.` : text}</span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
            {mode === 'direto' && !nothing && <p className="text-xs text-amber-700">Isto muda o site no ar.</p>}

            <DialogFooter className="gap-2 sm:justify-between">
              <div className="flex gap-2">
                {status.changes.length > 0 && (
                  <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy !== null} onClick={() => void discard()}>
                    {busy === 'descartar' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />} Descartar edições
                  </Button>
                )}
                {onReview && !status.changes.length && (
                  <Button variant="ghost" disabled={busy !== null} onClick={() => void backToMain()}>
                    Voltar para {status.defaultBranch}
                  </Button>
                )}
              </div>
              <Button disabled={nothing || busy !== null || !status.remote} onClick={() => void publish()}>
                {busy === 'publicar' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
                {mode === 'direto' ? 'Publicar' : 'Mandar para revisão'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
