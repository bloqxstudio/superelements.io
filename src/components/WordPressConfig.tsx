
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface WordPressConfig {
  baseUrl: string;
  postType: string;
  jsonField: string;
  previewField: string;
  username: string;
  applicationPassword: string;
}

interface WordPressConfigProps {
  config: WordPressConfig;
  isConnected: boolean;
  onConfigChange: (config: WordPressConfig) => void;
  onFetch: () => void;
  onTestConnection: () => void;
  onReset: () => void;
  isLoading: boolean;
  isLoadingPostTypes: boolean;
}

const WordPressConfig: React.FC<WordPressConfigProps> = ({
  config,
  isConnected,
  onConfigChange,
  onFetch,
  onTestConnection,
  onReset,
  isLoading,
  isLoadingPostTypes
}) => {
  const handleInputChange = (field: keyof WordPressConfig, value: string) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const handleReset = () => {
    onConfigChange({
      baseUrl: '',
      postType: 'posts',
      jsonField: '_elementor_data',
      previewField: 'link',
      username: '',
      applicationPassword: ''
    });
    onReset();
  };

  const canTestConnection = config.baseUrl && config.username && config.applicationPassword;
  const canFetchComponents = isConnected;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">WordPress Connection</CardTitle>
          <Button 
            onClick={handleReset} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              1
            </div>
            <h3 className="font-medium">WordPress Connection Details</h3>
            {isConnected && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">WordPress Site URL *</Label>
              <Input
                id="baseUrl"
                placeholder="https://your-wordpress-site.com"
                value={config.baseUrl}
                onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                disabled={isLoadingPostTypes}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">WordPress Username *</Label>
              <Input
                id="username"
                placeholder="your-username"
                value={config.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                disabled={isLoadingPostTypes}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="applicationPassword">Application Password *</Label>
              <Input
                id="applicationPassword"
                type="password"
                placeholder="Generate this in WordPress Admin → Users → Your Profile"
                value={config.applicationPassword}
                onChange={(e) => handleInputChange('applicationPassword', e.target.value)}
                disabled={isLoadingPostTypes}
              />
              <p className="text-xs text-muted-foreground">
                To create an Application Password: Go to WordPress Admin → Users → Your Profile → Application Passwords
              </p>
            </div>
          </div>

          <div className="ml-8">
            <Button 
              onClick={onTestConnection} 
              disabled={!canTestConnection || isLoadingPostTypes}
              variant={isConnected ? "outline" : "default"}
              className="w-full md:w-auto"
            >
              {isLoadingPostTypes ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Connection...
                </>
              ) : isConnected ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Connection Successful
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            
            {!canTestConnection && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Please fill in all required fields above
              </div>
            )}
          </div>
        </div>

        {/* Fetch Components Button */}
        {canFetchComponents && (
          <div className="pt-4">
            <Button 
              onClick={onFetch} 
              disabled={isLoading || !canFetchComponents}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching Content...
                </>
              ) : (
                'Fetch Content'
              )}
            </Button>
            
            <div className="mt-2 text-sm text-muted-foreground">
              <p>This will load components from your WordPress site.</p>
            </div>
          </div>
        )}
        
        {/* Help text */}
        {!isConnected && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Need Help?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Make sure your WordPress site is accessible</li>
              <li>• Create an Application Password in WordPress Admin</li>
              <li>• Ensure the REST API is enabled on your WordPress site</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WordPressConfig;
