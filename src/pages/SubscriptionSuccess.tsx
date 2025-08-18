
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Zap, ArrowRight } from 'lucide-react';

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const { checkSubscription } = useAuthStore();

  useEffect(() => {
    // Check subscription status after successful payment
    const timer = setTimeout(() => {
      checkSubscription();
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkSubscription]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#D2F525]/10 to-green-50 flex items-center justify-center p-6">
      <Card className="max-w-md mx-auto shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Bem-vindo ao PRO! 🎉
          </h1>
          
          <p className="text-gray-600 mb-6">
            Seu pagamento foi processado com sucesso via AbacatePay. Você agora tem acesso à nossa biblioteca premium de componentes!
          </p>
          
          <div className="bg-[#D2F525]/10 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-800">
              <Zap className="w-4 h-4" />
              Recursos PRO foram desbloqueados
            </div>
          </div>
          
          <Button 
            onClick={() => navigate('/')}
            className="w-full bg-[#D2F525] hover:bg-[#B8CC02] text-black font-medium"
            size="lg"
          >
            Explorar Componentes Premium
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          
          <p className="text-xs text-gray-500 mt-4">
            Pode demorar alguns momentos para que seu acesso seja totalmente ativado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;
