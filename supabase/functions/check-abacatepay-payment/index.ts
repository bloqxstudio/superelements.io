
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-ABACATEPAY-PAYMENT] ${step}${detailsStr}`);
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
    if (!authHeader) {
      logStep("ERROR: No authorization header");
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
      logStep("ERROR: User not authenticated");
      return new Response(JSON.stringify({ 
        success: false,
        error: "User not authenticated or email not available" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    const requestBody = await req.json();
    const { billingId } = requestBody;
    
    if (!billingId) {
      logStep("ERROR: Billing ID required");
      return new Response(JSON.stringify({ 
        success: false,
        error: "Billing ID is required" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Checking payment status for billing ID", { billingId });

    // Buscar transação no banco de dados
    const { data: transaction, error: fetchError } = await supabaseClient
      .from("abacatepay_transactions")
      .select("*")
      .eq("transaction_id", billingId)
      .eq("user_id", user.id) // Garantir que o usuário só pode ver suas próprias transações
      .single();

    if (fetchError || !transaction) {
      logStep("Transaction not found", { transactionId: billingId, error: fetchError });
      return new Response(JSON.stringify({ 
        success: false,
        error: "Transaction not found" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    logStep("Transaction found", { 
      transactionId: transaction.transaction_id,
      status: transaction.status,
      paymentMethod: transaction.payment_method
    });

    // Se a transação ainda está pendente, verificar status na API do AbacatePay
    if (transaction.status === 'pending') {
      const abacatePayToken = Deno.env.get("ABACATEPAY_API_TOKEN");
      if (abacatePayToken) {
        try {
          logStep("Checking status with AbacatePay API");
          
          const statusResponse = await fetch(`https://api.abacatepay.com/v1/billing/${billingId}`, {
            headers: {
              'Authorization': `Bearer ${abacatePayToken}`,
              'Content-Type': 'application/json',
            },
          });

          logStep("AbacatePay API status response", { status: statusResponse.status });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            logStep("AbacatePay status check", { 
              transactionId: billingId,
              apiStatus: statusData.status 
            });

            // Se o status mudou na API, atualizar no banco
            if (statusData.status && statusData.status !== transaction.status) {
              let newStatus = transaction.status;
              let paidAt = null;

              switch (statusData.status.toLowerCase()) {
                case 'paid':
                case 'approved':
                case 'complete':
                  newStatus = 'paid';
                  paidAt = new Date().toISOString();
                  break;
                case 'failed':
                case 'rejected':
                case 'cancelled':
                case 'expired':
                  newStatus = 'failed';
                  break;
                default:
                  newStatus = 'pending';
                  break;
              }

              if (newStatus !== transaction.status) {
                const supabaseService = createClient(
                  Deno.env.get("SUPABASE_URL") ?? "",
                  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
                  { auth: { persistSession: false } }
                );

                const updateData: any = {
                  status: newStatus,
                  abacatepay_data: { ...transaction.abacatepay_data, ...statusData },
                  updated_at: new Date().toISOString()
                };

                if (paidAt) {
                  updateData.paid_at = paidAt;
                }

                await supabaseService
                  .from("abacatepay_transactions")
                  .update(updateData)
                  .eq("transaction_id", billingId);

                logStep("Transaction status updated", { 
                  transactionId: billingId,
                  oldStatus: transaction.status,
                  newStatus 
                });

                // Retornar dados atualizados
                return new Response(JSON.stringify({
                  success: true,
                  transaction_id: transaction.transaction_id,
                  status: newStatus,
                  payment_method: transaction.payment_method,
                  amount_cents: transaction.amount_cents,
                  pix_code: transaction.pix_code,
                  qr_code_url: transaction.qr_code_url,
                  checkout_url: transaction.checkout_url,
                  expires_at: transaction.expires_at,
                  paid_at: paidAt || transaction.paid_at,
                  created_at: transaction.created_at,
                  updated_at: updateData.updated_at
                }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                  status: 200,
                });
              }
            }
          } else {
            const errorText = await statusResponse.text();
            logStep("AbacatePay API error during status check", { 
              status: statusResponse.status,
              error: errorText 
            });
          }
        } catch (apiError) {
          logStep("AbacatePay API error", { error: apiError.message });
          // Continuar com dados do banco mesmo se a API falhar
        }
      } else {
        logStep("ABACATEPAY_API_TOKEN not configured for status check");
      }
    }

    // Retornar dados da transação do banco
    return new Response(JSON.stringify({
      success: true,
      transaction_id: transaction.transaction_id,
      status: transaction.status,
      payment_method: transaction.payment_method,
      amount_cents: transaction.amount_cents,
      pix_code: transaction.pix_code,
      qr_code_url: transaction.qr_code_url,
      checkout_url: transaction.checkout_url,
      expires_at: transaction.expires_at,
      paid_at: transaction.paid_at,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-abacatepay-payment", { message: errorMessage, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
