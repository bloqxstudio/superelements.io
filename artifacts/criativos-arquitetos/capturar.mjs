// Capturas paradas do case (desktop e celular), já com as animações assentadas.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { AQUI, abrirSite, comNavegador, enderecoDoSpace } from './lib.mjs'
const SP = { projeto: '817e7afc-f37b-46b0-95da-860469e8e8aa', pagina: '30c4d7f3-08cb-4484-b7db-810531151953' }
const CFG = {
  desktop: { largura: 1280, altura: 900, escala: 1.5, mobile: false, pts: [['d-abertura', 0], ['d-projeto', 900], ['d-arquitetura', 1981], ['d-interiores', 3781], ['d-decisoes', 5581], ['d-galeria', 7500], ['d-contato', 9613]] },
  mobile: { largura: 390, altura: 844, escala: 3, mobile: true, pts: [['m-abertura', 0], ['m-projeto', 844], ['m-arquitetura', 2065], ['m-interiores', 3753], ['m-decisoes', 5441], ['m-galeria', 6948], ['m-contato', 7592]] },
}
for (const [dev, c] of Object.entries(CFG)) {
  await comNavegador(async ({ site }) => {
    await abrirSite(site, { url: enderecoDoSpace({ ...SP, device: dev }), largura: c.largura, altura: c.altura, escala: c.escala, mobile: c.mobile })
    let t = 0, y = 0
    const avancar = async (ms, top) => { t += ms; await site.avaliar(`scrollTo({top:${top},behavior:'instant'});dispatchEvent(new Event('scroll'));window.__vt.advance(${t});window.__vt.realFrame().then(()=>true)`) }
    await avancar(3500, 0)
    for (const [nome, alvo] of c.pts) {
      while (Math.abs(alvo - y) > 400) { y += Math.sign(alvo - y) * 400; await avancar(120, y) }
      y = alvo; await avancar(2200, y)
      const { data } = await site.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path.join(AQUI, 'capturas', nome + '.png'), Buffer.from(data, 'base64'))
      console.log(nome)
    }
  })
}
