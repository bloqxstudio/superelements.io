import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/integrations/supabase/client';

export const useSecurityAudit = () => {
  const { user, profile } = useAuthStore();

  const logSecurityEvent = async (eventType: string, eventData: Record<string, any>) => {
    if (!user) return;

    try {
      // SECURITY FIX: Remove external IP API call to prevent data leakage
      // IP address will be captured server-side in edge functions if needed
      const { error } = await supabase
        .from('security_audit_log')
        .insert({
          user_id: user.id,
          event_type: eventType,
          event_data: eventData,
          ip_address: 'client-side-hidden', // Will be set server-side
          user_agent: navigator.userAgent
        });

      if (error) {
        console.error('Failed to log security event:', error);
      }
    } catch (error) {
      console.error('Security audit logging error:', error);
    }
  };

  const logConnectionAccess = (connectionId: string) => {
    logSecurityEvent('connection_access', { connection_id: connectionId });
  };

  const logRoleChange = (oldRole: string, newRole: string) => {
    logSecurityEvent('role_change_attempt', { 
      old_role: oldRole, 
      new_role: newRole 
    });
  };

  const logSuspiciousActivity = (activity: string, details: Record<string, any>) => {
    logSecurityEvent('suspicious_activity', { 
      activity, 
      details,
      user_role: profile?.role 
    });
  };

  // Monitor for suspicious activities
  useEffect(() => {
    if (!user || !profile) return;

    // Log login events
    logSecurityEvent('user_login', { 
      user_id: user.id,
      role: profile.role 
    });

    // Set up monitoring for rapid API calls
    let apiCallCount = 0;
    const resetCounter = () => { apiCallCount = 0; };
    const interval = setInterval(resetCounter, 60000); // Reset every minute

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      apiCallCount++;
      if (apiCallCount > 100) { // More than 100 calls per minute
        logSuspiciousActivity('rapid_api_calls', { 
          calls_per_minute: apiCallCount 
        });
      }
      return originalFetch(...args);
    };

    return () => {
      clearInterval(interval);
      window.fetch = originalFetch;
    };
  }, [user, profile]);

  return {
    logSecurityEvent,
    logConnectionAccess,
    logRoleChange,
    logSuspiciousActivity
  };
};