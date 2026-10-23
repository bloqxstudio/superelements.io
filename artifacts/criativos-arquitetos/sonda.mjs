import { comNavegador, abrirSite, enderecoDoSpace } from './lib.mjs'
const [projeto, pagina, dev = 'desktop', l = '1280', a = '900'] = process.argv.slice(2)
await comNavegador(async ({ site }) => {
  await abrirSite(site, { url: enderecoDoSpace({ projeto, pagina, device: dev }), largura: +l, altura: +a, escala: 1, mobile: dev === 'mobile' })
  console.log(JSON.stringify(await site.avaliar(`({ h: document.documentElement.scrollHeight, secoes: [...document.querySelectorAll('.po-sec')].map((e, i) => ({ i, c: e.className.replace('po-sec po-dark ', ''), top: Math.round(e.getBoundingClientRect().top + scrollY), h: Math.round(e.getBoundingClientRect().height) })) })`), null, 1))
})
