import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    if (req.method === 'GET' || req.method === 'POST') {
      // Get plan features
      const url = new URL(req.url);
      const planName = url.searchParams.get('plan');

      let query = supabaseClient
        .from('admin_plan_features')
        .select('*')
        .eq('is_enabled', true)
        .order('display_order', { ascending: true });

      if (planName) {
        query = query.eq('plan_name', planName);
      }

      const { data: features, error } = await query;

      if (error) {
        console.error('Error fetching plan features:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Group features by plan if no specific plan requested
      let result;
      if (planName) {
        result = { features };
      } else {
        result = {
          starter: features?.filter(f => f.plan_name === 'starter') || [],
          pro: features?.filter(f => f.plan_name === 'pro') || []
        };
      }

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-plan-features function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});