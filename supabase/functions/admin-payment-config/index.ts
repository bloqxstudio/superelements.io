import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-PAYMENT-CONFIG] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check admin role
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      throw new Error("Admin access required");
    }

    logStep("Admin authenticated", { userId: user.id });

    const { method } = req;
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || method.toLowerCase();

    switch (action) {
      case 'get':
      case 'list': {
        const { data: configs, error } = await supabaseClient
          .from("admin_payment_configs")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ configs }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'post':
      case 'create': {
        const body = await req.json();
        const { currency, plan_type, price_cents, discount_percentage, status } = body;

        // Initialize Stripe
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
        });

        // Create Stripe price if needed
        let stripe_price_id = null;
        if (status === 'live') {
          const product = await stripe.products.create({
            name: `Pro Plan ${plan_type} (${currency})`,
            description: `Professional subscription - ${plan_type} billing in ${currency}`,
          });

          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: price_cents,
            currency: currency.toLowerCase(),
            recurring: { interval: plan_type === 'monthly' ? 'month' : 'year' },
            nickname: `Pro ${plan_type} (${currency})`,
          });

          stripe_price_id = price.id;
          logStep("Created Stripe price", { priceId: stripe_price_id, currency, plan_type });
        }

        const { data: config, error } = await supabaseClient
          .from("admin_payment_configs")
          .insert({
            currency,
            plan_type,
            price_cents,
            stripe_price_id,
            discount_percentage: discount_percentage || 0,
            status: status || 'draft',
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        logStep("Payment config created", { configId: config.id });

        return new Response(JSON.stringify({ config }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
        });
      }

      case 'put':
      case 'update': {
        const body = await req.json();
        const { id, ...updates } = body;

        const { data: config, error } = await supabaseClient
          .from("admin_payment_configs")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        logStep("Payment config updated", { configId: id });

        return new Response(JSON.stringify({ config }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'delete': {
        const body = await req.json();
        const { id } = body;

        const { error } = await supabaseClient
          .from("admin_payment_configs")
          .delete()
          .eq("id", id);

        if (error) throw error;

        logStep("Payment config deleted", { configId: id });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});