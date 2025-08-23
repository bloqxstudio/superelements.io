import React from 'react';
import { User, LogOut, Crown, Zap, CircleUserRound } from 'lucide-react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const getRoleIcon = (role: AppRole) => {
  switch (role) {
    case 'admin':
      return <Crown className="h-3 w-3" />;
    case 'pro':
      return <Zap className="h-3 w-3" />;
    case 'free':
      return <CircleUserRound className="h-3 w-3" />;
    default:
      return <User className="h-3 w-3" />;
  }
};

const getRoleColor = (role: AppRole) => {
  switch (role) {
    case 'admin':
      return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
    case 'pro':
      return 'bg-gradient-to-r from-pro-gradient-from to-pro-gradient-to text-white';
    case 'free':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getRoleLabel = (role: AppRole) => {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'pro':
      return 'Pro';
    case 'free':
      return 'Free';
    default:
      return 'Free';
  }
};

export const UserAvatar: React.FC = () => {
  const { user, profile, signOut } = useAuth();

  if (!user || !profile) return null;

  const getInitial = () => {
    if (profile.email) {
      return profile.email.charAt(0).toUpperCase();
    }
    return user.email?.charAt(0).toUpperCase() || 'U';
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`
          h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium
          transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring
          ${getRoleColor(profile.role)}
        `}>
          {getInitial()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">{profile.email}</p>
          <div className="flex items-center gap-1 mt-1">
            {getRoleIcon(profile.role)}
            <Badge variant="secondary" className="text-xs">
              {getRoleLabel(profile.role)}
            </Badge>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};