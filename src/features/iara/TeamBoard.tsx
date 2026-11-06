import React, { useEffect, useState } from 'react'
import { WorkBar } from './WorkBar'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, ChevronLeft, ChevronRight, CircleAlert, Clock, Hand, Loader2, RotateCcw, ScanEye, SkipForward, ThumbsDown, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AGENT_COLORS, agentName, decidePost } from './actions'
import { answerChoice, isWaitingChoice } from './orchestra'
import { galleryFull, patchMessage, type GalleryItem, type IaraMessage, type TeamPart } from './store'

/**
 * O quadro da equipe de agentes na conversa: uma linha por parte (quem faz, em que pé está e o que
 * o revisor disse), as tentativas de imagem em miniatura (clique abre grande) e, quando a equipe
 * espera, a escolha da pessoa: usar uma, dizer o que não gostou e pedir outra, ou seguir sem.
 * No fim, a aprovação do post montado.
 */

const STATUS: Record<TeamPart['status'], { label: string; tone: string }> = {
  fila: { label: 'Na fila', tone: 'text-gray-500' },
  trabalhando: { label: 'Trabalhando', tone: 'text-sky-700' },
  revisao: { label: 'Com o revisor', tone: 'text-violet-700' },
  refazendo: { label: 'Refazendo', tone: 'text-amber-800' },
  escolha: { label: 'Sua vez de escolher', tone: 'text-violet-700' },
  aprovado: { label: 'Aprovado', tone: 'text-emerald-700' },
  duvida: { label: 'Passou com ressalva', tone: 'text-amber-800' },
  falhou: { label: 'Não saiu', tone: 'text-red-700' },
}

const VERDICT: Record<NonNullable<GalleryItem['verdict']>, { label: string; tone: string }> = {
  aprovado: { label: 'Revisor aprovou', tone: 'bg-emerald-600' },
  duvida: { label: 'Revisor em dúvida', tone: 'bg-amber-500' },
  refazer: { label: 'Revisor reprovou', tone: 'bg-red-500' },
}

const Icon: React.FC<{ status: TeamPart['status'] }> = ({ status }) => {
  if (status === 'trabalhando' || status === 'refazendo') return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
  if (status === 'revisao') return <ScanEye className="h-3.5 w-3.5" aria-hidden />
  if (status === 'escolha') return <Hand className="h-3.5 w-3.5" aria-hidden />
  if (status === 'aprovado') return <Check className="h-3.5 w-3.5" aria-hidden />
  if (status === 'duvida' || status === 'falhou') return <CircleAlert className="h-3.5 w-3.5" aria-hidden />
  return <Clock className="h-3.5 w-3.5" aria-hidden />
}

const full = (g: GalleryItem) => galleryFull.get(g.id) ?? g.thumb

/** A imagem grande, com o que o revisor achou e a escolha (quando a equipe espera por ela). */
const Lightbox: React.FC<{ items: GalleryItem[]; start: number; canChoose: (g: GalleryItem) => boolean; onUse: (g: GalleryItem) => void; onClose: () => void }> = ({ items, start, canChoose, onUse, onClose }) => {
  const [i, setI] = useState(start)
  const g = items[i]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((n) => Math.min(items.length - 1, n + 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])
  if (!g) return null
  return (
    <div role="dialog" aria-modal="true" aria-label={`${g.group}, tentativa ${g.attempt}`} className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-3xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
          <img src={full(g)} alt={`${g.group}, tentativa ${g.attempt}`} className="max-h-[72vh] max-w-full rounded-lg object-contain" />
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} aria-label="Anterior" className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
          {i < items.length - 1 && (
            <button type="button" onClick={() => setI(i + 1)} aria-label="Próxima" className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        <div className="w-full rounded-xl bg-white p-3 text-sm">
          <p className="font-semibold text-gray-900">
            {g.group} · tentativa {g.attempt} <span className="font-normal text-gray-400">({i + 1} de {items.length})</span>
          </p>
          {g.verdict && <p className="mt-0.5 text-xs text-gray-600"><span className={cn('mr-1.5 inline-block h-2 w-2 rounded-full', VERDICT[g.verdict].tone)} aria-hidden />{VERDICT[g.verdict].label}{g.note ? `: ${g.note}` : ''}</p>}
          {g.feedback && <p className="mt-0.5 text-xs text-gray-600">Você disse: {g.feedback}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {canChoose(g) && (
              <button type="button" onClick={() => onUse(g)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700">
                <Check className="h-3.5 w-3.5" aria-hidden /> Usar esta
              </button>
            )}
            <a href={full(g)} download={`${g.group.toLowerCase().replace(/\s+/g, '-')}-${g.attempt}.png`} className="inline-flex h-8 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Baixar
            </a>
            <button type="button" onClick={onClose} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-gray-500 hover:bg-gray-100">
              <X className="h-3.5 w-3.5" aria-hidden /> Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** As tentativas de uma parte e, quando a equipe espera, a escolha da pessoa. */
const Gallery: React.FC<{ msgId: string; part: TeamPart }> = ({ msgId, part }) => {
  const items = part.gallery ?? []
  const [open, setOpen] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const waitingHere = part.status === 'escolha' && !!part.waiting && isWaitingChoice(msgId, part.key)
  const choosable = (g: GalleryItem) => waitingHere && g.group === part.waiting
  const use = (g: GalleryItem) => {
    if (answerChoice(msgId, part.key, { kind: 'usar', item: g.id })) setOpen(null)
    else toast.error('A equipe não está mais esperando esta escolha.')
  }
  if (!items.length) return null
  const groups = [...new Set(items.map((g) => g.group))]
  return (
    <div className="mt-2 grid gap-2">
      {groups.map((group) => (
        <div key={group}>
          {groups.length > 1 && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{group}</p>}
          <ul className="flex flex-wrap gap-1.5" aria-label={`Tentativas: ${group}`}>
            {items.map((g, i) =>
              g.group !== group ? null : (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(i)}
                    title={`Tentativa ${g.attempt}${g.verdict ? ` · ${VERDICT[g.verdict].label}` : ''}${g.note ? `: ${g.note}` : ''}`}
                    className={cn(
                      'relative block h-16 w-16 overflow-hidden rounded-md ring-1 transition-shadow hover:ring-2 hover:ring-violet-400',
                      g.pick === 'usar' ? 'ring-2 ring-emerald-500' : g.pick === 'nao' ? 'opacity-50 ring-black/10' : 'ring-black/10'
                    )}
                  >
                    {g.thumb || galleryFull.has(g.id) ? <img src={g.thumb || full(g)} alt={`${g.group}, tentativa ${g.attempt}`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-gray-100 text-[9px] text-gray-400">antiga</span>}
                    {g.verdict && <span className={cn('absolute right-1 top-1 h-2 w-2 rounded-full ring-1 ring-white', VERDICT[g.verdict].tone)} aria-hidden />}
                    {g.pick === 'usar' && (
                      <span className="absolute inset-x-0 bottom-0 bg-emerald-600/90 text-center text-[9px] font-semibold text-white">Escolhida</span>
                    )}
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      ))}
      {waitingHere && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-2">
          <p className="text-[11px] font-semibold text-violet-900">Sua vez: {part.waiting}</p>
          <p className="text-[11px] text-violet-800">Clique numa imagem para ver grande e usar. Ou diga o que não gostou para gerar outra.</p>
          <label className="sr-only" htmlFor={`fb-${msgId}-${part.key}`}>O que não gostou</label>
          <textarea
            id={`fb-${msgId}-${part.key}`}
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Ex.: luz muito fria, quero pessoas de costas, menos trânsito…"
            className="mt-1.5 w-full resize-none rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none"
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!feedback.trim()}
              onClick={() => {
                if (answerChoice(msgId, part.key, { kind: 'outra', feedback: feedback.trim() })) setFeedback('')
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-violet-600 px-2.5 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <ThumbsDown className="h-3 w-3" aria-hidden /> Gerar outra
            </button>
            <button type="button" onClick={() => answerChoice(msgId, part.key, { kind: 'pular' })} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-gray-600 hover:bg-white">
              <SkipForward className="h-3 w-3" aria-hidden /> Seguir sem esta foto
            </button>
          </div>
        </div>
      )}
      {open !== null && <Lightbox items={items} start={open} canChoose={choosable} onUse={use} onClose={() => setOpen(null)} />}
    </div>
  )
}

export const TeamBoard: React.FC<{ m: IaraMessage; onAdjust: (text: string) => void }> = ({ m, onAdjust }) => {
  const team = m.team!
  const [busy, setBusy] = useState(false)

  const decide = async (decision: 'aprovar' | 'descartar') => {
    if (!team.setId || !team.postId) return
    setBusy(true)
    try {
      await decidePost(team.setId, team.postId, decision)
      patchMessage(m.id, (x) => (x.team ? { ...x, team: { ...x.team, final: decision === 'aprovar' ? 'aprovado' : 'descartado' } } : x))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Equipe da Iara</p>
      <p className="text-sm font-medium text-gray-900">{team.title}</p>
      <ol className="grid gap-1.5" aria-label="Partes do trabalho">
        {team.parts.map((p) => (
          <li key={p.key} className={cn('rounded-lg bg-white p-2 ring-1', p.status === 'escolha' ? 'ring-violet-300' : 'ring-black/5')}>
            <div className="flex items-start gap-2">
              {p.preview && !p.gallery?.length ? <img src={p.preview} alt="" className="h-10 w-10 shrink-0 rounded object-cover" /> : !p.gallery?.length ? <span className="h-10 w-10 shrink-0 rounded bg-gray-100" aria-hidden /> : null}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-900">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: AGENT_COLORS[p.agent] ?? '#a78bfa' }} aria-hidden />
                  <span className="truncate">{p.label}</span>
                  <span className="shrink-0 font-normal text-gray-400">· {p.agent === 'imagens' ? 'Imagens' : agentName(p.agent)}</span>
                </p>
                <p className={cn('mt-0.5 flex items-center gap-1 text-[11px]', STATUS[p.status].tone)}>
                  <Icon status={p.status} /> {STATUS[p.status].label}
                  {p.attempt > 1 && <span className="text-gray-400">· tentativa {p.attempt}</span>}
                  {p.gallery && p.gallery.length > 0 && <span className="text-gray-400">· {p.gallery.length} imagem{p.gallery.length > 1 ? 'ns' : ''}</span>}
                </p>
                {p.note && <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">{p.note}</p>}
              </div>
            </div>
            <Gallery msgId={m.id} part={p} />
          </li>
        ))}
      </ol>
      {team.final === 'trabalhando' && <WorkBar />}
      {team.final === 'aguardando' && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-2.5">
          <p className="text-xs font-semibold text-violet-900">O revisor liberou. Sua vez de aprovar.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" disabled={busy} onClick={() => void decide('aprovar')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
              <Check className="h-3.5 w-3.5" aria-hidden /> Aprovar o post
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                patchMessage(m.id, (x) => (x.team ? { ...x, team: { ...x.team, final: 'ajuste' } } : x))
                onAdjust('Ajuste no post que a equipe montou: ')
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Pedir ajuste
            </button>
            <button type="button" disabled={busy} onClick={() => void decide('descartar')} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-gray-500 hover:bg-white">
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Descartar
            </button>
            {team.open && (
              <Link to={team.open} className="ml-auto inline-flex h-8 items-center text-xs font-medium text-violet-700 underline-offset-2 hover:underline">
                Abrir no editor
              </Link>
            )}
          </div>
        </div>
      )}
      {team.final === 'aprovado' && <p className="flex items-center gap-1.5 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" aria-hidden /> Post aprovado.</p>}
      {team.final === 'descartado' && <p className="flex items-center gap-1.5 text-xs text-gray-500"><X className="h-3.5 w-3.5" aria-hidden /> Post descartado.</p>}
      {team.final === 'ajuste' && <p className="text-xs text-gray-500">Ajuste pedido: escreva o que mudar.</p>}
    </div>
  )
}
