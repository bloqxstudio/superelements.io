
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, Crown, Shield } from 'lucide-react';

export const SimpleUserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuthStore();
  const { userRole, isAdmin, isPro, isFree } = useAccessControl();

  if (!user || !profile) return null;

  const userInitial = user.email?.charAt(0).toUpperCase() || 'U';

  const handleSignOut = async () => {
    await signOut();
  };

  const handleManageConnections = () => {
    navigate('/connections');
  };

  const getPlanBadgeVariant = () => {
    if (isAdmin) return 'secondary';
    if (isPro) return 'default';
    return 'outline';
  };

  const getPlanBadgeColor = () => {
    if (isAdmin) return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
    if (isPro) return 'bg-[#D2F525] text-black hover:bg-[#B8CC02]';
    return 'border-gray-300 text-gray-600 hover:bg-gray-50';
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
    <div className="flex items-center gap-3">
      {/* Plan Badge */}
      <Badge 
        variant={getPlanBadgeVariant()}
        className={`${getPlanBadgeColor()} flex items-center gap-1 text-xs font-medium px-2 py-1`}
      >
        {getPlanIcon()}
        {getPlanBadgeText()}
      </Badge>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[#D2F525] text-black font-semibold text-sm">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white z-50">
          {isAdmin && (
            <>
              <DropdownMenuItem onClick={handleManageConnections}>
                <Settings className="mr-2 h-4 w-4" />
                Manage Connections
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
