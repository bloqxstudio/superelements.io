/**
 * As faixas do story (1080×1920) que o Instagram cobre: a barra do perfil em cima, a caixa de resposta e os botões
 * embaixo. Texto fica fora delas. O DESIGN diz 250 px em cima e 300 px embaixo; os modelos (`templates.ts`), as guias
 * do editor (`grid.ts`) e o slide livre do MCP (`supabase/functions/sinfy-mcp/livre.ts`, cópia conferida em
 * `scripts/tests/mcp-marca.test.mjs`) usam estes números. Antes as guias e o MCP usavam 18% (346 px) embaixo e os
 * modelos 300 (revisão de 2026-11-13). Sem imports: o teste lê direto.
 */
export const STORY_SAFE = { top: 250, bottom: 300 } as const

/** As mesmas faixas numa altura de story qualquer (na proporção de 1920). */
export const storySafe = (height: number) => ({ top: Math.round((height * STORY_SAFE.top) / 1920), bottom: Math.round((height * STORY_SAFE.bottom) / 1920) })
