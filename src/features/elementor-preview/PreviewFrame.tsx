import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EDITOR_BRIDGE, EDITOR_MESSAGE_TYPES, type PreviewEditorMessage } from './editorBridge'

export type { PreviewEditorMessage } from './editorBridge'

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile'

export const VIEWPORT_WIDTH: Record<PreviewViewport, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
}

// Roda dentro do iframe e avisa a página qual a altura do conteúdo. Mede o
// body: o scrollHeight do documento nunca fica menor que o próprio iframe, e
// uma seção mais baixa que a altura inicial ficaria com espaço em branco.
const HEIGHT_SCRIPT = `<script>(function(){function post(){parent.postMessage({type:'se-preview-height',height:document.body.scrollHeight},'*')}new ResizeObserver(post).observe(document.body);addEventListener('load',post);post()})()</script>`

// Cabe uma landing page inteira; só segura algum conteúdo que cresça junto com o iframe.
const MAX_HEIGHT = 30000

// Altura de tela usada para `vh`: o iframe cresce com o conteúdo, então o
// motor escreve vh como var(--se-vh) e o preview fixa o valor por device.
export const SCREEN_HEIGHT: Record<PreviewViewport | 'fluid', number> = {
  desktop: 900,
  tablet: 1024,
  mobile: 812,
  fluid: 900,
}

interface PreviewFrameProps {
  html: string
  /** Device simulado; "fluid" usa a largura do container, sem escala nem moldura. */
  viewport: PreviewViewport | 'fluid'
  /** Legenda com a largura e a escala abaixo do preview. */
  showSize?: boolean
  /** Seleção, arrasto e edição direta dos elementos dentro do iframe. */
  interactive?: boolean
  /** Camada selecionada e a destacada de fora (árvore do Navigator). */
  selectedElementId?: string
  hoveredElementId?: string
  onEditorMessage?: (message: PreviewEditorMessage) => void
  /** O iframe, para quem precisa mandar mensagens a ele (soltar um elemento vindo do painel). */
  frameRef?: React.MutableRefObject<HTMLIFrameElement | null>
  /** Desenho por cima do preview, em px do iframe vezes `scale`. */
  overlay?: (scale: number) => React.ReactNode
}

const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const shortText = (value: unknown) => (typeof value === 'string' && value.length <= 32 ? value : '')

/** Reemite no elemento do iframe o gesto que o preview devolveu, para o canvas tratar como se fosse dele. */
const redispatchGesture = (frame: HTMLIFrameElement, data: Record<string, unknown>) => {
  if (data.type === 'se-preview-key') {
    if (data.event !== 'keydown' && data.event !== 'keyup') return
    frame.dispatchEvent(
      new KeyboardEvent(data.event, {
        key: shortText(data.key),
        code: shortText(data.code),
        ctrlKey: data.ctrlKey === true,
        metaKey: data.metaKey === true,
        shiftKey: data.shiftKey === true,
        altKey: data.altKey === true,
        repeat: data.repeat === true,
        bubbles: true,
        cancelable: true,
      }),
    )
    return
  }
  // O iframe está escalado duas vezes (encaixe na largura e zoom do canvas); a caixa dele diz quanto
  const box = frame.getBoundingClientRect()
  const ratio = frame.offsetWidth ? box.width / frame.offsetWidth : 1
  const deltaMode = finite(data.deltaMode)
  frame.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: box.left + finite(data.x) * ratio,
      clientY: box.top + finite(data.y) * ratio,
      deltaX: finite(data.deltaX),
      deltaY: finite(data.deltaY),
      deltaMode: deltaMode === 1 || deltaMode === 2 ? deltaMode : 0,
      ctrlKey: data.ctrlKey === true,
      metaKey: data.metaKey === true,
      shiftKey: data.shiftKey === true,
    }),
  )
}

/**
 * O que muda de um documento para o outro sem recarregar o iframe: os estilos
 * do motor, as folhas de fonte e a árvore do .elementor. Documento com script
 * no corpo (carrossel, animação, widget HTML) precisa recarregar para rodar.
 */
function morphPayload(html: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const root = parsed.querySelector('body > .elementor')
  if (!root || parsed.body.querySelector('script')) return null
  const style = (id: string) => parsed.getElementById(id)?.textContent ?? undefined
  return {
    type: 'se-morph',
    styles: { 'se-base': style('se-base'), 'se-elements': style('se-elements'), 'se-motion': style('se-motion') },
    links: [...parsed.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute('href')),
    html: root.outerHTML,
  }
}

/**
 * Mostra o documento gerado pelo motor num iframe isolado (sandbox sem
 * allow-same-origin), na largura real do device e escalado para caber.
 * Interativo, ganha a ponte do editor visual: seleção, arrasto, texto direto,
 * roda e teclas de volta para o canvas, e atualização sem recarregar.
 */
const PreviewFrameBase: React.FC<PreviewFrameProps> = ({
  html,
  viewport,
  showSize = true,
  interactive = false,
  selectedElementId,
  hoveredElementId,
  onEditorMessage,
  frameRef,
  overlay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [height, setHeight] = useState(600)
  // Documento carregado no iframe; mudanças que dão para aplicar por dentro não trocam o srcDoc
  const [frameHtml, setFrameHtml] = useState(html)
  const ready = useRef(false)
  const state = useRef({ selectedElementId, hoveredElementId })
  state.current = { selectedElementId, hoveredElementId }
  const listener = useRef(onEditorMessage)
  listener.current = onEditorMessage

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Seleção, destaque e escala na tela, para a ponte medir e calcular as bordas de soltar. */
  const postState = () => {
    const frame = iframeRef.current
    if (!interactive || !ready.current || !frame?.contentWindow) return
    const box = frame.getBoundingClientRect()
    frame.contentWindow.postMessage(
      {
        type: 'se-editor-state',
        selectedId: state.current.selectedElementId ?? '',
        hoverId: state.current.hoveredElementId ?? '',
        scale: frame.offsetWidth ? box.width / frame.offsetWidth : 1,
      },
      '*',
    )
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current
      if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return
      const type = event.data.type
      if (type === 'se-preview-height') {
        setHeight(Math.min(MAX_HEIGHT, Math.max(80, Math.ceil(finite(event.data.height)))))
      } else if (type === 'se-preview-wheel' || type === 'se-preview-key') {
        redispatchGesture(frame, event.data)
      } else if (type === 'se-ready') {
        ready.current = true
        postState()
      } else if (EDITOR_MESSAGE_TYPES.has(type)) {
        listener.current?.(event.data as PreviewEditorMessage)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // postState lê tudo por refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

  useEffect(postState, [interactive, selectedElementId, hoveredElementId])

  // Editando, a seção muda por dentro do iframe: sem piscar e sem perder a seleção
  useEffect(() => {
    if (html === frameHtml) return
    const frame = iframeRef.current
    const payload = interactive && ready.current && frame?.contentWindow ? morphPayload(html) : null
    if (payload) frame!.contentWindow!.postMessage(payload, '*')
    else {
      ready.current = false
      setFrameHtml(html)
    }
    // frameHtml só troca quando o iframe recarrega
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, interactive])

  const srcDoc = useMemo(() => {
    ready.current = false
    return frameHtml
      .replace('</head>', `<style>:root{--se-vh:${SCREEN_HEIGHT[viewport] / 100}px}</style></head>`)
      .replace('</body>', `${interactive ? EDITOR_BRIDGE : ''}${HEIGHT_SCRIPT}</body>`)
  }, [frameHtml, viewport, interactive])

  // Ligar ou desligar a ponte recarrega com o documento mais novo
  useEffect(() => {
    setFrameHtml(html)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, viewport])

  const fluid = viewport === 'fluid'
  const width = fluid ? containerWidth : VIEWPORT_WIDTH[viewport]
  const scale = !fluid && containerWidth ? Math.min(1, containerWidth / width) : 1

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div className={fluid ? 'h-full overflow-hidden bg-white' : 'h-full overflow-hidden rounded-md border bg-white shadow-sm'}>
          <iframe
            ref={(el) => {
              iframeRef.current = el
              if (frameRef) frameRef.current = el
            }}
            title="Preview do componente"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            onMouseEnter={postState}
            style={{ width, height, border: 0, display: 'block', transform: `scale(${scale})`, transformOrigin: '0 0' }}
          />
        </div>
        {overlay && <div className="pointer-events-none absolute inset-0">{overlay(scale)}</div>}
      </div>
      {!fluid && showSize && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {width}px · {Math.round(scale * 100)}%
        </p>
      )}
    </div>
  )
}

export const PreviewFrame = React.memo(PreviewFrameBase)
