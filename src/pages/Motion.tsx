import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AudioLines, Clapperboard, Images, Mic, Search, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { setLink } from './Creatives'
import { matchesSearch, useCovers } from '@/features/criativos/covers'
import { CoverStrip, PostCover } from '@/features/criativos/SetCovers'
import { RecentVideos } from '@/features/criativos/explicativo/RecentVideos'

/**
 * Motion: a porta do menu para animar criativos. Lista os conjuntos da conta e
 * abre o escolhido no editor já na aba Motion (`?motion=1`).
 */

const motionLink = (s: SetSummary, postId?: string) => {
  const base = setLink(s).replace(/^\/criativos\//, '/motion/')
  return postId ? `${base}${base.includes('?') ? '&' : '?'}post=${postId}` : base
}

const explainerLink = (s: SetSummary) => {
  const [path, q] = motionLink(s).split('?')
  return `${path}/explica?${q ? `${q}&` : ''}novo=1`
}

/** Porta do vídeo explicativo: gravar ou enviar a fala e escolher o conjunto (marca e pasta das mídias). */
const ExplainerEntry: React.FC<{ sets: SetSummary[] | null }> = ({ sets }) => {
  const navigate = useNavigate()
  const [pick, setPick] = useState('')
  const chosen = sets?.find((s) => `${s.projectId ?? ''}/${s.id}` === pick) ?? sets?.[0]
  return (
    <section className="mt-6 overflow-hidden rounded-2xl bg-gray-950 p-5 text-white md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-300"><AudioLines className="h-4 w-4" /> Novo · Vídeo explicativo</p>
          <h2 className="mt-1.5 text-lg font-semibold">Grave ou envie sua fala. Sai uma animação explicando o que você disse.</h2>
          <p className="mt-1 max-w-xl text-sm text-gray-300">Texto cinético no ritmo da voz, objetos animando, legenda palavra por palavra, fotos tratadas e efeitos de som nas transições. A IA escreve o roteiro animado; o vídeo sai pronto para publicar.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Video className="h-3 w-3" /> Gravar vídeo</span>
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Mic className="h-3 w-3" /> Gravar ou enviar áudio</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5">Vídeo de referência</span>
          </div>
        </div>
        <div className="w-full shrink-0 md:w-72">
          {sets === null ? <div className="h-20 animate-pulse rounded-lg bg-white/10" /> : sets.length ? (
            <>
              <label className="text-[11px] text-gray-400">Na marca e na pasta do conjunto
                <select value={pick || (chosen ? `${chosen.projectId ?? ''}/${chosen.id}` : '')} onChange={(e) => setPick(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white">
                  {sets.map((s) => (<option key={`${s.projectId ?? ''}/${s.id}`} value={`${s.projectId ?? ''}/${s.id}`} className="text-gray-900">{s.name}{s.projectName ? ` · ${s.projectName}` : ''}</option>))}
                </select>
              </label>
              <Button className="mt-2 w-full bg-white text-gray-900 hover:bg-gray-100" disabled={!chosen} onClick={() => chosen && navigate(explainerLink(chosen))}>Criar vídeo explicativo</Button>
              {chosen && <Link to={explainerLink(chosen).replace(/[?&]novo=1$/, '')} className="mt-1.5 block text-center text-xs text-gray-400 hover:text-white hover:underline">Ver os vídeos deste conjunto</Link>}
            </>
          ) : (
            <p className="text-sm text-gray-300">Crie um conjunto nos <Link to="/criativos" className="underline">Criativos</Link> primeiro: ele guarda a marca e as mídias do vídeo.</p>
          )}
        </div>
      </div>
    </section>
  )
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

        <ExplainerEntry sets={sets} />
        <RecentVideos sets={sets} linkOf={motionLink} />

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
