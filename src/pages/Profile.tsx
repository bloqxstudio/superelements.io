import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Crown, Shield, Mail, User } from 'lucide-react';

const Profile = () => {
  const { user, profile } = useAuthStore();
  const { userRole, isAdmin, isPro, isFree } = useAccessControl();

  if (!user || !profile) {
    return <div className="p-6">Loading...</div>;
  }

  const userInitial = user.email?.charAt(0).toUpperCase() || 'U';

  const getPlanBadgeColor = () => {
    if (isAdmin) return 'bg-purple-100 text-purple-800';
    if (isPro) return 'bg-[#D2F525] text-black';
    return 'border-gray-300 text-gray-600';
  };

  const getPlanBadgeText = () => {
    if (isAdmin) return 'ADMIN';
    if (isPro) return 'PRO';
    return 'FREE';
  };

  const getPlanIcon = () => {
    if (isAdmin) return <Shield className="h-3 w-3" />;
    if (isPro) return <Crown className="h-3 w-3" />;
    return null;
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </CardTitle>
          <CardDescription>
            Manage your account information and subscription details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Avatar and Basic Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-[#D2F525] text-black font-semibold text-lg">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{user.email}</span>
              </div>
              <Badge className={`${getPlanBadgeColor()} flex items-center gap-1 w-fit`}>
                {getPlanIcon()}
                {getPlanBadgeText()}
              </Badge>
            </div>
          </div>

          {/* Plan Information */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Current Plan</h3>
            <p className="text-sm text-muted-foreground">
              {isAdmin && "You have administrator access to all features and settings."}
              {isPro && "You have access to all Pro features including unlimited components."}
              {isFree && "You're currently on the Free plan. Upgrade to Pro for unlimited access."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;