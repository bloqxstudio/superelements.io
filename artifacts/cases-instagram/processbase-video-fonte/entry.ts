import './setup-window'
import { renderElementorDocument } from '@/engine/elementor'
import { createProcessBaseTemplate } from '@/features/space/processbaseTemplate'
import { PROCESSBASE_GRAPH_SCRIPT } from '@/features/space/processbaseGraph'
import { PROCESSBASE_EMBLEM_SCRIPT } from '@/features/processbase/emblem3d'
import { EMBLEM_PIECES } from '@/features/processbase/emblem'
import { writeFileSync } from 'node:fs'

const template = createProcessBaseTemplate()
const elements = template.sections.flatMap((s) => JSON.parse(s.elementorJson))
const doc = renderElementorDocument(elements, { title: 'ProcessBase', background: '#171A2C', motion: 'play' })
writeFileSync('pb-page.html', doc.document)
const still = renderElementorDocument(elements, { title: 'ProcessBase', background: '#171A2C', motion: 'static' })
writeFileSync('pb-static.html', still.document)
writeFileSync('pb-scripts.js', `window.PB_GRAPH=${JSON.stringify(PROCESSBASE_GRAPH_SCRIPT)};window.PB_EMBLEM=${JSON.stringify(PROCESSBASE_EMBLEM_SCRIPT)};window.PB_PIECES=${JSON.stringify(EMBLEM_PIECES)};`)
console.log('sections', template.sections.map((s) => s.name).join(' | '), 'warnings', doc.warnings.length)
