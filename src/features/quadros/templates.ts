import { FONT, PALETTE, stickyColor, type BoardDraft, type DraftItem } from './layout.ts'

/**
 * Notas adesivas e modelos de quadro. Uma nota é um retângulo do Excalidraw sem borda, com cor de
 * fundo e `customData.sticky`; dois cliques (ou Enter) escrevem dentro dela. Os modelos são `BoardDraft`
 * desenhados pelo mesmo `planDraft` que a Iara usa (cartões com ícone, colunas, fluxos com setas).
 */

export { FONT, stickyColor }
export const STICKY_COLORS: { name: string; color: string }[] = PALETTE.map(({ name, color }) => ({ name, color }))
export const STICKY_SIZE = 180

type Skeleton = Record<string, unknown>

export const stickySkeleton = (x: number, y: number, color: string, text?: string, id?: string): Skeleton => ({
  type: 'rectangle',
  ...(id ? { id } : {}),
  x, y, width: STICKY_SIZE, height: STICKY_SIZE,
  backgroundColor: color, fillStyle: 'solid', strokeColor: 'transparent', strokeWidth: 1, roughness: 0,
  roundness: null,
  customData: { sticky: true },
  ...(text ? { label: { text, fontSize: 18, fontFamily: FONT, strokeColor: '#1e1e1e', textAlign: 'center', verticalAlign: 'middle' } } : {}),
})

const card = (titulo: string, texto?: string, icone?: string, cor?: string, tag?: string): DraftItem => ({ kind: 'cartao', titulo, texto, icone, cor, tag })
const note = (texto: string, cor?: string): DraftItem => ({ kind: 'nota', texto, cor })

/** Como o modelo aparece na lista (um desenho pequeno, sem imagem). */
export type TemplateArt = { kind: 'mapa' | 'colunas' | 'fluxo' | 'grade'; colors: string[] }
export interface BoardTemplate { id: string; name: string; description: string; art: TemplateArt; draft: () => BoardDraft }

export const TEMPLATES: BoardTemplate[] = [
  {
    id: 'brainstorm', name: 'Brainstorm', description: 'Um tema no centro e ideias ligadas a ele',
    art: { kind: 'mapa', colors: ['#fff1a8', '#ffc9de', '#c5e4ff', '#c8f0c4', '#e0d4ff', '#ffd8a8'] },
    draft: () => ({
      titulo: 'Brainstorm', centro: 'Tema central',
      cartoes: [
        card('Ideia', 'Escreva aqui', 'lightbulb', 'amarelo'), card('Público', 'Para quem é', 'users', 'rosa'),
        card('Formato', 'Post, vídeo, página…', 'layout-grid', 'azul'), card('Canal', 'Onde aparece', 'megaphone', 'verde'),
        card('Referência', 'Algo que inspira', 'bookmark', 'roxo'), card('Próximo passo', 'O que fazer primeiro', 'arrow-right', 'laranja'),
      ],
    }),
  },
  {
    id: 'kanban', name: 'Kanban', description: 'A fazer, fazendo e feito',
    art: { kind: 'colunas', colors: ['#fff1a8', '#c5e4ff', '#c8f0c4'] },
    draft: () => ({
      titulo: 'Quadro de tarefas',
      colunas: [
        { nome: 'A fazer', cor: 'amarelo', itens: [card('Tarefa', 'O que precisa ser feito', 'circle', 'amarelo', 'Prioridade'), card('Tarefa', undefined, 'circle', 'amarelo'), card('Tarefa', undefined, 'circle', 'amarelo')] },
        { nome: 'Fazendo', cor: 'azul', itens: [card('Tarefa', 'Quem está com ela', 'loader', 'azul')] },
        { nome: 'Feito', cor: 'verde', itens: [card('Tarefa', undefined, 'circle-check', 'verde')] },
      ],
    }),
  },
  {
    id: 'calendario', name: 'Calendário de posts', description: 'A semana de conteúdo, dia a dia',
    art: { kind: 'colunas', colors: ['#e0d4ff', '#c5e4ff', '#ffc9de', '#c8f0c4', '#ffd8a8'] },
    draft: () => ({
      titulo: 'Calendário da semana', subtitulo: 'Um cartão por publicação: formato, ideia e chamada.',
      colunas: [
        { nome: 'Segunda', cor: 'roxo', itens: [card('Ideia do post', 'O gancho dos primeiros segundos', 'clapperboard', 'roxo', 'Reels')] },
        { nome: 'Terça', cor: 'azul', itens: [card('Ideia do post', 'O que cada slide mostra', 'gallery-horizontal', 'azul', 'Carrossel')] },
        { nome: 'Quarta', cor: 'rosa', itens: [card('Ideia do post', 'Bastidores ou pergunta', 'smartphone', 'rosa', 'Stories')] },
        { nome: 'Quinta', cor: 'verde', itens: [card('Ideia do post', 'Uma prova: cliente, número, antes e depois', 'image', 'verde', 'Post')] },
        { nome: 'Sexta', cor: 'laranja', itens: [card('Ideia do post', 'Oferta ou chamada para conversar', 'megaphone', 'laranja', 'Reels')] },
      ],
    }),
  },
  {
    id: 'jornada', name: 'Jornada do cliente', description: 'Do primeiro contato à compra, em etapas ligadas',
    art: { kind: 'fluxo', colors: ['#e0d4ff', '#c5e4ff', '#fff1a8', '#c8f0c4', '#ffd8a8'] },
    draft: () => ({
      titulo: 'Jornada do cliente', fluxo: true,
      cartoes: [
        card('Descobre', 'Onde nos vê pela primeira vez', 'eye', 'roxo', 'Anúncio'),
        card('Considera', 'O que precisa ver para confiar', 'search', 'azul', 'Site'),
        card('Conversa', 'A primeira mensagem e a resposta', 'message-circle', 'amarelo', 'WhatsApp'),
        card('Decide', 'O que tira a dúvida final', 'circle-check', 'verde', 'Proposta'),
        card('Volta', 'O que faz comprar de novo e indicar', 'repeat', 'laranja', 'Pós-venda'),
      ],
    }),
  },
  {
    id: 'funil', name: 'Funil de vendas', description: 'Etapas do funil com o número de cada uma',
    art: { kind: 'fluxo', colors: ['#c5e4ff', '#e0d4ff', '#fff1a8', '#c8f0c4'] },
    draft: () => ({
      titulo: 'Funil de vendas', fluxo: true,
      cartoes: [
        card('Visitas', 'Quantas pessoas chegam', 'users', 'azul', 'Topo'),
        card('Contatos', 'Quantas chamam no WhatsApp ou mandam o formulário', 'message-square', 'roxo', 'Meio'),
        card('Propostas', 'Quantas recebem preço', 'file-text', 'amarelo', 'Meio'),
        card('Vendas', 'Quantas fecham', 'badge-dollar-sign', 'verde', 'Fundo'),
      ],
    }),
  },
  {
    id: 'campanha', name: 'Plano de campanha', description: 'Objetivo, público, mensagem, canais e peças',
    art: { kind: 'colunas', colors: ['#e0d4ff', '#ffd8a8', '#fff1a8', '#c5e4ff'] },
    draft: () => ({
      titulo: 'Plano de campanha',
      colunas: [
        { nome: 'Objetivo', cor: 'roxo', itens: [card('O que queremos', 'Uma meta com número e prazo', 'target', 'roxo')] },
        { nome: 'Público', cor: 'laranja', itens: [card('Para quem', 'Quem compra e o que o trava', 'users', 'laranja')] },
        { nome: 'Mensagem', cor: 'amarelo', itens: [card('O que dizer', 'A promessa em uma frase', 'quote', 'amarelo')] },
        { nome: 'Canais e peças', cor: 'azul', itens: [card('Instagram', 'Reels e stories', 'instagram', 'azul'), card('Site', 'Página da oferta', 'globe', 'azul'), card('WhatsApp', 'Mensagem de entrada', 'message-circle', 'azul')] },
      ],
      ligacoes: [{ de: 1, para: 2 }, { de: 2, para: 3 }, { de: 3, para: 4 }],
    }),
  },
  {
    id: 'persona', name: 'Persona', description: 'Quem compra: dores, desejos e objeções',
    art: { kind: 'grade', colors: ['#c5e4ff', '#ffc9de', '#c8f0c4', '#ffd8a8', '#e0d4ff', '#fff1a8'] },
    draft: () => ({
      titulo: 'Persona',
      cartoes: [
        card('Quem é', 'Idade, trabalho, cidade, rotina', 'user', 'azul'), card('Dores', 'O que incomoda hoje', 'frown', 'rosa'),
        card('Desejos', 'O que quer conseguir', 'heart', 'verde'), card('Objeções', 'Por que ainda não comprou', 'shield-alert', 'laranja'),
        card('Onde está', 'Redes, sites, lugares', 'map-pin', 'roxo'), card('Como decide', 'Quem influencia e o que pesa', 'scale', 'amarelo'),
      ],
    }),
  },
  {
    id: 'retro', name: 'Retrospectiva', description: 'O que foi bem, o que melhorar e as ações',
    art: { kind: 'colunas', colors: ['#c8f0c4', '#ffc9de', '#c5e4ff'] },
    draft: () => ({
      titulo: 'Retrospectiva',
      colunas: [
        { nome: 'Foi bem', cor: 'verde', itens: [note('', 'verde'), note('', 'verde')] },
        { nome: 'Melhorar', cor: 'rosa', itens: [note('', 'rosa'), note('', 'rosa')] },
        { nome: 'Ações', cor: 'azul', itens: [card('Ação', 'Quem faz e até quando', 'check', 'azul')] },
      ],
    }),
  },
]
