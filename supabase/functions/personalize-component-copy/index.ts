import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type FieldKind = 'text' | 'url' | 'image' | 'color'

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

const normalizeReferenceUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim()
  if (!trimmed) throw new Error('referenceUrl must be a valid URL')

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withProtocol).toString()
}

const extractMetaTag = (html: string, key: string) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedKey}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedKey}["'][^>]*>`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  return ''
}

const extractTitle = (html: string) => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return titleMatch?.[1]?.trim() || ''
}

const safeFetchReferenceUrl = async (url: string) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4500)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SuperelementsAI/1.0 (+https://superelements.io)'
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`referenceUrl fetch failed with ${response.status}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

const fetchReferenceUrlWithFallback = async (rawUrl: string) => {
  const normalized = normalizeReferenceUrl(rawUrl)

  try {
    const html = await safeFetchReferenceUrl(normalized)
    return { url: normalized, html }
  } catch (firstError) {
    const parsed = new URL(normalized)
    if (parsed.protocol === 'http:') {
      const httpsVersion = normalized.replace(/^http:\/\//i, 'https://')
      const html = await safeFetchReferenceUrl(httpsVersion)
      return { url: httpsVersion, html }
    }

    throw firstError
  }
}

const urlLikeKeys = new Set(['url', 'link', 'href', 'button_url', 'cta_url'])
const imageLikeKeys = new Set(['image', 'image_url', 'background_image', 'src'])
const colorLikeKeys = new Set(['color', 'text_color', 'background_color', 'accent_color', 'overlay_color'])
const textLikeKeys = new Set([
  'title', 'subtitle', 'headline', 'subheadline', 'description', 'text', 'editor', 'content',
  'button_text', 'label', 'caption', 'alt', 'placeholder', 'pretitle', 'eyebrow', 'cta'
])

const looksLikePlaceholder = (value: string) => {
  const v = value.trim()
  if (!v) return false
  return (
    /\{\{[^}]+\}\}/.test(v) ||
    /\[\[[^\]]+\]\]/.test(v) ||
    /<[^>]+>/.test(v) ||
    /lorem ipsum/i.test(v) ||
    /dummy|placeholder|example|sample/i.test(v)
  )
}

const guessFieldKind = (key: string, value: string): FieldKind | null => {
  const normalizedKey = key.toLowerCase()

  if (urlLikeKeys.has(normalizedKey) || /^https?:\/\//i.test(value)) return 'url'
  if (imageLikeKeys.has(normalizedKey) || /\.(png|jpe?g|webp|svg)(\?.*)?$/i.test(value)) return 'image'
  if (colorLikeKeys.has(normalizedKey) || /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.test(value.trim())) return 'color'

  if (textLikeKeys.has(normalizedKey)) return 'text'
  if (looksLikePlaceholder(value)) return 'text'

  return null
}

const collectEditableFields = (node: unknown, path: (string | number)[] = [], out: EditableField[] = []): EditableField[] => {
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

      out.push({
        id: out.length,
        path: nextPath,
        key,
        value,
        kind,
      })
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
    const { prompt, clipboardJson, componentTitle, referenceUrl } = await req.json()

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('prompt is required')
    }

    if (!clipboardJson || typeof clipboardJson !== 'string') {
      throw new Error('clipboardJson is required')
    }

    if (clipboardJson.length > 200000) {
      throw new Error('clipboardJson is too large for personalization')
    }

    let originalClipboard: any
    try {
      originalClipboard = JSON.parse(clipboardJson)
    } catch {
      throw new Error('clipboardJson is not valid JSON')
    }

    if (!originalClipboard || originalClipboard.type !== 'elementor' || !Array.isArray(originalClipboard.elements)) {
      throw new Error('clipboardJson must be a valid Elementor clipboard payload')
    }

    let referenceContext: Record<string, string> | null = null
    if (typeof referenceUrl === 'string' && referenceUrl.trim()) {
      let normalizedReferenceUrl = normalizeReferenceUrl(referenceUrl.trim())

      try {
        const fetched = await fetchReferenceUrlWithFallback(referenceUrl.trim())
        normalizedReferenceUrl = fetched.url
        const html = fetched.html

        referenceContext = {
          url: normalizedReferenceUrl,
          title: extractMetaTag(html, 'og:title') || extractTitle(html),
          description: extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description'),
          image: extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image'),
          theme_color: extractMetaTag(html, 'theme-color'),
        }
      } catch (error) {
        console.warn('Failed to fetch referenceUrl context:', error)
        referenceContext = {
          url: normalizedReferenceUrl,
          title: '',
          description: '',
          image: '',
          theme_color: '',
        }
      }
    }

    const editableFields = collectEditableFields(originalClipboard.elements)

    if (editableFields.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            personalized_json: JSON.stringify(originalClipboard),
            preview_html: '',
            reference_context: referenceContext,
            model: 'no-op',
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-nano'

    const systemPrompt = `
Você recebe campos editáveis de um componente Elementor e deve sugerir substituições.

Objetivo:
- Personalizar textos, links, imagens e cores com base no prompt e na URL de referência.
- NÃO alterar estrutura técnica do Elementor.

Regras:
- Responda JSON válido (sem markdown).
- Retorne no máximo 60 substituições.
- Não invente IDs; use apenas IDs recebidos.
- Para campos kind=url, use URL válida (https://...).
- Para campos kind=color, prefira hexadecimal (#RRGGBB).
- Se existir reference_context.url, priorize esse link em CTAs.
- Se existir reference_context.image, priorize para campos de imagem.
- Se existir reference_context.theme_color, use como cor primária.

Formato de saída:
{
  "replacements": [
    { "id": 0, "value": "novo valor" }
  ],
  "preview_html": "html opcional simples para preview"
}
`

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
          { role: 'system', content: systemPrompt.trim() },
          {
            role: 'user',
            content: JSON.stringify({
              component_title: typeof componentTitle === 'string' ? componentTitle : 'Componente',
              prompt: prompt.trim(),
              reference_context: referenceContext,
              editable_fields: editableFields,
            }),
          },
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
      throw new Error('OpenAI returned invalid JSON envelope')
    }

    const replacements: Array<{ id: number; value: string }> = Array.isArray(parsed?.replacements)
      ? parsed.replacements.filter((item: any) => typeof item?.id === 'number' && typeof item?.value === 'string')
      : []

    const personalizedClipboard = JSON.parse(JSON.stringify(originalClipboard))
    const fieldMap = new Map(editableFields.map((field) => [field.id, field]))

    for (const replacement of replacements.slice(0, 60)) {
      const field = fieldMap.get(replacement.id)
      if (!field) continue
      setValueAtPath(personalizedClipboard, ['elements', ...field.path], replacement.value)
    }

    if (!personalizedClipboard || personalizedClipboard.type !== 'elementor' || !Array.isArray(personalizedClipboard.elements)) {
      throw new Error('personalized_clipboard is not a valid Elementor clipboard payload')
    }

    const previewHtml = typeof parsed?.preview_html === 'string' ? parsed.preview_html : ''

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          personalized_json: JSON.stringify(personalizedClipboard),
          preview_html: previewHtml,
          reference_context: referenceContext,
          replacements_count: replacements.length,
          editable_fields_count: editableFields.length,
          model,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in personalize-component-copy:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
