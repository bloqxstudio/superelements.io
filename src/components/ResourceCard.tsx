import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, FileDown, Link as LinkIcon } from 'lucide-react';
import type { Resource } from '@/hooks/useResources';
import * as LucideIcons from 'lucide-react';

interface ResourceCardProps {
  resource: Resource;
}

export const ResourceCard = ({ resource }: ResourceCardProps) => {
  const handleAction = () => {
    if (resource.type === 'download') {
      // Trigger download
      window.open(resource.url, '_blank');
    } else {
      // Open link in new tab
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Dynamically get icon component
  const IconComponent = (LucideIcons as any)[resource.icon] || FileDown;

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-primary/10 p-3 w-fit">
            <IconComponent className="h-6 w-6 text-primary" />
          </div>
          {resource.category && (
            <Badge variant="secondary">{resource.category}</Badge>
          )}
        </div>
        <CardTitle className="mt-4">{resource.title}</CardTitle>
        {resource.description && (
          <CardDescription>{resource.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {resource.file_size && (
          <p className="text-sm text-muted-foreground">
            Tamanho: {resource.file_size}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleAction} 
          className="w-full"
          variant={resource.type === 'download' ? 'default' : 'outline'}
        >
          {resource.type === 'download' ? (
            <>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Acessar
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
