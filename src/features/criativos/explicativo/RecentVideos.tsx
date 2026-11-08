import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, AudioLines, Clapperboard, Mic, Search } from 'lucide-react'
import { listSetMedia, loadSet, mediaUsedOf, videosInfoOf } from '../storage'
import type { SetSummary, VideoInfo } from '../types'
import { LOOKS, type LookId } from './types'

/**
 * Os últimos vídeos explicativos da conta, como evidência do que foi criado (2026-11-08, o usuário:
 * "coloque os últimos vídeos como evidência na aba, quero ver o que foi criado por último"). Lê o
 * resumo de cada conjunto (`videosInfo` no index.json, sem abrir o conjunto); conjuntos recentes com
 * índice antigo são abertos uma vez. Embaixo, as tentativas que não viraram vídeo: áudio ou vídeo que
 * subiu para a pasta de um conjunto recente e que nenhum vídeo ou post usa (como a narração de uma
 * criação que não chegou a salvar).
 */

const DAY = 24 * 60 * 60_000

const when = (ms: number) => {
  const d = new Date(ms)
  const today = new Date()
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / DAY)
  return days === 0 ? `hoje ${hm}` : days === 1 ? `ontem ${hm}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hm}`
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

type Row = { set: SetSummary; video: VideoInfo }
type Orphan = { set: SetSummary; name: string; size: number; at: number; kind: 'audio' | 'video' }

export const RecentVideos: React.FC<{ sets: SetSummary[] | null; linkOf: (s: SetSummary) => string }> = ({ sets, linkOf }) => {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [orphans, setOrphans] = useState<Orphan[]>([])

  useEffect(() => {
    if (!sets) return
    let alive = true
    ;(async () => {
      const now = Date.now()
      const byRecent = [...sets].sort((a, b) => b.updatedAt - a.updatedAt)
      const info = new Map<string, { videos: VideoInfo[]; used?: string[] }>()
      for (const s of sets) if (s.videosInfo) info.set(s.id + (s.projectId ?? ''), { videos: s.videosInfo, used: s.mediaUsed })
      // Índice antigo (antes dos vídeos no resumo): abre os conjuntos mexidos nos últimos 5 dias, uma vez
      const stale = byRecent.filter((s) => !s.videosInfo && now - s.updatedAt < 5 * DAY).slice(0, 6)
      await Promise.all(
        stale.map(async (s) => {
          const set = await loadSet(s.id, s.shared ? s.projectId : undefined).catch(() => undefined)
          if (set) info.set(s.id + (s.projectId ?? ''), { videos: videosInfoOf(set), used: mediaUsedOf(set) })
        }),
      )
      if (!alive) return
      const all: Row[] = []
      for (const s of sets) for (const v of info.get(s.id + (s.projectId ?? ''))?.videos ?? []) all.push({ set: s, video: v })
      all.sort((a, b) => b.video.at - a.video.at)
      setRows(all.slice(0, 12))
      // Tentativas sem vídeo: mídias recentes (14 dias) na pasta dos conjuntos recentes que ninguém usa
      const look = byRecent.filter((s) => info.get(s.id + (s.projectId ?? ''))?.used).slice(0, 10)
      const found: Orphan[] = []
      await Promise.all(
        look.map(async (s) => {
          const used = new Set(info.get(s.id + (s.projectId ?? ''))?.used ?? [])
          for (const f of await listSetMedia(s).catch(() => [])) if (now - f.mtime < 14 * DAY && !used.has(f.id)) found.push({ set: s, name: f.name, size: f.size, at: f.mtime, kind: f.kind })
        }),
      )
      if (alive) setOrphans(found.sort((a, b) => b.at - a.at).slice(0, 8))
    })().catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [sets])

  const open = (s: SetSummary, id?: string) => {
    const [path, q] = linkOf(s).split('?')
    return `${path}/explica${q || id ? '?' : ''}${q ?? ''}${q && id ? '&' : ''}${id ? `id=${id}` : ''}`
  }

  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Clapperboard className="h-4 w-4" /> Últimos vídeos explicativos</h2>
      <p className="mt-0.5 text-xs text-gray-500">O que foi criado por último na conta (pela tela ou pela Iara), do mais novo ao mais antigo.</p>
      {rows === null ? (
        <div className="mt-3 h-20 animate-pulse rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" />
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">Nenhum vídeo explicativo salvo ainda.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ set, video }) => (
            <li key={set.id + video.id}>
              <Link to={open(set, video.id)} className="flex gap-3 rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] transition hover:shadow-[0_0_0_2px_rgb(124_58_237)]">
                <span className="flex h-16 w-10 shrink-0 items-center justify-center rounded-md text-white" style={{ background: `linear-gradient(160deg, ${set.colors[0] ?? '#111'}, ${set.colors[1] ?? set.colors[0] ?? '#444'})` }}><AudioLines className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{video.name}</span>
                  <span className="block truncate text-[11px] text-gray-500">{set.name}{set.projectName ? ` · ${set.projectName}` : ''}</span>
                  <span className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{when(video.at)}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{mmss(video.duration)} · {video.cenas} cenas</span>
                    {video.look && video.look !== 'editorial' && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-800">{LOOKS[video.look as LookId]?.label ?? video.look}</span>}
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{video.voice ? <><Mic className="mr-0.5 inline h-2.5 w-2.5" />{video.voice}</> : 'sem voz'}</span>
                    {video.research && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800"><Search className="mr-0.5 inline h-2.5 w-2.5" />{video.research}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {orphans.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> Tentativas que não viraram vídeo</p>
          <p className="mt-0.5 text-[11px] text-amber-900/80">Áudio ou vídeo que subiu para o conjunto e que nenhum vídeo usa: uma criação que parou no meio ou não chegou a salvar.</p>
          <ul className="mt-2 space-y-1">
            {orphans.map((o) => (
              <li key={o.set.id + o.name} className="flex items-center gap-2 text-xs text-gray-800">
                <span className="w-24 shrink-0 tabular-nums text-gray-500">{when(o.at)}</span>
                <span className="min-w-0 flex-1 truncate">{/^narracao-ia|\.wav$/.test(o.name) ? 'Narração por IA' : o.kind === 'video' ? 'Vídeo' : 'Áudio'} · <Link to={open(o.set)} className="font-medium hover:underline">{o.set.name}</Link> · {(o.size / 1024 / 1024).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
