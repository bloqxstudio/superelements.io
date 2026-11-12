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

// 2026-11-12, decisão do usuário: aprovar e publicar pelo MCP, sempre com o "pode" da pessoa (confirmar: true)
test('MCP: aprovar e publicar só com confirmação da pessoa', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261103120000_crm_mcp.sql', import.meta.url), 'utf8')
  assert.match(sql, /p_args->>'p_to' = 'aprovado'/)
  assert.match(sql, /grant execute on function public\.crm_mcp_call\(uuid, text, jsonb\) to service_role/)
  assert.doesNotMatch(sql, /grant execute on function public\.crm_mcp_call\(uuid, text, jsonb\) to authenticated/)
  const fn = readFileSync(new URL('../../supabase/functions/sinfy-mcp/index.ts', import.meta.url), 'utf8')
  // A função antiga (crm_mcp_call) segue sem aprovar; o caminho novo exige confirmar
  assert.match(fn, /if \(a\.status === 'aprovado'\) \{\n\s+if \(a\.confirmar !== true\) throw new ToolError/)
  // Publicar: sem confirmar só mostra a prévia; com confirmar entra na fila como a pessoa (aprovação dela)
  assert.match(fn, /if \(a\.confirmar !== true\) \{\n\s+const images = await renderSlides/)
  assert.match(fn, /status = 'agendado', frames = /)
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

test('plataforma: lista fechada sem segredos e gravação limitada', () => {
  const src = readFileSync(new URL('../../supabase/functions/sinfy-mcp/plataforma.ts', import.meta.url), 'utf8')
  const block = src.slice(src.indexOf('const TABLES'), src.indexOf('interface Column'))
  for (const secret of ['crm_instagram_tokens', 'crm_ad_tokens', 'crm_whatsapp_auth', 'crm_mcp_keys', 'crm_team_invites', 'crm_teams:', 'crm_ad_pending', 'crm_lead_hooks']) assert.ok(!block.includes(secret), `${secret} não pode estar na lista`)
  assert.match(src, /set local role authenticated/)
  assert.match(src, /total > 25/)
  assert.match(src, /a\.confirmar !== true/)
  assert.match(src, /WHATSAPP_DAILY_LIMIT = 30/)
})
