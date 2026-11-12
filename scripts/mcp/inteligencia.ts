/**
 * O que o MCP da Sinfy usa das telas sem navegador (2026-11-12, MCP como caminho principal): a
 * inteligência de Instagram (`features/instagram-ia`, a nota do perfil), as skills de Instagram em
 * texto, o rascunho e o resumo dos quadros. Empacotado por `npm run build:mcp` em
 * `supabase/functions/sinfy-mcp/_gerado/inteligencia.js`.
 */
export { HOOK_RULES, hooksForPrompt, rankHooks } from '@/features/instagram-ia/ganchos'
export { beatSheet } from '@/features/instagram-ia/tempos'
export { lintCaption } from '@/features/instagram-ia/legenda'
export { detect, humanizeReport } from '@/features/instagram-ia/humanizar'
export { normalizeSwipe, rankSwipe, swipeMarkdown } from '@/features/instagram-ia/virais'
export { auditPosts } from '@/features/instagram-ia/auditoria'
export { PROFILE_RUBRIC, RUBRIC_NOTE } from '@/features/instagram-ia/perfil'
export { auditProfile } from '@/features/crm/profileAudit'
export { INSTAGRAM_SKILLS } from '@/features/space/chat/instagramSkills'
export { readDraft, draftIsEmpty } from '@/features/quadros/layout'
export { boardOutline } from '@/features/quadros/outline'
