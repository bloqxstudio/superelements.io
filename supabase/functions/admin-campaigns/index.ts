import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-CAMPAIGNS] ${step}${detailsStr}`);
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
        const { data: campaigns, error } = await supabaseClient
          .from("admin_campaigns")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ campaigns }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'post':
      case 'create': {
        const body = await req.json();
        const { 
          name, 
          description, 
          coupon_code, 
          discount_percentage, 
          start_date, 
          end_date, 
          usage_limit, 
          target_audience,
          status 
        } = body;

        // Create Stripe coupon if status is active
        let stripeCouponId = null;
        if (status === 'active' && coupon_code) {
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
            apiVersion: "2023-10-16",
          });

          const coupon = await stripe.coupons.create({
            id: coupon_code.toUpperCase(),
            percent_off: discount_percentage,
            max_redemptions: usage_limit || undefined,
            redeem_by: Math.floor(new Date(end_date).getTime() / 1000),
            name: name,
            metadata: {
              campaign_name: name,
              target_audience: JSON.stringify(target_audience || {}),
            },
          });

          stripeCouponId = coupon.id;
          logStep("Created Stripe coupon", { couponId: stripeCouponId });
        }

        const { data: campaign, error } = await supabaseClient
          .from("admin_campaigns")
          .insert({
            name,
            description,
            coupon_code: coupon_code?.toUpperCase(),
            discount_percentage,
            start_date,
            end_date,
            usage_limit,
            target_audience: target_audience || {},
            status: status || 'draft',
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        logStep("Campaign created", { campaignId: campaign.id });

        return new Response(JSON.stringify({ campaign }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
        });
      }

      case 'put':
      case 'update': {
        const body = await req.json();
        const { id, ...updates } = body;

        const { data: campaign, error } = await supabaseClient
          .from("admin_campaigns")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        logStep("Campaign updated", { campaignId: id });

        return new Response(JSON.stringify({ campaign }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'validate-coupon': {
        const body = await req.json();
        const { coupon_code } = body;

        const { data: campaign, error } = await supabaseClient
          .from("admin_campaigns")
          .select("*")
          .eq("coupon_code", coupon_code.toUpperCase())
          .eq("status", "active")
          .single();

        if (error || !campaign) {
          return new Response(JSON.stringify({ valid: false, error: "Invalid coupon code" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const now = new Date();
        const startDate = new Date(campaign.start_date);
        const endDate = new Date(campaign.end_date);

        if (now < startDate || now > endDate) {
          return new Response(JSON.stringify({ valid: false, error: "Coupon expired or not yet active" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        if (campaign.usage_limit && campaign.current_usage >= campaign.usage_limit) {
          return new Response(JSON.stringify({ valid: false, error: "Coupon usage limit reached" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        return new Response(JSON.stringify({ 
          valid: true, 
          campaign: {
            id: campaign.id,
            name: campaign.name,
            discount_percentage: campaign.discount_percentage,
            coupon_code: campaign.coupon_code,
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'use-coupon': {
        const body = await req.json();
        const { coupon_code } = body;

        // Increment usage count
        const { data: campaign, error } = await supabaseClient
          .from("admin_campaigns")
          .update({ current_usage: supabaseClient.raw('current_usage + 1') })
          .eq("coupon_code", coupon_code.toUpperCase())
          .select()
          .single();

        if (error) throw error;

        logStep("Coupon used", { campaignId: campaign.id, usage: campaign.current_usage });

        return new Response(JSON.stringify({ success: true, campaign }), {
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