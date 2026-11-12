import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Empacota para a função sinfy-mcp (Deno), sem `@/`, um arquivo por entrada: os modelos dos Criativos
// e a inteligência de Instagram, as skills e os quadros (`scripts/mcp/inteligencia.ts`).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
for (const name of ['criativos', 'inteligencia']) await build({
  entryPoints: [path.join(root, `scripts/mcp/${name}.ts`)],
  outfile: path.join(root, `supabase/functions/sinfy-mcp/_gerado/${name}.js`),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  alias: { '@': path.join(root, 'src') },
  banner: { js: '// Gerado por `npm run build:mcp` (scripts/mcp/build.mjs). Não edite à mão.\n// @ts-nocheck' },
  logLevel: 'warning',
})
console.log('sinfy-mcp/_gerado/criativos.js e inteligencia.js prontos')
