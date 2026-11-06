import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { decodeEntities, encodeTemplate, findText, listPages, locOffset, normalize, openTagEnd, replaceText, saveImage } from '../sites/source.ts'
import { inside } from '../sites/registry.ts'

const site = (files) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'site-'))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    writeFileSync(path.join(dir, file), content)
  }
  return { id: 't', name: 't', dir, framework: 'astro', addedAt: '' }
}

test('texto como o navegador mostra', () => {
  assert.equal(normalize('\n   PROTEÇÃO   QUE\n  '), 'PROTEÇÃO QUE')
  assert.equal(decodeEntities('200&nbsp;modelos &amp; mais &#123;x&#x7d;'), '200 modelos & mais {x}')
  // O espaço fixo não some
  assert.equal(normalize('200 modelos'), '200 modelos')
  assert.equal(encodeTemplate('a < b {c} & d e'), 'a &lt; b &#123;c&#125; &amp; d&nbsp;e')
})

test('posição do Astro e fim da tag de abertura', () => {
  const buf = Buffer.from('<p>ç</p>\n<a href="x>y" data-x={a > b}>Ir</a>')
  assert.equal(locOffset(buf, '2:1'), 10)
  const start = buf.indexOf('<a')
  assert.equal(buf.subarray(openTagEnd(buf, start)).toString().slice(0, 2), 'Ir')
})

test('procura e troca texto escrito em dados (aspas escapadas)', () => {
  const s = site({
    'src/components/Cards.astro': "---\nconst items = [\n  { title: 'Brilho ou Fosco' },\n]\n---\n<h3>{items[0].title}</h3>\n",
    'src/content/faq.json': '{ "q": "Qual o prazo?" }',
    'README.md': 'Brilho ou Fosco',
  })
  // A documentação na raiz não conta
  assert.equal(findText(s, 'Brilho ou Fosco').length, 1)
  replaceText(s, { text: 'Brilho ou Fosco', next: "Brilho 'ou' Fosco" })
  assert.match(readFileSync(path.join(s.dir, 'src/components/Cards.astro'), 'utf8'), /title: 'Brilho \\'ou\\' Fosco'/)
  replaceText(s, { text: 'Qual o prazo?', next: 'Qual o "prazo"?' })
  assert.equal(JSON.parse(readFileSync(path.join(s.dir, 'src/content/faq.json'), 'utf8')).q, 'Qual o "prazo"?')
})

test('texto do HTML do .astro é escapado como HTML', () => {
  const s = site({ 'src/pages/index.astro': '---\n---\n<p>\n  Fale com a gente\n</p>\n' })
  replaceText(s, { text: 'Fale com a gente', next: 'Fale {agora} & já' })
  assert.match(readFileSync(path.join(s.dir, 'src/pages/index.astro'), 'utf8'), /Fale &#123;agora&#125; &amp; já/)
})

test('repetido: não troca sem dizer onde', () => {
  const s = site({ 'src/a.astro': '<p>Oi</p>', 'src/b.astro': '<p>Oi</p>' })
  assert.throws(() => replaceText(s, { text: 'Oi', next: 'Olá' }), /mais de uma vez/)
  replaceText(s, { text: 'Oi', next: 'Olá', file: 'src/b.astro', line: 1 })
  assert.equal(readFileSync(path.join(s.dir, 'src/b.astro'), 'utf8'), '<p>Olá</p>')
})

test('páginas a partir de src/pages', () => {
  const s = site({ 'src/pages/index.astro': '', 'src/pages/sobre.astro': '', 'src/pages/blog/[slug].astro': '', 'src/pages/_rascunho.astro': '' })
  assert.deepEqual(listPages(s).map((p) => p.route), ['/', '/blog/[slug]', '/sobre'])
})

test('imagem enviada vai para public/superelements', () => {
  const s = site({})
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const saved = saveImage(s, { name: 'Foto Ação.PNG', data: png })
  assert.match(saved.src, /^\/superelements\/foto-acao-[a-z0-9]+\.png$/)
  assert.throws(() => saveImage(s, { name: 'x', data: 'data:text/html;base64,PGI+' }), /imagem/)
})

test('nunca fora da pasta do site', () => {
  const s = site({})
  assert.throws(() => inside(s, '../fora.astro'), /fora/)
  assert.throws(() => inside(s, 'node_modules/astro/x.astro'), /fora/)
  assert.throws(() => inside(s, '/etc/passwd'), /fora/)
})
