import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertRequest {
  componentId: number;
  componentUrl: string;
  forceRefresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { componentId, componentUrl, forceRefresh }: ConvertRequest = await req.json();

    console.log('🎨 Convert to Figma request:', { componentId, componentUrl, forceRefresh });

    // Init Supabase with service role for cache operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch rendered HTML from component URL
    console.log('📥 Fetching HTML from:', componentUrl);
    const htmlResponse = await fetch(componentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CodeToDesign/1.0)'
      }
    });

    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch component HTML: ${htmlResponse.status}`);
    }

    const htmlContent = await htmlResponse.text();
    console.log('✅ HTML fetched, size:', htmlContent.length, 'bytes');

    // Generate hash of HTML for cache key
    const htmlHash = await hashString(htmlContent);

    // 2. Check cache (unless force refresh)
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

    // 3. Call code.to.design API
    console.log('🚀 Converting HTML to Figma via code.to.design API...');
    const apiKey = Deno.env.get('CODE_TO_DESIGN_API_KEY');
    
    if (!apiKey) {
      throw new Error('CODE_TO_DESIGN_API_KEY not configured');
    }

    const conversionResponse = await fetch('https://api.code.to.design/api/convert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent,
        format: 'figma',
        options: {
          width: 1200,
          preserveFonts: true,
          inlineStyles: true
        }
      })
    });

    if (!conversionResponse.ok) {
      const errorText = await conversionResponse.text();
      console.error('❌ code.to.design API error:', conversionResponse.status, errorText);
      throw new Error(`code.to.design API error: ${conversionResponse.status} - ${errorText}`);
    }

    const figmaData = await conversionResponse.json();
    console.log('✨ Conversion successful, data size:', JSON.stringify(figmaData).length, 'bytes');

    // 4. Save to cache
    console.log('💾 Saving conversion to cache...');
    const { error: insertError } = await supabaseClient
      .from('figma_conversions')
      .insert({
        component_id: componentId,
        component_url: componentUrl,
        html_hash: htmlHash,
        figma_data: figmaData,
        conversion_metadata: {
          convertedAt: new Date().toISOString(),
          htmlSize: htmlContent.length,
          apiVersion: '1.0'
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
        data: figmaData,
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
