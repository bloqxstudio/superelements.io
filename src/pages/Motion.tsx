import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AudioLines, Clapperboard, Loader2, Plus, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AreaTabs } from '@/features/navigation/AreaTabs'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { coverUrls, listSets, loadSet, videosInfoOf } from '@/features/criativos/storage'
import type { SetSummary, VideoInfo } from '@/features/criativos/types'
import { setLink } from './Creatives'

/**
 * /motion — a área dos vídeos (2026-11-09; o usuário: "crie uma área 100% focada em vídeos… aqui não precisa
 * mostrar nada estático, somente os vídeos que temos"). Todos os vídeos da conta, de todos os conjuntos, com a
 * capa (tirada da própria animação, `VideoStudio.tsx`), do mais novo para o mais antigo. Cada um abre no estúdio
 * único (`/motion/:setId/video`). Animar um post estático continua no editor de Criativos (aba Motion).
 */

const DAY = 86_400_000
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const when = (ms: number) => {
  const days = Math.floor((Date.now() - ms) / DAY)
  return days < 1 ? 'hoje' : days === 1 ? 'ontem' : days < 30 ? `há ${days} dias` : new Date(ms).toLocaleDateString('pt-BR')
}
const studioOf = (s: SetSummary) => {
  const [path, q] = setLink(s).replace(/^\/criativos\//, '/motion/').split('?')
  return { path: `${path}/video`, q: q ?? '' }
}
const videoLink = (s: SetSummary, id?: string, extra = '') => {
  const { path, q } = studioOf(s)
  const params = [q, id ? `id=${id}` : '', extra].filter(Boolean).join('&')
  return `${path}${params ? `?${params}` : ''}`
}

type Row = { set: SetSummary; video: VideoInfo }

const VideoCard: React.FC<{ row: Row; cover?: string }> = ({ row, cover }) => {
  const { video: v, set } = row
  const anim = v.kind === 'animacao'
  return (
    <Link to={videoLink(set, v.id)} className="group block overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgb(0_0_0/0.12),0_8px_20px_-10px_rgb(0_0_0/0.25)]">
      <div className="relative aspect-[9/16] bg-gray-900">
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-violet-900 text-white/70">
            {anim ? <Sparkles className="h-8 w-8" /> : <AudioLines className="h-8 w-8" />}
          </div>
        )}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">{mmss(v.duration)}</span>
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-900">{anim ? 'Animação' : 'Roteiro e voz'}</span>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">{v.name}</p>
        <p className="mt-1 truncate text-[11px] text-gray-500">{set.name} · {when(v.at)}{v.voice ? ` · ${v.voice}` : ''}</p>
      </div>
    </Link>
  )
}

const Motion: React.FC = () => {
  const navigate = useNavigate()
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'todos' | 'animacao' | 'roteiro'>('todos')
  const [target, setTarget] = useState('')
  useProjectList()
  const projectIds = useProjectStore((s) => s.projects).map((p) => p.id).join(',')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const list = await listSets(projectIds ? projectIds.split(',') : [])
      if (!alive) return
      setSets(list)
      setTarget((t) => t || list[0]?.id || '')
      const info = new Map<string, VideoInfo[]>()
      for (const s of list) if (s.videosInfo) info.set(s.id, s.videosInfo)
      // Índice de antes da ferramenta única (sem as animações): relê os conjuntos mexidos nos últimos 30 dias
      const stale = [...list].sort((a, b) => b.updatedAt - a.updatedAt).filter((s) => Date.now() - s.updatedAt < 30 * DAY && !(s.videosInfo ?? []).some((v) => v.kind)).slice(0, 10)
      await Promise.all(stale.map(async (s) => {
        const set = await loadSet(s.id, s.shared ? s.projectId : undefined).catch(() => undefined)
        if (set) info.set(s.id, videosInfoOf(set))
      }))
      const all: Row[] = []
      for (const s of list) for (const v of info.get(s.id) ?? []) all.push({ set: s, video: v })
      all.sort((a, b) => b.video.at - a.video.at)
      if (!alive) return
      setRows(all)
      const paths = all.flatMap((r) => (r.video.cover ? [r.video.cover] : []))
      if (paths.length) setCovers(await coverUrls(paths).catch(() => ({})))
    })().catch(() => alive && (setSets([]), setRows([])))
    return () => { alive = false }
  }, [projectIds])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter((r) => (kind === 'todos' || (r.video.kind ?? 'roteiro') === kind) && (!q || `${r.video.name} ${r.set.name}`.toLowerCase().includes(q)))
  }, [rows, query, kind])
  const chosen = sets?.find((s) => s.id === target)

  return (
    <div className="se-page min-h-[calc(100vh-57px)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <AreaTabs area="criativos" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900"><Clapperboard className="h-6 w-6" /> Vídeos</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Todos os vídeos da conta, num estúdio só: animações a partir de referências, vídeos com roteiro e voz, e comerciais em código. Cada um com capa, prévia e MP4.</p>
          </div>
          <div className="flex items-center gap-2">
            {sets && sets.length > 1 && (
              <select aria-label="Conjunto do vídeo novo" value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 max-w-[14rem] rounded-md border border-gray-200 bg-white px-2 text-sm">
                {sets.map((s) => <option key={s.id + (s.projectId ?? '')} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <Button className="gap-1.5" disabled={!chosen} onClick={() => chosen && navigate(videoLink(chosen, undefined, 'novo=escolher'))}><Plus className="h-4 w-4" /> Novo vídeo</Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {([['todos', 'Todos'], ['animacao', 'Animações'], ['roteiro', 'Roteiro e voz']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={`h-8 rounded-full border px-3 text-xs font-medium ${kind === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>{label}</button>
          ))}
          <label className="ml-auto flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3">
            <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar vídeo" aria-label="Buscar vídeo" className="w-40 bg-transparent text-xs outline-none" />
          </label>
        </div>

        {!rows ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo os vídeos</p>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-gray-800">Nenhum vídeo ainda</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">Comece a partir de uma referência salva em <Link to="/referencias" className="underline">Referências</Link>: a IA recria a animação na sua marca, com narração.</p>
            {chosen && <Button className="mt-4" size="sm" onClick={() => navigate(videoLink(chosen, undefined, 'novo=referencia'))}><Sparkles className="mr-1.5 h-4 w-4" /> Criar a partir de uma referência</Button>}
          </div>
        ) : shown.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">Nenhum vídeo neste filtro.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((r) => <VideoCard key={`${r.set.id}:${r.video.id}`} row={r} cover={r.video.cover ? covers[r.video.cover] : undefined} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export default Motion
