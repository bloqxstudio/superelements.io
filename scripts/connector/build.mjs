// Gera o conector dos agentes num arquivo só, servido pelo app em /conector/conector.mjs.
//   npm run conector
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = path.join(root, 'public/conector/conector.mjs')
const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

await build({
  entryPoints: [path.join(root, 'scripts/connector/conector.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: out,
  // O space.mjs vai dentro: o conector grava ele na pasta de trabalho do agente
  define: {
    __SPACE_CLI__: JSON.stringify(readFileSync(path.join(root, 'scripts/space/space.mjs'), 'utf8')),
    __CONECTOR_VERSION__: JSON.stringify(version),
  },
  banner: { js: '#!/usr/bin/env node\n// Conector dos agentes do Superelements. Gerado por scripts/connector/build.mjs: não edite aqui.' },
  logLevel: 'warning',
})
console.log(`✔ ${path.relative(root, out)} (versão ${version})`)
