import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-PRICING-CONFIGS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Get active payment configurations
    const { data: configs, error } = await supabaseClient
      .from("admin_payment_configs")
      .select("*")
      .eq("status", "live")
      .order("currency", { ascending: true })
      .order("plan_type", { ascending: true });

    if (error) throw error;

    logStep("Retrieved pricing configs", { count: configs?.length || 0 });

    // Transform configs into pricing structure
    const pricingByCountry: Record<string, any> = {};
    
    configs?.forEach(config => {
      const countryCode = config.currency === 'BRL' ? 'BR' : 'US';
      
      if (!pricingByCountry[countryCode]) {
        pricingByCountry[countryCode] = {
          currency: {
            code: config.currency,
            symbol: config.currency === 'BRL' ? 'R$' : '$'
          },
          plans: {}
        };
      }
      
      if (!pricingByCountry[countryCode].plans[config.plan_type]) {
        pricingByCountry[countryCode].plans[config.plan_type] = {};
      }
      
      pricingByCountry[countryCode].plans[config.plan_type] = {
        price: Math.floor(config.price_cents / 100),
        price_cents: config.price_cents,
        stripe_price_id: config.stripe_price_id,
        discount_percentage: config.discount_percentage || 0,
        originalPrice: config.discount_percentage 
          ? Math.floor(config.price_cents / 100 / (1 - config.discount_percentage / 100))
          : null,
        status: config.status || 'draft'
      };
    });

    logStep("Transformed pricing data", { countries: Object.keys(pricingByCountry) });

    return new Response(JSON.stringify({ 
      success: true, 
      pricing: pricingByCountry,
      configs: configs 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});