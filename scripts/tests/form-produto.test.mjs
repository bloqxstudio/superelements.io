import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogBrands, catalogModels, catalogYears, catalogMatches, checkAnswers, cleanDefinition, answerText, productMessage, whatsappLink, formIssues, SETTINGS_DEFAULT } from '../../supabase/functions/_shared/forms.ts'
import { parseCatalog, catalogCsv } from '../../src/features/crm/catalogImport.ts'

const CSV = `id;marca;modelo;ano;imagem;link;código brilho;código fosco
1;Honda;CB 500X;2022–2025;https://x.test/1.png;https://loja.test/produto/1;VZB0100;VZF0100
2;Honda;CB 500X;2018–2021;;;VZB0101;VZF0101
3;Yamaha;MT-07;2021;;;VZB0200;
4;;sem marca;;;;;`

const catalog = () => ({ ...parseCatalog(CSV), whatsapp: '5551980230392' })
const def = () => cleanDefinition({ kind: 'form', steps: [{ id: 's', fields: [{ id: 'moto', type: 'product', label: 'Moto', required: true, catalog: catalog() }] }] })

test('parseCatalog: CSV com ; e códigos como variações, sem linhas sem marca', () => {
  const c = parseCatalog(CSV)
  assert.equal(c.items.length, 3)
  assert.equal(c.skipped, 1)
  assert.deepEqual(c.items[0].codes, [{ label: 'Brilho', code: 'VZB0100' }, { label: 'Fosco', code: 'VZF0100' }])
  assert.deepEqual(c.items[2].codes, [{ label: 'Brilho', code: 'VZB0200' }])
  assert.equal(c.items[1].image, undefined)
})

test('parseCatalog: JSON e volta ao CSV', () => {
  const json = parseCatalog(JSON.stringify({ items: [{ brand: 'BMW', model: 'R 1250 GS', codes: [{ label: 'Brilho', code: 'X1' }] }], brands: [{ name: 'BMW', logo: 'https://x.test/bmw.png' }] }))
  assert.equal(json.items[0].codes[0].code, 'X1')
  assert.equal(json.brands[0].logo, 'https://x.test/bmw.png')
  const again = parseCatalog(catalogCsv(parseCatalog(CSV).items))
  assert.deepEqual(again.items.map((i) => i.codes), parseCatalog(CSV).items.map((i) => i.codes))
})

test('listas dependentes só com o que existe', () => {
  const c = catalog()
  assert.deepEqual(catalogBrands(c).map((b) => b.name), ['Honda', 'Yamaha'])
  assert.deepEqual(catalogModels(c, 'honda'), ['CB 500X'])
  assert.deepEqual(catalogYears(c, 'Honda', 'CB 500X'), ['2022–2025', '2018–2021'])
  assert.equal(catalogMatches(c, 'Honda', 'CB 500X', '2018–2021')[0].id, '2')
})

test('servidor aceita só item do catálogo e mostra o produto nas respostas', () => {
  const d = def()
  assert.deepEqual(checkAnswers(d, { moto: '1' }).answers, { moto: '1' })
  assert.ok(checkAnswers(d, { moto: 'inventado' }).errors.moto)
  assert.ok(checkAnswers(d, {}).errors.moto)
  assert.equal(answerText(d.steps[0].fields[0], '1'), 'Honda CB 500X · 2022–2025 · Brilho VZB0100, Fosco VZF0100')
})

test('mensagem do WhatsApp com a moto, os códigos, o link e a referência', () => {
  const c = catalog()
  const msg = productMessage(c, c.items[0], {}, 'AB12CD')
  assert.match(msg, /\*Honda CB 500X\* \(2022–2025\)/)
  assert.match(msg, /Brilho: VZB0100\nFosco: VZF0100/)
  assert.match(msg, /https:\/\/loja\.test\/produto\/1/)
  assert.match(msg, /Ref\. AB12CD/)
  const none = productMessage(c, undefined, { brand: 'Ducati', model: 'Panigale' })
  assert.match(none, /Ducati Panigale/)
  assert.ok(whatsappLink(c.whatsapp, msg).startsWith('https://wa.me/5551980230392?text='))
})

test('avisos: campo de produto sem catálogo ou sem WhatsApp', () => {
  const d = cleanDefinition({ kind: 'form', steps: [{ id: 's', title: 'Moto', fields: [{ id: 'm', type: 'product', label: 'Moto', catalog: { items: [] } }] }] })
  const issues = formIssues(d, SETTINGS_DEFAULT).map((i) => i.text).join(' | ')
  assert.match(issues, /importe o catálogo/)
  assert.match(issues, /WhatsApp/)
})
