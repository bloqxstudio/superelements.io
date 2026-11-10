import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getSource, referencesSince, updateSource, type Reference, type ReferenceSource } from './api'
import { KIND_LABEL } from './rules'

/**
 * Importar do grupo, pela tela (2026-11-09; o usuário: "temos novas referências no grupo, importe para o app
 * na aba referências, podemos ter um fluxo por tela pra isso? Pra clicar e fazer?").
 *
 * Três passos: escolher quantos posts recentes ler → acompanhar o Mac (`services/referencias`) lendo o grupo
 * e importando um a um → ver o que chegou e ir revisar as novas. O andamento vem de `crm_reference_sources`
 * (run_stage, run_total, run_done, run_note), conferido a cada 4 s só enquanto a janela está aberta.
 */

const AMOUNTS = [
  { value: 0, label: 'Só as novas', hint: 'Os 30 posts mais recentes, até 12 novos. Para o dia a dia.' },
  { value: 20, label: 'Os 20 mais recentes', hint: 'Importa todos os que faltarem entre os 20.' },
  { value: 40, label: 'Os 40 mais recentes', hint: 'Para pôr o grupo em dia depois de um tempo.' },
  { value: 60, label: 'Os 60 mais recentes', hint: 'O máximo de uma vez.' },
] as const

/** Cada post novo leva uns 30 s (abrir, quadros do vídeo, a IA classificar). */
const SECONDS_PER_POST = 30

const pendingOf = (s: ReferenceSource) => !!s.runRequestedAt && (!s.lastRunAt || s.runRequestedAt > s.lastRunAt)

export const ImportDialog: React.FC<{
  sources: ReferenceSource[]
  teamId: string
  open: boolean
  initialSourceId?: string
  onClose: () => void
  onProgress: () => void
  onReview: () => void
}> = ({ sources, teamId, open, initialSourceId, onClose, onProgress, onReview }) => {
  const enabled = sources.filter((s) => s.enabled)
  const [sourceId, setSourceId] = useState(initialSourceId ?? enabled[0]?.id)
  const [amount, setAmount] = useState<number>(0)
  const [live, setLive] = useState<ReferenceSource>()
  const [sending, setSending] = useState(false)
  const [arrived, setArrived] = useState<Reference[]>()
  const [now, setNow] = useState(Date.now())

  useEffect(() => { if (open) { setSourceId(initialSourceId ?? enabled[0]?.id); setArrived(undefined); setLive(undefined); setAmount(0) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const source = live?.id === sourceId ? live : sources.find((s) => s.id === sourceId)

  const pending = source ? pendingOf(source) : false
  const finished = !!source && !pending && (source.runStage === 'pronto' || source.runStage === 'erro') && !!source.runRequestedAt && !!live
  const step: 'escolher' | 'andamento' | 'pronto' = !source ? 'escolher' : pending ? 'andamento' : finished ? 'pronto' : 'escolher'

  // Acompanha o grupo enquanto o pedido está na fila ou rodando
  useEffect(() => {
    if (!open || !sourceId || step !== 'andamento') return
    let last = ''
    const tick = async () => {
      const s = await getSource(sourceId).catch(() => undefined)
      setNow(Date.now())
      if (!s) return
      setLive(s)
      const sig = `${s.runStage}|${s.runDone}`
      if (sig !== last) { last = sig; onProgress() }
    }
    void tick()
    const t = window.setInterval(() => void tick(), 4000)
    return () => window.clearInterval(t)
  }, [open, sourceId, step, onProgress])

  // No fim, o que chegou
  useEffect(() => {
    if (step !== 'pronto' || !source?.runStartedAt || arrived) return
    void referencesSince(teamId, source.id, source.runStartedAt - 5000).then(setArrived, () => setArrived([]))
  }, [step, source, teamId, arrived])

  const start = async () => {
    if (!source) return
    setSending(true)
    try {
      const s = await updateSource(source.id, { requestRun: true, runLimit: amount || null })
      setLive(s)
      setArrived(undefined)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui pedir ao Mac.')
    } finally {
      setSending(false)
    }
  }

  const waitingSeconds = source?.runRequestedAt ? Math.max(0, Math.round((now - source.runRequestedAt) / 1000)) : 0
  // O Mac olha os pedidos a cada minuto; se passou de 3 min sem começar, provavelmente está desligado
  const stalled = step === 'andamento' && waitingSeconds > 180 && !(source?.runStage === 'lendo' || source?.runStage === 'importando')
  // Uma leitura que começou antes do pedido (a rotina) termina primeiro; a do pedido vem logo depois
  const ownRun = !!source?.runStartedAt && !!source.runRequestedAt && source.runStartedAt >= source.runRequestedAt - 10_000
  const stage = ownRun ? source?.runStage : undefined
  const total = source?.runTotal ?? 0
  const done = Math.min(source?.runDone ?? 0, total)
  const remaining = useMemo(() => (total > done ? Math.ceil(((total - done) * SECONDS_PER_POST) / 60) : 0), [total, done])

  const steps = [
    { key: 'fila', label: 'Pedido enviado ao Mac', on: true, done: !!stage },
    { key: 'lendo', label: 'Lendo o grupo no Instagram', on: !!stage, done: stage === 'importando' || stage === 'pronto' },
    { key: 'importando', label: total ? `Importando ${done} de ${total}` : stage === 'importando' ? 'Nenhum post novo' : 'Importando os posts novos', on: stage === 'importando', done: stage === 'pronto' },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !sending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar do grupo</DialogTitle>
          <DialogDescription>
            O Mac da equipe abre o grupo, lê os posts mandados lá e cria cada referência com capa, quadros, engajamento e a classificação da IA.
          </DialogDescription>
        </DialogHeader>

        {!enabled.length && <p className="text-sm text-gray-600">Cadastre e ligue um grupo do Instagram primeiro, em "Grupos do Instagram".</p>}

        {step === 'escolher' && enabled.length > 0 && (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void start() }}>
            {enabled.length > 1 && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-800">Grupo</span>
                <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                  {enabled.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium text-gray-800">Quantos posts ler</legend>
              {AMOUNTS.map((a) => (
                <label key={a.value} className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm', amount === a.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300')}>
                  <input type="radio" name="quantos" checked={amount === a.value} onChange={() => setAmount(a.value)} className="mt-0.5" />
                  <span><span className="font-medium text-gray-900">{a.label}</span><span className="block text-xs text-gray-500">{a.hint}</span></span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-gray-500">Os já importados são pulados. Cada post novo leva cerca de 30 s; pode fechar esta janela que o Mac continua.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={sending || !source} className="gap-1.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Importar
              </Button>
            </div>
          </form>
        )}

        {step === 'andamento' && source && (
          <div className="grid gap-4">
            <ol className="grid gap-2.5">
              {steps.map((s) => (
                <li key={s.key} className={cn('flex items-center gap-2.5 text-sm', s.on || s.done ? 'text-gray-900' : 'text-gray-400')}>
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', s.done ? 'border-emerald-600 bg-emerald-600 text-white' : s.on ? 'border-gray-900' : 'border-gray-300')}>
                    {s.done ? <Check className="h-3 w-3" /> : s.on ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  </span>
                  {s.label}
                </li>
              ))}
            </ol>
            {stage === 'importando' && total > 0 && (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                  <div className="h-full rounded-full bg-gray-900 transition-[width] duration-500" style={{ width: `${Math.round((done / total) * 100)}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{source.runNote ? <>Última: <span className="text-gray-800">{source.runNote}</span> · </> : null}{remaining ? `faltam cerca de ${remaining} min` : 'terminando'}</p>
              </div>
            )}
            {!stage && !stalled && (
              <p className="text-xs text-gray-500">{source.runStage === 'lendo' || source.runStage === 'importando' ? 'O Mac está terminando a leitura da rotina; a sua começa em seguida.' : 'O Mac olha os pedidos a cada minuto.'}</p>
            )}
            {stalled && (
              <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                O Mac ainda não começou. Confira se ele está ligado e com o leitor rodando (serviço com.avencestudio.referencias). O pedido fica guardado e roda quando ele voltar.
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Fechar e continuar no fundo</Button>
            </div>
          </div>
        )}

        {step === 'pronto' && source && (
          <div className="grid gap-4">
            {source.runStage === 'erro' ? (
              <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{source.lastError ?? 'A leitura falhou.'}</p>
            ) : (
              <p className="text-sm text-gray-900">
                <Check className="mr-1.5 inline h-4 w-4 text-emerald-600" />
                {source.lastFound ? `${source.lastFound} referência${source.lastFound === 1 ? ' nova' : 's novas'} no app.` : 'O grupo já estava em dia: nenhum post novo.'}
              </p>
            )}
            {arrived && arrived.length > 0 && (
              <ul className="grid max-h-56 gap-1 overflow-y-auto text-xs">
                {arrived.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-2 rounded-md bg-gray-50 px-2.5 py-1.5">
                    <span className="shrink-0 font-medium text-gray-500">{KIND_LABEL[r.kind]}</span>
                    <span className="truncate text-gray-900">{r.title || r.url}</span>
                    {r.author && <span className="ml-auto shrink-0 text-gray-500">@{r.author}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => { setArrived(undefined); setAmount(0); setLive(undefined) }}>Importar mais</Button>
              {!!source.lastFound && source.runStage !== 'erro' ? <Button onClick={onReview}>Revisar as novas</Button> : <Button onClick={onClose}>Fechar</Button>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
