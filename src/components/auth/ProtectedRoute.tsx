
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isInitialized, profile, isProfileLoading } = useAuthStore();

  console.log('🛡️ ProtectedRoute check:', { 
    isInitialized, 
    hasUser: !!user, 
    hasProfile: !!profile, 
    isProfileLoading,
    userRole: profile?.role, 
    allowedRoles 
  });

  // Show skeleton while initializing auth
  if (!isInitialized) {
    console.log('⏳ ProtectedRoute: Auth not initialized, showing skeleton');
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between pb-4 border-b">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          
          {/* Main content skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log('🔒 ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Show loading skeleton if profile is still loading and we need role checks
  if (allowedRoles && allowedRoles.length > 0 && isProfileLoading) {
    console.log('⏳ ProtectedRoute: Profile loading, showing skeleton');
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              <Skeleton className="h-12 w-12 rounded-full mx-auto" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check role permissions if allowedRoles is specified
  if (allowedRoles && allowedRoles.length > 0) {
    console.log('🔐 ProtectedRoute: Checking role permissions');
    if (!profile?.role || !allowedRoles.includes(profile.role)) {
      console.log('❌ ProtectedRoute: Access denied, redirecting to home');
      return <Navigate to="/" replace />;
    }
  }

  console.log('✅ ProtectedRoute: Access granted');
  return <>{children}</>;
};
