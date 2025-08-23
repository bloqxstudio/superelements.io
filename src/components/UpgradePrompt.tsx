import React from 'react';
import { Zap, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppRole } from '@/contexts/AuthContext';

interface UpgradePromptProps {
  requiredLevel: AppRole;
  currentLevel: AppRole;
  onUpgrade?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  requiredLevel,
  currentLevel,
  onUpgrade
}) => {
  const getPromptConfig = () => {
    if (requiredLevel === 'pro' && currentLevel === 'free') {
      return {
        icon: <Zap className="h-6 w-6" />,
        title: 'Componente Pro',
        description: 'Este componente é exclusivo para usuários Pro. Faça upgrade para acessar todos os componentes.',
        buttonText: 'Fazer Upgrade para Pro',
        gradient: 'from-pro-gradient-from to-pro-gradient-to'
      };
    }
    
    if (requiredLevel === 'admin') {
      return {
        icon: <Crown className="h-6 w-6" />,
        title: 'Componente Admin',
        description: 'Este componente é exclusivo para administradores.',
        buttonText: 'Contatar Administrador',
        gradient: 'from-yellow-400 to-orange-500'
      };
    }

    return {
      icon: <Zap className="h-6 w-6" />,
      title: 'Acesso Restrito',
      description: 'Você não tem permissão para acessar este componente.',
      buttonText: 'Fazer Upgrade',
      gradient: 'from-pro-gradient-from to-pro-gradient-to'
    };
  };

  const config = getPromptConfig();

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className={`mx-auto mb-2 p-3 rounded-full bg-gradient-to-r ${config.gradient} text-white`}>
          {config.icon}
        </div>
        <CardTitle className="text-lg">{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {requiredLevel !== 'admin' && (
          <Button 
            onClick={onUpgrade}
            className={`w-full bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white`}
          >
            {config.buttonText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};