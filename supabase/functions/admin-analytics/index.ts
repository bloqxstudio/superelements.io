import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-ANALYTICS] ${step}${detailsStr}`);
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

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'dashboard';

    switch (action) {
      case 'dashboard': {
        // Get overview statistics
        const [
          usersData,
          subscribersData,
          revenueData,
          campaignsData,
          configsData
        ] = await Promise.all([
          // Total users from profiles table
          supabaseClient
            .from("profiles")
            .select("role"),
          
          // Active subscribers by tier
          supabaseClient
            .from("subscribers")
            .select("subscription_tier, subscribed")
            .eq("subscribed", true),
          
          // Recent analytics events for revenue
          supabaseClient
            .from("admin_analytics_events")
            .select("amount_cents, currency, timestamp")
            .eq("event_type", "payment_success")
            .gte("timestamp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
          
          // Active campaigns
          supabaseClient
            .from("admin_campaigns")
            .select("id, name, current_usage, usage_limit, status")
            .eq("status", "active"),
          
          // Payment configurations
          supabaseClient
            .from("admin_payment_configs")
            .select("currency, plan_type, price_cents, status")
            .eq("status", "live")
        ]);

        const dashboard = {
          users: {
            total: usersData.data?.length || 0,
            byRole: usersData.data?.reduce((acc: any, user: any) => {
              acc[user.role || 'free'] = (acc[user.role || 'free'] || 0) + 1;
              return acc;
            }, {}) || {}
          },
          subscribers: {
            total: subscribersData.data?.length || 0,
            byTier: subscribersData.data?.reduce((acc: any, sub: any) => {
              acc[sub.subscription_tier || 'free'] = (acc[sub.subscription_tier || 'free'] || 0) + 1;
              return acc;
            }, {}) || {}
          },
          revenue: {
            total30Days: revenueData.data?.reduce((sum: number, event: any) => 
              sum + (event.amount_cents || 0), 0) || 0,
            byCurrency: revenueData.data?.reduce((acc: any, event: any) => {
              const currency = event.currency || 'USD';
              acc[currency] = (acc[currency] || 0) + (event.amount_cents || 0);
              return acc;
            }, {}) || {}
          },
          campaigns: {
            active: campaignsData.data?.length || 0,
            usage: campaignsData.data?.reduce((acc: any, campaign: any) => {
              acc.used += campaign.current_usage || 0;
              acc.total += campaign.usage_limit || 0;
              return acc;
            }, { used: 0, total: 0 }) || { used: 0, total: 0 }
          },
          configs: {
            live: configsData.data?.length || 0,
            byPlan: configsData.data?.reduce((acc: any, config: any) => {
              const key = `${config.currency}_${config.plan_type}`;
              acc[key] = config.price_cents;
              return acc;
            }, {}) || {}
          }
        };

        return new Response(JSON.stringify({ dashboard }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'revenue': {
        const days = parseInt(url.searchParams.get('days') || '30');
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data: events, error } = await supabaseClient
          .from("admin_analytics_events")
          .select("amount_cents, currency, timestamp, metadata")
          .eq("event_type", "payment_success")
          .gte("timestamp", startDate)
          .order("timestamp", { ascending: true });

        if (error) throw error;

        // Group by day and currency
        const dailyRevenue = events?.reduce((acc: any, event: any) => {
          const date = new Date(event.timestamp).toISOString().split('T')[0];
          const currency = event.currency || 'USD';
          
          if (!acc[date]) acc[date] = {};
          if (!acc[date][currency]) acc[date][currency] = 0;
          
          acc[date][currency] += event.amount_cents || 0;
          return acc;
        }, {}) || {};

        return new Response(JSON.stringify({ dailyRevenue, events }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'conversions': {
        const days = parseInt(url.searchParams.get('days') || '30');
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const [checkoutEvents, successEvents] = await Promise.all([
          supabaseClient
            .from("admin_analytics_events")
            .select("timestamp, metadata")
            .eq("event_type", "checkout_started")
            .gte("timestamp", startDate),
          
          supabaseClient
            .from("admin_analytics_events")
            .select("timestamp, metadata")
            .eq("event_type", "payment_success")
            .gte("timestamp", startDate)
        ]);

        const conversions = {
          checkouts: checkoutEvents.data?.length || 0,
          successes: successEvents.data?.length || 0,
          rate: checkoutEvents.data?.length ? 
            (successEvents.data?.length || 0) / checkoutEvents.data.length * 100 : 0
        };

        return new Response(JSON.stringify({ conversions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'track': {
        const body = await req.json();
        const { event_type, amount_cents, currency, metadata } = body;

        const { data: event, error } = await supabaseClient
          .from("admin_analytics_events")
          .insert({
            event_type,
            user_id: user.id,
            amount_cents,
            currency,
            metadata: metadata || {},
            ip_address: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for'),
            user_agent: req.headers.get('user-agent'),
          })
          .select()
          .single();

        if (error) throw error;

        logStep("Event tracked", { eventId: event.id, event_type });

        return new Response(JSON.stringify({ event }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
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