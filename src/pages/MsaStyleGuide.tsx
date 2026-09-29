import { MSA } from '@/features/msa/tokens'

const colors = [
  ['Papel', MSA.paper, 'Canvas e áreas de leitura'],
  ['Tinta', MSA.ink, 'Texto, estrutura e faixas escuras'],
  ['Sálvia', MSA.sage, 'Progresso, seleção e CTA'],
  ['Oliva', MSA.muted, 'Texto secundário e labels'],
  ['Base suave', MSA.soft, 'Fotografia e superfícies de apoio'],
]

const MsaStyleGuide = () => (
  <main className="msa-guide min-h-screen" style={{ background: MSA.paper, color: MSA.ink }}>
    <style>{`
      @font-face{font-family:Syne;src:url('/brands/marketing-sem-agencia/assets/fonts/syne-latin.woff2') format('woff2');font-weight:400 800;font-display:swap}
      @font-face{font-family:Urbanist;src:url('/brands/marketing-sem-agencia/assets/fonts/urbanist-latin.woff2') format('woff2');font-weight:300 600;font-display:swap}
      .msa-guide{font-family:Urbanist,sans-serif}.msa-display{font-family:Syne,sans-serif}.msa-wrap{width:min(1180px,calc(100% - 40px));margin-inline:auto}
      .msa-rule{border-top:1px solid rgba(47,35,23,.2)}.msa-label{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#61695b}
      .msa-h1{font-size:clamp(44px,7vw,92px);line-height:1.02;letter-spacing:-.015em;font-weight:700;text-transform:uppercase;text-wrap:balance}
      .msa-h2{font-size:clamp(32px,4.2vw,54px);line-height:1.06;letter-spacing:-.01em;font-weight:700;text-transform:uppercase;text-wrap:balance}
      .msa-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:rgba(47,35,23,.2);border:1px solid rgba(47,35,23,.2)}
      .msa-swatch{min-height:220px;padding:22px;display:flex;flex-direction:column;justify-content:space-between}
      .msa-construction{display:grid;grid-template-columns:70px .7fr 1fr 1.2fr;gap:24px;padding:26px 0;border-top:1px solid rgba(243,239,228,.18);align-items:start}
      @media(max-width:900px){.msa-grid{grid-template-columns:1fr 1fr}.msa-construction{grid-template-columns:50px 1fr}.msa-construction>*:nth-child(n+3){grid-column:2}}
      @media(max-width:640px){.msa-grid{grid-template-columns:1fr}.msa-wrap{width:min(100% - 32px,1180px)}}
    `}</style>
    <header className="msa-wrap flex min-h-[76px] flex-wrap items-center justify-between gap-5 py-4">
      <div className="flex items-baseline gap-3"><strong className="msa-display text-[22px] font-extrabold">MSA</strong><span className="msa-label">Marketing sem Agência</span></div>
      <span className="msa-label">Style guide · V0.1</span>
    </header>
    <div className="msa-rule" />

    <section className="msa-wrap py-24 md:py-32">
      <p className="msa-label mb-8">Direção inicial</p>
      <h1 className="msa-display msa-h1 max-w-[1050px]">Marketing que fica dentro da empresa.</h1>
      <p className="mt-10 max-w-[680px] text-xl font-light leading-relaxed text-[#61695B]">Uma evolução editorial da identidade atual: menos página de promessa, mais sistema visível. Fundação, estrutura, operação assistida e autonomia.</p>
    </section>

    <section className="msa-wrap pb-24 md:pb-32">
      <p className="msa-label mb-6">Paleta medida</p>
      <div className="msa-grid">
        {colors.map(([name, value, role]) => <article key={name} className="msa-swatch" style={{ background: value, color: value === MSA.ink ? MSA.paper : MSA.ink }}>
          <strong className="msa-display text-lg uppercase">{name}</strong><div><p className="font-mono text-xs">{value}</p><p className="mt-2 text-sm opacity-70">{role}</p></div>
        </article>)}
      </div>
    </section>

    <section className="bg-[#2F2317] py-24 text-[#F3EFE4] md:py-32">
      <div className="msa-wrap">
        <p className="msa-label mb-8 !text-[#BED499]">Gramática construtiva</p>
        <h2 className="msa-display msa-h2 max-w-[820px]">A marca se move montando uma capacidade — não decorando uma tela.</h2>
        <div className="mt-16">
          {[
            ['01','FUNDAÇÃO','Diagnóstico e direção','Entender negócio, vendas e restrições.'],
            ['02','ESTRUTURA','Pessoas e processos','Definir papéis, rotinas e ferramentas.'],
            ['03','ENTREGA','Operação assistida','Ajustar a estrutura no trabalho real.'],
            ['04','PERMANÊNCIA','Autonomia','O conhecimento continua dentro.'],
          ].map((item) => <div className="msa-construction" key={item[0]}>{item.map((value, index) => <span key={value} className={index === 0 ? 'text-[#BED499]' : index < 3 ? 'msa-display font-bold uppercase' : 'text-[#F3EFE4]/70'}>{value}</span>)}</div>)}
        </div>
      </div>
    </section>

    <section className="msa-wrap grid gap-14 py-24 md:grid-cols-[.8fr_1.2fr] md:py-32">
      <img className="aspect-[3/4] w-full object-cover object-[50%_20%] grayscale-[.12]" src="/brands/marketing-sem-agencia/assets/henrique-zanotti-portrait.jpg" alt="Retrato de Henrique Zanotti" />
      <div className="flex flex-col justify-center">
        <p className="msa-label mb-7">Persona visual</p>
        <h2 className="msa-display msa-h2">Operador experiente. Não guru.</h2>
        <p className="mt-8 max-w-[620px] text-lg leading-relaxed text-[#61695B]">A imagem do Henrique sustenta autoridade quando aparece ligada à execução: retrato direto, trabalho e palco real. Prêmios e resultados só entram com fonte e permissão.</p>
        <div className="mt-10 flex flex-wrap gap-3">{['Estratégia','Operação','Liderança','Autonomia'].map((label)=><span key={label} className="border border-[#2F2317]/20 px-4 py-2 text-xs font-semibold tracking-[.12em]">{label.toUpperCase()}</span>)}</div>
      </div>
    </section>
  </main>
)

export default MsaStyleGuide

