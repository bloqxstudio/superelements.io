import React, { useEffect, useRef, useState } from 'react'
import { agentStatus, useAgents, type AgentRun, type AgentView } from '@/features/space/bridge/agentsStore'
import { AGENT_COLOR } from './agentStatus'

/** Largura em que a página é montada: a do player no desktop. */
const PAGE_WIDTH = 1440
/** Espera as mudanças seguidas assentarem antes de pedir a página de novo. */
const SETTLE = 350
/** Um pouco da seção de cima aparece, para ver onde a seção está na página. */
const CONTEXT_ABOVE = 64

/** A última prévia de cada agente: voltar à tela mostra na hora, enquanto a nova chega. */
const cache = new Map<string, AgentView>()

const sameView = (a: AgentView | undefined, b: AgentView) =>
  !!a && a.html === b.html && a.anchor === b.anchor && a.working === b.working && a.pending.join() === b.pending.join()

const cssId = (id: string) => id.replace(/["\\]/g, '')

/**
 * A página montada como no player, com as marcas do agente: o esqueleto do
 * plano borrado e a seção em que ele mexe contornada, com uma varredura
 * enquanto ele trabalha. Sem scripts: a prévia mostra a composição parada.
 */
const decorate = (view: AgentView) => {
  const focus = view.working ?? view.anchor
  const rules = [
    'html{scrollbar-width:none}html::-webkit-scrollbar{display:none}',
    ...view.pending.map((id) => `[data-id="${cssId(id)}"]{filter:blur(8px) saturate(.5);opacity:.7}`),
    focus && `[data-id="${cssId(focus)}"]{position:relative;outline:8px solid ${AGENT_COLOR};outline-offset:-8px}`,
    view.working &&
      `[data-id="${cssId(view.working)}"]::after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:linear-gradient(180deg,transparent,rgb(217 119 87 / .2),transparent) no-repeat;background-size:100% 40%;animation:se-preview-scan 1.8s ease-in-out infinite}`,
    '@keyframes se-preview-scan{from{background-position:0 -60%}to{background-position:0 160%}}',
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}',
  ]
  return view.html.replace('</head>', `<style id="se-agent-preview">${rules.filter(Boolean).join('')}</style></head>`)
}

interface Layer {
  id: number
  view: AgentView
  ready: boolean
}

/** Prévia ao vivo da página em que o agente trabalha; atualiza a cada mudança dele. `onPage` diz qual página é. */
export const AgentPreview: React.FC<{ run: AgentRun; onPage?: (name: string) => void }> = ({ run, onPage }) => {
  const requestView = useAgents((s) => s.requestView)
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [layers, setLayers] = useState<Layer[]>(() => {
    const cached = cache.get(run.key)
    return cached ? [{ id: 0, view: cached, ready: true }] : []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = agentStatus(run)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Cada mudança do agente (gravou, marcou outra seção, mudou de página) pede a página de novo
  useEffect(() => {
    if (!requestView) return
    let alive = true
    const timer = setTimeout(() => {
      setLoading(true)
      requestView({ projectId: run.projectId, page: run.pageId, section: run.sectionId, open: true })
        .then((view) => {
          if (!alive) return
          setError(null)
          if (sameView(cache.get(run.key), view)) return
          cache.set(run.key, view)
          // Id sempre maior que o das camadas na tela (o contador fica no componente: recarregar o módulo não o zera)
          setLayers((current) => [...current.filter((l) => l.ready).slice(-1), { id: Math.max(-1, ...current.map((l) => l.id)) + 1, view, ready: false }])
        })
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setLoading(false))
    }, SETTLE)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [requestView, run.key, run.projectId, run.pageId, run.sectionId, run.rev, run.now])

  const scale = box.width / PAGE_WIDTH
  const frameHeight = scale ? box.height / scale : 0

  /** A página nova entra por cima da anterior já rolada até onde o agente está, sem piscar. */
  const onLoad = (layer: Layer, frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument
    const focus = layer.view.working ?? layer.view.anchor
    const target = focus ? doc?.querySelector(`[data-id="${cssId(focus)}"]`) : null
    if (doc && target && frame.contentWindow) {
      const top = target.getBoundingClientRect().top + frame.contentWindow.scrollY
      frame.contentWindow.scrollTo(0, Math.max(0, top - CONTEXT_ABOVE))
    }
    setLayers((current) => current.filter((l) => l.id >= layer.id).map((l) => (l.id === layer.id ? { ...l, ready: true } : l)))
  }

  const shown = [...layers].reverse().find((l) => l.ready) ?? layers[layers.length - 1]
  const empty = shown && !shown.view.html
  const pageName = shown?.view.pageName
  useEffect(() => {
    if (pageName) onPage?.(pageName)
  }, [pageName, onPage])

  return (
    <div
      ref={boxRef}
      className="relative aspect-[16/10] overflow-hidden bg-zinc-50 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:16px_16px]"
    >
      {scale > 0 &&
        layers.map((layer) =>
          layer.view.html ? (
            <iframe
              key={layer.id}
              title={`Prévia de ${layer.view.pageName}`}
              aria-hidden={layer !== shown}
              tabIndex={-1}
              sandbox="allow-same-origin"
              srcDoc={decorate(layer.view)}
              onLoad={(e) => onLoad(layer, e.currentTarget)}
              className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity duration-300 motion-reduce:transition-none"
              style={{ width: PAGE_WIDTH, height: frameHeight, transform: `scale(${scale})`, opacity: layer.ready ? 1 : 0 }}
            />
          ) : null
        )}

      {!shown && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-gray-500">
          {error ? `Prévia indisponível: ${error}` : requestView ? 'Abrindo o projeto…' : 'A prévia precisa da ponte dos agentes (npm run dev).'}
        </div>
      )}
      {empty && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">{shown.view.pageName}: página ainda vazia</div>}

      {loading && shown && (
        <span className="absolute bottom-2.5 right-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[11px] text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
          Atualizando<span aria-hidden className="se-agent-dots" />
        </span>
      )}
      {status === 'working' && run.now && (
        <span className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-124px)] items-center gap-1.5 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_4px_12px_-4px_rgb(0_0_0/0.18)]">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-pulse" style={{ background: AGENT_COLOR }} />
          <span className="truncate">{run.now}</span>
        </span>
      )}
    </div>
  )
}
