/**
 * O que o MCP da Sinfy (`supabase/functions/sinfy-mcp`) usa dos Criativos para desenhar a prévia no
 * servidor: os mesmos modelos do editor e o desenho em SVG. Empacotado por `npm run build:mcp` em
 * `supabase/functions/sinfy-mcp/_gerado/criativos.js` (o Deno não entende o atalho `@/`).
 */
export { buildPost } from '@/features/criativos/templates'
export { setMeasureContext } from '@/features/criativos/render'
export { slideToSvg, slideImages } from '@/features/criativos/svg'
export { sizeOf } from '@/features/criativos/types'
// O índice de cada pasta gravado sem apagar a linha que o navegador acabou de gravar (revisão de 2026-11-13)
export { upsertRow, writeIndexSafely } from '@/features/criativos/indexMerge'
