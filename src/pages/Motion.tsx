import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clapperboard, Images, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { setLink } from './Creatives'
import { matchesSearch, useCovers } from '@/features/criativos/covers'
import { CoverStrip, PostCover } from '@/features/criativos/SetCovers'

/**
 * Motion: a porta do menu para animar criativos. Lista os conjuntos da conta e
 * abre o escolhido no editor já na aba Motion (`?motion=1`).
 */

const motionLink = (s: SetSummary, postId?: string) => {
  const base = setLink(s).replace(/^\/criativos\//, '/motion/')
  return postId ? `${base}${base.includes('?') ? '&' : '?'}post=${postId}` : base
}

const STEPS = [
  ['Escolha um criativo', 'Qualquer conjunto da conta: feed, carrossel ou story.'],
  ['Anime', 'Abre já animado (fade in de cada camada). Troque o estilo e ajuste as barras na linha do tempo.'],
  ['Baixe o MP4', 'Vídeo em H.264, 30 fps, no tamanho do formato, pronto para reels, story ou anúncio.'],
] as const

const Motion: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyMotion, setOnlyMotion] = useState(false)
  useProjectList()
  const covered = useCovers(sets)
  const visible = covered.sets?.filter((s) => matchesSearch(s, query) && (!onlyMotion || s.postsInfo?.some((p) => p.motion))) ?? null
  const projectIds = useProjectStore((s) => s.projects).map((p) => p.id).join(',')

  const load = () =>
    listSets(projectIds ? projectIds.split(',') : [])
      .then((s) => {
        setSets(s)
        setError(false)
      })
      .catch((err) => {
        console.error(err)
        setError(true)
      })

  useEffect(() => void load(), [projectIds]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="se-page min-h-[calc(100vh-57px)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900"><Clapperboard className="h-6 w-6" /> Motion</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Transforme um criativo em vídeo animado, na marca da conta, para postar ou anunciar.</p>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
              <span className="text-xs font-semibold text-violet-700">{i + 1}</span>
              <p className="mt-1 text-sm font-semibold text-gray-900">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-gray-500">{text}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-sm font-semibold text-gray-900">Escolha o criativo</h2>
        {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Não consegui ler os conjuntos da conta. <button className="underline" onClick={() => void load()}>Tentar de novo</button></p>}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg bg-white px-3 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conjunto, projeto ou post" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={onlyMotion} onChange={(e) => setOnlyMotion(e.target.checked)} /> Só os já animados</label>
        </div>

        <div className="mt-4 space-y-4">
          {sets === null && !error && [0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" />)}
          {visible?.map((s) => {
            const posts = (s.postsInfo ?? []).filter((p) => !onlyMotion || p.motion)
            return (
              <section key={`${s.projectId ?? ''}/${s.id}`} className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
                <div className="flex items-baseline justify-between gap-3">
                  <Link to={motionLink(s)} className="min-w-0 truncate text-sm font-semibold text-gray-900 hover:underline">{s.name}</Link>
                  <span className="shrink-0 text-xs text-gray-500">{s.projectName ? `${s.projectName} · ` : ''}{s.posts} {s.posts === 1 ? 'post' : 'posts'}</span>
                </div>
                {posts.length ? (
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                    {posts.map((p) => (
                      <Link key={p.id} to={motionLink(s, p.id)} title={`Animar ${p.name}`} className="group w-28 shrink-0 focus-visible:outline-none">
                        <PostCover post={p} url={p.cover ? covered.urls[p.cover] : undefined} colors={s.colors} className="w-full transition-shadow group-hover:ring-2 group-hover:ring-violet-500 group-focus-visible:ring-2 group-focus-visible:ring-violet-500" />
                        <span className="mt-1 block truncate text-[11px] text-gray-700">{p.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link to={motionLink(s)} className="mt-3 block"><CoverStrip summary={s} urls={covered.urls} /></Link>
                )}
              </section>
            )
          })}
          {!!sets?.length && visible?.length === 0 && <p className="text-sm text-gray-500">Nada encontrado.</p>}
        </div>

        {sets?.length === 0 && (
          <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]"><Images className="h-5 w-5" /></span>
            <h3 className="mt-4 text-sm font-semibold text-gray-900">Nenhum criativo ainda</h3>
            <p className="mt-1 max-w-md text-sm text-gray-500">O motion parte de um criativo. Crie um conjunto nos Criativos e volte aqui para animar.</p>
            <Button asChild className="mt-5"><Link to="/criativos">Ir para Criativos</Link></Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Motion
