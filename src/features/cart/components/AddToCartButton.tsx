import React from 'react';
import { ShoppingCart, Check, Lock } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectionsStore } from '@/store/connectionsStore';

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
  const { profile } = useAuth();
  const { getConnectionById } = useConnectionsStore();
  const componentId = component.originalId || component.id;
  const inCart = isInCart(componentId);

  // Demo users: cart completely blocked
  const isDemo = profile?.is_demo === true;

  const connection = connectionId ? getConnectionById(connectionId) : null;
  const isPro = (connection?.accessLevel === 'pro') || (component.connection_access_level === 'pro');
  const isBlocked = isDemo || (isPro && profile?.role !== 'pro' && profile?.role !== 'admin');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBlocked) return;

    if (inCart) {
      removeFromCart(componentId);
    } else {
      addToCart(component, baseUrl, connectionId, postType);
    }
  };

  if (isBlocked) {
    return (
      <button
        onClick={(e) => e.stopPropagation()}
        disabled
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-all duration-200 flex-shrink-0 bg-gray-50 border-gray-300 text-gray-400 cursor-not-allowed opacity-60"
        title={isDemo ? 'Carrinho indisponível no ambiente de demonstração' : 'Componente PRO — faça upgrade para adicionar ao carrinho'}
      >
        <Lock className="h-3 w-3" />
        <span className="font-medium">{isDemo ? 'DEMO' : 'PRO'}</span>
      </button>
    );
  }

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
