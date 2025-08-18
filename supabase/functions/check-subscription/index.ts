
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check current user role first - PRESERVE ADMIN ROLES
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileData?.role === 'admin') {
      logStep("User is admin - preserving admin role", { email: user.email });
      return new Response(JSON.stringify({ 
        subscribed: true, 
        role: 'admin',
        subscription_end: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for AbacatePay transactions/subscriptions FIRST
    logStep("Checking AbacatePay transactions");
    
    const { data: abacateTransaction, error: abacateError } = await supabaseClient
      .from("abacatepay_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1);

    if (abacateError) {
      logStep("Error fetching AbacatePay transactions", { error: abacateError });
    }

    let role = 'free';
    let subscriptionEnd = null;
    let subscriptionTier = null;
    let isSubscribed = false;

    if (abacateTransaction && abacateTransaction.length > 0) {
      const transaction = abacateTransaction[0];
      logStep("Found AbacatePay transaction", { 
        transactionId: transaction.transaction_id,
        planType: transaction.plan_type,
        paidAt: transaction.paid_at
      });

      if (transaction.plan_type === 'lifetime') {
        role = 'pro';
        subscriptionTier = 'lifetime';
        subscriptionEnd = null; // Lifetime não expira
        isSubscribed = true;
        logStep("Lifetime subscription found");
      } else {
        // Verificar se ainda está válido baseado na data de pagamento
        const paidAt = new Date(transaction.paid_at);
        const expiresAt = new Date(paidAt);
        
        if (transaction.plan_type === 'monthly') {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (transaction.plan_type === 'annual') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        const now = new Date();
        const isStillValid = expiresAt > now;
        
        logStep("Checking subscription validity", { 
          paidAt: paidAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString(),
          isStillValid
        });

        if (isStillValid) {
          role = 'pro';
          subscriptionTier = 'pro';
          subscriptionEnd = expiresAt.toISOString();
          isSubscribed = true;
          logStep("Valid subscription found", { expiresAt: subscriptionEnd });
        } else {
          logStep("AbacatePay subscription expired", { expiresAt: expiresAt.toISOString() });
        }
      }
    } else {
      logStep("No paid AbacatePay transactions found");
    }

    // Update user role in profiles table (only if not admin)
    await supabaseClient.from("profiles").upsert({
      id: user.id,
      email: user.email,
      role: role,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    logStep("Updated user role", { role, subscribed: isSubscribed, subscriptionTier });

    return new Response(JSON.stringify({
      subscribed: isSubscribed,
      role: role,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
