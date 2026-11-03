/**
 * O que o MCP da Sinfy (`supabase/functions/sinfy-mcp`) usa dos Criativos para desenhar a prévia no
 * servidor: os mesmos modelos do editor e o desenho em SVG. Empacotado por `npm run build:mcp` em
 * `supabase/functions/sinfy-mcp/_gerado/criativos.js` (o Deno não entende o atalho `@/`).
 */
export { buildPost } from '@/features/criativos/templates'
export { setMeasureContext } from '@/features/criativos/render'
export { slideToSvg, slideImages } from '@/features/criativos/svg'
export { sizeOf } from '@/features/criativos/types'
