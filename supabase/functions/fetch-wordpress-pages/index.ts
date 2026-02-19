import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { connectionId } = await req.json()

    if (!connectionId) {
      throw new Error('Connection ID is required')
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get connection details including credentials
    const { data: connection, error: connError } = await supabaseClient
      .from('connections')
      .select('id, base_url')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    // Get credentials
    const { data: credentials, error: credError } = await supabaseClient
      .from('connection_credentials')
      .select('username, application_password')
      .eq('connection_id', connectionId)
      .single()

    if (credError || !credentials) {
      throw new Error('Credentials not found')
    }

    // Fetch pages from WordPress
    const baseUrl = connection.base_url.replace(/\/$/, '')
    const apiUrl = `${baseUrl}/wp-json/wp/v2/pages`
    const auth = btoa(`${credentials.username}:${credentials.application_password}`)
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
    }

    const buildParams = (page: number, includeContext: boolean) => {
      const params = new URLSearchParams({
        per_page: '100',
        page: String(page),
        _fields: 'id,title,slug,link,status,modified'
      })

      if (includeContext) {
        params.set('context', 'edit')
      }

      return params
    }

    const fetchPage = async (page: number, includeContext: boolean) => {
      const params = buildParams(page, includeContext)
      const url = `${apiUrl}?${params.toString()}`
      console.log('Fetching WordPress pages:', url)
      const response = await fetch(url, { headers })
      return response
    }

    let includeContext = true
    let firstResponse = await fetchPage(1, includeContext)

    if (!firstResponse.ok && [400, 401, 403].includes(firstResponse.status)) {
      const body = await firstResponse.text()
      console.warn(
        `WordPress returned ${firstResponse.status} with context=edit, retrying without context`,
        body
      )
      includeContext = false
      firstResponse = await fetchPage(1, includeContext)
    }

    if (!firstResponse.ok) {
      const errorText = await firstResponse.text()
      console.error('WordPress API error:', errorText)
      throw new Error(`WordPress returned ${firstResponse.status}: ${firstResponse.statusText}`)
    }

    const firstBatch = await firstResponse.json()
    const totalPages = Number(firstResponse.headers.get('X-WP-TotalPages') || '1')
    let wpPages = Array.isArray(firstBatch) ? firstBatch : []

    for (let page = 2; page <= totalPages; page++) {
      const response = await fetchPage(page, includeContext)
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`WordPress API error at page ${page}:`, errorText)
        throw new Error(`WordPress returned ${response.status}: ${response.statusText}`)
      }

      const batch = await response.json()
      if (Array.isArray(batch)) {
        wpPages = wpPages.concat(batch)
      }
    }

    console.log('Successfully fetched pages:', wpPages.length)

    // Transform and insert pages
    const pagesToInsert = wpPages.map((page: any) => ({
      connection_id: connectionId,
      wordpress_page_id: page.id,
      title: page.title?.rendered || page.title || 'Untitled',
      slug: page.slug || '',
      url: page.link || '',
      status: page.status || 'draft',
      modified_date: page.modified || new Date().toISOString(),
    }))

    // Insert pages into database
    const { data, error } = await supabaseClient
      .from('client_pages')
      .upsert(pagesToInsert, {
        onConflict: 'connection_id,wordpress_page_id'
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: wpPages.length,
        pages: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in fetch-wordpress-pages:', error)

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
