import React, { useEffect } from 'react';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useAdminStore } from '@/store/adminStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentConfigManager } from '@/components/admin/PaymentConfigManager';
import { PlanFeaturesManager } from '@/components/admin/PlanFeaturesManager';
import { CampaignManager } from '@/components/admin/CampaignManager';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
import { StripeConfigPanel } from '@/components/admin/StripeConfigPanel';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Gift, 
  Settings, 
  BarChart3,
  CreditCard,
  Target
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { isAdmin } = useAccessControl();
  const { dashboard, loadingDashboard, fetchDashboard } = useAdminStore();

  useEffect(() => {
    if (isAdmin) {
      fetchDashboard();
    }
  }, [isAdmin, fetchDashboard]);

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (cents: number, currency: string = 'USD') => {
    const symbol = currency === 'BRL' ? 'R$' : '$';
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Comprehensive payment and business management
              </p>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Administrator
            </Badge>
          </div>
        </div>

        {/* Overview Cards */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Subscribers
                </CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboard.subscribers.total}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Object.entries(dashboard.subscribers.byTier).map(([tier, count]) => (
                    <span key={tier} className="mr-2">
                      {tier}: {count}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  30-Day Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(dashboard.revenue.total30Days)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Object.entries(dashboard.revenue.byCurrency).map(([currency, amount]) => (
                    <span key={currency} className="mr-2">
                      {currency}: {formatCurrency(amount as number, currency)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Campaigns
                </CardTitle>
                <Gift className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboard.campaigns.active}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Usage: {dashboard.campaigns.usage.used}/{dashboard.campaigns.usage.total}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Live Configs
                </CardTitle>
                <Settings className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboard.configs.live}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Payment configurations active
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 bg-muted">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="payment-config" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="plan-features" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="stripe" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-4">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="payment-config" className="space-y-4">
            <PaymentConfigManager />
          </TabsContent>

          <TabsContent value="plan-features" className="space-y-4">
            <PlanFeaturesManager />
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <CampaignManager />
          </TabsContent>

          <TabsContent value="stripe" className="space-y-4">
            <StripeConfigPanel />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">System Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Maintenance Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable maintenance mode for system updates
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Email Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure admin email alerts
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Backup & Export</h3>
                    <p className="text-sm text-muted-foreground">
                      Export data and manage backups
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Export Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;