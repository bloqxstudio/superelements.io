-- Create admin payment configurations table
CREATE TABLE public.admin_payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency VARCHAR(3) NOT NULL, -- USD, BRL
  plan_type VARCHAR(20) NOT NULL, -- monthly, yearly
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  discount_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft, live
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(currency, plan_type, status)
);

-- Create campaigns table for promotions
CREATE TABLE public.admin_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  coupon_code TEXT UNIQUE,
  discount_percentage INTEGER NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  usage_limit INTEGER,
  current_usage INTEGER DEFAULT 0,
  target_audience JSONB, -- email lists, user types
  status TEXT DEFAULT 'draft', -- draft, active, expired
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Create Stripe configurations table
CREATE TABLE public.admin_stripe_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL, -- test, live
  currency VARCHAR(3) NOT NULL,
  publishable_key TEXT NOT NULL,
  webhook_endpoint TEXT,
  status TEXT DEFAULT 'active', -- active, inactive
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(environment, currency)
);

-- Create analytics events table
CREATE TABLE public.admin_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- payment_success, subscription_start, etc
  user_id UUID,
  amount_cents INTEGER,
  currency VARCHAR(3),
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS on all admin tables
ALTER TABLE public.admin_payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_stripe_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_analytics_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin-only access
CREATE POLICY "Admin only access to payment configs" ON public.admin_payment_configs
FOR ALL USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Admin only access to campaigns" ON public.admin_campaigns
FOR ALL USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Admin only access to stripe configs" ON public.admin_stripe_configs
FOR ALL USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Admin only access to analytics" ON public.admin_analytics_events
FOR ALL USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Create updated_at triggers
CREATE TRIGGER update_admin_payment_configs_updated_at
  BEFORE UPDATE ON public.admin_payment_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_campaigns_updated_at
  BEFORE UPDATE ON public.admin_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_stripe_configs_updated_at
  BEFORE UPDATE ON public.admin_stripe_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();