import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { periodOf } from '../../supabase/functions/sinfy-mcp/dados.ts'

test('período: padrão 30 dias e relatórios salvos dos Anúncios', () => {
  assert.equal(periodOf(undefined).preset, 'last_30d')
  assert.equal(periodOf('7').preset, 'last_7d')
  assert.equal(periodOf('90').preset, 'last_90d')
  assert.equal(periodOf('mes').preset, 'this_month')
  assert.equal(periodOf('2026-10-30').preset, 'dia:2026-10-30')
  const day = periodOf('2026-10-30')
  assert.equal(day.to.getTime() - day.from.getTime(), 86_400_000)
  assert.equal(day.from.toISOString(), '2026-10-30T03:00:00.000Z')
})

test('MCP: nada de aprovar nem de publicar pela IA', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261103120000_crm_mcp.sql', import.meta.url), 'utf8')
  assert.match(sql, /p_args->>'p_to' = 'aprovado'/)
  assert.match(sql, /grant execute on function public\.crm_mcp_call\(uuid, text, jsonb\) to service_role/)
  assert.doesNotMatch(sql, /grant execute on function public\.crm_mcp_call\(uuid, text, jsonb\) to authenticated/)
  const fn = readFileSync(new URL('../../supabase/functions/sinfy-mcp/index.ts', import.meta.url), 'utf8')
  assert.match(fn, /status: \{ type: 'string', enum: \['ideia', 'producao', 'revisao'\] \}/)
  // Conta de cliente não usa os modelos com cases e ilustrações da Avence
  assert.match(fn, /caller\.team\.is_home \? \[\.\.\.TEMPLATES, \.\.\.AVENCE_TEMPLATES\] : TEMPLATES/)
})

test('prévia: o slide vira SVG com o texto quebrado e o logo', async (t) => {
  let opentype, C, previa
  try {
    opentype = (await import('opentype.js')).default
    C = await import('../../supabase/functions/sinfy-mcp/_gerado/criativos.js')
    previa = await import('../../supabase/functions/sinfy-mcp/previa.ts')
  } catch {
    return t.skip('sem opentype.js ou sem o pacote gerado (npm run build:mcp)')
  }
  // Fonte fixa: medida por estimativa (sem rede no teste)
  C.setMeasureContext(previa.measureContext(new Map()))
  const brand = { name: 'Teste', colors: [{ name: 'primary', hex: '#171B19' }, { name: 'accent', hex: '#D2F525' }, { name: 'background', hex: '#F1F2ED' }], headingFont: 'Inter', bodyFont: 'Inter', emphasisFont: 'Inter', buttonRadius: 999, look: 'editorial' }
  const post = C.buildPost({ name: 'x', format: '4x5', slides: [{ template: 'manifesto', title: 'Um título bem comprido para quebrar em *várias* linhas', body: 'Frase', dark: true }] }, brand)
  const svg = C.slideToSvg(post.slides[0], '4x5')
  assert.match(svg, /^<svg[^>]+width="1080" height="1350"/)
  assert.ok((svg.match(/<text /g) ?? []).length > 6, 'o título sai em várias linhas e palavras')
  assert.ok(opentype)
})
