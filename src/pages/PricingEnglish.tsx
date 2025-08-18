
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Crown, ExternalLink, QrCode } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DirectCheckoutButton } from '@/components/payment/DirectCheckoutButton';

const PricingEnglish = () => {
  const { userRole, isSubscribed, canAccessProFeatures } = useAccessControl();
  const [loading, setLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [userCountry, setUserCountry] = useState<string>('US');
  const [currency, setCurrency] = useState<{ code: string; symbol: string }>({ code: 'USD', symbol: '$' });

  // Detect user's country
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const country = data.country_code;
        setUserCountry(country);
        
        if (country === 'BR') {
          setCurrency({ code: 'BRL', symbol: 'R$' });
        } else {
          setCurrency({ code: 'USD', symbol: '$' });
        }
      } catch (error) {
        console.error('Error detecting country:', error);
        // Default to USD if detection fails
        setCurrency({ code: 'USD', symbol: '$' });
      }
    };

    detectCountry();
  }, []);

  // Pricing by currency and period
  const getPricing = () => {
    if (currency.code === 'BRL') {
      return {
        monthly: { price: 59, originalPrice: 99 },
        yearly: { price: 497, originalPrice: 708 } // 12 months for the price of 8.5
      };
    } else {
      return {
        monthly: { price: 12, originalPrice: 19 },
        yearly: { price: 99, originalPrice: 144 } // 12 months for the price of 8.5
      };
    }
  };

  const pricing = getPricing();
  const currentPrice = pricing[billingPeriod];

  const plans = [
    {
      name: 'Free',
      price: `${currency.symbol}0`,
      period: 'Forever',
      description: 'Perfect to get started',
      features: [
        'Access to free components',
        'Basic Elementor templates',
        'Unlimited projects',
        'Community support',
        'No attribution required'
      ],
      icon: Sparkles,
      current: userRole === 'free',
      buttonText: userRole === 'free' ? 'Current Plan' : 'Get Started',
      buttonVariant: 'outline' as const,
      popular: false
    },
    {
      name: 'Pro',
      price: `${currency.symbol}${currentPrice.price}`,
      period: billingPeriod === 'yearly' ? 'Per year' : 'Per month',
      originalPrice: `${currency.symbol}${currentPrice.originalPrice}`,
      description: 'For professional developers',
      features: [
        'Everything in Free plan',
        'Premium component library',
        'Advanced Elementor widgets',
        'Unlimited projects',
        'Access to source files',
        'Priority support'
      ],
      icon: Crown,
      current: userRole === 'pro',
      buttonText: userRole === 'pro' ? 'Current Plan' : 'Subscribe Pro',
      buttonVariant: 'default' as const,
      popular: true,
      highlight: true
    }
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 bg-gray-100 rounded-full text-sm font-medium mb-6">
            Plans & Pricing
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight text-gray-900">
            Build professional websites in<br />
            Elementor 6x faster
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Copy. Paste. Publish. A library with ready-made, customizable and organized sections to transform ideas into real pages in Elementor — in minutes.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                billingPeriod === 'monthly' 
                  ? 'bg-[#D2F525] text-black' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors relative ${
                billingPeriod === 'yearly' 
                  ? 'bg-[#D2F525] text-black' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                -30%
              </span>
            </button>
          </div>
          
          <div className="text-[#D2F525] text-sm font-medium">
            Save more with the annual plan →
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = plan.current;
            
            return (
              <Card 
                key={plan.name} 
                className={`relative bg-white border-2 text-gray-900 overflow-hidden transition-all hover:shadow-lg ${
                  plan.highlight ? 'border-[#D2F525] shadow-lg' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-[#D2F525] text-black text-center py-2 text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                
                <CardContent className={`p-8 ${plan.popular ? 'pt-16' : 'pt-8'}`}>
                  {/* Plan Header */}
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-[#D2F525]" />
                      </div>
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                    </div>
                    
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      {plan.originalPrice && billingPeriod === 'yearly' && (
                        <span className="text-lg text-gray-400 line-through">{plan.originalPrice}</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">{plan.period}</p>
                    <p className="text-gray-600 mt-2">{plan.description}</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <div className="w-5 h-5 bg-[#D2F525] rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-black" />
                        </div>
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {plan.name === 'Pro' && !isCurrentPlan ? (
                    <DirectCheckoutButton
                      planType={billingPeriod === 'monthly' ? 'monthly' : 'annual'}
                      disabled={loading}
                      className="w-full h-12 font-semibold bg-[#D2F525] hover:bg-[#B8CC02] text-black"
                    >
                      {loading ? 'Processing...' : 'Subscribe Now'}
                    </DirectCheckoutButton>
                  ) : (
                    <Button
                      disabled={true}
                      className={`w-full h-12 font-semibold ${
                        isCurrentPlan
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                      variant={plan.buttonVariant}
                    >
                      {plan.buttonText}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Current Plan Indicator */}
        {userRole !== 'free' && (
          <div className="text-center mt-8">
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
              Current Plan: {userRole.toUpperCase()}
            </Badge>
          </div>
        )}
        
        {/* Bottom Text */}
        <div className="text-center mt-16 text-gray-500 text-sm max-w-2xl mx-auto">
          <p>All plans include access to our component library with regular updates and new components added monthly. Payments processed securely via AbacatePay.</p>
        </div>
      </div>
    </div>
  );
};

export default PricingEnglish;
