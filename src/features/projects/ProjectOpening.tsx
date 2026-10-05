import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { sectionsInView, useSectionLoading } from '@/features/space/opening'
import { useSpaceStore } from '@/store/spaceStore'

/** Seção que não carrega não segura a abertura mais do que isso. */
const MAX_WAIT = 8000
/** A fonte do app atrasada (rede lenta) também não. */
const FONTS_WAIT = 3000
/** Duração da saída (a tela some e o canvas aparece por baixo). */
const LEAVE_MS = 280

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

interface ProjectOpeningProps {
  /** Nome do projeto, quando a lista da conta já chegou. */
  name?: string
  /** O conteúdo já está no canvas: daqui em diante espera as seções que aparecem na tela. */
  ready: boolean
}

/**
 * Tela da abertura de um projeto, por cima do Space. Fica enquanto o conteúdo
 * vem da conta e, depois, até as seções que aparecem na tela terminarem de
 * carregar (e a fonte do app), para o canvas aparecer já no lugar. Monte com
 * `key` do projeto: cada abertura começa de novo.
 */
export const ProjectOpening: React.FC<ProjectOpeningProps> = ({ name, ready }) => {
  const rootRef = useRef<HTMLDivElement>(null)
  // As seções que a pessoa vai ver ao abrir, contadas uma vez, com o canvas na posição salva
  const [targets, setTargets] = useState<string[] | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [phase, setPhase] = useState<'open' | 'leaving' | 'gone'>('open')
  const loadedCount = useSectionLoading((s) => (targets ? targets.filter((id) => s.loaded[id]).length : 0))

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!ready || targets || !root) return
    const { nodes, canvasTransform } = useSpaceStore.getState()
    setTargets(sectionsInView(nodes, canvasTransform, root.clientWidth, root.clientHeight))
  }, [ready, targets])

  useEffect(() => {
    if (!ready) return
    let active = true
    // A fonte do app chega depois do primeiro desenho e muda a largura das barras
    if (document.fonts) void document.fonts.ready.then(() => active && setFontsReady(true))
    const fonts = setTimeout(() => setFontsReady(true), document.fonts ? FONTS_WAIT : 0)
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT)
    return () => {
      active = false
      clearTimeout(fonts)
      clearTimeout(timer)
    }
  }, [ready])

  const total = targets?.length ?? 0
  const done = !!targets && fontsReady && (loadedCount >= total || timedOut)

  useEffect(() => {
    if (done && phase === 'open') setPhase(reducedMotion() ? 'gone' : 'leaving')
  }, [done, phase])

  useEffect(() => {
    if (phase !== 'leaving') return
    const timer = setTimeout(() => setPhase('gone'), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === 'gone') return null

  // A conta responde primeiro, depois as seções enchem o resto da barra
  const progress = done ? 1 : !ready ? 0.12 : 0.2 + 0.75 * (total ? loadedCount / total : 1)
  const caption = !ready
    ? 'Abrindo o projeto'
    : done
      ? 'Pronto'
      : total
        ? `Carregando as seções · ${loadedCount} de ${total}`
        : 'Preparando o canvas'

  return (
    <div
      ref={rootRef}
      data-project-opening
      role="status"
      aria-live="polite"
      aria-busy={!done}
      className={`absolute inset-0 z-[60] flex items-center justify-center bg-[#f4f4f5] transition-opacity ease-out motion-reduce:transition-none ${
        phase === 'leaving' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${LEAVE_MS}ms` }}
    >
      <div className={`flex w-64 flex-col gap-3 rounded-xl px-4 py-3.5 ${ISLAND_SURFACE}`}>
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
          <p className="min-w-0 truncate text-[13px] font-semibold text-gray-900">{name ?? 'Projeto'}</p>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-gray-100" aria-hidden>
          <div
            className="h-full origin-left rounded-full bg-gray-900 transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
        <p className="text-[11px] tabular-nums text-gray-500">{caption}</p>
      </div>
    </div>
  )
}
