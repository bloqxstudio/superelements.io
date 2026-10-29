import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nestForm, parseLead, hasContact } from '../../supabase/functions/lead-webhook/parse.ts'
import { alertText, campaignSnapshot, leadOrigin } from '../../supabase/functions/lead-webhook/origin.ts'

const elementor = {
  form: { id: 'abc', name: 'Contato' },
  fields: {
    name: { id: 'name', type: 'text', title: 'Nome', value: 'Maria Souza' },
    email: { id: 'email', type: 'email', title: 'E-mail', value: 'Maria@Ex.com' },
    telefone: { id: 'telefone', type: 'tel', title: 'Telefone', value: '(51) 99999-1234' },
    message: { id: 'message', type: 'textarea', title: 'Mensagem', value: 'Quero um site' },
    utm_source: { id: 'utm_source', type: 'hidden', title: 'utm', value: 'facebook' },
    utm_medium: { id: 'utm_medium', type: 'hidden', title: 'm', value: 'paid' },
    utm_campaign: { id: 'utm_campaign', type: 'hidden', title: 'c', value: 'Leads Julho' },
    cargo: { id: 'cargo', type: 'text', title: 'Cargo', value: 'Sócia' },
  },
  meta: { page_url: { value: 'x' }, date: '2026-10-29' },
}

test('webhook do Elementor vira lead com origem paga da Meta', () => {
  const lead = parseLead(elementor)
  assert.equal(lead.name, 'Maria Souza')
  assert.equal(lead.email, 'maria@ex.com')
  assert.equal(lead.phone, '5551999991234')
  assert.equal(lead.message, 'Quero um site')
  assert.equal(lead.channel, 'Meta Ads')
  assert.equal(lead.paid, true)
  assert.equal(lead.utm.campaign, 'Leads Julho')
  assert.equal(lead.fields.cargo, 'Sócia')
  assert.ok(hasContact(lead))
})

test('formulário com chaves aninhadas e JSON simples dão o mesmo lead', () => {
  const params = new URLSearchParams('fields[nome][value]=Ana&fields[email][value]=ana@x.com&gclid=abc&utm_campaign=Busca')
  const lead = parseLead(nestForm(params))
  assert.equal(lead.name, 'Ana')
  assert.equal(lead.channel, 'Google Ads')
  const flat = parseLead({ nome: 'Ana', whatsapp: '51 98888-7777' })
  assert.equal(flat.phone, '5551988887777')
  assert.equal(flat.channel, 'Direto')
})

test('sem e-mail nem telefone não é lead; chaves perigosas não sujam o objeto', () => {
  assert.equal(hasContact(parseLead({ nome: 'Só nome' })), false)
  nestForm(new URLSearchParams('__proto__[x]=1'))
  assert.equal({}.x, undefined)
})

test('campanha acha o gasto no relatório da Meta e entra no aviso', () => {
  const lead = parseLead(elementor)
  const reports = [{ preset: 'last_30d', fetched_at: '2026-10-29T10:00:00Z', data: { currency: 'BRL', since: '2026-09-29', until: '2026-10-28', campaigns: [{ id: '1', name: 'leads julho', status: 'ACTIVE', metrics: { spend: 1234.5, leads: 40 }, result: { type: 'lead', value: 40, cost: 30.86 } }], ads: [] } }]
  const campaign = campaignSnapshot(reports, lead)
  assert.equal(campaign.from, 'meta')
  assert.equal(campaign.spend, 1234.5)
  const text = alertText(lead, campaign, 'https://x/crm?oportunidade={id}')
  assert.match(text, /Maria Souza/)
  assert.match(text, /Meta Ads/)
  assert.match(text, /Campanha: leads julho \(ativa\)/)
  assert.match(text, /40 resultados/)
  assert.equal(leadOrigin(lead, campaign, 'h').campaign.name, 'leads julho')
  assert.equal(campaignSnapshot([], lead).from, 'utm')
})
