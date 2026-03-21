import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type FieldKind = 'text' | 'color'

interface EditableField {
  id: number
  path: (string | number)[]
  key: string
  value: string
  kind: FieldKind
}

const parseJsonFromResponse = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const colorLikeKeys = new Set([
  'color', 'text_color', 'background_color', 'title_color', 'accent_color',
  'overlay_color', 'button_background_color', 'button_text_color', 'border_color',
  'heading_color', 'link_color',
])

const textLikeKeys = new Set([
  'title', 'subtitle', 'headline', 'subheadline', 'description', 'text', 'editor',
  'content', 'button_text', 'label', 'caption', 'pretitle', 'eyebrow', 'cta',
])

const guessFieldKind = (key: string, value: string): FieldKind | null => {
  const k = key.toLowerCase()
  if (colorLikeKeys.has(k) || /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.test(value.trim())) return 'color'
  if (textLikeKeys.has(k)) return 'text'
  return null
}

const collectEditableFields = (
  node: unknown,
  path: (string | number)[] = [],
  out: EditableField[] = [],
): EditableField[] => {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectEditableFields(item, [...path, index], out))
    return out
  }

  if (!node || typeof node !== 'object') return out

  const obj = node as Record<string, unknown>

  for (const [key, value] of Object.entries(obj)) {
    const nextPath = [...path, key]

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed || trimmed.length > 700) continue
      const kind = guessFieldKind(key, value)
      if (!kind) continue
      out.push({ id: out.length, path: nextPath, key, value, kind })
      continue
    }

    if (typeof value === 'object' && value !== null) {
      collectEditableFields(value, nextPath, out)
    }
  }

  return out
}

const setValueAtPath = (root: any, path: (string | number)[], value: string) => {
  if (!path.length) return
  let cursor = root
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]
    if (cursor == null || typeof cursor !== 'object') return
    cursor = cursor[segment as keyof typeof cursor]
  }
  const last = path[path.length - 1]
  if (cursor && typeof cursor === 'object' && typeof cursor[last as keyof typeof cursor] === 'string') {
    cursor[last as keyof typeof cursor] = value
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { elementorJson, colors, copy } = await req.json()

    if (!elementorJson || typeof elementorJson !== 'string') {
      throw new Error('elementorJson is required')
    }

    if (elementorJson.length > 200000) {
      throw new Error('elementorJson is too large')
    }

    const hasColors = Array.isArray(colors) && colors.length > 0
    const hasCopy = typeof copy === 'string' && copy.trim().length > 0

    if (!hasColors && !hasCopy) {
      return new Response(
        JSON.stringify({ success: true, data: { modified_json: elementorJson } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    let parsedJson: any
    try {
      parsedJson = JSON.parse(elementorJson)
    } catch {
      throw new Error('elementorJson is not valid JSON')
    }

    // Collect editable fields filtering by what we actually need to transform
    const allFields = collectEditableFields(parsedJson)
    const relevantFields = allFields.filter((f) => {
      if (f.kind === 'color' && hasColors) return true
      if (f.kind === 'text' && hasCopy) return true
      return false
    })

    if (relevantFields.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: { modified_json: elementorJson } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-nano'

    const systemPrompt = `
Você recebe campos editáveis de um JSON do Elementor, e opcionalmente uma paleta de cores e um texto de copy.
Aplique as transformações de forma semântica.

CORES (aplique apenas se "colors" for fornecida e não vazia):
- Analise os campos de cor disponíveis e identifique sua função semântica (fundo principal, fundo secundário, cor de texto, cor de destaque/acento, botão, borda, etc.)
- Distribua as cores da paleta de acordo com a função semântica:
  - 1ª cor → cor primária (background principal, cor de maior destaque)
  - 2ª cor → cor secundária (background de contraste, seções alternadas)
  - 3ª cor → cor de acento (títulos em destaque, botões, CTAs)
  - 4ª cor → cor de texto principal (textos em fundo escuro)
  - 5ª+ → demais campos de cor na ordem que fizer sentido visual

TEXTOS (aplique apenas se "copy" for fornecido e não vazio):
- O copy está em blocos separados por linha em branco
- Distribua os blocos pelos campos de texto de forma semântica:
  - 1º bloco → título principal (campo title/headline/heading de maior hierarquia)
  - 2º bloco → subtítulo ou descrição curta
  - 3º bloco → corpo do texto (editor/description)
  - 4º bloco → texto de botão/CTA (se existir)
  - Blocos adicionais → demais campos de texto na ordem lógica
- NÃO altere campos que não sejam de texto

Retorne APENAS JSON válido (sem markdown), no formato:
{ "replacements": [{ "id": 0, "value": "novo valor" }] }
Retorne apenas os campos que você vai modificar.
`.trim()

    const colorFields = relevantFields.filter((f) => f.kind === 'color')
    const textFields = relevantFields.filter((f) => f.kind === 'text')

    const userPayload: Record<string, unknown> = {
      editable_fields: relevantFields.map((f) => ({ id: f.id, key: f.key, kind: f.kind, current_value: f.value })),
    }
    if (hasColors) userPayload.colors = colors
    if (hasCopy) userPayload.copy = copy
    userPayload.field_summary = {
      color_fields: colorFields.length,
      text_fields: textFields.length,
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_completion_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    })

    const openAiPayload = await parseJsonFromResponse(openAiResponse)
    if (!openAiResponse.ok) {
      const message = openAiPayload?.error?.message || `OpenAI request failed with ${openAiResponse.status}`
      throw new Error(message)
    }

    const content = openAiPayload?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      throw new Error('OpenAI returned empty response')
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('OpenAI returned invalid JSON')
    }

    const replacements: Array<{ id: number; value: string }> = Array.isArray(parsed?.replacements)
      ? parsed.replacements.filter((item: any) => typeof item?.id === 'number' && typeof item?.value === 'string')
      : []

    const modifiedJson = JSON.parse(JSON.stringify(parsedJson))
    const fieldMap = new Map(relevantFields.map((field) => [field.id, field]))

    for (const replacement of replacements.slice(0, 80)) {
      const field = fieldMap.get(replacement.id)
      if (!field) continue
      setValueAtPath(modifiedJson, field.path, replacement.value)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          modified_json: JSON.stringify(modifiedJson),
          replacements_count: replacements.length,
          editable_fields_count: relevantFields.length,
          model,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('Error in space-apply-transformations:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
