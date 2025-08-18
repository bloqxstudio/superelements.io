import React, { useEffect, useState } from 'react';
import { useAdminStore, PaymentConfig } from '@/store/adminStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2, Eye, DollarSign } from 'lucide-react';

interface PaymentConfigForm {
  currency: string;
  plan_type: string;
  price_cents: number;
  discount_percentage: number;
  status: 'draft' | 'live';
}

export const PaymentConfigManager = () => {
  const { 
    paymentConfigs, 
    loadingConfigs, 
    fetchPaymentConfigs,
    createPaymentConfig,
    updatePaymentConfig,
    deletePaymentConfig
  } = useAdminStore();

  const [editingConfig, setEditingConfig] = useState<PaymentConfig | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<PaymentConfigForm>({
    defaultValues: {
      currency: 'USD',
      plan_type: 'monthly',
      price_cents: 1200,
      discount_percentage: 0,
      status: 'draft'
    }
  });

  useEffect(() => {
    fetchPaymentConfigs();
  }, [fetchPaymentConfigs]);

  useEffect(() => {
    if (editingConfig) {
      form.reset({
        currency: editingConfig.currency,
        plan_type: editingConfig.plan_type,
        price_cents: editingConfig.price_cents,
        discount_percentage: editingConfig.discount_percentage,
        status: editingConfig.status
      });
    } else {
      form.reset({
        currency: 'USD',
        plan_type: 'monthly',
        price_cents: 1200,
        discount_percentage: 0,
        status: 'draft'
      });
    }
  }, [editingConfig, form]);

  const onSubmit = async (data: PaymentConfigForm) => {
    try {
      if (editingConfig) {
        await updatePaymentConfig(editingConfig.id, data);
        toast({
          title: "Success",
          description: "Payment configuration updated successfully",
        });
      } else {
        await createPaymentConfig(data);
        toast({
          title: "Success", 
          description: "Payment configuration created successfully",
        });
      }
      
      setDialogOpen(false);
      setEditingConfig(null);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (config: PaymentConfig) => {
    if (window.confirm(`Are you sure you want to delete the ${config.currency} ${config.plan_type} configuration?`)) {
      try {
        await deletePaymentConfig(config.id);
        toast({
          title: "Success",
          description: "Payment configuration deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete configuration",
          variant: "destructive",
        });
      }
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const symbol = currency === 'BRL' ? 'R$' : '$';
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  const openCreateDialog = () => {
    setEditingConfig(null);
    setDialogOpen(true);
  };

  const openEditDialog = (config: PaymentConfig) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payment Configuration</h2>
          <p className="text-muted-foreground">
            Manage pricing for different plans and currencies
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? 'Edit Payment Configuration' : 'Create Payment Configuration'}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD - United States Dollar</SelectItem>
                          <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plan_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select plan type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price_cents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (in cents)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          placeholder="1200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Percentage</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          placeholder="0"
                          min="0"
                          max="100"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    {editingConfig ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Configurations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paymentConfigs.map((config) => (
          <Card key={config.id} className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-foreground">
                  {config.currency} - {config.plan_type}
                </CardTitle>
                <Badge 
                  variant={config.status === 'live' ? 'default' : 'secondary'}
                  className={config.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                >
                  {config.status}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold text-foreground">
                  {formatPrice(config.price_cents, config.currency)}
                </span>
                {config.discount_percentage > 0 && (
                  <Badge variant="outline" className="text-xs">
                    -{config.discount_percentage}%
                  </Badge>
                )}
              </div>
              
              {config.stripe_price_id && (
                <div className="text-xs text-muted-foreground">
                  Stripe ID: {config.stripe_price_id}
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                Created: {new Date(config.created_at).toLocaleDateString()}
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(config)}
                  className="flex-1"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(config)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {paymentConfigs.length === 0 && !loadingConfigs && (
          <div className="col-span-full">
            <Card className="border-dashed border-2 border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No payment configurations found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first payment configuration to get started.
                </p>
                <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Configuration
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};