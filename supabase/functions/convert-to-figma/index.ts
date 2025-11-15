import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertRequest {
  componentId: number;
  html?: string;
  url?: string;
  forceRefresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ConvertRequest = await req.json();
    const { componentId, html, url, forceRefresh = false } = body;
    
    if (!componentId || (!html && !url)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing componentId and html/url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎨 Convert to Figma request:', { 
      componentId, 
      hasHtml: !!html,
      hasUrl: !!url,
      forceRefresh 
    });
    
    let finalHtml = html;
    let componentUrl = url || `https://component-${componentId}`;
    
    // If URL provided instead of HTML, fetch it server-side
    if (!html && url) {
      console.log('📥 Fetching HTML from URL:', url);
      try {
        const fetchResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          redirect: 'follow'
        });
        
        if (!fetchResponse.ok) {
          throw new Error(`Failed to fetch URL: ${fetchResponse.status}`);
        }
        
        finalHtml = await fetchResponse.text();
        console.log('✅ HTML fetched successfully, length:', finalHtml.length);
      } catch (fetchError: any) {
        console.error('❌ Failed to fetch HTML from URL:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch URL: ${fetchError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Init Supabase with service role for cache operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate hash of HTML for cache key
    const htmlHash = await hashString(finalHtml!);
    console.log('🔑 HTML hash:', htmlHash);

    // Check cache (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabaseClient
        .from('figma_conversions')
        .select('*')
        .eq('component_id', componentId)
        .eq('html_hash', htmlHash)
        .maybeSingle();

      if (cached && !cacheError) {
        console.log('🎯 Cache hit! Returning cached conversion');
        
        // Update usage stats
        await supabaseClient
          .from('figma_conversions')
          .update({ 
            last_used_at: new Date().toISOString(),
            use_count: cached.use_count + 1
          })
          .eq('id', cached.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: cached.figma_data,
            cached: true,
            savedCost: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Call api.to.design with correct endpoint
    console.log('🚀 Converting HTML to Figma via api.to.design...');
    const apiKey = Deno.env.get('CODE_TO_DESIGN_API_KEY');
    
    if (!apiKey) {
      throw new Error('CODE_TO_DESIGN_API_KEY not configured');
    }

    const conversionResponse = await fetch('https://api.to.design/html', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: finalHtml,
        clip: true  // Enable clipboard mode
      })
    });

    if (!conversionResponse.ok) {
      const errorText = await conversionResponse.text();
      console.error('❌ api.to.design API error:', conversionResponse.status, errorText);
      throw new Error(`API error: ${conversionResponse.status} - ${errorText}`);
    }

    // Response is text/html clipboard data
    const clipboardHtml = await conversionResponse.text();
    console.log('✨ Conversion successful, clipboard HTML size:', clipboardHtml.length, 'bytes');

    // Save to cache
    console.log('💾 Saving conversion to cache...');
    const { error: insertError } = await supabaseClient
      .from('figma_conversions')
      .insert({
        component_id: componentId,
        component_url: componentUrl,
        html_hash: htmlHash,
        figma_data: { clipboardHtml },
        conversion_metadata: {
          convertedAt: new Date().toISOString(),
          htmlSize: finalHtml!.length,
          clipboardHtmlSize: clipboardHtml.length,
          fetchedFromUrl: !!url
        }
      });

    if (insertError) {
      console.warn('⚠️ Failed to save to cache:', insertError.message);
    } else {
      console.log('✅ Saved to cache successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { clipboardHtml },
        cached: false,
        newConversion: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Conversion error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to generate SHA-256 hash
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
