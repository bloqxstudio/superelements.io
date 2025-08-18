import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE-COUPONS] ${step}${detailsStr}`);
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

    // Authenticate user and check admin role
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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get active campaigns that need to be synced
    const { data: campaigns, error: campaignsError } = await supabaseClient
      .from("admin_campaigns")
      .select("*")
      .eq("status", "active")
      .not("coupon_code", "is", null);

    if (campaignsError) throw campaignsError;

    logStep("Found active campaigns", { count: campaigns?.length || 0 });

    const syncResults = [];

    for (const campaign of campaigns || []) {
      try {
        logStep("Processing campaign", { id: campaign.id, coupon_code: campaign.coupon_code });

        // Check if coupon already exists in Stripe
        let existingCoupon;
        try {
          existingCoupon = await stripe.coupons.retrieve(campaign.coupon_code.toUpperCase());
          logStep("Coupon already exists", { couponId: existingCoupon.id });
        } catch (error) {
          // Coupon doesn't exist, we'll create it
          logStep("Coupon doesn't exist, will create", { coupon_code: campaign.coupon_code });
        }

        if (!existingCoupon) {
          // Create new coupon in Stripe
          const coupon = await stripe.coupons.create({
            id: campaign.coupon_code.toUpperCase(),
            percent_off: campaign.discount_percentage,
            max_redemptions: campaign.usage_limit || undefined,
            redeem_by: Math.floor(new Date(campaign.end_date).getTime() / 1000),
            name: campaign.name,
            metadata: {
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              target_audience: JSON.stringify(campaign.target_audience || {}),
            },
          });

          logStep("Created Stripe coupon", { 
            couponId: coupon.id, 
            campaignId: campaign.id 
          });

          syncResults.push({
            campaign_id: campaign.id,
            coupon_code: campaign.coupon_code,
            status: 'created',
            stripe_coupon_id: coupon.id
          });
        } else {
          syncResults.push({
            campaign_id: campaign.id,
            coupon_code: campaign.coupon_code,
            status: 'exists',
            stripe_coupon_id: existingCoupon.id
          });
        }
      } catch (error) {
        logStep("Error processing campaign", { 
          campaignId: campaign.id, 
          error: error.message 
        });
        
        syncResults.push({
          campaign_id: campaign.id,
          coupon_code: campaign.coupon_code,
          status: 'error',
          error: error.message
        });
      }
    }

    logStep("Sync completed", { results: syncResults });

    return new Response(JSON.stringify({ 
      success: true, 
      synced: syncResults.length,
      results: syncResults
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-stripe-coupons", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});