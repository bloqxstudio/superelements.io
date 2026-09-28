import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { renderElementorDocument } from '@/engine/elementor'
import { collectImageUrls, isLocalUrl } from '@/features/space/pageImages'
import { createLeoSchererTemplates } from '@/features/space/leoschererTemplate'

type Node = { id?: string; elType?: string; widgetType?: string; elements?: Node[] }
const WIDTHS = [1440, 1024, 768, 390]

const inspect = (sections: Node[][]) => {
  let containers = 0
  const ids = new Set<string>()
  const duplicates = new Set<string>()
  const walk = (nodes: Node[]) => nodes.forEach((node) => {
    if (node.id) { if (ids.has(node.id)) duplicates.add(node.id); ids.add(node.id) }
    if (node.elType === 'container') containers += 1
    if (node.elements) walk(node.elements)
  })
  sections.forEach(walk)
  return { containers, duplicates: [...duplicates], withoutContainer: sections.filter((roots) => !roots.some((root) => root.elType === 'container')).length }
}

const LeoSchererElementorPreview = () => {
  const [params, setParams] = useSearchParams()
  const templates = useMemo(() => createLeoSchererTemplates(), [])
  const template = templates.find((item) => item.id === params.get('t')) ?? templates[0]
  const width = WIDTHS.includes(Number(params.get('w'))) ? Number(params.get('w')) : 1440
  const raw = params.get('raw') === '1'
  const preview = useMemo(() => {
    const sections = template.sections.map((section) => JSON.parse(section.elementorJson) as Node[])
    const elements = sections.flat()
    const result = renderElementorDocument(elements, { title: `${template.name} · Elementor`, background: '#000000' })
    const images = collectImageUrls(elements)
    return { document: result.document, widgets: result.widgets, unsupported: Object.values(result.unsupported).reduce((sum, count) => sum + count, 0), warnings: result.warnings, images: images.length, localImages: images.filter(isLocalUrl).length, ...inspect(sections) }
  }, [template])

  useEffect(() => { if (raw) { document.open(); document.write(preview.document); document.close() } }, [raw, preview.document])
  if (raw) return null
  const set = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }) }
  const widgets = Object.entries(preview.widgets).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${count} ${type}`).join(' · ')
  const pass = preview.unsupported === 0 && preview.warnings.length === 0 && preview.duplicates.length === 0 && preview.withoutContainer === 0

  return <main className="min-h-screen bg-zinc-950 p-4 text-sm text-zinc-100">
    <header className="mx-auto mb-4 max-w-[1440px] space-y-3 rounded-xl bg-zinc-900 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>Leo Scherer · Elementor nativo</strong>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((item) => <button key={item.id} type="button" onClick={() => set('t', item.id)} className={`rounded-md px-2.5 py-1 ${item.id === template.id ? 'bg-sky-400 text-black' : 'bg-zinc-800 text-zinc-300'}`}>{item.name.replace('Leo Scherer · ', '')}</button>)}
          {WIDTHS.map((value) => <button key={value} type="button" onClick={() => set('w', String(value))} className={`rounded-md px-2.5 py-1 ${value === width ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-300'}`}>{value}px</button>)}
          <a className="rounded-md bg-zinc-800 px-2.5 py-1" href={`?t=${template.id}&w=${width}&raw=1`}>Tela cheia</a>
        </div>
      </div>
      <p className="text-zinc-400">{template.sections.length} seções · {preview.containers} containers · {widgets} · {preview.images} imagens ({preview.localImages} locais)</p>
      <p className={`font-mono text-xs ${pass ? 'text-emerald-300' : 'text-amber-300'}`}>html: {preview.widgets.html ?? 0} · unsupported: {preview.unsupported} · warnings: {preview.warnings.length} · ids duplicados: {preview.duplicates.length} · seções sem container: {preview.withoutContainer}</p>
    </header>
    <div className="mx-auto overflow-hidden rounded-xl bg-black" style={{ width: Math.min(width, 1440), maxWidth: '100%' }}>
      <iframe key={`${template.id}-${width}`} title={`${template.name} renderizado`} srcDoc={preview.document} className="block h-[calc(100vh-150px)] min-h-[600px] w-full border-0" />
    </div>
  </main>
}

export default LeoSchererElementorPreview

