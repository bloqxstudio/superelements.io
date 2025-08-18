
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AbacatePayCheckout } from "./AbacatePayCheckout";
import { toast } from "sonner";
import { ExternalLink, QrCode } from "lucide-react";

interface DirectCheckoutButtonProps {
  planType: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
}

export const DirectCheckoutButton = ({
  planType,
  children,
  className,
  disabled,
  variant = "default"
}: DirectCheckoutButtonProps) => {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const handleClick = () => {
    setPaymentDialogOpen(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled}
        className={className}
        variant={variant}
      >
        {children}
      </Button>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o método de pagamento</DialogTitle>
          </DialogHeader>
          <AbacatePayCheckout 
            planType={planType}
            onSuccess={() => {
              setPaymentDialogOpen(false);
              toast.success("Redirecionando...");
            }} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
