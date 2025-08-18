
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, ArrowRight, Home, AlertCircle } from 'lucide-react';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkSubscription } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [subscriptionUpdated, setSubscriptionUpdated] = useState(false);

  useEffect(() => {
    const verifyPayment = async () => {
      setIsChecking(true);
      
      // Aguarda um pouco para dar tempo do webhook processar
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        // Verifica o status da assinatura
        await checkSubscription();
        setSubscriptionUpdated(true);
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsChecking(false);
      }
    };

    verifyPayment();
  }, [checkSubscription]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Verificando pagamento...
            </h1>
            
            <p className="text-gray-600 mb-6">
              Aguarde enquanto confirmamos seu pagamento. Isso pode levar alguns instantes.
            </p>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ⏳ Processando via AbacatePay...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
      <Card className="max-w-md mx-auto shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            {subscriptionUpdated ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-amber-600" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {subscriptionUpdated ? 'Pagamento Confirmado! 🎉' : 'Processando Pagamento'}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {subscriptionUpdated 
              ? 'Seu pagamento foi processado com sucesso via AbacatePay. Você agora tem acesso completo ao SuperElements PRO!'
              : 'Seu pagamento está sendo processado. Pode levar alguns minutos para que seu acesso seja ativado completamente.'
            }
          </p>
          
          {subscriptionUpdated && (
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-800">
                <CheckCircle className="w-4 h-4" />
                Acesso PRO ativado com sucesso
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/')}
              className="w-full bg-[#D2F525] hover:bg-[#B8CC02] text-black font-medium"
              size="lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Explorar Componentes Premium
            </Button>
            
            <Button 
              onClick={() => navigate('/pricing')}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Ver Detalhes do Plano
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          {!subscriptionUpdated && (
            <p className="text-xs text-gray-500 mt-4">
              Se o problema persistir, entre em contato com nosso suporte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
