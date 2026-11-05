import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, CircleAlert, Loader2, MessageSquare, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLabel } from '@/features/conteudos/rules'
import { commentApproval, getApproval, mediaUrl, respondApproval, type PublicApproval, type PublicItem } from '@/features/pauta/api'
import { channelLabel, dayHeading } from '@/features/pauta/rules'
import { SlideViewer, ratioOf, timeLabel } from '@/features/pauta/ui'

/**
 * /pauta/aprovar/:id — o cliente, sem login, vê as peças de um envio, aprova ou pede ajuste em
 * cada uma e comenta (inclusive sobre um slide). Não edita nada. O nome fica neste navegador.
 */

const NAME_KEY = 'pauta-aprovacao-nome'
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

const field = 'w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10'

const ItemCard: React.FC<{ linkId: string; item: PublicItem; name: string; needName: () => boolean; onDone: () => void; index: number; total: number }> = ({ linkId, item, name, needName, onDone, index, total }) => {
  const posts = item.media.filter((m) => m.slides.length)
  const [post, setPost] = useState(0)
  const [slide, setSlide] = useState(0)
  const [mode, setMode] = useState<'idle' | 'ajuste' | 'comentar'>('idle')
  const [note, setNote] = useState('')
  const [onSlide, setOnSlide] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [scriptOpen, setScriptOpen] = useState(!posts.length)
  const current = posts[post]
  const urls = useMemo(() => (current ? current.slides.map(mediaUrl) : []), [current])

  const act = async (fn: () => Promise<unknown>) => {
    if (needName()) return
    setBusy(true)
    setError(undefined)
    try {
      await fn()
      setNote('')
      setMode('idle')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui enviar.')
    } finally {
      setBusy(false)
    }
  }

  const where = current && onSlide ? { post: post + 1, slide: slide + 1 } : {}
  const when = [item.date && dayHeading(item.date), item.time].filter(Boolean).join(', ')

  return (
    <article id={`peca-${item.id}`} aria-labelledby={`t-${item.id}`} className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-12px_rgb(0_0_0/0.12)]">
      <header className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            <span className="tabular-nums">
              {index + 1}/{total}
            </span>
            {when && <span className="capitalize"> · {when}</span>}
            {item.channel && ` · ${channelLabel(item.channel)}`} · {formatLabel(item.format)}
          </p>
          <h2 id={`t-${item.id}`} className="mt-1 text-lg font-semibold leading-snug tracking-tight text-gray-900">
            {item.title}
          </h2>
        </div>
        {item.decision !== 'pendente' && (
          <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium', item.decision === 'aprovado' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800')}>
            {item.decision === 'aprovado' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Undo2 className="h-3.5 w-3.5" aria-hidden />}
            {item.decision === 'aprovado' ? 'Aprovado' : 'Ajuste pedido'}
          </span>
        )}
      </header>

      {item.replaced && (
        <p className="mx-5 mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> A equipe já mandou uma versão mais nova desta peça em outro link.
        </p>
      )}

      <div className="px-5 pt-4">
        {posts.length > 1 && (
          <div role="tablist" aria-label="Posts desta peça" className="mb-3 flex flex-wrap gap-1.5">
            {posts.map((p, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === post} onClick={() => setPost(i)} className={cn('h-8 rounded-full border px-3 text-xs font-medium', i === post ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300')}>
                {p.name || `Post ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {current && (
          <div className="mx-auto max-w-[420px]">
            <SlideViewer urls={urls} ratio={ratioOf(current.format)} onSlide={setSlide} label={current.name || item.title} />
          </div>
        )}
        {current?.caption && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Legenda</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800">{current.caption}</p>
          </div>
        )}
        {item.script && (
          <div className="mt-4">
            <button type="button" aria-expanded={scriptOpen} onClick={() => setScriptOpen((v) => !v)} className="text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800">
              Roteiro {scriptOpen ? '−' : '+'}
            </button>
            {scriptOpen && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800">{item.script}</p>}
          </div>
        )}
      </div>

      {item.comments.length > 0 && (
        <ol className="mx-5 mt-5 grid gap-2" aria-label="Comentários">
          {item.comments.map((c) => (
            <li key={c.id} className={cn('rounded-xl p-3 text-sm', c.client ? 'bg-gray-50' : 'bg-violet-50')}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                <span className="font-semibold text-gray-900">
                  {c.name}
                  {!c.client && <span className="ml-1.5 font-normal text-violet-700">equipe</span>}
                  {c.post && c.slide && <span className="ml-1.5 font-normal text-gray-500">· {posts.length > 1 ? `post ${c.post}, ` : ''}slide {c.slide}</span>}
                </span>
                <span className="text-gray-500">{timeLabel(c.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-line text-gray-800">{c.body}</p>
              {c.resolved && <p className="mt-1 text-[11px] font-medium text-emerald-700">Resolvido pela equipe</p>}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 border-t border-gray-100 px-5 py-4">
        {mode === 'idle' ? (
          <div className="flex flex-wrap gap-2">
            {item.decision !== 'aprovado' && (
              <button type="button" disabled={busy} onClick={() => void act(() => respondApproval(linkId, item.id, 'aprovado', name, ''))} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Aprovar
              </button>
            )}
            <button type="button" onClick={() => setMode('ajuste')} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:border-gray-400">
              <Undo2 className="h-4 w-4" aria-hidden /> Pedir ajuste
            </button>
            <button type="button" onClick={() => setMode('comentar')} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
              <MessageSquare className="h-4 w-4" aria-hidden /> Comentar
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!note.trim()) return
              void act(() => (mode === 'ajuste' ? respondApproval(linkId, item.id, 'ajuste', name, note) : commentApproval(linkId, item.id, name, note, where.post, where.slide)))
            }}
          >
            <label htmlFor={`n-${item.id}`} className="text-sm font-medium text-gray-900">
              {mode === 'ajuste' ? 'O que precisa mudar?' : 'Seu comentário'}
            </label>
            <textarea id={`n-${item.id}`} autoFocus rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} className={cn(field, 'mt-1.5 py-2')} placeholder={mode === 'ajuste' ? 'Ex.: trocar a foto do slide 2 e encurtar o título.' : undefined} />
            {current && (
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={onSlide} onChange={(e) => setOnSlide(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                Sobre o slide {slide + 1}
                {posts.length > 1 ? ` do ${current.name || `post ${post + 1}`}` : ''}
              </label>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" disabled={busy || !note.trim()} className={cn('inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50', mode === 'ajuste' ? 'bg-gray-900 hover:bg-black' : 'bg-gray-900 hover:bg-black')}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {mode === 'ajuste' ? 'Pedir ajuste' : 'Enviar comentário'}
              </button>
              <button type="button" onClick={() => setMode('idle')} className="h-10 rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
            </div>
          </form>
        )}
        {item.decidedName && item.decidedAt && <p className="mt-2 text-xs text-gray-500">{item.decision === 'aprovado' ? 'Aprovado' : 'Ajuste pedido'} por {item.decidedName}, {timeLabel(item.decidedAt)}.</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </article>
  )
}

const PautaApproval: React.FC = () => {
  const { id = '' } = useParams()
  const [data, setData] = useState<PublicApproval | null>(null)
  const [failed, setFailed] = useState(false)
  const [name, setName] = useState(readName)
  const [askName, setAskName] = useState(false)
  const [bulk, setBulk] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await getApproval(id))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (data?.state === 'ativo') document.title = `${data.title} · ${data.teamName}`
  }, [data])

  const saveName = (v: string) => {
    setName(v)
    try {
      localStorage.setItem(NAME_KEY, v)
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }

  const needName = () => {
    if (name.trim()) return false
    setAskName(true)
    document.getElementById('pauta-nome')?.focus()
    return true
  }

  if (failed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] p-6 text-center text-sm text-gray-600">
        <div>
          <p>Não consegui abrir agora.</p>
          <button type="button" onClick={() => void load()} className="mt-3 h-9 rounded-lg border border-gray-300 bg-white px-4 font-medium text-gray-800">
            Tentar de novo
          </button>
        </div>
      </main>
    )
  }
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4]" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-label="Abrindo" />
      </main>
    )
  }
  if (data.state !== 'ativo') {
    const text = data.state === 'revogado' ? 'Este link foi encerrado pela equipe.' : data.state === 'expirado' ? 'Este link expirou.' : 'Link não encontrado.'
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] p-6 text-center">
        <div>
          {data.teamName && <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{data.teamName}</p>}
          <p className="mt-2 text-base font-semibold text-gray-900">{text}</p>
          <p className="mt-1 text-sm text-gray-500">Peça um novo link a quem enviou.</p>
        </div>
      </main>
    )
  }

  const total = data.items.length
  const ok = data.items.filter((i) => i.decision === 'aprovado').length
  const fix = data.items.filter((i) => i.decision === 'ajuste').length
  const pending = data.items.filter((i) => i.decision === 'pendente' && !i.replaced)

  const approveAll = async () => {
    if (needName() || !pending.length) return
    setBulk(true)
    try {
      for (const it of pending) await respondApproval(data.id, it.id, 'aprovado', name, '')
    } finally {
      setBulk(false)
      void load()
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f6f4] pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{data.teamName} · para aprovar</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-gray-900">{data.title}</h1>
          {data.message && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{data.message}</p>}
          <p className="mt-3 text-sm text-gray-600">Veja cada peça, aprove ou peça ajuste. Você pode comentar sobre um slide específico.</p>

          <div className="mt-5 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-gray-900">
                {ok + fix} de {total} respondidas
              </span>
              <span className="text-xs text-gray-500">
                <span className="text-emerald-700">{ok} aprovadas</span> · <span className="text-red-700">{fix} com ajuste</span>
              </span>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
              <span className="bg-emerald-500" style={{ width: `${(ok / total) * 100}%` }} />
              <span className="bg-red-500" style={{ width: `${(fix / total) * 100}%` }} />
            </div>
            <label htmlFor="pauta-nome" className="mt-4 block text-xs font-medium text-gray-700">
              Seu nome <span className="font-normal text-gray-500">(aparece nas respostas)</span>
            </label>
            <input id="pauta-nome" value={name} maxLength={120} onChange={(e) => saveName(e.target.value)} onBlur={() => name.trim() && setAskName(false)} autoComplete="name" className={cn(field, 'mt-1 h-10', askName && !name.trim() && 'border-red-400 ring-2 ring-red-100')} />
            {askName && !name.trim() && <p className="mt-1 text-xs text-red-700">Escreva seu nome para responder.</p>}
            {pending.length > 1 && (
              <button type="button" onClick={() => void approveAll()} disabled={bulk} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:border-gray-400 disabled:opacity-60">
                {bulk ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                Aprovar as {pending.length} que faltam
              </button>
            )}
          </div>
        </header>

        <div className="mt-6 grid gap-6">
          {data.items.map((item, i) => (
            <ItemCard key={item.id} linkId={data.id} item={item} name={name} needName={needName} onDone={() => void load()} index={i} total={total} />
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-400">Link válido até {new Date(data.expiresAt).toLocaleDateString('pt-BR')}.</p>
      </div>
    </main>
  )
}

export default PautaApproval
