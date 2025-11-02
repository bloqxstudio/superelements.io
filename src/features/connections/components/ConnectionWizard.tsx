
import React, { useState, useEffect } from 'react';
import { useConnectionsStore, WordPressConnection } from '@/store/connectionsStore';
import { WordPressPostTypeService } from '@/services/wordPressPostTypeService';
import { extractWordPressInfo, isValidUrl, URL_EXAMPLES } from '@/utils/wordpressUrlUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2, Globe, Users, Crown, Link, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingConnectionId?: string;
}

interface ValidationResult {
  isValid: boolean;
  hasAuth: boolean;
  error?: string;
}

export const ConnectionWizard: React.FC<ConnectionWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingConnectionId
}) => {
  const { addConnection, updateConnection, getConnectionById } = useConnectionsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [extractedInfo, setExtractedInfo] = useState<{ baseUrl: string; postType: string } | null>(null);

  // Form state - simplified
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    postType: 'posts',
    username: '',
    applicationPassword: '',
    isActive: true,
    userType: 'all' as 'free' | 'pro' | 'all'
  });

  // Load existing connection data for editing
  useEffect(() => {
    if (editingConnectionId) {
      const connection = getConnectionById(editingConnectionId);
      if (connection) {
        setFormData({
          name: connection.name,
          baseUrl: connection.base_url,
          postType: connection.post_type,
          username: connection.credentials?.username || '',
          applicationPassword: connection.credentials?.application_password || '',
          isActive: connection.isActive,
          userType: connection.userType
        });
        setUrlInput(connection.base_url);
      }
    }
  }, [editingConnectionId, getConnectionById]);

  // Handle URL input change and extract info
  const handleUrlInputChange = (value: string) => {
    setUrlInput(value);
    
    if (value.trim() && isValidUrl(value)) {
      const info = extractWordPressInfo(value);
      
      if (info.isValid) {
        const newExtractedInfo = {
          baseUrl: info.baseUrl,
          postType: info.postType || 'posts'
        };
        
        setExtractedInfo(newExtractedInfo);
        
        // Auto-fill form fields
        setFormData(prev => ({
          ...prev,
          baseUrl: newExtractedInfo.baseUrl,
          postType: newExtractedInfo.postType,
          // Auto-generate name from URL if not editing
          name: !editingConnectionId && !prev.name ? 
            new URL(info.baseUrl).hostname.replace('www.', '') : prev.name
        }));
        
        if (info.postType) {
          toast.success(`Post type detectado: ${info.postType}`);
        }
      } else {
        setExtractedInfo(null);
        toast.error('URL inválida');
      }
    } else {
      setExtractedInfo(null);
    }
  };

  const validateConnection = async () => {
    if (!formData.baseUrl || !formData.username || !formData.applicationPassword) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setIsLoading(true);
    try {
      const result = await WordPressPostTypeService.validateWordPressSite({
        baseUrl: formData.baseUrl,
        username: formData.username,
        applicationPassword: formData.applicationPassword
      });

      setValidation(result);

      if (result.isValid) {
        toast.success('Conexão validada com sucesso!');
      } else {
        toast.error(result.error || 'Falha na validação da conexão');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidation({
        isValid: false,
        hasAuth: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      toast.error('Falha ao validar conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Por favor, insira um nome de exibição');
      return;
    }

    if (!formData.baseUrl || !formData.username || !formData.applicationPassword) {
      toast.error('Por favor, preencha todos os campos de conexão');
      return;
    }

    setIsLoading(true);
    try {
      const connectionData: Omit<WordPressConnection, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
        name: formData.name,
        base_url: formData.baseUrl,
        post_type: formData.postType,
        json_field: '_elementor_data', // Valor padrão fixo
        preview_field: 'link', // Valor padrão fixo
        credentials: {
          username: formData.username,
          application_password: formData.applicationPassword,
        },
        status: 'connected',
        isActive: formData.isActive,
        userType: formData.userType,
        lastTested: new Date(),
        componentsCount: 0
      };

      if (editingConnectionId) {
        await updateConnection(editingConnectionId, connectionData);
        toast.success('Conexão atualizada com sucesso!');
      } else {
        await addConnection(connectionData);
        toast.success('Conexão criada com sucesso!');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving connection:', error);
      toast.error(editingConnectionId ? 'Falha ao atualizar conexão' : 'Falha ao criar conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      baseUrl: '',
      postType: 'posts',
      username: '',
      applicationPassword: '',
      isActive: true,
      userType: 'all'
    });
    setValidation(null);
    setUrlInput('');
    setExtractedInfo(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'free':
        return <Users className="h-4 w-4" />;
      case 'pro':
        return <Crown className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingConnectionId ? 'Editar Conexão WordPress' : 'Adicionar Conexão WordPress'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL Input with Auto-Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                URL do WordPress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="urlInput">URL do WordPress *</Label>
                <Input
                  id="urlInput"
                  placeholder={URL_EXAMPLES[0]}
                  value={urlInput}
                  onChange={(e) => handleUrlInputChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Cole a URL do seu site WordPress ou de uma página específica do admin (ex: edit.php?post_type=...)
                </p>
              </div>

              {/* Extracted Info Display */}
              {extractedInfo && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 font-medium">Informações detectadas automaticamente:</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div><strong>Site:</strong> {extractedInfo.baseUrl}</div>
                    <div><strong>Tipo de Post:</strong> {extractedInfo.postType}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connection Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Detalhes da Conexão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome de Exibição *</Label>
                <Input
                  id="name"
                  placeholder="Meu Site WordPress"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nome de Usuário *</Label>
                  <Input
                    id="username"
                    placeholder="Nome de usuário do WordPress"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationPassword">Senha de Aplicação *</Label>
                  <Input
                    id="applicationPassword"
                    type="password"
                    placeholder="Senha de aplicação"
                    value={formData.applicationPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicationPassword: e.target.value }))}
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Para criar uma Senha de Aplicação: Vá em WordPress Admin → Usuários → Seu Perfil → Senhas de Aplicação
              </div>

              {/* Test Connection Button */}
              <Button 
                onClick={validateConnection} 
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando Conexão...
                  </>
                ) : (
                  'Testar Conexão'
                )}
              </Button>

              {/* Validation Results */}
              {validation && !validation.isValid && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-red-700">{validation.error}</p>
                </div>
              )}

              {validation?.isValid && (
                <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-green-700">Conexão validada com sucesso!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Exibição</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Conexão Ativa</Label>
                    <p className="text-sm text-muted-foreground">
                      Ativar esta conexão para mostrar componentes aos usuários
                    </p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                </div>

                <div>
                  <Label>Visibilidade por Tipo de Usuário</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Escolha quais usuários podem ver componentes desta conexão
                  </p>
                  <Select value={formData.userType} onValueChange={(value: 'free' | 'pro' | 'all') => setFormData(prev => ({ ...prev, userType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Todos os Usuários
                        </div>
                      </SelectItem>
                      <SelectItem value="free">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Apenas Usuários Gratuitos
                        </div>
                      </SelectItem>
                      <SelectItem value="pro">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          Apenas Usuários Pro
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingConnectionId ? 'Atualizar Conexão' : 'Criar Conexão'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
