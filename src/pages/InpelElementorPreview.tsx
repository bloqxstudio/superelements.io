import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { renderElementorDocument } from '@/engine/elementor'
import { collectImageUrls, isLocalUrl } from '@/features/space/pageImages'
import { createInpelTemplates } from '@/features/space/inpelTemplate'

/**
 * Validação da Inpel: renderiza o JSON nativo do Elementor (não uma réplica em
 * React) e mostra os números de aceite. `?t=` escolhe o template, `?w=` a
 * largura do quadro e `?raw=1` abre o documento gerado sozinho, em tela cheia.
 */

type Node = { id?: string; elType?: string; widgetType?: string; elements?: Node[] }

const WIDTHS = [1440, 1024, 768, 390]

const inspect = (sections: Node[][]) => {
  let containers = 0
  const ids = new Set<string>()
  const duplicates = new Set<string>()
  const walk = (items: Node[]) => items.forEach((item) => {
    if (item.id) {
      if (ids.has(item.id)) duplicates.add(item.id)
      ids.add(item.id)
    }
    if (item.elType === 'container') containers += 1
    if (Array.isArray(item.elements)) walk(item.elements)
  })
  sections.forEach(walk)
  const withoutContainer = sections.filter((roots) => !roots.some((root) => root.elType === 'container')).length
  return { containers, duplicates: [...duplicates], withoutContainer }
}

const InpelElementorPreview = () => {
  const [params, setParams] = useSearchParams()
  const templates = useMemo(() => createInpelTemplates(), [])
  const template = templates.find((item) => item.id === params.get('t')) ?? templates[0]
  const width = WIDTHS.includes(Number(params.get('w'))) ? Number(params.get('w')) : 1440
  const raw = params.get('raw') === '1'

  const preview = useMemo(() => {
    const sections = template.sections.map((section) => JSON.parse(section.elementorJson) as Node[])
    const elements = sections.flat()
    const result = renderElementorDocument(elements, { title: `${template.name} · Elementor`, background: '#FFFFFF' })
    const images = collectImageUrls(elements)
    return {
      document: result.document,
      widgets: result.widgets,
      unsupported: Object.values(result.unsupported).reduce((sum, count) => sum + count, 0),
      warnings: result.warnings,
      images: images.length,
      localImages: images.filter(isLocalUrl).length,
      ...inspect(sections),
    }
  }, [template])

  useEffect(() => {
    if (!raw) return
    document.open()
    document.write(preview.document)
    document.close()
  }, [raw, preview.document])

  if (raw) return null

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }
  const widgetSummary = Object.entries(preview.widgets).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${count} ${type}`).join(' · ')
  const html = preview.widgets.html ?? 0
  const pass = preview.unsupported === 0 && preview.warnings.length === 0 && preview.duplicates.length === 0 && preview.withoutContainer === 0

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-sm text-zinc-100">
      <header className="mx-auto mb-4 max-w-[1440px] space-y-3 rounded-xl bg-zinc-900 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong>Inpel · Elementor nativo</strong>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((item) => (
              <button key={item.id} type="button" onClick={() => set('t', item.id)} aria-pressed={item.id === template.id}
                className={`rounded-md px-2.5 py-1 transition-colors ${item.id === template.id ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                {item.name.replace('Inpel · ', '')}
              </button>
            ))}
            <span className="mx-1 w-px bg-zinc-700" aria-hidden="true" />
            {WIDTHS.map((value) => (
              <button key={value} type="button" onClick={() => set('w', String(value))} aria-pressed={value === width}
                className={`rounded-md px-2.5 py-1 tabular-nums transition-colors ${value === width ? 'bg-zinc-100 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                {value}px
              </button>
            ))}
            <a className="rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-300 hover:bg-zinc-700" href={`?t=${template.id}&raw=1`}>Tela cheia</a>
          </div>
        </div>
        <p className="text-zinc-400">
          {template.sections.length} seções · {preview.containers} containers · {widgetSummary} · {preview.images} imagens ({preview.localImages} locais)
        </p>
        <p className={`font-mono text-xs ${pass ? 'text-emerald-300' : 'text-amber-300'}`}>
          html: {html} · unsupported: {preview.unsupported} · warnings: {preview.warnings.length} · ids duplicados: {preview.duplicates.length} · seções sem container: {preview.withoutContainer}
          {preview.warnings.length > 0 && <span className="block text-amber-300">{preview.warnings.join(' | ')}</span>}
        </p>
      </header>
      <div className="mx-auto overflow-hidden rounded-xl bg-white" style={{ width: Math.min(width, 1440), maxWidth: '100%' }}>
        {/* Altura fixa com rolagem própria: o quadro se comporta como a janela do navegador (100svh, cabeçalho fixo). */}
        <iframe key={`${template.id}-${width}`} title={`${template.name} renderizado`} srcDoc={preview.document}
          className="block h-[calc(100vh-150px)] min-h-[600px] w-full border-0" />
      </div>
    </main>
  )
}

export default InpelElementorPreview
