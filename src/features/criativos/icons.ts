import type React from 'react'
import { ICONS as FORM_ICON_NAMES } from '../../../supabase/functions/_shared/forms.ts'

/**
 * Ícones para os criativos (2026-11-06, o usuário: "permita que o agente tenha acesso aos ícones do cadastro
 * dos formulários, quero usar essa biblioteca nos criativos"). Os formulários usam 30 ícones de traço do
 * Lucide (`ICONS` em `_shared/forms.ts`); aqui eles são o conjunto da casa, e o resto do Lucide (~1.500,
 * licença ISC, já no app) fica para busca. Cada ícone vira um PNG na cor pedida e entra no post como imagem.
 */

export const FORM_ICONS: readonly string[] = FORM_ICON_NAMES

type Loader = () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>
let loaders: Record<string, Loader> | undefined

async function all(): Promise<Record<string, Loader>> {
  loaders ??= (await import('lucide-react/dynamicIconImports')).default as Record<string, Loader>
  return loaders
}

export async function iconExists(name: string): Promise<boolean> {
  return name in (await all())
}

/** Palavras em português que a pessoa (ou o agente) usa, para o nome do Lucide. */
const PT: Record<string, string> = {
  foguete: 'rocket', alvo: 'target', meta: 'target', crescimento: 'trending-up', grafico: 'chart', gráfico: 'chart',
  check: 'check', certo: 'check', ok: 'check', trofeu: 'trophy', troféu: 'trophy', premio: 'award', prêmio: 'award',
  estrela: 'star', brilho: 'sparkles', raio: 'zap', energia: 'zap', diamante: 'gem', joia: 'gem', ideia: 'lightbulb',
  lampada: 'lightbulb', lâmpada: 'lightbulb', paleta: 'palette', cor: 'palette', megafone: 'megaphone', anuncio: 'megaphone',
  anúncio: 'megaphone', dinheiro: 'dollar', preco: 'tag', preço: 'tag', pessoas: 'users', equipe: 'users', cliente: 'user',
  pessoa: 'user', aperto: 'handshake', acordo: 'handshake', parceria: 'handshake', maleta: 'briefcase', trabalho: 'briefcase',
  loja: 'store', escudo: 'shield', seguranca: 'shield', segurança: 'shield', coracao: 'heart', coração: 'heart', amor: 'heart',
  mensagem: 'message', conversa: 'message', whatsapp: 'message-circle', telefone: 'phone', celular: 'smartphone',
  local: 'map-pin', endereco: 'map-pin', endereço: 'map-pin', mapa: 'map', calendario: 'calendar', calendário: 'calendar',
  agenda: 'calendar', data: 'calendar', relogio: 'clock', relógio: 'clock', hora: 'clock', tempo: 'timer', entrega: 'truck',
  caminhao: 'truck', caminhão: 'truck', pacote: 'package', caixa: 'box', carrinho: 'shopping-cart', sacola: 'shopping-bag',
  compra: 'shopping', cartao: 'credit-card', cartão: 'credit-card', carteira: 'wallet', presente: 'gift', desconto: 'percent',
  porcentagem: 'percent', casa: 'house', predio: 'building', prédio: 'building', comida: 'utensils', restaurante: 'utensils',
  cafe: 'coffee', café: 'coffee', carro: 'car', aviao: 'plane', avião: 'plane', viagem: 'plane', bicicleta: 'bike',
  ferramenta: 'wrench', chave: 'key', cadeado: 'lock', usuario: 'user', usuário: 'user', sorriso: 'smile', sol: 'sun', lua: 'moon',
  folha: 'leaf', natureza: 'leaf', agua: 'droplet', água: 'droplet', gota: 'droplet', camera: 'camera', câmera: 'camera',
  foto: 'image', imagem: 'image', video: 'video', vídeo: 'video', musica: 'music', música: 'music', livro: 'book',
  estudo: 'graduation-cap', formatura: 'graduation-cap', curso: 'graduation-cap', seta: 'arrow', mais: 'plus', menos: 'minus',
  busca: 'search', lupa: 'search', filtro: 'filter', camadas: 'layers', tesoura: 'scissors', pincel: 'paintbrush',
  academia: 'dumbbell', saude: 'heart-pulse', saúde: 'heart-pulse', medico: 'stethoscope', médico: 'stethoscope',
  remedio: 'pill', remédio: 'pill', bebe: 'baby', bebê: 'baby', cachorro: 'dog', gato: 'cat', pet: 'paw-print', pata: 'paw-print',
  email: 'mail', 'e-mail': 'mail', enviar: 'send', mundo: 'globe', site: 'globe', internet: 'globe', config: 'settings',
  configuracao: 'settings', configuração: 'settings', fogo: 'flame', coroa: 'crown', curtir: 'thumbs-up', like: 'thumbs-up',
  reciclar: 'recycle', play: 'play', microfone: 'mic', alerta: 'circle-alert', ajuda: 'circle-help', informacao: 'info',
  informação: 'info', lista: 'list', documento: 'file-text', contrato: 'file-signature', banco: 'landmark', nota: 'receipt',
  recibo: 'receipt', fatura: 'receipt', moto: 'bike', hamburguer: 'sandwich', hambúrguer: 'sandwich', pizza: 'pizza',
  bolo: 'cake', cerveja: 'beer', vinho: 'wine', roupa: 'shirt', camiseta: 'shirt', oculos: 'glasses', óculos: 'glasses',
  dente: 'smile', dentista: 'smile', lei: 'scale', justica: 'scale', justiça: 'scale', advogado: 'scale', martelo: 'gavel',
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * Busca no Lucide inteiro. Os do conjunto dos formulários vêm primeiro; depois nome exato, começo e trecho.
 * Aceita palavras em português ("calendário", "entrega") e em inglês.
 */
export async function searchIcons(query: string, limit = 40): Promise<string[]> {
  const names = Object.keys(await all())
  const words = query.split(/[,;]+|\s+/).map((w) => w.trim()).filter(Boolean)
  if (!words.length) return [...FORM_ICONS]
  const terms = [...new Set(words.flatMap((w) => [norm(w), PT[w.toLowerCase()] ?? PT[norm(w)]].filter((t): t is string => !!t)))]
  const score = (n: string) => {
    let best = 0
    for (const t of terms) {
      if (n === t) best = Math.max(best, 100)
      else if (n.startsWith(`${t}-`) || n.startsWith(t)) best = Math.max(best, 60)
      else if (n.split('-').includes(t)) best = Math.max(best, 50)
      else if (t.length >= 3 && n.includes(t)) best = Math.max(best, 20)
    }
    return best ? best + (FORM_ICONS.includes(n) ? 30 : 0) - n.length / 100 : 0
  }
  return names
    .map((n) => [n, score(n)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([n]) => n)
}

/** O ícone em PNG quadrado na cor pedida (lado ≈ 2× o tamanho no post, entre 64 e 512 px). */
export async function iconPng(name: string, color: string, size: number, strokeWidth = 1.75): Promise<Blob | undefined> {
  const load = (await all())[name]
  if (!load) return undefined
  const [{ default: Icon }, { createElement }, { renderToStaticMarkup }] = await Promise.all([load(), import('react'), import('react-dom/server')])
  const svg = renderToStaticMarkup(createElement(Icon, { color, size: 256, strokeWidth }))
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const side = Math.max(64, Math.min(512, Math.round(size * 2)))
  const c = document.createElement('canvas')
  c.width = side
  c.height = side
  c.getContext('2d')!.drawImage(img, 0, 0, side, side)
  return new Promise((r) => c.toBlob((b) => r(b ?? undefined), 'image/png'))
}
