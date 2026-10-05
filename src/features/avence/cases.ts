/**
 * Os cases do Avence Studio: os sites do carrossel público do site atual
 * (avencestudio.com), conferidos ao vivo em 2026-10-04 (`brands/avence-studio/COPY.md` §2).
 * Só o que dá para afirmar olhando o site: nome, segmento, cidade quando o
 * próprio site diz, o que a página tem e a plataforma que o código mostra.
 * Nada de números, resultados ou depoimentos.
 *
 * Fotos tiradas pelo Edge headless (`.space/avence-studio/build/capture.mjs`) e
 * convertidas para WebP com o ffmpeg: a capa (topo da página, 960 × 600), a
 * página do computador (1440px de largura, reduzida para 1200, até 4800px de
 * página) e a do celular (390px a 2x, reduzida para 520, até 4800px de página).
 *
 * Case com história de scroll (`video`): as telas mostram o efeito, não a foto.
 * Vídeo gravado do site ao vivo por `.space/avence-studio/build/record-case.mjs`
 * (relógio virtual, a página rolando do topo até o fim da história), sem som e em
 * loop: 1280 × 800 no computador e 520 × 1098 (9:19) no celular.
 */
export interface AvShot { path: string; w: number; h: number }
export interface AvVideo { src: string; poster: string }
export interface AvCase {
  slug: string
  name: string
  segment: string
  /** cidade, só quando o próprio site diz */
  place?: string
  url: string
  domain: string
  /** o que o site tem, em uma frase */
  summary: string
  /** plataforma que o código do site mostra */
  stack: string
  cover: AvShot
  /** uma segunda tela do site (outro trecho da página), para a segunda fileira da galeria não repetir a capa */
  screen: AvShot
  page: AvShot
  phone: AvShot
  /** o efeito do site em vídeo, no lugar das fotos da janela e do celular */
  video?: { desktop: AvVideo; phone: AvVideo }
}

const shots = (slug: string, pageH = 4000) => ({
  cover: { path: `/brands/avence-studio/cases/${slug}-capa.webp`, w: 960, h: 600 },
  screen: { path: `/brands/avence-studio/cases/${slug}-tela.webp`, w: 960, h: 600 },
  page: { path: `/brands/avence-studio/cases/${slug}-pagina.webp`, w: 1200, h: pageH },
  phone: { path: `/brands/avence-studio/cases/${slug}-celular.webp`, w: 520, h: 6400 },
})

export const AV_CASES: AvCase[] = [
  {
    // primeiro case por pedido do usuário (2026-10-04), com o efeito do site em vídeo
    // ("quero que mostre o efeito do case"): o logo se forma, gira em 3D e os pilares
    // acendem. As duas imagens SVG que o site publicado ainda mostra quebradas foram
    // trocadas na gravação pelos arquivos de `public/brands/processbase/`. A capa da
    // galeria saiu sem o GSAP (composição final do CSS).
    slug: 'processbase', name: 'ProcessBase', segment: 'Consultoria de gestão para empresas', place: 'São Leopoldo, RS',
    url: 'https://processbase.com.br/', domain: 'processbase.com.br',
    summary: 'Site de uma consultoria que organiza cultura, processos, treinamentos e planejamento nas empresas: o Método Base em quatro pilares, como o projeto anda, quem conduz e o diagnóstico marcado pelo site.',
    stack: 'WordPress e Elementor', ...shots('processbase'),
    video: {
      desktop: { src: '/brands/avence-studio/cases/processbase-efeito.mp4', poster: '/brands/avence-studio/cases/processbase-efeito-capa.webp' },
      phone: { src: '/brands/avence-studio/cases/processbase-efeito-celular.mp4', poster: '/brands/avence-studio/cases/processbase-efeito-celular-capa.webp' },
    },
  },
  {
    slug: 'vizor', name: 'Vizor Películas', segment: 'Películas para painéis de moto', place: 'São Leopoldo, RS',
    url: 'https://vizorpeliculas.com.br/', domain: 'vizorpeliculas.com.br',
    summary: 'Site e catálogo de uma fabricante de películas protetoras para painéis de motocicletas, com busca por marca, modelo e ano e uma página para quem quer revender.',
    stack: 'Astro', ...shots('vizor'),
  },
  {
    slug: 'flavia-neto', name: 'Flávia Neto', segment: 'Aulas de yoga', place: 'Florianópolis, SC',
    url: 'https://flavianeto.com.br/', domain: 'flavianeto.com.br',
    summary: 'Site de uma professora de yoga no sul da Ilha de Florianópolis: as aulas, o espaço, as perguntas frequentes e a aula experimental marcada pelo WhatsApp.',
    stack: 'WordPress e Elementor', ...shots('flavia-neto'),
  },
  {
    slug: 'zena-viagens', name: 'Zena Viagens', segment: 'Viagens sob medida',
    url: 'https://zenaviagens.com/', domain: 'zenaviagens.com',
    summary: 'Site de uma agência de viagens planejadas sob medida: o método, os serviços, quem está por trás e o pedido da viagem num formulário.',
    stack: 'WordPress e Elementor', ...shots('zena-viagens'),
  },
  {
    slug: 'contplan', name: 'Contplan', segment: 'Contabilidade para empresas', place: 'Porto Alegre, RS',
    url: 'https://www.contplan.com.br/', domain: 'contplan.com.br',
    summary: 'Site de um escritório de contabilidade: os serviços, os planos, o caminho para virar cliente, a área do cliente e o contato.',
    stack: 'WordPress e Elementor', ...shots('contplan'),
  },
  {
    slug: 'prexparts', name: 'PrexParts', segment: 'Peças e acessórios para motos',
    url: 'https://prexparts.com.br/', domain: 'prexparts.com.br',
    summary: 'Site de uma fabricante de peças e acessórios para motos: a linha de produtos organizada por modelo, as marcas atendidas e a página da empresa.',
    stack: 'WordPress e Elementor', ...shots('prexparts', 3740),
  },
]

/** Fora da Home (COPY.md §2): Infinity Day e Tankker CRM não estão no ar no endereço que achamos. */
