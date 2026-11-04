import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clapperboard, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { setLink } from './Creatives'

/**
 * Motion: a porta do menu para animar criativos. Lista os conjuntos da conta e
 * abre o escolhido no editor já na aba Motion (`?motion=1`).
 */

const motionLink = (s: SetSummary) => setLink(s).replace(/^\/criativos\//, '/motion/')

const STEPS = [
  ['Escolha um criativo', 'Qualquer conjunto da conta: feed, carrossel ou story.'],
  ['Anime', 'Abre já animado (fade in de cada camada). Troque o estilo e ajuste as barras na linha do tempo.'],
  ['Baixe o MP4', 'Vídeo em H.264, 30 fps, no tamanho do formato, pronto para reels, story ou anúncio.'],
] as const

const Motion: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  const [error, setError] = useState(false)
  useProjectList()
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

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets === null && !error && [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" />)}
          {sets?.map((s) => (
            <Link key={s.id} to={motionLink(s)} className="group block rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_6px_16px_-6px_rgb(0_0_0/0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {s.colors.length ? s.colors.map((c) => <span key={c} className="h-5 w-5 rounded-md ring-1 ring-black/10" style={{ background: c }} />) : <span className="h-5 text-xs text-gray-400">Sem marca</span>}
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-violet-700 opacity-0 transition-opacity group-hover:opacity-100"><Clapperboard className="h-3.5 w-3.5" /> Animar</span>
              </div>
              <p className="mt-4 truncate text-sm font-semibold text-gray-900">{s.name}</p>
              <p className="mt-0.5 text-xs text-gray-500">{s.projectName ? `${s.projectName} · ` : ''}{s.posts} {s.posts === 1 ? 'post' : 'posts'}</p>
            </Link>
          ))}
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
