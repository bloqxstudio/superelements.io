import { Link } from 'react-router-dom'
import { LS as C, LS_FONTS as F, LS_LAYOUT as L } from '@/features/leoscherer/tokens'

const swatches = [
  ['Canvas', C.black], ['Elevado', C.raised], ['Hero', C.hero], ['Papel', C.paper], ['Texto do tema', C.body],
  ['Roxo WooCommerce', C.purple], ['Azul de ação', C.blue], ['Vermelho Watch', C.red],
]

const LeoSchererStyleGuide = () => <main className="min-h-screen bg-black text-white" style={{ fontFamily: `${F.display},Arial,sans-serif` }}>
  <div className="mx-auto max-w-[1160px] px-5 py-8">
    <nav className="flex items-center justify-between border-b border-white/15 pb-5">
      <img src="/leoscherer/assets/logo.png" alt="LS · Produtos Apple e importados" className="w-[267px] max-w-[55vw]" />
      <Link className="text-sm text-sky-300" to="/leoscherer-elementor-preview">Ver templates Elementor</Link>
    </nav>
    <section className="py-20">
      <p className="mb-4 text-sm text-sky-300">LEO SCHERER · GUIA MEDIDO</p>
      <h1 className="max-w-[12ch] text-5xl font-semibold leading-none md:text-7xl">Produtos Apple em um palco preto.</h1>
      <p className="mt-6 max-w-2xl text-lg text-[#B6B6B6]" style={{ fontFamily: `${F.body},Arial,sans-serif` }}>A linguagem original usa preto, imagens isoladas e tipografia Helvetica direta. A cor aparece apenas em ações, preços e sinais do produto.</p>
    </section>
    <section className="border-t border-white/15 py-16">
      <h2 className="mb-8 text-3xl font-semibold">Cor</h2>
      <div className="grid gap-px overflow-hidden bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
        {swatches.map(([name, value]) => <div className="bg-black p-4" key={name}><i className="mb-3 block h-20 border border-white/15" style={{ background: value }} /><b className="block text-sm">{name}</b><code className="text-xs text-[#B6B6B6]">{value}</code></div>)}
      </div>
    </section>
    <section className="border-t border-white/15 py-16">
      <h2 className="mb-8 text-3xl font-semibold">Tipografia e layout</h2>
      <div className="space-y-8">
        <div><small className="text-sky-300">Hero · Helvetica 600 · 52/52</small><p className="mt-2 text-[52px] font-semibold leading-none">iPhone 18 Pro</p></div>
        <div><small className="text-sky-300">Destaque · Helvetica 600 · 75/75</small><p className="mt-2 max-w-4xl text-5xl font-semibold leading-none md:text-[75px]">Aperte o play para sentir esta experiência.</p></div>
        <div><small className="text-sky-300">Texto · Source Sans Pro 400</small><p className="mt-2 max-w-xl text-base leading-[1.618] text-[#6D6D6D]" style={{ fontFamily: `${F.body},Arial,sans-serif` }}>Conteúdo editorial e textos do tema usam uma escala menor, com contraste deliberadamente suave sobre o preto.</p></div>
      </div>
      <p className="mt-12 text-sm text-[#B6B6B6]">Conteúdo: {L.content}px · breakpoints: {L.breakpoint.tablet}px e {L.breakpoint.mobile}px · cantos e sombras raros.</p>
    </section>
  </div>
</main>

export default LeoSchererStyleGuide
