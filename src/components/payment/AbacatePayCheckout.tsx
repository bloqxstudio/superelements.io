
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, CreditCard, Loader2, Copy, Check, User, AlertCircle, ExternalLink } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";

interface AbacatePayCheckoutProps {
  planType: string;
  onSuccess?: () => void;
}

interface CustomerData {
  name: string;
  taxId: string;
  cellphone?: string;
}

export const AbacatePayCheckout = ({ 
  planType, 
  onSuccess
}: AbacatePayCheckoutProps) => {
  const { user, session } = useAuthStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [selectedMethod, setSelectedMethod] = useState<"PIX" | "CREDIT_CARD" | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: "",
    taxId: "",
    cellphone: ""
  });

  // Check if user is authenticated
  if (!user || !session) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-semibold">Login Necessário</h3>
          <p className="text-muted-foreground">
            Você precisa estar logado para fazer uma compra.
          </p>
          <Button onClick={() => navigate("/login")} className="w-full">
            Fazer Login
          </Button>
        </div>
      </Card>
    );
  }

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const validateCustomerData = () => {
    if (!customerData.name.trim()) {
      toast.error("Nome é obrigatório");
      return false;
    }
    
    const taxIdNumbers = customerData.taxId.replace(/\D/g, '');
    if (taxIdNumbers.length !== 11 && taxIdNumbers.length !== 14) {
      toast.error("CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos");
      return false;
    }
    
    return true;
  };

  // Função removida - agora sempre mostra seleção de método

  const handlePaymentMethodSelect = (paymentMethod: "PIX" | "CREDIT_CARD") => {
    setSelectedMethod(paymentMethod);
    setShowCustomerForm(true);
  };

  const processPayment = async (paymentMethod: "PIX" | "CREDIT_CARD" = selectedMethod!) => {
    // Verify session is still valid
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      navigate("/login");
      return;
    }

    setIsLoading(true);

    try {
      console.log("Iniciando pagamento com AbacatePay...", {
        planType,
        paymentMethod,
        hasToken: !!session.access_token
      });

      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: {
          planType,
          paymentMethod,
          customerData: {
            name: customerData.name,
            taxId: customerData.taxId.replace(/\D/g, ''),
            cellphone: customerData.cellphone
          }
        }
      });

      console.log("Resposta da edge function:", { data, error });
      
      if (data) {
        console.log("Dados recebidos do pagamento:", {
          paymentMethod,
          hasPixCode: !!data.pix_code,
          hasPixQrCode: !!data.pix_qr_code,
          hasPaymentUrl: !!data.payment_url,
          pixCodeLength: data.pix_code?.length || 0,
          paymentUrl: data.payment_url,
          fullData: data
        });
      }

      if (error) {
        console.error("Erro na edge function:", error);
        
        if (error.message?.includes("Session not found") || error.message?.includes("not authenticated")) {
          toast.error("Sessão expirada. Redirecionando para login...");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }
        
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Erro ao processar pagamento");
      }

      setPaymentData(data);

      if (paymentMethod === "PIX") {
        startPolling(data.billing_id);
      } else {
        // Para cartão, abre em nova aba
        if (data.payment_url) {
          console.log("Tentando abrir checkout:", {
            url: data.payment_url,
            isValidUrl: data.payment_url.startsWith('http'),
            urlLength: data.payment_url.length
          });
          
          // Validar URL antes de tentar abrir
          if (!data.payment_url.startsWith('http')) {
            toast.error("URL de pagamento inválida");
            return;
          }
          
          // Tentar abrir em nova aba com verificação melhorada
          try {
            const newWindow = window.open(data.payment_url, "_blank", "noopener,noreferrer");
            
            // Verificar se a janela foi aberta
            setTimeout(() => {
              if (!newWindow || newWindow.closed) {
                // Se pop-up foi bloqueado, mostrar modal com link
                setPaymentData({
                  ...data,
                  blocked_popup: true,
                  payment_url: data.payment_url
                });
                toast.error("Pop-up foi bloqueado. Use o link abaixo para continuar.");
                return;
              }
              
              toast.success("Checkout aberto em nova aba!");
              
              // Limpa o formulário e fecha modal se necessário
              if (onSuccess) {
                setTimeout(() => {
                  onSuccess();
                }, 1000);
              }
            }, 500);
            
          } catch (error) {
            console.error("Erro ao abrir checkout:", error);
            toast.error("Erro ao abrir checkout. Tente novamente.");
          }
        } else {
          toast.error("URL de checkout não encontrada");
        }
      }

    } catch (error: any) {
      console.error("Payment error:", error);
      
      let errorMessage = "Erro ao processar pagamento";
      
      if (error.message?.includes("Session not found")) {
        errorMessage = "Sessão expirada. Faça login novamente.";
        setTimeout(() => navigate("/login"), 2000);
      } else if (error.message?.includes("not authenticated")) {
        errorMessage = "Falha na autenticação. Faça login novamente.";
        setTimeout(() => navigate("/login"), 2000);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = () => processPayment();

  const startPolling = (billingId: string) => {
    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("check-abacatepay-payment", {
          body: { billingId }
        });

        if (data.success && data.status === "approved") {
          clearInterval(interval);
          setIsPolling(false);
          toast.success("Pagamento aprovado! Redirecionando...");
          setTimeout(() => {
            onSuccess?.();
            window.location.href = "/payment-success";
          }, 2000);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(interval);
      setIsPolling(false);
    }, 600000);
  };

  const copyPixCode = async () => {
    if (paymentData?.pix_code) {
      await navigator.clipboard.writeText(paymentData.pix_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setPaymentData(null);
    setSelectedMethod(null);
    setShowCustomerForm(false);
    setCustomerData({ name: "", taxId: "", cellphone: "" });
  };

  // Fallback para checkout bloqueado
  if (paymentData && paymentData.blocked_popup && selectedMethod === "CREDIT_CARD") {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <ExternalLink className="h-6 w-6 text-amber-500" />
              <h3 className="text-lg font-semibold">Checkout Bloqueado</h3>
            </div>
            
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                O navegador bloqueou a abertura automática do checkout.
              </p>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para abrir o checkout manualmente:
              </p>
              
              <Button
                onClick={() => window.open(paymentData.payment_url, "_blank", "noopener,noreferrer")}
                className="w-full h-12 font-medium"
                size="lg"
              >
                <ExternalLink className="h-5 w-5 mr-2" />
                Abrir Checkout do Cartão
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Será aberto em uma nova aba segura
              </p>
            </div>
          </div>
        </Card>

        <Button
          variant="outline"
          onClick={resetForm}
          className="w-full"
        >
          Escolher outro método de pagamento
        </Button>
      </div>
    );
  }

  // Sempre começa com seleção de método de pagamento

  if (paymentData && selectedMethod === "PIX") {
    console.log("Renderizando tela PIX:", {
      hasPixQrCode: !!paymentData.pix_qr_code,
      hasPixCode: !!paymentData.pix_code,
      pixQrCodeUrl: paymentData.pix_qr_code,
      pixCodeLength: paymentData.pix_code?.length || 0,
      fullPaymentData: paymentData
    });
    
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <QrCode className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold">Pagamento PIX</h3>
            </div>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Valor: <span className="font-bold">R$ {paymentData.amount?.toFixed(2) || '0,00'}</span>
              </p>
            </div>
            
            {paymentData.pix_qr_code ? (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <img 
                    src={paymentData.pix_qr_code} 
                    alt="QR Code PIX" 
                    className="w-64 h-64"
                    onError={(e) => {
                      console.error("Erro ao carregar QR Code:", paymentData.pix_qr_code);
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = 
                        '<div class="w-64 h-64 border-2 border-dashed border-red-300 rounded-lg flex items-center justify-center"><p class="text-red-500 text-sm">Erro ao carregar QR Code</p></div>';
                    }}
                    onLoad={() => {
                      console.log("QR Code carregado com sucesso:", paymentData.pix_qr_code);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-64 h-64 border-2 border-dashed border-muted-foreground/50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">QR Code não disponível</p>
                    <p className="text-xs text-muted-foreground mt-1">Use o código PIX abaixo</p>
                  </div>
                </div>
              </div>
            )}

            {paymentData.pix_code ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Código PIX - Copie e cole no seu banco:
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                  <code className="flex-1 text-xs break-all font-mono bg-transparent">
                    {paymentData.pix_code}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyPixCode}
                    className="flex-shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O pagamento é confirmado automaticamente em alguns segundos
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="h-5 w-5 text-red-500 mx-auto" />
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  Código PIX não disponível
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Entre em contato com o suporte
                </p>
              </div>
            )}

            {isPolling && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>Aguardando confirmação do pagamento...</span>
              </div>
            )}
          </div>
        </Card>

        <Button
          variant="outline"
          onClick={resetForm}
          className="w-full"
        >
          Escolher outro método de pagamento
        </Button>
      </div>
    );
  }

  if (showCustomerForm) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Dados para pagamento</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="taxId">CPF ou CNPJ *</Label>
                <Input
                  id="taxId"
                  type="text"
                  placeholder="000.000.000-00"
                  value={customerData.taxId}
                  onChange={(e) => setCustomerData(prev => ({ 
                    ...prev, 
                    taxId: formatCPF(e.target.value) 
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="cellphone">Telefone (opcional)</Label>
                <Input
                  id="cellphone"
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={customerData.cellphone}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, cellphone: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCustomerForm(false)}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handlePayment}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    {selectedMethod === 'CREDIT_CARD' && <ExternalLink className="h-4 w-4 mr-2" />}
                    {selectedMethod === 'PIX' ? 'Gerar PIX' : 'Abrir Checkout'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-center">
        Escolha a forma de pagamento
      </h3>

      <div className="grid gap-3">
        <Button
          onClick={() => handlePaymentMethodSelect("PIX")}
          disabled={isLoading}
          className="h-16 flex items-center gap-3"
          variant="outline"
        >
          <QrCode className="h-5 w-5" />
          Pagar com PIX
          <span className="text-sm text-muted-foreground ml-auto">
            Instantâneo
          </span>
        </Button>

        <Button
          onClick={() => handlePaymentMethodSelect("CREDIT_CARD")}
          disabled={isLoading}
          className="h-16 flex items-center gap-3"
          variant="outline"
        >
          <CreditCard className="h-5 w-5" />
          Pagar com Cartão
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              Nova aba
            </span>
            <ExternalLink className="h-4 w-4" />
          </div>
        </Button>
      </div>
    </div>
  );
};
