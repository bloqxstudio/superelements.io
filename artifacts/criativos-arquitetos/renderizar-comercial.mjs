import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { AQUI } from './lib.mjs'
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const nomes = ['grade-seis-sites', 'case-vizor', 'case-flavia-neto', 'case-zena-viagens', 'case-contplan', 'case-prexparts', 'pergunta-direta', 'oferta-site-novo', 'lista-o-que-entregamos']
const _antigo = ['pb-1-capa', 'pb-2-emblema', 'pb-3-antes-depois', 'pb-4-como-funciona', 'pb-5-primeira-tela', 'pb-6-fecho', 'grade-seis-cases', 'case-vizor', 'case-flavia-neto', 'case-zena-viagens', 'case-contplan', 'case-prexparts', 'lupa-processbase', 'lista-site-avence']
mkdirSync(path.join(AQUI, 'comercial'), { recursive: true })
const quais = process.argv[2] ? [Number(process.argv[2])] : nomes.map((_, i) => i + 1)
for (const n of quais) {
  const out = path.join(AQUI, 'comercial', `${String(n).padStart(2, '0')}-${nomes[n - 1]}.png`)
  execFileSync(C, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', '--virtual-time-budget=9000', '--window-size=1080,1350', `--screenshot=${out}`, `file://${path.join(AQUI, 'posts-comercial.html')}?post=${n}`], { stdio: 'ignore' })
  console.log(out)
}
