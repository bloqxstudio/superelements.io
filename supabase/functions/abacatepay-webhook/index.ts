import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ABACATEPAY-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role para operações webhook
  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook started");

    const webhookData = await req.json();
    logStep("Webhook data received", { 
      transactionId: webhookData.id,
      status: webhookData.status,
      type: webhookData.type 
    });

    // Verificar se é uma notificação de pagamento
    if (!webhookData.id || !webhookData.status) {
      throw new Error("Invalid webhook data: missing transaction ID or status");
    }

    // Buscar transação no banco de dados
    const { data: transaction, error: fetchError } = await supabaseService
      .from("abacatepay_transactions")
      .select("*")
      .eq("transaction_id", webhookData.id)
      .single();

    if (fetchError || !transaction) {
      logStep("Transaction not found", { transactionId: webhookData.id, error: fetchError });
      // Não é erro crítico, talvez seja de outra aplicação
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Transaction found", { 
      transactionId: transaction.transaction_id,
      currentStatus: transaction.status,
      newStatus: webhookData.status
    });

    // Mapear status do AbacatePay para nosso sistema
    let newStatus = transaction.status;
    let paidAt = null;

    switch (webhookData.status?.toLowerCase()) {
      case 'paid':
      case 'approved':
        newStatus = 'paid';
        paidAt = new Date().toISOString();
        break;
      case 'failed':
      case 'rejected':
        newStatus = 'failed';
        break;
      case 'cancelled':
      case 'canceled':
        newStatus = 'cancelled';
        break;
      case 'pending':
      case 'waiting':
        newStatus = 'pending';
        break;
      default:
        logStep("Unknown status received", { status: webhookData.status });
        newStatus = transaction.status; // manter status atual
    }

    // Atualizar transação no banco
    const updateData: any = {
      status: newStatus,
      abacatepay_data: { ...transaction.abacatepay_data, ...webhookData },
      updated_at: new Date().toISOString()
    };

    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    const { error: updateError } = await supabaseService
      .from("abacatepay_transactions")
      .update(updateData)
      .eq("transaction_id", webhookData.id);

    if (updateError) {
      logStep("Failed to update transaction", { error: updateError });
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    logStep("Transaction updated", { 
      transactionId: webhookData.id,
      newStatus,
      paidAt 
    });

    // Se pagamento foi aprovado, atualizar assinatura do usuário
    if (newStatus === 'paid') {
      logStep("Payment approved, updating user subscription");

      // Determinar subscription_tier baseado no plan_type
      let subscriptionTier = 'pro';
      let subscriptionEnd = null;

      if (transaction.plan_type === 'lifetime') {
        subscriptionTier = 'lifetime';
        // Lifetime não tem data de expiração
      } else {
        // Para planos mensais e anuais, calcular data de expiração
        const now = new Date();
        if (transaction.plan_type === 'monthly') {
          now.setMonth(now.getMonth() + 1);
        } else if (transaction.plan_type === 'annual') {
          now.setFullYear(now.getFullYear() + 1);
        }
        subscriptionEnd = now.toISOString();
      }

      // Atualizar ou inserir na tabela subscribers
      const { error: subscriberError } = await supabaseService
        .from("subscribers")
        .upsert({
          user_id: transaction.user_id,
          email: webhookData.customer?.email || 'unknown@email.com',
          subscribed: true,
          subscription_tier: subscriptionTier,
          subscription_end: subscriptionEnd,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: 'user_id'
        });

      if (subscriberError) {
        logStep("Failed to update subscriber", { error: subscriberError });
        // Não falhar o webhook por isso, mas logar o erro
      } else {
        logStep("Subscriber updated", { 
          userId: transaction.user_id,
          subscriptionTier,
          subscriptionEnd 
        });
      }

      // Atualizar role na tabela profiles
      const { error: profileError } = await supabaseService
        .from("profiles")
        .update({ 
          role: 'pro',
          updated_at: new Date().toISOString()
        })
        .eq("id", transaction.user_id);

      if (profileError) {
        logStep("Failed to update profile role", { error: profileError });
      } else {
        logStep("Profile role updated to pro", { userId: transaction.user_id });
      }
    }

    // Responder confirmação para o AbacatePay
    return new Response(JSON.stringify({ 
      received: true,
      transaction_id: webhookData.id,
      status: newStatus
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in abacatepay-webhook", { message: errorMessage });
    
    // Para webhooks, sempre retornar 200 para evitar reenvios desnecessários
    return new Response(JSON.stringify({ 
      error: errorMessage,
      received: true 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});