import React, { useEffect, useState } from 'react';
import { useAdminStore, PlanFeature } from '@/store/adminStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2, Star, Crown } from 'lucide-react';

interface PlanFeatureForm {
  plan_name: 'starter' | 'pro';
  feature_name: string;
  feature_description: string;
  display_order: number;
  is_enabled: boolean;
}

export const PlanFeaturesManager = () => {
  const { 
    planFeatures, 
    loadingPlanFeatures, 
    fetchPlanFeatures,
    createPlanFeature,
    updatePlanFeature,
    deletePlanFeature
  } = useAdminStore();

  const [editingFeature, setEditingFeature] = useState<PlanFeature | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<PlanFeatureForm>({
    defaultValues: {
      plan_name: 'starter',
      feature_name: '',
      feature_description: '',
      display_order: 0,
      is_enabled: true
    }
  });

  useEffect(() => {
    fetchPlanFeatures();
  }, [fetchPlanFeatures]);

  useEffect(() => {
    if (editingFeature) {
      form.reset({
        plan_name: editingFeature.plan_name,
        feature_name: editingFeature.feature_name,
        feature_description: editingFeature.feature_description,
        display_order: editingFeature.display_order,
        is_enabled: editingFeature.is_enabled
      });
    } else {
      form.reset({
        plan_name: 'starter',
        feature_name: '',
        feature_description: '',
        display_order: 0,
        is_enabled: true
      });
    }
  }, [editingFeature, form]);

  const onSubmit = async (data: PlanFeatureForm) => {
    try {
      if (editingFeature) {
        await updatePlanFeature(editingFeature.id, data);
        toast({
          title: "Success",
          description: "Feature updated successfully",
        });
      } else {
        await createPlanFeature(data);
        toast({
          title: "Success", 
          description: "Feature created successfully",
        });
      }
      
      setDialogOpen(false);
      setEditingFeature(null);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save feature",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (feature: PlanFeature) => {
    if (window.confirm(`Are you sure you want to delete "${feature.feature_name}"?`)) {
      try {
        await deletePlanFeature(feature.id);
        toast({
          title: "Success",
          description: "Feature deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete feature",
          variant: "destructive",
        });
      }
    }
  };

  const openCreateDialog = () => {
    setEditingFeature(null);
    setDialogOpen(true);
  };

  const openEditDialog = (feature: PlanFeature) => {
    setEditingFeature(feature);
    setDialogOpen(true);
  };

  const allFeatures = [...planFeatures.starter, ...planFeatures.pro];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Plan Features</h2>
          <p className="text-muted-foreground">
            Manage features displayed for each pricing plan
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingFeature ? 'Edit Plan Feature' : 'Create Plan Feature'}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="plan_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="starter">STARTER</SelectItem>
                          <SelectItem value="pro">PRO</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feature_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feature Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Premium templates" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feature_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Brief description of the feature" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="display_order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enabled</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Show this feature on the pricing page
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    {editingFeature ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Features by Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Starter Features */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-gray-600" />
              STARTER Plan Features
              <Badge variant="secondary">{planFeatures.starter.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {planFeatures.starter.map((feature, index) => (
              <div key={feature.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {feature.feature_name}
                    </span>
                    {!feature.is_enabled && (
                      <Badge variant="outline" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {feature.feature_description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Order: {feature.display_order}
                  </p>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(feature)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(feature)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {planFeatures.starter.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No features configured for STARTER plan
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pro Features */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-[#D2F525]" />
              PRO Plan Features
              <Badge variant="secondary">{planFeatures.pro.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {planFeatures.pro.map((feature, index) => (
              <div key={feature.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {feature.feature_name}
                    </span>
                    {!feature.is_enabled && (
                      <Badge variant="outline" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {feature.feature_description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Order: {feature.display_order}
                  </p>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(feature)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(feature)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {planFeatures.pro.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No features configured for PRO plan
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};