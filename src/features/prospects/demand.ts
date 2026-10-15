import { PLATFORM_LABEL } from './score.ts'
import type { SiteDiagnosis } from './types.ts'

/**
 * O diagnóstico de captação: quem chega pelo celular entende, confia e chama
 * no WhatsApp? Sete perguntas que o dono entende sem explicação
 * (`brands/avence-studio/CLIENTE-IDEAL.md`), respondidas com a leitura do
 * site, a foto do celular (`scripts/prospects/phone.ts`, Edge no servidor de
 * dev) e a leitura do texto pelo Claude Code da máquina
 * (`scripts/prospects/copyReader.ts`). Vale também para o Node: imports
 * relativos com `.ts` e sintaxe que o Node apaga.
 */

/** Caixa em pixels CSS do celular; `y` conta do topo da página (nos fixos, do topo da tela). */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface ContactSpot extends Box {
  kind: 'whatsapp' | 'phone' | 'email' | 'form'
  /** Fica preso na tela (botão flutuante, barra fixa). */
  fixed: boolean
  text?: string
  /** O link do WhatsApp já leva uma mensagem escrita. */
  prefilled?: boolean
}

/** A página aberta num celular (Edge headless, 390 × 844). */
export interface PhoneCapture {
  /** Endereço final, depois dos redirecionamentos. */
  url: string
  viewport: { width: number; height: number }
  /** A primeira tela, como o celular mostra (JPEG em data URL). */
  firstScreen: string
  /** A página do topo até no máximo 8 telas, uma foto reduzida por tela, para ver o caminho até o contato. */
  strip?: { height: number; screens: { image: string; height: number }[] }
  pageHeight: number
  /** Tempo até o maior elemento da primeira tela aparecer (LCP), com 4G lento e processador 4× mais lento simulados. */
  lcpMs?: number
  contacts: ContactSpot[]
  /** O título principal (o primeiro H1, ou o maior texto da primeira tela). */
  headline?: Box & { text: string }
  /** Os textos da primeira tela, na ordem em que aparecem. */
  firstScreenText: { kind: 'titulo' | 'texto' | 'botao'; text: string }[]
  /** Títulos da página inteira (H1 a H3). */
  headings: string[]
  /** Um trecho do texto da página, para a leitura do texto. */
  pageText: string
  /** Sinais de confiança na página: avaliações, mapa, endereço, registro profissional… */
  trust: string[]
  /** Medição carregada na página (também a que vem pelo Tag Manager). */
  tracking: string[]
  /** Um aviso de cookies cobre parte da primeira tela. */
  cookieBanner?: boolean
}

/** A primeira tela lida pelo Claude Code, como um visitante vindo do anúncio. */
export interface CopyReading {
  /** O que o visitante entende em 5 segundos, na voz dele. */
  understood: string
  clear: 'sim' | 'em parte' | 'nao'
  /** O texto fala do problema de quem chega ou da própria empresa. */
  focus: 'cliente' | 'empresa' | 'misto'
  /** Trechos copiados do site e o que atrapalha em cada um. */
  issues: { quote: string; problem: string }[]
  /** Sinais de confiança que o texto mostra. */
  trust: string[]
  /** A primeira tela reescrita, só com fatos do site. */
  rewrite: { eyebrow: string; title: string; subtitle: string; button: string }
}

/** O que a leitura do texto recebe. */
export interface CopyInput {
  url: string
  name: string
  niche?: string
  description?: string
  firstScreenText: PhoneCapture['firstScreenText']
  headings: string[]
  pageText: string
}

export type Answer = 'sim' | 'parcial' | 'nao' | 'aberto'

export const ANSWER_LABEL: Record<Answer, string> = {
  sim: 'Sim',
  parcial: 'Em parte',
  nao: 'Não',
  aberto: 'A conferir',
}

export interface DemandQuestion {
  n: number
  id: 'entende' | 'whatsapp' | 'rapido' | 'foco' | 'confianca' | 'medicao' | 'atual'
  question: string
  answer: Answer
  detail: string
  /** A frase para a primeira mensagem ao dono, quando a resposta é ruim. */
  pitch?: string
  /** Esperando a foto do celular ou a leitura do texto. */
  pending?: boolean
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const listText = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`)

/** Rolagens até o elemento aparecer (0: está na primeira tela ou fica preso nela). */
export const scrollsTo = (spot: Box & { fixed?: boolean }, viewport: { height: number }) => (spot.fixed ? 0 : Math.max(0, Math.floor(spot.y / viewport.height)))

/** O primeiro contato de cada tipo, pela ordem em que aparece rolando. */
export const firstContact = (phone: PhoneCapture, kind?: ContactSpot['kind']) =>
  phone.contacts.filter((c) => !kind || c.kind === kind).sort((a, b) => scrollsTo(a, phone.viewport) - scrollsTo(b, phone.viewport) || a.y - b.y)[0]

const WE = /\b(n[óo]s|nosso|nossa|nossos|nossas|somos|empresa|excel[êe]ncia|tradi[çc][ãa]o|qualidade|compromisso|solu[çc][õo]es|miss[ãa]o|vis[ãa]o|valores|bem-vindo|bem vindo)\b/gi
const YOU = /\b(voc[êe]|seu|sua|seus|suas|te|precisa|quer)\b/gi

const OLD_BUILDERS = /WPBakery|Slider Revolution|Divi|Avada/

/** As sete perguntas, com o que já se sabe; o resto fica "a conferir" ou esperando. */
export const demandQuestions = (
  d: SiteDiagnosis,
  phone: PhoneCapture | null | undefined,
  copy: CopyReading | null | undefined,
  state: {
    phone: 'loading' | 'done' | 'off'
    copy: 'loading' | 'done' | 'off'
  },
  now = new Date()
): DemandQuestion[] => {
  const { scan, checks } = d
  const list: DemandQuestion[] = []
  const firstText = phone?.firstScreenText ?? []

  // 1. Em 5 segundos, entende?
  {
    const q = 'Em 5 segundos, quem chega entende o que vocês fazem, para quem e onde?'
    if (copy) {
      const answer: Answer = copy.clear === 'sim' ? 'sim' : copy.clear === 'em parte' ? 'parcial' : 'nao'
      list.push({
        n: 1,
        id: 'entende',
        question: q,
        answer,
        detail: `Quem chega entende: "${copy.understood}"`,
        pitch: answer === 'sim' ? undefined : 'Reparei que, pela primeira tela, quem chega do anúncio não entende de cara o que vocês fazem.',
      })
    } else if (phone && !firstText.some((t) => t.kind === 'titulo')) {
      list.push({
        n: 1,
        id: 'entende',
        question: q,
        answer: 'nao',
        detail: 'A primeira tela não tem um título que diga o que vocês fazem.',
        pitch: 'Reparei que a primeira tela do site não diz o que vocês fazem.',
      })
    } else {
      const title = phone?.headline?.text
      list.push({
        n: 1,
        id: 'entende',
        question: q,
        answer: 'aberto',
        detail: title ? `O título é "${title}". A leitura do texto diz se fica claro.` : 'Depende da leitura do texto da primeira tela.',
        pending: state.copy === 'loading' || state.phone === 'loading',
      })
    }
  }

  // 2. WhatsApp sem procurar?
  {
    const q = 'Dá para chamar no WhatsApp sem procurar?'
    if (phone) {
      const whats = firstContact(phone, 'whatsapp')
      const other = firstContact(phone)
      if (whats && scrollsTo(whats, phone.viewport) === 0) {
        list.push({
          n: 2,
          id: 'whatsapp',
          question: q,
          answer: 'sim',
          detail: `O WhatsApp está à vista ${whats.fixed ? 'o tempo todo (botão preso na tela)' : 'na primeira tela'}${whats.prefilled ? ', com a mensagem já escrita' : ''}.`,
        })
      } else if (whats) {
        const n = scrollsTo(whats, phone.viewport)
        list.push({
          n: 2,
          id: 'whatsapp',
          question: q,
          answer: 'nao',
          detail: `O primeiro botão do WhatsApp só aparece depois de ${plural(n, 'rolagem', 'rolagens')}.`,
          pitch: `Reparei que, no celular, o botão do WhatsApp só aparece depois de ${plural(n, 'rolagem', 'rolagens')}.`,
        })
      } else if (other) {
        const n = scrollsTo(other, phone.viewport)
        const what = other.kind === 'phone' ? 'o telefone' : other.kind === 'form' ? 'um formulário' : 'o e-mail'
        list.push({
          n: 2,
          id: 'whatsapp',
          question: q,
          answer: 'nao',
          detail: `Não tem WhatsApp. O primeiro contato é ${what}${n ? `, depois de ${plural(n, 'rolagem', 'rolagens')}` : ''}.`,
          pitch: 'Reparei que o site não tem um botão de WhatsApp para quem chega pelo celular.',
        })
      } else {
        list.push({
          n: 2,
          id: 'whatsapp',
          question: q,
          answer: 'nao',
          detail: 'Não achamos nenhum jeito de chamar a empresa na página inicial.',
          pitch: 'Reparei que quem chega pelo celular não acha como chamar vocês na página inicial.',
        })
      }
    } else if (scan.status && scan.status < 400) {
      list.push(
        scan.whatsapp
          ? {
              n: 2,
              id: 'whatsapp',
              question: q,
              answer: 'aberto',
              detail: 'Tem WhatsApp na página. A foto do celular diz se ele fica à vista.',
              pending: state.phone === 'loading',
            }
          : {
              n: 2,
              id: 'whatsapp',
              question: q,
              answer: 'nao',
              detail: 'Não tem WhatsApp na página inicial.',
              pitch: 'Reparei que quem chega pelo celular não acha um botão de WhatsApp na página inicial.',
            }
      )
    } else {
      list.push({
        n: 2,
        id: 'whatsapp',
        question: q,
        answer: 'aberto',
        detail: 'O site não abriu.',
      })
    }
  }

  // 3. Rápido no celular?
  {
    const q = 'A página aparece rápido no celular?'
    if (phone?.lcpMs) {
      const answer: Answer = phone.lcpMs <= 2500 ? 'sim' : phone.lcpMs <= 4000 ? 'parcial' : 'nao'
      list.push({
        n: 3,
        id: 'rapido',
        question: q,
        answer,
        detail: `A primeira tela aparece em ${seconds(phone.lcpMs)} num celular com 4G lento (simulado, como o teste de celular do Google). O Google considera bom até 2,5 s.`,
        pitch: answer === 'nao' ? `Reparei que, num celular com 4G, a página leva ${seconds(phone.lcpMs)} para aparecer.` : undefined,
      })
    } else {
      list.push({
        n: 3,
        id: 'rapido',
        question: q,
        answer: 'aberto',
        detail: scan.ms ? `O servidor começa a responder em ${seconds(scan.ms)}; a foto do celular mede o resto.` : 'A foto do celular mede.',
        pending: state.phone === 'loading',
      })
    }
  }

  // 4. Fala do cliente ou da empresa?
  {
    const q = 'O texto fala de quem chega ou só da empresa?'
    if (copy) {
      const answer: Answer = copy.focus === 'cliente' ? 'sim' : copy.focus === 'misto' ? 'parcial' : 'nao'
      const issue = copy.issues[0]
      list.push({
        n: 4,
        id: 'foco',
        question: q,
        answer,
        detail: answer === 'sim' ? 'A primeira tela fala da situação de quem chega.' : issue ? `"${issue.quote}": ${issue.problem}` : 'A primeira tela fala mais da empresa do que de quem chega.',
        pitch: answer === 'nao' ? 'Reparei que a primeira tela fala de vocês, e não do problema de quem chega procurando.' : undefined,
      })
    } else if (firstText.length) {
      const text = firstText.map((t) => t.text).join(' ')
      const we = text.match(WE)?.length ?? 0
      const you = text.match(YOU)?.length ?? 0
      list.push({
        n: 4,
        id: 'foco',
        question: q,
        answer: 'aberto',
        detail: we > you ? 'A primeira tela usa mais "nós" e "empresa" do que "você". A leitura do texto confirma.' : 'Depende da leitura do texto.',
        pending: state.copy === 'loading',
      })
    } else {
      list.push({
        n: 4,
        id: 'foco',
        question: q,
        answer: 'aberto',
        detail: 'Depende da leitura do texto.',
        pending: state.copy === 'loading' || state.phone === 'loading',
      })
    }
  }

  // 5. Confiança
  {
    const q = 'A página mostra por que confiar em vocês?'
    // A leitura do texto vê mais (e diz melhor); sem ela, ficam os sinais que a página mostra no código
    const signals = [...new Set((copy?.trust.length ? copy.trust : (phone?.trust ?? [])).map((s) => s.trim()).filter(Boolean))]
    if (phone || copy) {
      const answer: Answer = signals.length >= 3 ? 'sim' : signals.length ? 'parcial' : 'nao'
      list.push({
        n: 5,
        id: 'confianca',
        question: q,
        answer,
        detail: signals.length
          ? `Mostra: ${listText(signals.slice(0, 5).map((s) => s.charAt(0).toLowerCase() + s.slice(1)))}.`
          : 'Não achamos avaliações, endereço, registro profissional nem tempo de atuação na página inicial.',
        pitch: answer === 'nao' ? 'Reparei que a página inicial não mostra avaliações, endereço nem quem atende.' : undefined,
        pending: !copy && state.copy === 'loading',
      })
    } else {
      list.push({
        n: 5,
        id: 'confianca',
        question: q,
        answer: 'aberto',
        detail: 'A foto do celular e a leitura do texto dizem.',
        pending: state.phone === 'loading',
      })
    }
  }

  // 6. Medição
  {
    const q = 'Vocês sabem quantos contatos o site traz?'
    const tracking = phone?.tracking.length ? phone.tracking : (scan.ads ?? [])
    const paid = tracking.filter((t) => /Ads|Meta|TikTok|LinkedIn/.test(t))
    if (!tracking.length && (phone || (scan.status && scan.status < 400))) {
      list.push({
        n: 6,
        id: 'medicao',
        question: q,
        answer: phone ? 'nao' : 'aberto',
        detail: phone ? 'O site não carrega nenhuma medição: ninguém sabe quantos contatos ele traz.' : 'A página não mostra medição; a foto do celular confere o que o Tag Manager carrega.',
        pitch: phone ? 'Reparei que o site não tem nenhuma medição: hoje não dá para saber quantos contatos ele traz.' : undefined,
        pending: !phone && state.phone === 'loading',
      })
    } else {
      list.push({
        n: 6,
        id: 'medicao',
        question: q,
        answer: 'aberto',
        detail: `Tem ${listText(tracking)}. Falta conferir se o clique no WhatsApp é contado${paid.length ? ' como conversão do anúncio' : ''}.`,
      })
    }
  }

  // 7. Parece de hoje?
  {
    const q = 'O site parece de hoje?'
    const issues: string[] = []
    if (scan.status && scan.status < 400) {
      if (!scan.viewport) issues.push('não se adapta ao celular')
      if (!scan.https) issues.push('o navegador mostra "não seguro"')
      if (scan.copyrightYear && scan.copyrightYear <= now.getFullYear() - 2) issues.push(`o rodapé diz ${scan.copyrightYear}`)
      if (d.plugins.some((p) => OLD_BUILDERS.test(p)) || (scan.builder && OLD_BUILDERS.test(scan.builder))) issues.push('foi montado com um construtor antigo')
      if (checks && !checks.favicon) issues.push('não tem ícone na aba')
      if (phone?.cookieBanner) issues.push('um aviso de cookies cobre a primeira tela')
      const answer: Answer = !issues.length ? 'sim' : issues.length === 1 ? 'parcial' : 'nao'
      const sentence = listText(issues)
      list.push({
        n: 7,
        id: 'atual',
        question: q,
        answer,
        detail: issues.length ? `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.` : 'Nada de site parado: celular, cadeado e rodapé em dia.',
        pitch: scan.copyrightYear && scan.copyrightYear <= now.getFullYear() - 2 ? `Reparei que o rodapé do site ainda diz ${scan.copyrightYear}.` : undefined,
      })
    } else {
      list.push({
        n: 7,
        id: 'atual',
        question: q,
        answer: 'aberto',
        detail: `${PLATFORM_LABEL[scan.platform]}.`,
      })
    }
  }

  return list
}

/** A frase da primeira mensagem: o pior ponto, na ordem que mais pesa para quem anuncia. */
export const pitchOf = (questions: DemandQuestion[]) => {
  const order: DemandQuestion['id'][] = ['whatsapp', 'entende', 'rapido', 'medicao', 'foco', 'confianca', 'atual']
  for (const id of order) {
    const q = questions.find((item) => item.id === id && item.answer === 'nao' && item.pitch)
    if (q) return q.pitch
  }
  return undefined
}

/** As respostas e a leitura do texto em texto corrido, para a nota no CRM. */
export const demandText = (questions: DemandQuestion[], copy: CopyReading | null | undefined) =>
  [
    `As sete perguntas\n${questions.map((q) => `${q.n}. ${q.question} ${ANSWER_LABEL[q.answer]}. ${q.detail}`).join('\n')}`,
    copy
      ? `O que o texto diz\n- Quem chega entende: "${copy.understood}"\n${copy.issues.map((i) => `- "${i.quote}": ${i.problem}`).join('\n')}\n\nPrimeira tela reescrita (rascunho)\n${copy.rewrite.eyebrow}\n${copy.rewrite.title}\n${copy.rewrite.subtitle}\n[${copy.rewrite.button}]`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
