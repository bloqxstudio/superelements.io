import React from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

interface AddToCartButtonProps {
  component: any;
  baseUrl: string;
  connectionId: string;
  postType: string;
}

export const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  component,
  baseUrl,
  connectionId,
  postType,
}) => {
  const { addToCart, removeFromCart, isInCart } = useCartStore();
  const componentId = component.originalId || component.id;
  const inCart = isInCart(componentId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (inCart) {
      removeFromCart(componentId);
    } else {
      addToCart(component, baseUrl, connectionId, postType);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded 
        transition-all duration-200 flex-shrink-0
        ${inCart 
          ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90' 
          : 'bg-background border-border text-foreground hover:bg-muted'
        }
      `}
      title={inCart ? "Remover do carrinho" : "Adicionar ao carrinho"}
    >
      {inCart ? (
        <Check className="h-3 w-3" />
      ) : (
        <ShoppingCart className="h-3 w-3" />
      )}
      <span className="font-medium">
        {inCart ? 'NO CARRINHO' : 'CARRINHO'}
      </span>
    </button>
  );
};
