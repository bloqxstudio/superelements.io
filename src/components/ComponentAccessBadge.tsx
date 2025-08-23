import React from 'react';
import { Crown, Zap, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AppRole } from '@/contexts/AuthContext';

interface ComponentAccessBadgeProps {
  accessLevel: AppRole;
  userRole?: AppRole;
  size?: 'sm' | 'md';
}

export const ComponentAccessBadge: React.FC<ComponentAccessBadgeProps> = ({
  accessLevel,
  userRole,
  size = 'sm'
}) => {
  const isAccessible = userRole && (
    userRole === 'admin' || 
    (userRole === 'pro' && (accessLevel === 'free' || accessLevel === 'pro')) ||
    (userRole === 'free' && accessLevel === 'free')
  );

  const getBadgeConfig = () => {
    switch (accessLevel) {
      case 'admin':
        return {
          icon: <Crown className="h-3 w-3" />,
          label: 'Admin',
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600'
        };
      case 'pro':
        return {
          icon: <Zap className="h-3 w-3" />,
          label: 'Pro',
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-pro-gradient-from to-pro-gradient-to text-white'
        };
      case 'free':
        return {
          icon: null,
          label: 'Free',
          variant: 'secondary' as const,
          className: ''
        };
      default:
        return {
          icon: <Lock className="h-3 w-3" />,
          label: 'Locked',
          variant: 'outline' as const,
          className: ''
        };
    }
  };

  const config = getBadgeConfig();
  
  if (accessLevel === 'free') {
    return null; // Don't show badge for free components
  }

  return (
    <Badge 
      variant={config.variant}
      className={`
        ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}
        flex items-center gap-1
        ${config.className}
        ${!isAccessible ? 'opacity-75' : ''}
      `}
    >
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  );
};