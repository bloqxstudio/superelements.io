import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Strategy = 'mobile' | 'desktop'

const isMissingPerformanceTableError = (error: unknown) => {
  if (!(error instanceof Error)) return false
  return error.message.includes('client_page_performance')
    && (error.message.includes('does not exist') || error.message.includes('relation'))
}

const toScore = (value: unknown): number | null => {
  return typeof value === 'number' ? Math.round(value * 100) : null
}

const extractCategoryScores = (rawResult: any) => {
  const categories = rawResult?.lighthouseResult?.categories || {}
  return {
    performance_score: toScore(categories?.performance?.score),
    accessibility_score: toScore(categories?.accessibility?.score),
    best_practices_score: toScore(categories?.['best-practices']?.score),
    seo_score: toScore(categories?.seo?.score),
  }
}

const normalizeResultData = (data: any) => {
  const extracted = extractCategoryScores(data?.raw_result)
  return {
    ...data,
    performance_score: data?.performance_score ?? extracted.performance_score,
    accessibility_score: extracted.accessibility_score,
    best_practices_score: extracted.best_practices_score,
    seo_score: extracted.seo_score,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pageId, url, strategy = 'mobile', forceRefresh = false } = await req.json()

    if (strategy !== 'mobile' && strategy !== 'desktop') {
      throw new Error("Invalid strategy. Use 'mobile' or 'desktop'")
    }

    if (!pageId && !url) {
      throw new Error('pageId or url is required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const apiKey = Deno.env.get('PAGESPEED_API_KEY')
    if (!apiKey) {
      throw new Error('PAGESPEED_API_KEY is not configured')
    }

    let targetUrl = url as string | undefined
    let resolvedPageId = pageId as string | undefined
    let connectionId: string | null = null

    if (resolvedPageId) {
      const { data: page, error: pageError } = await supabaseClient
        .from('client_pages')
        .select('id, connection_id, url')
        .eq('id', resolvedPageId)
        .single()

      if (pageError || !page) {
        throw new Error('Client page not found')
      }

      targetUrl = page.url
      connectionId = page.connection_id
    }

    if (!targetUrl) {
      throw new Error('Unable to resolve target URL')
    }

    if (resolvedPageId && !forceRefresh) {
      try {
        const cacheThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: cached, error: cacheError } = await supabaseClient
          .from('client_page_performance')
          .select('*')
          .eq('client_page_id', resolvedPageId)
          .eq('strategy', strategy)
          .gte('fetched_at', cacheThreshold)
          .order('fetched_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cacheError) {
          throw cacheError
        }

        if (cached) {
          return new Response(
            JSON.stringify({
              success: true,
              cached: true,
              data: normalizeResultData(cached)
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            },
          )
        }
      } catch (error) {
        if (!isMissingPerformanceTableError(error)) {
          throw error
        }
        console.warn('Cache table not available yet; continuing without cache read')
      }
    }

    const endpoint = new URL('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed')
    endpoint.searchParams.set('url', targetUrl)
    endpoint.searchParams.set('strategy', strategy)
    endpoint.searchParams.append('category', 'performance')
    endpoint.searchParams.append('category', 'accessibility')
    endpoint.searchParams.append('category', 'best-practices')
    endpoint.searchParams.append('category', 'seo')
    endpoint.searchParams.set('key', apiKey)

    const psiResponse = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })

    const payload = await psiResponse.json()
    if (!psiResponse.ok) {
      const message = payload?.error?.message || `PageSpeed request failed with ${psiResponse.status}`
      throw new Error(message)
    }

    const lighthouse = payload?.lighthouseResult || {}
    const categories = lighthouse?.categories || {}
    const audits = lighthouse?.audits || {}
    const performanceScore = toScore(categories?.performance?.score)
    const lcpMs = typeof audits?.['largest-contentful-paint']?.numericValue === 'number'
      ? Math.round(audits['largest-contentful-paint'].numericValue)
      : null
    const inpMs = typeof audits?.['interaction-to-next-paint']?.numericValue === 'number'
      ? Math.round(audits['interaction-to-next-paint'].numericValue)
      : null
    const tbtMs = typeof audits?.['total-blocking-time']?.numericValue === 'number'
      ? Math.round(audits['total-blocking-time'].numericValue)
      : null
    const cls = typeof audits?.['cumulative-layout-shift']?.numericValue === 'number'
      ? Number(audits['cumulative-layout-shift'].numericValue.toFixed(3))
      : null

    const record = {
      client_page_id: resolvedPageId ?? null,
      connection_id: connectionId,
      url: targetUrl,
      strategy: strategy as Strategy,
      performance_score: performanceScore,
      lcp_ms: lcpMs,
      inp_ms: inpMs,
      tbt_ms: tbtMs,
      cls,
      report_url: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(targetUrl)}`,
      raw_result: payload,
      fetched_at: new Date().toISOString(),
    }

    if (resolvedPageId) {
      try {
        const { data, error } = await supabaseClient
          .from('client_page_performance')
          .upsert(record, { onConflict: 'client_page_id,strategy' })
          .select('*')
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            cached: false,
            data: normalizeResultData(data)
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      } catch (error) {
        if (!isMissingPerformanceTableError(error)) {
          throw error
        }
        console.warn('Cache table not available yet; returning transient PageSpeed data')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        data: normalizeResultData(record)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-pagespeed:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
