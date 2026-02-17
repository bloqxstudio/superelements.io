import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Strategy = 'mobile' | 'desktop'

const parseJsonFromResponse = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const normalizeList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

const buildAuditContext = (rawResult: any) => {
  const lighthouse = rawResult?.lighthouseResult || {}
  const categories = lighthouse?.categories || {}
  const audits = lighthouse?.audits || {}

  const compactAudits = Object.entries(audits).reduce((acc, [id, audit]: [string, any]) => {
    acc[id] = {
      title: audit?.title ?? '',
      description: audit?.description ?? '',
      score: typeof audit?.score === 'number' ? Number(audit.score.toFixed(2)) : null,
      scoreDisplayMode: audit?.scoreDisplayMode ?? null,
      numericValue: typeof audit?.numericValue === 'number' ? Math.round(audit.numericValue) : null,
      displayValue: audit?.displayValue ?? null,
    }
    return acc
  }, {} as Record<string, unknown>)

  return {
    requestedUrl: rawResult?.id || rawResult?.analysisUTCTimestamp || null,
    finalDisplayedUrl: lighthouse?.finalDisplayedUrl ?? null,
    fetchTime: lighthouse?.fetchTime ?? null,
    categories: {
      performance: categories?.performance?.score ?? null,
      accessibility: categories?.accessibility?.score ?? null,
      bestPractices: categories?.['best-practices']?.score ?? null,
      seo: categories?.seo?.score ?? null,
    },
    audits: compactAudits,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pageId, strategy = 'mobile', forceRefresh = false } = await req.json()

    if (!pageId) {
      throw new Error('pageId is required')
    }
    if (strategy !== 'mobile' && strategy !== 'desktop') {
      throw new Error("Invalid strategy. Use 'mobile' or 'desktop'")
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini'

    const { data: performance, error: performanceError } = await supabaseClient
      .from('client_page_performance')
      .select('*')
      .eq('client_page_id', pageId)
      .eq('strategy', strategy as Strategy)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (performanceError) {
      throw performanceError
    }
    if (!performance) {
      throw new Error('No PageSpeed report found for this page. Run PageSpeed first.')
    }

    if (!forceRefresh) {
      const { data: cachedAnalysis, error: cacheError } = await supabaseClient
        .from('client_page_recommendations')
        .select('*')
        .eq('client_page_id', pageId)
        .eq('strategy', strategy as Strategy)
        .eq('performance_id', performance.id)
        .limit(1)
        .maybeSingle()

      if (cacheError) {
        throw cacheError
      }

      if (cachedAnalysis) {
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            data: cachedAnalysis,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }
    }

    const reportContext = buildAuditContext(performance.raw_result)
    const analysisPrompt = `
Você é um especialista em performance web, acessibilidade, SEO técnico e WordPress.
Analise o relatório Lighthouse/PageSpeed e produza recomendações práticas e priorizadas.

Regras:
- Responda em português do Brasil.
- Traga ações implementáveis em projeto React + WordPress.
- Priorize impacto real no score e UX.
- Cada ação deve citar ao menos 1 evidence_audit_id.
- Seja objetivo e técnico.
- Retorne apenas JSON válido, sem markdown.

Formato JSON obrigatório:
{
  "summary": "string",
  "priority_actions": [
    {
      "title": "string",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "category": "performance|accessibility|best_practices|seo|general",
      "expected_result": "string",
      "why": "string",
      "evidence_audit_ids": ["string"],
      "implementation_steps": ["string"]
    }
  ],
  "quick_wins": ["string"],
  "wordpress_focus": ["string"],
  "risk_notes": ["string"]
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
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: analysisPrompt.trim() },
          {
            role: 'user',
            content: JSON.stringify({
              strategy,
              page_url: performance.url,
              fetched_at: performance.fetched_at,
              scores: {
                performance: performance.performance_score,
                accessibility: performance.accessibility_score ?? null,
                best_practices: performance.best_practices_score ?? null,
                seo: performance.seo_score ?? null,
              },
              metrics: {
                lcp_ms: performance.lcp_ms,
                inp_ms: performance.inp_ms,
                tbt_ms: performance.tbt_ms,
                cls: performance.cls,
              },
              report: reportContext,
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
      throw new Error('OpenAI returned empty analysis')
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('OpenAI returned invalid JSON')
    }

    const normalized = {
      summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
      priority_actions: Array.isArray(parsed?.priority_actions) ? parsed.priority_actions : [],
      quick_wins: normalizeList(parsed?.quick_wins),
      wordpress_focus: normalizeList(parsed?.wordpress_focus),
      risk_notes: normalizeList(parsed?.risk_notes),
    }

    const toInsert = {
      client_page_id: pageId,
      performance_id: performance.id,
      connection_id: performance.connection_id,
      strategy: strategy as Strategy,
      summary: normalized.summary,
      priority_actions: normalized.priority_actions,
      quick_wins: normalized.quick_wins,
      wordpress_focus: normalized.wordpress_focus,
      risk_notes: normalized.risk_notes,
      full_analysis: parsed,
      model,
      generated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseClient
      .from('client_page_recommendations')
      .upsert(toInsert, { onConflict: 'client_page_id,strategy' })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in analyze-pagespeed-report:', error)

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
