
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { plan, billingPeriod = 'yearly', userCountry = 'US' } = await req.json();
    if (!plan || !['pro'].includes(plan)) {
      throw new Error("Invalid plan specified");
    }

    // Map billingPeriod to plan_type for database lookup
    let planType = billingPeriod;
    if (billingPeriod === 'yearly') {
      planType = 'annual';
    }

    // Get pricing configuration from database
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const currency = userCountry === 'BR' ? 'BRL' : 'USD';
    const { data: priceConfig, error: configError } = await supabaseService
      .from("admin_payment_configs")
      .select("*")
      .eq("status", "live")
      .eq("currency", currency)
      .eq("plan_type", planType)
      .single();

    if (configError || !priceConfig) {
      throw new Error(`No live payment configuration found for ${currency} ${planType}. Please configure payment settings first.`);
    }
    
    if (!priceConfig.stripe_price_id) {
      throw new Error(`Payment configuration for ${currency} ${planType} is missing Stripe Price ID.`);
    }
    
    logStep("Found live price config", { priceId: priceConfig.stripe_price_id, currency, billingPeriod });

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    // Log the key type to verify environment
    const isTestKey = stripeSecretKey.startsWith('sk_test_');
    const isLiveKey = stripeSecretKey.startsWith('sk_live_');
    logStep("Stripe key type", { isTestKey, isLiveKey, keyPrefix: stripeSecretKey.substring(0, 12) + '...' });

    const stripe = new Stripe(stripeSecretKey, { 
      apiVersion: "2023-10-16" 
    });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Use configured price ID from live payment config
    const priceId = priceConfig.stripe_price_id;
    logStep("Using configured live price ID", { priceId, billingPeriod, planType, currency });

    // Validate that the price ID exists (double-check)
    try {
      const priceData = await stripe.prices.retrieve(priceId);
      logStep("Price ID validated successfully", { priceId, amount: priceData.unit_amount });
    } catch (priceError) {
      logStep("ERROR: Price ID validation failed", { priceId, error: priceError.message });
      throw new Error(`Invalid price ID: ${priceId}. Error: ${priceError.message}`);
    }

    // Create checkout session for PRO plan using the validated price ID
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true, // Enable discount codes in checkout
      success_url: `${req.headers.get("origin")}/subscription-success`,
      cancel_url: `${req.headers.get("origin")}/pricing`,
      metadata: {
        user_id: user.id,
        plan: 'pro',
        billing_period: billingPeriod,
        plan_type: planType
      },
      locale: userCountry === 'BR' ? 'pt-BR' : 'en',
    });

    logStep("Checkout session created successfully", { 
      sessionId: session.id, 
      priceId, 
      checkoutUrl: session.url,
      mode: session.mode
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
