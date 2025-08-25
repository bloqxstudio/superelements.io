import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
export const ProBanner: React.FC = () => {
  const {
    user,
    profile
  } = useAuth();

  // Only show banner for authenticated free users
  if (!user || !profile || profile.role !== 'free') {
    return null;
  }
  return <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-pro-gradient-from to-pro-gradient-to text-white shadow-lg animate-fade-in">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 p-2 bg-white/20 rounded-full">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Desbloqueie toda plataforma por apenas R$47 por mês</p>
            <p className="text-xs text-white/80 hidden sm:block">Acesse todos os componentes, plugins e a comunidade</p>
          </div>
        </div>
        
        <Button 
          size="sm" 
          variant="secondary" 
          className="bg-white text-pro-gradient-from hover:bg-white/90 font-medium flex-shrink-0"
          onClick={() => {
            const phone = "+5551989249280";
            const message = encodeURIComponent("quero contratar o Super Elements PRO");
            const whatsappUrl = `https://api.whatsapp.com/send/?phone=${encodeURIComponent(phone)}&text=${message}&type=phone_number&app_absent=0`;
            window.open(whatsappUrl, '_blank');
          }}
        >
          Fazer Upgrade
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>;
};