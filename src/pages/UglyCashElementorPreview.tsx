import { useMemo } from 'react'
import { renderElementorDocument } from '@/engine/elementor'
import { createUglyCashTemplate } from '@/features/space/uglyCashTemplate'

const UglyCashElementorPreview = () => {
  const preview = useMemo(() => {
    const template = createUglyCashTemplate()
    const elements = template.sections.flatMap(section => JSON.parse(section.elementorJson))
    let containers = 0
    const walk = (items: Array<{ elType?: string; elements?: unknown[] }>) => items.forEach(item => {
      if (item.elType === 'container') containers += 1
      if (Array.isArray(item.elements)) walk(item.elements as Array<{ elType?: string; elements?: unknown[] }>)
    })
    walk(elements)
    const result = renderElementorDocument(elements, { title: 'UGLYCASH · Elementor native preview', background: '#F2F2F2' })
    return {
      html: result.html,
      styles: [...result.document.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]),
      widgets: result.widgets,
      containers,
      unsupported: result.unsupported,
      warnings: result.warnings,
    }
  }, [])

  return <main className="min-h-screen bg-zinc-950 p-4 text-white">
    <div className="mx-auto mb-4 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm">
      <div><strong>UGLYCASH · Elementor nativo</strong><span className="ml-3 text-zinc-400">8 seções · {preview.containers} containers · {preview.widgets.heading ?? 0} headings · {preview.widgets['text-editor'] ?? 0} textos · {preview.widgets.image ?? 0} imagens · {preview.widgets.video ?? 0} vídeo · {preview.widgets.html ?? 0} HTML</span></div>
      <code className="text-xs text-lime-300">unsupported: {Object.keys(preview.unsupported).length} · warnings: {preview.warnings.length}</code>
    </div>
    <style>{`@font-face{font-family:"Helvetica Now Display Cn";src:url('/uglycash/assets/helvetica-now-condensed-bold.woff2') format('woff2');font-weight:700;font-display:swap}@font-face{font-family:Inter;src:url('/uglycash/assets/inter-400.woff2') format('woff2');font-weight:400 700;font-display:swap}`}</style>
    {preview.styles.map((css, index) => <style key={index} dangerouslySetInnerHTML={{ __html: css }} />)}
    <div className="mx-auto max-w-[1440px] overflow-hidden rounded-xl bg-white" dangerouslySetInnerHTML={{ __html: preview.html }} />
  </main>
}

export default UglyCashElementorPreview
