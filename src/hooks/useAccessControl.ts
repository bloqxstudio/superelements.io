import { useAuthStore } from '@/store/authStore';

export const useAccessControl = () => {
  const { profile, subscription } = useAuthStore();
  
  const isAdmin = profile?.role === 'admin';
  const isPro = profile?.role === 'pro' || isAdmin;
  const isFree = profile?.role === 'free' && !isPro && !isAdmin;
  const isSubscribed = subscription?.subscribed || false;
  const canAccessProFeatures = isPro || isSubscribed;
  
  return {
    isAdmin,
    isPro,
    isFree,
    role: profile?.role || 'free',
    userRole: profile?.role || 'free',
    isSubscribed,
    canAccessProFeatures
  };
};