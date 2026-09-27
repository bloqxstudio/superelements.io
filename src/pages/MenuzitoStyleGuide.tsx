import { useEffect } from 'react'

const colors = [
  ['Primary', '#699FB5'], ['Secondary', '#4D578F'], ['Showcase', '#749EB3'], ['Foreground', '#020817'],
  ['Muted', '#F1F5F9'], ['Muted text', '#64748B'], ['Border', '#E2E8F0'], ['Surface', '#FFFFFF'],
]

const MenuzitoStyleGuide = () => {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = '/menuzito/model.css'; link.dataset.menuzitoGuide = 'true'
    document.head.appendChild(link)
    return () => { link.remove() }
  }, [])
  return <main className="mz-guide">
    <section><span className="mz-kicker mz-kicker--blue">MENUZITO · DESIGN SYSTEM</span><h1>Uma interface leve para operações mais ágeis.</h1><p>Tokens extraídos dos estilos computados da página publicada.</p></section>
    <section><h2>Cores</h2><div className="mz-guide__colors">{colors.map(([name,value])=><article key={name}><i style={{background:value}}></i><strong>{name}</strong><code>{value}</code></article>)}</div></section>
    <section><h2>Tipografia</h2><div className="mz-guide__type"><h1>Display 60 / 800</h1><h2>Heading 36 / 700</h2><h3>Card title 18 / 700</h3><p>Body 16 / 400 — Inter mantém a leitura limpa e funcional.</p><small>Small 14 / 500</small></div></section>
    <section><h2>Botões e superfícies</h2><div className="mz-actions"><button className="mz-btn mz-btn--primary">Ação principal →</button><button className="mz-btn mz-btn--outline">Ação secundária</button><span className="mz-kicker mz-kicker--green">15 DIAS GRÁTIS</span></div><div className="mz-guide__cards"><article>Raio 16px<br/><small>Borda estrutural sutil</small></article><article>Raio 24px<br/><small>Sombra apenas para elevação</small></article></div></section>
  </main>
}

export default MenuzitoStyleGuide
