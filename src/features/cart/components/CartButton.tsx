import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { Badge } from '@/components/ui/badge';

export const CartButton: React.FC = () => {
  const { getItemCount, toggleCart, items } = useCartStore();
  const itemCount = getItemCount();

  if (itemCount === 0) return null;

  return (
    <button
      onClick={toggleCart}
      className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 group"
      title={`Ver carrinho (${itemCount} ${itemCount === 1 ? 'item' : 'itens'})`}
    >
      <div className="relative">
        <ShoppingCart className="h-6 w-6" />
        {itemCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold animate-in zoom-in"
          >
            {itemCount > 9 ? '9+' : itemCount}
          </Badge>
        )}
      </div>
    </button>
  );
};
