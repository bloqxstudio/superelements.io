import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Empacota os modelos dos Criativos para a função sinfy-mcp (Deno): sem `@/`, um arquivo só.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
await build({
  entryPoints: [path.join(root, 'scripts/mcp/criativos.ts')],
  outfile: path.join(root, 'supabase/functions/sinfy-mcp/_gerado/criativos.js'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  alias: { '@': path.join(root, 'src') },
  banner: { js: '// Gerado por `npm run build:mcp` (scripts/mcp/build.mjs). Não edite à mão.\n// @ts-nocheck' },
  logLevel: 'warning',
})
console.log('sinfy-mcp/_gerado/criativos.js pronto')
