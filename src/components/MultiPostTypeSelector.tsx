
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Database, Settings, Infinity } from 'lucide-react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useWordPressConnection } from '@/hooks/useWordPressConnection';

interface WordPressPostType {
  name: string;
  slug: string;
  description: string;
  hierarchical: boolean;
  rest_base: string;
  labels?: {
    name?: string;
    singular_name?: string;
  };
}

interface MultiPostTypeSelectorProps {
  isVisible: boolean;
  onClose: () => void;
}

const MultiPostTypeSelector: React.FC<MultiPostTypeSelectorProps> = ({
  isVisible,
  onClose
}) => {
  const { postTypes, isLoading } = useWordPressStore();
  const { loadComponentsFromMultiplePostTypes } = useWordPressConnection();
  
  const [selectedPostTypes, setSelectedPostTypes] = useState<string[]>([]);
  const [limitPerPostType, setLimitPerPostType] = useState(1000);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [isUnlimitedMode, setIsUnlimitedMode] = useState(false);

  if (!isVisible) return null;

  const handlePostTypeToggle = (postTypeRestBase: string, checked: boolean) => {
    if (checked) {
      setSelectedPostTypes(prev => [...prev, postTypeRestBase]);
    } else {
      setSelectedPostTypes(prev => prev.filter(pt => pt !== postTypeRestBase));
    }
  };

  const handleSelectAll = () => {
    if (selectedPostTypes.length === postTypes.length) {
      setSelectedPostTypes([]);
    } else {
      setSelectedPostTypes(postTypes.map(pt => pt.rest_base));
    }
  };

  const handleLoadComponents = async () => {
    if (selectedPostTypes.length === 0) return;

    setIsLoadingComponents(true);
    try {
      const effectiveLimit = isUnlimitedMode ? Number.MAX_SAFE_INTEGER : limitPerPostType;
      await loadComponentsFromMultiplePostTypes(selectedPostTypes, effectiveLimit);
      onClose();
    } catch (error) {
      console.error('Failed to load components:', error);
    } finally {
      setIsLoadingComponents(false);
    }
  };

  const getPostTypeLabel = (postType: WordPressPostType) => {
    const label = postType.labels?.name || postType.name;
    const slug = postType.slug;
    const restBase = postType.rest_base;
    
    if (restBase !== slug) {
      return `${label} (${slug}) → API: ${restBase}`;
    }
    
    return `${label} (${slug})`;
  };

  const estimatedTotal = isUnlimitedMode 
    ? 'All available components' 
    : `Up to ${(selectedPostTypes.length * limitPerPostType).toLocaleString()} components`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Load from Multiple Post Types
            </CardTitle>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Select multiple post types to load components from. You can choose to load all components or set a limit per post type.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <h3 className="font-medium">Loading Settings</h3>
            </div>
            
            {/* Unlimited Mode Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Infinity className="h-4 w-4" />
                  <Label htmlFor="unlimited-mode" className="font-medium">Load All Components</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Load all available components without any limits (may take longer)
                </p>
              </div>
              <Switch
                id="unlimited-mode"
                checked={isUnlimitedMode}
                onCheckedChange={setIsUnlimitedMode}
              />
            </div>
            
            {!isUnlimitedMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="limitPerPostType">Components per Post Type</Label>
                  <Input
                    id="limitPerPostType"
                    type="number"
                    min="100"
                    max="5000"
                    step="100"
                    value={limitPerPostType}
                    onChange={(e) => setLimitPerPostType(parseInt(e.target.value) || 1000)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit components per post type for faster loading
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Estimated Total</Label>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-sm font-medium">
                      {estimatedTotal}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {selectedPostTypes.length} post types × {limitPerPostType} limit
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isUnlimitedMode && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                  <Infinity className="h-4 w-4" />
                  <span className="font-medium">Unlimited Mode Enabled</span>
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  All available components will be loaded. This may take several minutes depending on the amount of data.
                </p>
              </div>
            )}
          </div>

          {/* Post Type Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Available Post Types ({postTypes.length})</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={postTypes.length === 0}
              >
                {selectedPostTypes.length === postTypes.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {postTypes.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No post types available. Please check your connection.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {postTypes.map((postType) => (
                  <div
                    key={postType.slug}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <Checkbox
                      id={postType.slug}
                      checked={selectedPostTypes.includes(postType.rest_base)}
                      onCheckedChange={(checked) => 
                        handlePostTypeToggle(postType.rest_base, checked as boolean)
                      }
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={postType.slug}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {getPostTypeLabel(postType)}
                      </Label>
                      {postType.description && (
                        <p className="text-xs text-muted-foreground">
                          {postType.description}
                        </p>
                      )}
                      <div className="flex gap-1">
                        {postType.hierarchical && (
                          <Badge variant="secondary" className="text-xs">
                            Hierarchical
                          </Badge>
                        )}
                        {['post', 'page', 'attachment'].includes(postType.slug) && (
                          <Badge variant="outline" className="text-xs">
                            Built-in
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Summary */}
          {selectedPostTypes.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Selected Post Types ({selectedPostTypes.length})</h4>
              <div className="flex flex-wrap gap-2">
                {selectedPostTypes.map((restBase) => {
                  const postType = postTypes.find(pt => pt.rest_base === restBase);
                  return (
                    <Badge key={restBase} variant="default" className="text-xs">
                      {postType?.labels?.name || postType?.name || restBase}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Load Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleLoadComponents}
              disabled={selectedPostTypes.length === 0 || isLoadingComponents}
              className="w-full"
              size="lg"
            >
              {isLoadingComponents ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Components...
                </>
              ) : (
                <>
                  {isUnlimitedMode ? (
                    <Infinity className="mr-2 h-4 w-4" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  {isUnlimitedMode 
                    ? `Load All Components from ${selectedPostTypes.length} Post Types`
                    : `Load Components from ${selectedPostTypes.length} Post Types`
                  }
                </>
              )}
            </Button>
            
            {selectedPostTypes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                Please select at least one post type
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiPostTypeSelector;
