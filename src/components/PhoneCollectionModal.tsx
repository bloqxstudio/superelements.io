import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, MessageCircle } from 'lucide-react';

interface PhoneCollectionModalProps {
  open: boolean;
  onComplete: () => void;
  userEmail: string;
}

export const PhoneCollectionModal: React.FC<PhoneCollectionModalProps> = ({ 
  open, 
  onComplete, 
  userEmail 
}) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || phone.length < 11) {
      setError('Por favor, insira um número de telefone válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      onComplete();
    } catch (err: any) {
      console.error('Error updating phone:', err);
      setError('Erro ao salvar telefone. Tente novamente.');
    }
    
    setLoading(false);
  };

  const handleSkip = () => {
    // For now, we'll complete the flow even if they skip
    // In the future, we could store a flag to remind them later
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Phone className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Complete seu perfil
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            Para uma melhor experiência e comunicações importantes, precisamos do seu número de telefone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email-display" className="text-gray-700 text-sm">
              Email confirmado
            </Label>
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 text-sm font-medium">{userEmail}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-700 text-sm">
              Telefone *
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <PhoneInput
                value={phone}
                onChange={setPhone}
                disabled={loading}
                className="pl-10 h-12"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="flex items-start space-x-2 text-sm text-gray-500">
              <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Usaremos seu telefone apenas para comunicações importantes sobre sua conta e atualizações do produto.
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvando...
                </div>
              ) : (
                'Salvar telefone'
              )}
            </Button>
            
            <Button 
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={loading}
              className="w-full h-12 text-gray-600 hover:text-gray-900"
            >
              Pular por agora
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};