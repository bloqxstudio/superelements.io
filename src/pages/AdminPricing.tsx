import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  Globe, 
  Settings, 
  Save, 
  Eye, 
  Calculator,
  Crown,
  Zap,
  Trash2,
  Plus
} from 'lucide-react';

interface PricingConfig {
  id: string;
  currency: string;
  plan_type: string;
  price_cents: number;
  discount_percentage: number;
  stripe_price_id: string;
  status: string;
}

const AdminPricing = () => {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('usd');

  // Form states for different currencies and plans
  const [usdConfigs, setUsdConfigs] = useState({
    monthly: { price: 2900, discount: 0, stripeId: '', status: 'draft' },
    quarterly: { price: 5700, discount: 34, stripeId: '', status: 'draft' },
    annual: { price: 14400, discount: 58, stripeId: '', status: 'draft' }
  });

  const [brlConfigs, setBrlConfigs] = useState({
    monthly: { price: 11400, discount: 0, stripeId: '', status: 'draft' },
    quarterly: { price: 22400, discount: 34, stripeId: '', status: 'draft' },
    annual: { price: 56400, discount: 58, stripeId: '', status: 'draft' }
  });

  const [specialConfigs, setSpecialConfigs] = useState({
    founder: { price: 870, discount: 70, stripeId: '', status: 'draft' }
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_payment_configs')
        .select('*')
        .order('currency', { ascending: true })
        .order('plan_type', { ascending: true });

      if (error) throw error;

      setConfigs(data || []);
      
      // Populate form states with existing data
      data?.forEach((config: PricingConfig) => {
        if (config.currency === 'USD') {
          setUsdConfigs(prev => ({
            ...prev,
            [config.plan_type]: {
              price: config.price_cents,
              discount: config.discount_percentage || 0,
              stripeId: config.stripe_price_id || '',
              status: config.status
            }
          }));
        } else if (config.currency === 'BRL') {
          setBrlConfigs(prev => ({
            ...prev,
            [config.plan_type]: {
              price: config.price_cents,
              discount: config.discount_percentage || 0,
              stripeId: config.stripe_price_id || '',
              status: config.status
            }
          }));
        }
      });
    } catch (error) {
      console.error('Error loading configs:', error);
      toast({
        title: "Error",
        description: "Failed to load pricing configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (currency: string, planType: string, config: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_payment_configs')
        .upsert({
          currency,
          plan_type: planType,
          price_cents: config.price,
          discount_percentage: config.discount,
          stripe_price_id: config.stripeId,
          status: config.status,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'currency,plan_type'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${currency} ${planType} plan updated successfully`,
      });

      loadConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const calculateDiscount = (originalPrice: number, currentPrice: number) => {
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  };

  const formatPrice = (cents: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : 'R$';
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  const PlanConfigCard = ({ 
    title, 
    icon: Icon, 
    currency, 
    planType, 
    config, 
    onConfigChange,
    originalPrice 
  }: {
    title: string;
    icon: any;
    currency: string;
    planType: string;
    config: any;
    onConfigChange: (newConfig: any) => void;
    originalPrice?: number;
  }) => (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="w-5 h-5 text-primary" />
          {title}
          <Badge variant={config.status === 'live' ? 'default' : 'secondary'}>
            {config.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Price (cents)</Label>
            <Input
              type="number"
              value={config.price}
              onChange={(e) => onConfigChange({
                ...config,
                price: parseInt(e.target.value) || 0
              })}
              placeholder="Price in cents"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formatPrice(config.price, currency)}
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium">Discount %</Label>
            <Input
              type="number"
              value={config.discount}
              onChange={(e) => onConfigChange({
                ...config,
                discount: parseInt(e.target.value) || 0
              })}
              placeholder="Discount percentage"
            />
            {originalPrice && (
              <p className="text-xs text-muted-foreground mt-1">
                Save {formatPrice(originalPrice - config.price, currency)}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">Stripe Price ID</Label>
          <Input
            value={config.stripeId}
            onChange={(e) => onConfigChange({
              ...config,
              stripeId: e.target.value
            })}
            placeholder="price_xxxxxxxxxxxxx"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.status === 'live'}
              onCheckedChange={(checked) => onConfigChange({
                ...config,
                status: checked ? 'live' : 'draft'
              })}
            />
            <Label className="text-sm">Live Status</Label>
          </div>
          <Button
            onClick={() => saveConfig(currency, planType, config)}
            disabled={saving}
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Pricing Plans Management</h1>
        <p className="text-muted-foreground">
          Configure pricing plans, currencies, and special offers for your platform.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usd" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            USD Plans
          </TabsTrigger>
          <TabsTrigger value="brl" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            BRL Plans
          </TabsTrigger>
          <TabsTrigger value="special" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Special Offers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usd" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <PlanConfigCard
              title="Monthly Pro"
              icon={Crown}
              currency="USD"
              planType="monthly"
              config={usdConfigs.monthly}
              onConfigChange={(newConfig) => setUsdConfigs(prev => ({
                ...prev,
                monthly: newConfig
              }))}
            />
            <PlanConfigCard
              title="Quarterly Pro"
              icon={Crown}
              currency="USD"
              planType="quarterly"
              config={usdConfigs.quarterly}
              onConfigChange={(newConfig) => setUsdConfigs(prev => ({
                ...prev,
                quarterly: newConfig
              }))}
              originalPrice={2900 * 3}
            />
            <PlanConfigCard
              title="Annual Pro"
              icon={Crown}
              currency="USD"
              planType="annual"
              config={usdConfigs.annual}
              onConfigChange={(newConfig) => setUsdConfigs(prev => ({
                ...prev,
                annual: newConfig
              }))}
              originalPrice={2900 * 12}
            />
          </div>
        </TabsContent>

        <TabsContent value="brl" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <PlanConfigCard
              title="Monthly Pro"
              icon={Crown}
              currency="BRL"
              planType="monthly"
              config={brlConfigs.monthly}
              onConfigChange={(newConfig) => setBrlConfigs(prev => ({
                ...prev,
                monthly: newConfig
              }))}
            />
            <PlanConfigCard
              title="Quarterly Pro"
              icon={Crown}
              currency="BRL"
              planType="quarterly"
              config={brlConfigs.quarterly}
              onConfigChange={(newConfig) => setBrlConfigs(prev => ({
                ...prev,
                quarterly: newConfig
              }))}
              originalPrice={11400 * 3}
            />
            <PlanConfigCard
              title="Annual Pro"
              icon={Crown}
              currency="BRL"
              planType="annual"
              config={brlConfigs.annual}
              onConfigChange={(newConfig) => setBrlConfigs(prev => ({
                ...prev,
                annual: newConfig
              }))}
              originalPrice={11400 * 12}
            />
          </div>
        </TabsContent>

        <TabsContent value="special" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <PlanConfigCard
              title="Founder's Deal (USD)"
              icon={Zap}
              currency="USD"
              planType="founder"
              config={specialConfigs.founder}
              onConfigChange={(newConfig) => setSpecialConfigs(prev => ({
                ...prev,
                founder: newConfig
              }))}
              originalPrice={2900}
            />
            <Card className="border-2 border-dashed border-muted-foreground/25">
              <CardContent className="flex items-center justify-center h-full min-h-[300px]">
                <div className="text-center space-y-4">
                  <Plus className="w-12 h-12 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-medium text-muted-foreground">Add New Special Offer</h3>
                  <p className="text-sm text-muted-foreground">
                    Create limited-time promotions and special pricing
                  </p>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Offer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Preview Pricing Page
            </Button>
            <Button variant="outline" size="sm">
              <Calculator className="w-4 h-4 mr-2" />
              Conversion Calculator
            </Button>
            <Button variant="outline" size="sm">
              <DollarSign className="w-4 h-4 mr-2" />
              Sync Stripe Prices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPricing;