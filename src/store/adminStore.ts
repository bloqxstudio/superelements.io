import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentConfig {
  id: string;
  currency: string;
  plan_type: string;
  price_cents: number;
  stripe_price_id?: string;
  discount_percentage: number;
  status: 'draft' | 'live';
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  coupon_code?: string;
  discount_percentage: number;
  start_date: string;
  end_date: string;
  usage_limit?: number;
  current_usage: number;
  target_audience?: any;
  status: 'draft' | 'active' | 'expired';
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PlanFeature {
  id: string;
  plan_name: 'starter' | 'pro';
  feature_name: string;
  feature_description: string;
  display_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AnalyticsDashboard {
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  subscribers: {
    total: number;
    byTier: Record<string, number>;
  };
  revenue: {
    total30Days: number;
    byCurrency: Record<string, number>;
  };
  campaigns: {
    active: number;
    usage: { used: number; total: number };
  };
  configs: {
    live: number;
    byPlan: Record<string, number>;
  };
}

interface AdminState {
  // Payment Configs
  paymentConfigs: PaymentConfig[];
  loadingConfigs: boolean;
  
  // Campaigns
  campaigns: Campaign[];
  loadingCampaigns: boolean;
  
  // Plan Features
  planFeatures: { starter: PlanFeature[]; pro: PlanFeature[] };
  loadingPlanFeatures: boolean;
  
  // Analytics
  dashboard: AnalyticsDashboard | null;
  loadingDashboard: boolean;
  
  // Actions
  fetchPaymentConfigs: () => Promise<void>;
  createPaymentConfig: (config: Partial<PaymentConfig>) => Promise<PaymentConfig>;
  updatePaymentConfig: (id: string, updates: Partial<PaymentConfig>) => Promise<PaymentConfig>;
  deletePaymentConfig: (id: string) => Promise<void>;
  
  fetchCampaigns: () => Promise<void>;
  createCampaign: (campaign: Partial<Campaign>) => Promise<Campaign>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<Campaign>;
  validateCoupon: (couponCode: string) => Promise<{ valid: boolean; campaign?: any; error?: string }>;
  syncStripeCoupons: () => Promise<{ success: boolean; synced: number; results: any[] }>;
  
  fetchPlanFeatures: () => Promise<void>;
  createPlanFeature: (feature: Partial<PlanFeature>) => Promise<PlanFeature>;
  updatePlanFeature: (id: string, updates: Partial<PlanFeature>) => Promise<PlanFeature>;
  deletePlanFeature: (id: string) => Promise<void>;
  
  fetchDashboard: () => Promise<void>;
  trackEvent: (event: { event_type: string; amount_cents?: number; currency?: string; metadata?: any }) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // Initial state
  paymentConfigs: [],
  loadingConfigs: false,
  campaigns: [],
  loadingCampaigns: false,
  planFeatures: { starter: [], pro: [] },
  loadingPlanFeatures: false,
  dashboard: null,
  loadingDashboard: false,

  // Payment Config Actions
  fetchPaymentConfigs: async () => {
    set({ loadingConfigs: true });
    try {
      const { data, error } = await supabase.functions.invoke('admin-payment-config', {
        method: 'GET',
      });
      
      if (error) throw error;
      set({ paymentConfigs: data.configs || [] });
    } catch (error) {
      console.error('Error fetching payment configs:', error);
    } finally {
      set({ loadingConfigs: false });
    }
  },

  createPaymentConfig: async (config) => {
    const { data, error } = await supabase.functions.invoke('admin-payment-config', {
      method: 'POST',
      body: config,
    });
    
    if (error) throw error;
    
    // Refresh configs
    await get().fetchPaymentConfigs();
    return data.config;
  },

  updatePaymentConfig: async (id, updates) => {
    const { data, error } = await supabase.functions.invoke('admin-payment-config', {
      method: 'PUT',
      body: { id, ...updates },
    });
    
    if (error) throw error;
    
    // Refresh configs
    await get().fetchPaymentConfigs();
    return data.config;
  },

  deletePaymentConfig: async (id) => {
    const { error } = await supabase.functions.invoke('admin-payment-config', {
      method: 'DELETE',
      body: { id },
    });
    
    if (error) throw error;
    
    // Refresh configs
    await get().fetchPaymentConfigs();
  },

  // Campaign Actions
  fetchCampaigns: async () => {
    set({ loadingCampaigns: true });
    try {
      const { data, error } = await supabase.functions.invoke('admin-campaigns', {
        method: 'GET',
      });
      
      if (error) throw error;
      set({ campaigns: data.campaigns || [] });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      set({ loadingCampaigns: false });
    }
  },

  createCampaign: async (campaign) => {
    const { data, error } = await supabase.functions.invoke('admin-campaigns', {
      method: 'POST',
      body: campaign,
    });
    
    if (error) throw error;
    
    // Refresh campaigns
    await get().fetchCampaigns();
    return data.campaign;
  },

  updateCampaign: async (id, updates) => {
    const { data, error } = await supabase.functions.invoke('admin-campaigns', {
      method: 'PUT',
      body: { id, ...updates },
    });
    
    if (error) throw error;
    
    // Refresh campaigns
    await get().fetchCampaigns();
    return data.campaign;
  },

  validateCoupon: async (couponCode) => {
    const { data, error } = await supabase.functions.invoke('admin-campaigns', {
      body: { coupon_code: couponCode },
      headers: { 'X-Action': 'validate-coupon' }
    });
    
    if (error) throw error;
    return data;
  },

  syncStripeCoupons: async () => {
    const { data, error } = await supabase.functions.invoke('sync-stripe-coupons');
    
    if (error) throw error;
    return data;
  },

  // Analytics Actions
  fetchDashboard: async () => {
    set({ loadingDashboard: true });
    try {
      const { data, error } = await supabase.functions.invoke('admin-analytics', {
        method: 'GET',
      });
      
      if (error) throw error;
      set({ dashboard: data.dashboard });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      set({ loadingDashboard: false });
    }
  },

  trackEvent: async (event) => {
    const { error } = await supabase.functions.invoke('admin-analytics', {
      body: event,
      headers: { 'X-Action': 'track' }
    });
    
    if (error) throw error;
  },

  // Plan Features Actions
  fetchPlanFeatures: async () => {
    set({ loadingPlanFeatures: true });
    try {
      const { data, error } = await supabase.functions.invoke('get-plan-features');
      
      if (error) throw error;
      if (data?.success) {
        set({ planFeatures: data.data });
      }
    } catch (error) {
      console.error('Error fetching plan features:', error);
    } finally {
      set({ loadingPlanFeatures: false });
    }
  },

  createPlanFeature: async (feature) => {
    const { data, error } = await supabase.functions.invoke('admin-plan-features', {
      method: 'POST',
      body: feature,
    });
    
    if (error) throw error;
    
    // Refresh features
    await get().fetchPlanFeatures();
    return data.feature;
  },

  updatePlanFeature: async (id, updates) => {
    const { data, error } = await supabase.functions.invoke('admin-plan-features', {
      method: 'PUT',
      body: { id, ...updates },
    });
    
    if (error) throw error;
    
    // Refresh features
    await get().fetchPlanFeatures();
    return data.feature;
  },

  deletePlanFeature: async (id) => {
    const { error } = await supabase.functions.invoke('admin-plan-features', {
      method: 'DELETE',
      body: { id },
    });
    
    if (error) throw error;
    
    // Refresh features
    await get().fetchPlanFeatures();
  },
}));