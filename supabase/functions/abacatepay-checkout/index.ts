
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [ABACATEPAY-CHECKOUT] ${step}${detailsStr}`);
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
    logStep("🚀 Function started - Direct checkout flow");

    // Verificar se o token do AbacatePay está configurado
    const abacatePayToken = Deno.env.get("ABACATEPAY_API_TOKEN");
    if (!abacatePayToken) {
      logStep("❌ ERROR: ABACATEPAY_API_TOKEN not configured");
      return new Response(JSON.stringify({ 
        success: false,
        error: "ABACATEPAY_API_TOKEN not configured in Supabase secrets" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    logStep("✅ AbacatePay token verified");

    const authHeader = req.headers.get("Authorization")!;
    if (!authHeader) {
      logStep("❌ ERROR: No authorization header");
      return new Response(JSON.stringify({ 
        success: false,
        error: "Authorization header required" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      logStep("❌ ERROR: User not authenticated");
      return new Response(JSON.stringify({ 
        success: false,
        error: "User not authenticated or email not available" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("👤 User authenticated", { userId: user.id, email: user.email });

    const requestBody = await req.json();
    const { planType, paymentMethod = 'PIX', customerData } = requestBody;
    
    logStep("📋 Request data received", { 
      planType, 
      paymentMethod, 
      hasCustomerData: !!customerData,
      customerName: customerData?.name || 'N/A'
    });

    if (!planType || !['monthly', 'annual', 'lifetime'].includes(planType)) {
      logStep("❌ ERROR: Invalid plan type", { planType });
      return new Response(JSON.stringify({ 
        success: false,
        error: "Invalid plan type specified" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!customerData || !customerData.name || !customerData.taxId) {
      logStep("❌ ERROR: Missing customer data");
      return new Response(JSON.stringify({ 
        success: false,
        error: "Customer data (name and CPF/CNPJ) is required" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get pricing configuration from database for AbacatePay
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logStep("💰 Fetching price configuration", { planType, currency: "BRL", provider: "abacatepay" });

    const { data: priceConfig, error: configError } = await supabaseService
      .from("admin_payment_configs")
      .select("*")
      .eq("status", "live")
      .eq("currency", "BRL")
      .eq("plan_type", planType)
      .eq("payment_provider", "abacatepay")
      .single();

    if (configError || !priceConfig) {
      logStep("❌ ERROR: Price configuration not found", { error: configError, planType });
      return new Response(JSON.stringify({ 
        success: false,
        error: `No live AbacatePay configuration found for BRL ${planType}. Please configure payment settings first.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    logStep("✅ Found live price config", { 
      priceId: priceConfig.abacatepay_product_id, 
      currency: "BRL", 
      planType,
      paymentMethod,
      priceCents: priceConfig.price_cents
    });

    const amountInCents = priceConfig.price_cents;
    
    const planNames = {
      monthly: "Pro Mensal",
      annual: "Pro Anual", 
      lifetime: "Pro Lifetime"
    };

    let abacateResult;
    let abacatePayUrl;
    let abacatePayData;

    const originUrl = req.headers.get("origin") || "https://app.superelements.io";

    if (paymentMethod === 'PIX') {
      // Usar API de PIX QR Code para pagamentos PIX
      abacatePayUrl = "https://api.abacatepay.com/v1/pixQrCode/create";
      abacatePayData = {
        amount: amountInCents,
        expiresIn: 3600, // 1 hora para expirar
        description: `${planNames[planType]} - SuperElements PRO`,
        customer: {
          name: customerData.name,
          cellphone: customerData.cellphone || "",
          email: user.email,
          taxId: customerData.taxId
        }
      };

      logStep("🔄 Creating AbacatePay PIX QR Code", { 
        url: abacatePayUrl,
        amount: amountInCents,
        description: abacatePayData.description
      });

    } else {
      // Usar API de billing para cartão de crédito - CHECKOUT EXTERNO
      abacatePayUrl = "https://api.abacatepay.com/v1/billing/create";
      abacatePayData = {
        frequency: "ONE_TIME",
        methods: [paymentMethod.toUpperCase()],
        products: [
          {
            externalId: `${planType}-${Date.now()}`,
            name: planNames[planType],
            description: `${planNames[planType]} - SuperElements PRO`,
            quantity: 1,
            price: amountInCents
          }
        ],
        returnUrl: `${originUrl}/payment-success`,
        completionUrl: `${originUrl}/payment-success`,
        customer: {
          name: customerData.name,
          cellphone: customerData.cellphone || "",
          email: user.email,
          taxId: customerData.taxId
        },
        allowCoupons: true
      };

      logStep("🔄 Creating AbacatePay external checkout", { 
        url: abacatePayUrl,
        returnUrl: abacatePayData.returnUrl,
        completionUrl: abacatePayData.completionUrl,
        amount: amountInCents
      });
    }

    const abacateResponse = await fetch(abacatePayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${abacatePayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(abacatePayData),
    });

    logStep("📡 AbacatePay API response received", { 
      status: abacateResponse.status,
      statusText: abacateResponse.statusText,
      paymentMethod
    });

    if (!abacateResponse.ok) {
      const errorText = await abacateResponse.text();
      logStep("❌ AbacatePay API error", { 
        status: abacateResponse.status, 
        statusText: abacateResponse.statusText,
        error: errorText 
      });
      return new Response(JSON.stringify({ 
        success: false,
        error: `AbacatePay API error: ${abacateResponse.status} - ${errorText}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    abacateResult = await abacateResponse.json();
    logStep("✅ AbacatePay response processed", { 
      responseId: abacateResult.id,
      status: abacateResult.status || 'pending',
      hasCheckoutUrl: !!abacateResult.checkoutUrl,
      hasPixCode: !!abacateResult.qrCode,
      hasQrCodeImage: !!abacateResult.qrCodeImage,
      qrCodeImageUrl: abacateResult.qrCodeImage,
      pixCode: abacateResult.qrCode,
      checkoutUrl: abacateResult.checkoutUrl
    });

    // Salvar transação no banco
    const { data: transaction, error: insertError } = await supabaseService
      .from("abacatepay_transactions")
      .insert({
        user_id: user.id,
        transaction_id: abacateResult.id,
        payment_method: paymentMethod,
        amount_cents: amountInCents,
        currency: "BRL",
        status: "pending",
        plan_type: planType,
        abacatepay_data: abacateResult,
        pix_code: paymentMethod === 'PIX' ? abacateResult.qrCode : null,
        qr_code_url: paymentMethod === 'PIX' ? abacateResult.qrCodeImage : null,
        checkout_url: paymentMethod !== 'PIX' ? abacateResult.checkoutUrl : null,
        expires_at: paymentMethod === 'PIX' && abacateResult.expiresAt ? new Date(abacateResult.expiresAt) : null,
      })
      .select()
      .single();

    if (insertError) {
      logStep("❌ Database insert error", { error: insertError });
      return new Response(JSON.stringify({ 
        success: false,
        error: `Failed to save transaction: ${insertError.message}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    logStep("💾 Transaction saved to database", { 
      transactionId: transaction.id,
      billingId: abacateResult.id
    });

    // Retornar dados da transação baseado no método de pagamento
    const responseData: any = {
      success: true,
      billing_id: abacateResult.id,
      payment_method: paymentMethod,
      amount: parseFloat((amountInCents / 100).toFixed(2)),
      status: "pending"
    };

    if (paymentMethod === 'PIX' && abacateResult.qrCode) {
      responseData.pix_code = abacateResult.qrCode;
      responseData.pix_qr_code = abacateResult.qrCodeImage;
      responseData.expires_at = abacateResult.expiresAt;
      logStep("✅ PIX payment data prepared for modal display", {
        hasPixCode: !!abacateResult.qrCode,
        hasQrImage: !!abacateResult.qrCodeImage,
        pixCodeLength: abacateResult.qrCode?.length || 0,
        qrImageUrl: abacateResult.qrCodeImage
      });
    } else if (abacateResult.checkoutUrl) {
      responseData.payment_url = abacateResult.checkoutUrl;
      logStep("🔗 External checkout URL ready", { 
        url: abacateResult.checkoutUrl,
        urlLength: abacateResult.checkoutUrl?.length || 0,
        isValidUrl: abacateResult.checkoutUrl?.startsWith('http')
      });
    }

    logStep("🎉 Success response prepared", { 
      billing_id: responseData.billing_id,
      payment_method: responseData.payment_method,
      hasPaymentUrl: !!responseData.payment_url,
      hasPixCode: !!responseData.pix_code
    });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("💥 CRITICAL ERROR in abacatepay-checkout", { 
      message: errorMessage, 
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
