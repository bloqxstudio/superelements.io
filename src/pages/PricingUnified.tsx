
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Sparkles, Zap, Shield, Star, ExternalLink, QrCode } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DirectCheckoutButton } from '@/components/payment/DirectCheckoutButton';

const PricingUnified = () => {
  const { userRole } = useAccessControl();
  const [loading, setLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [pricingConfigs, setPricingConfigs] = useState<any>(null);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [planFeatures, setPlanFeatures] = useState<{
    starter: any[];
    pro: any[];
  }>({
    starter: [],
    pro: []
  });
  const [loadingFeatures, setLoadingFeatures] = useState(true);

  useEffect(() => {
    const loadPricingAndFeatures = async () => {
      try {
        // Load pricing configs
        const {
          data: pricingData,
          error
        } = await supabase.functions.invoke('get-pricing-configs');
        if (error) {
          console.error('Error loading pricing configs:', error);
        } else if (pricingData?.success) {
          setPricingConfigs(pricingData.pricing);
        }

        // Load plan features
        const {
          data: featuresData,
          error: featuresError
        } = await supabase.functions.invoke('get-plan-features');
        if (featuresError) {
          console.error('Error loading plan features:', featuresError);
        } else if (featuresData?.success) {
          setPlanFeatures(featuresData.data);
        }
      } catch (error) {
        console.error('Error loading pricing or features:', error);
      } finally {
        setLoadingConfigs(false);
        setLoadingFeatures(false);
      }
    };
    loadPricingAndFeatures();
  }, []);

  const getPricing = () => {
    return {
      monthly: {
        price: 97,
        originalPrice: 97
      },
      yearly: {
        price: 47,
        originalPrice: 47
      }
    };
  };

  const pricing = getPricing();
  const currentPrice = pricing[billingPeriod];

  // Define features for each plan
  const freeFeatures = [{
    name: "Acesso a 30 componentes",
    included: true
  }, {
    name: "Use em projetos ilimitados",
    included: true
  }, {
    name: "Suporte prioritário",
    included: false
  }, {
    name: "Novos componentes semanais",
    included: false
  }, {
    name: "Pagamento único",
    included: false
  }];

  const proFeatures = [{
    name: "Acesso a 1000+ componentes",
    included: true
  }, {
    name: "Use em projetos ilimitados",
    included: true
  }, {
    name: "Suporte prioritário",
    included: true
  }, {
    name: "Novos componentes semanais",
    included: true
  }, {
    name: "Pagamento único",
    included: false
  }];

  const lifetimeFeatures = [{
    name: "Acesso a 1000+ componentes",
    included: true
  }, {
    name: "Use em projetos ilimitados",
    included: true
  }, {
    name: "Suporte prioritário",
    included: true
  }, {
    name: "Novos componentes semanais",
    included: true
  }, {
    name: "Pagamento único",
    included: true
  }];

  if (loadingConfigs || loadingFeatures) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }

  return <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="relative py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Escolha seu plano</h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">Desbloqueie todo o potencial do SuperElements PRO por uma fração do que você irá faturar.</p>

          {/* Billing Period Selector */}
          <div className="flex items-center justify-center mb-4">
            <div className="flex bg-muted/50 rounded-xl p-1.5 border">
              <button onClick={() => setBillingPeriod('monthly')} className={`px-8 py-3 rounded-lg text-sm font-medium transition-all ${billingPeriod === 'monthly' ? 'bg-background text-foreground shadow-lg border' : 'text-muted-foreground hover:text-foreground'}`}>
                Mensal
              </button>
              
              <button onClick={() => setBillingPeriod('yearly')} className={`px-8 py-3 rounded-lg text-sm font-medium transition-all ${billingPeriod === 'yearly' ? 'bg-background text-foreground shadow-lg border' : 'text-muted-foreground hover:text-foreground'}`}>
                Anual - Economize 58%
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="w-full max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Free Plan */}
          <Card className="relative bg-card hover:shadow-lg transition-all duration-300 border border-border/50">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2 text-foreground">Gratuito</h3>
                <p className="text-muted-foreground mb-6">Nenhum pagamento necessário</p>
                
                <div className="mb-6">
                  <span className="text-5xl font-bold text-foreground">R$0</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {freeFeatures.map((feature, index) => <li key={index} className="flex items-center gap-3">
                    {feature.included ? <Check className="w-5 h-5 text-foreground flex-shrink-0" /> : <X className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                    <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {feature.name}
                    </span>
                  </li>)}
              </ul>

              <Button variant="outline" className="w-full h-12 font-medium" disabled={userRole === 'free'}>
                {userRole === 'free' ? 'Plano atual' : 'Usar grátis'}
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="relative bg-card hover:shadow-xl transition-all duration-300 lg:scale-105 border border-border/50">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-foreground text-background px-4 py-2 font-medium">MAIS POPULAR</Badge>
            </div>
            
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2 text-foreground">Pro</h3>
                <p className="text-muted-foreground mb-6">
                  {billingPeriod === 'monthly' ? 'Pagamento mensal' : 'Pagamento anual'}
                </p>
                
                <div className="mb-6">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-foreground">
                      R${currentPrice.price}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  {billingPeriod === 'yearly' && <p className="text-sm text-muted-foreground mt-2">
                      Cobrado anualmente (R${currentPrice.price * 12})
                    </p>}
                  {billingPeriod === 'yearly' && <p className="text-sm text-primary mt-1 font-medium">
                      Economize 58% vs mensal
                    </p>}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {proFeatures.map((feature, index) => <li key={index} className="flex items-center gap-3">
                    {feature.included ? <Check className="w-5 h-5 text-foreground flex-shrink-0" /> : <X className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                    <span className={`text-sm font-medium ${feature.included ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {feature.name}
                    </span>
                  </li>)}
              </ul>

              <DirectCheckoutButton
                planType={billingPeriod === 'monthly' ? 'monthly' : 'annual'}
                disabled={loading || userRole === 'pro'}
                className="w-full h-12 font-bold bg-dark-button text-dark-button-foreground hover:bg-dark-button/90"
              >
                {loading ? 'Processando...' : userRole === 'pro' ? 'Plano Atual' : 'Assinar Agora'}
              </DirectCheckoutButton>
            </CardContent>
          </Card>

          {/* Lifetime Plan */}
          <Card className="relative bg-lifetime text-lifetime-foreground hover:shadow-xl transition-all duration-300 border border-lifetime-accent/30">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-4 py-2 font-medium uppercase tracking-wide">VAGAS LIMITADAS</Badge>
            </div>
            
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-lifetime-foreground">Membro fundador</h3>
                </div>
                <p className="text-lifetime-foreground/80 mb-6">Pagamento único</p>
                
                <div className="mb-6">
                  <span className="text-5xl font-bold text-lifetime-foreground">
                    R$1497
                  </span>
                  <div className="text-lifetime-foreground/80 mt-2 text-sm">Para sempre</div>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {lifetimeFeatures.map((feature, index) => <li key={index} className="flex items-center gap-3">
                    {feature.included ? <Check className="w-5 h-5 text-primary flex-shrink-0" /> : <X className="w-5 h-5 text-lifetime-foreground/50 flex-shrink-0" />}
                    <span className={`text-sm font-medium ${feature.included ? 'text-lifetime-foreground' : 'text-lifetime-foreground/50'}`}>
                      {feature.name}
                    </span>
                  </li>)}
              </ul>

              <DirectCheckoutButton
                planType="lifetime"
                disabled={loading}
                className="w-full h-12 font-bold bg-primary text-primary-foreground hover:bg-primary/90 uppercase tracking-wide"
              >
                {loading ? 'Processando...' : 'Garantir Vitalício'}
              </DirectCheckoutButton>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="bg-lifetime-foreground/20 rounded-full h-2 mb-2">
                  <div className="bg-primary h-2 rounded-full w-3/4"></div>
                </div>
                <p className="text-xs text-lifetime-foreground/80 text-center">
                  ACESSO VITALÍCIO - APENAS 10 VAGAS
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Perguntas frequentes
          </h2>
          
          <div className="space-y-6">
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-2 text-foreground">
                O que está incluído no plano gratuito?
              </h3>
              <p className="text-muted-foreground">
                O plano gratuito inclui acesso a 30 componentes de alta qualidade que você pode usar em projetos ilimitados.
              </p>
            </div>
            
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-2 text-foreground">
                Como funciona o pagamento?
              </h3>
              <p className="text-muted-foreground">
                Utilizamos o AbacatePay para processar pagamentos com PIX (instantâneo no modal) e cartão de crédito (checkout seguro em nova aba). Todos os pagamentos são processados no Brasil.
              </p>
            </div>
            
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-2 text-foreground">
                O que torna o plano Vitalício especial?
              </h3>
              <p className="text-muted-foreground">
                O plano Vitalício oferece acesso permanente a todos os componentes atuais e futuros com apenas um único pagamento. Sem taxas recorrentes, nunca.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>;
};

export default PricingUnified;
