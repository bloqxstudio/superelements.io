// Renderiza cada post de posts.html em PNG 1080×1350 (Chrome headless).
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { AQUI } from './lib.mjs'
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(path.join(AQUI, 'estaticos'), { recursive: true })
const quais = process.argv[2] ? [process.argv[2]] : [1, 2, 3, 4, 5, 6]
for (const n of quais) {
  const out = path.join(AQUI, 'estaticos', `arquitetos-0${n}.png`)
  execFileSync(C, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', '--virtual-time-budget=9000', '--window-size=1080,1350', `--screenshot=${out}`, `file://${path.join(AQUI, 'posts.html')}?post=${n}`], { stdio: 'ignore' })
  console.log(out)
}
