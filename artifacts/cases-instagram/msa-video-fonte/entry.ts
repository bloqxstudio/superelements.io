import './setup-window'
import { renderElementorDocument } from '@/engine/elementor'
import { createMsaTemplate } from '@/features/space/msaTemplate'
import { writeFileSync } from 'node:fs'

const template = createMsaTemplate()
const elements = template.sections.flatMap((s) => JSON.parse(s.elementorJson))
const doc = renderElementorDocument(elements, { title: 'MSA · Marketing sem Agência', background: '#F3EFE4', motion: 'play' })
// no vídeo as fotos carregam antes da gravação
writeFileSync('msa-page.html', doc.document.replace(/ loading="lazy"/g, ''))
console.log('sections', template.sections.map((s) => s.name).join(' | '), 'warnings', doc.warnings.length, doc.warnings.slice(0, 5))
