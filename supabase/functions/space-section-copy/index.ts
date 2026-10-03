import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Escreve os textos de uma seção da biblioteca para o projeto do cliente, no
 * Space. Recebe os espaços da seção (título, rótulo, texto, botão, item) e o
 * que o projeto já diz (contexto, voz do DESIGN.md e os textos das páginas), e
 * devolve um texto por espaço. Só para contas logadas: cada chamada gasta
 * crédito da API.
 *
 * Segredo: ANTHROPIC_API_KEY (Supabase > Edge Functions > Secrets).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Role = 'title' | 'eyebrow' | 'text' | 'button' | 'item'

interface Slot {
  id: string
  role: Role
  text: string
  size?: number
}

interface Body {
  project?: { name?: string; context?: string }
  /** Corpo do DESIGN.md: voz e regras de texto. */
  voice?: string
  /** Textos que já estão nas páginas do projeto. */
  examples?: { role: Role; text: string }[]
  section?: { title?: string }
  slots?: Slot[]
}

const ROLE_NAMES: Record<Role, string> = {
  title: 'título',
  eyebrow: 'rótulo curto acima do título',
  text: 'parágrafo',
  button: 'texto de botão',
  item: 'item de lista',
}

const SYSTEM = `Você escreve os textos de seções de landing page para um cliente, em português do Brasil.

A seção veio de uma biblioteca de modelos: os textos atuais são de exemplo (lorem ipsum ou inglês genérico) e servem só para mostrar o papel e o tamanho de cada espaço. Escreva um texto novo para cada espaço, para este cliente.

Como escrever:
- Use a voz do cliente: siga as regras de texto do guia da marca e imite o jeito dos textos que já estão nas páginas dele.
- A seção conta uma coisa só: o rótulo, o título, os parágrafos e o botão falam do mesmo assunto, que combina com o tipo da seção (herói, recursos, etapas, depoimento, preço, perguntas, contato).
- Respeite o tamanho de cada espaço: fique perto do número de caracteres do texto atual (até 30% a mais). Rótulo tem de 1 a 4 palavras. Botão tem de 2 a 5 palavras e começa com verbo. Item de lista é uma frase curta.
- Pode reaproveitar frases das páginas do cliente quando servirem, mas prefira escrever para esta seção.
- Não use emoji nem markdown. Não escreva tudo em maiúsculas: a caixa vem do estilo da página.

O que nunca fazer:
- Não invente fatos: números, preços, prazos, prêmios, resultados, nomes de clientes, depoimentos, datas ou dados de contato. Use só o que está no contexto, no guia ou nos textos do cliente. Se um espaço pede um dado que você não tem, escreva um texto que não afirme número nem fato.
- Não prometa o que o cliente não promete.

Responda com um texto para cada id recebido.`

const SCHEMA = {
  type: 'object',
  properties: {
    textos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, texto: { type: 'string' } },
        required: ['id', 'texto'],
        additionalProperties: false,
      },
    },
  },
  required: ['textos'],
  additionalProperties: false,
}

const MAX_SLOTS = 80
const MAX_VOICE = 12000
const MAX_EXAMPLES = 160

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Só conta logada: a chave anônima do app também passa pela verificação de JWT do Supabase
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return json({ error: 'Entre na conta para escrever com IA.' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'A chave ANTHROPIC_API_KEY não está configurada no Supabase.' }, 500)

    const body = (await req.json()) as Body
    const slots = (body.slots ?? []).filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string')
    if (!slots.length) return json({ error: 'A seção não tem textos para escrever.' }, 400)
    if (slots.length > MAX_SLOTS) return json({ error: `A seção tem ${slots.length} textos; o limite é ${MAX_SLOTS}.` }, 400)

    const examples = (body.examples ?? [])
      .slice(0, MAX_EXAMPLES)
      .map((e) => `- (${ROLE_NAMES[e.role] ?? e.role}) ${e.text}`)
      .join('\n')
    const request = [
      `# Cliente\n${body.project?.name ?? 'Sem nome'}`,
      body.project?.context?.trim() ? `## Contexto\n${body.project.context.trim()}` : '',
      body.voice?.trim() ? `## Guia da marca\n${body.voice.trim().slice(0, MAX_VOICE)}` : '',
      examples ? `## Textos que já estão nas páginas do cliente\n${examples}` : '',
      `# Seção\n${body.section?.title ?? 'Seção da biblioteca'}`,
      `## Espaços, na ordem em que aparecem\n${slots
        .map((s) => `- id ${s.id} · ${ROLE_NAMES[s.role] ?? s.role}${s.size ? ` · fonte ${Math.round(s.size)}px` : ''} · ${s.text.length} caracteres · atual: "${s.text}"`)
        .join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const client = new Anthropic({ apiKey })
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Se o modelo recusar, o pedido roda de novo num modelo de reserva, na mesma chamada
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: request }],
    } as Parameters<typeof client.beta.messages.create>[0])

    if (response.stop_reason === 'refusal') return json({ error: 'O modelo não quis escrever estes textos.' }, 422)
    if (response.stop_reason === 'max_tokens') return json({ error: 'A resposta ficou longa demais. Tente uma seção menor.' }, 422)

    const text = response.content.find((b) => b.type === 'text')
    const parsed = text && 'text' in text ? JSON.parse(text.text) : null
    const known = new Set(slots.map((s) => s.id))
    const texts = Array.isArray(parsed?.textos)
      ? (parsed.textos as { id: unknown; texto: unknown }[]).filter(
          (t): t is { id: string; texto: string } => typeof t.id === 'string' && known.has(t.id) && typeof t.texto === 'string' && !!t.texto.trim()
        )
      : []

    return json({ texts: texts.map((t) => ({ id: t.id, text: t.texto.trim() })), model: response.model })
  } catch (error) {
    console.error('[space-section-copy]', error)
    const status = error instanceof Anthropic.APIError && error.status ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Erro desconhecido' }, status >= 400 ? status : 500)
  }
})
