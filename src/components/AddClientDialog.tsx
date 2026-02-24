import React, { useState } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WordPressPostTypeService } from '@/services/wordPressPostTypeService';
import { extractWordPressInfo, isValidUrl } from '@/utils/wordpressUrlUtils';
import { slugify } from '@/utils/slugify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Globe,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  User,
  KeyRound,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AddClientDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (clientId: string) => void;
}

type Step = 'url' | 'credentials' | 'confirm';

interface FormState {
  url: string;
  baseUrl: string;
  name: string;
  username: string;
  applicationPassword: string;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const AddClientDialog: React.FC<AddClientDialogProps> = ({ open, onClose, onSuccess }) => {
  const { addConnection } = useConnectionsStore();
  const { activeWorkspace } = useWorkspace();

  const [step, setStep] = useState<Step>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [form, setForm] = useState<FormState>({
    url: '',
    baseUrl: '',
    name: '',
    username: '',
    applicationPassword: '',
  });

  const updateForm = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleUrlNext = () => {
    if (!form.url.trim()) {
      toast.error('Informe a URL do site WordPress');
      return;
    }
    if (!isValidUrl(form.url)) {
      toast.error('URL inválida. Exemplo: https://meucliente.com');
      return;
    }
    const info = extractWordPressInfo(form.url);
    const baseUrl = info.isValid ? info.baseUrl : form.url.trim();
    const autoName = (() => {
      try {
        return new URL(baseUrl).hostname.replace(/^www\./, '');
      } catch {
        return baseUrl;
      }
    })();
    updateForm({ baseUrl, name: form.name || autoName });
    setStep('credentials');
  };

  const handleTestAndSave = async () => {
    if (!form.username.trim() || !form.applicationPassword.trim()) {
      toast.error('Preencha usuário e senha de aplicação');
      return;
    }

    setIsLoading(true);
    setValidation(null);

    try {
      const result = await WordPressPostTypeService.validateWordPressSite({
        baseUrl: form.baseUrl,
        username: form.username,
        applicationPassword: form.applicationPassword,
      });

      setValidation(result);

      if (result.isValid) {
        setStep('confirm');
      } else {
        toast.error(result.error || 'Não foi possível conectar ao site');
      }
    } catch {
      const err = { isValid: false, error: 'Erro ao tentar conectar. Verifique as credenciais.' };
      setValidation(err);
      toast.error(err.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) {
      toast.error('Selecione um workspace antes de continuar');
      return;
    }

    setIsLoading(true);
    try {
      const id = await addConnection({
        name: form.name || form.baseUrl,
        slug: slugify(form.name || form.baseUrl),
        base_url: form.baseUrl,
        post_type: 'posts',
        json_field: '_elementor_data',
        preview_field: 'link',
        credentials: {
          username: form.username,
          application_password: form.applicationPassword,
        },
        status: 'connected',
        isActive: true,
        userType: 'all',
        accessLevel: 'free',
        lastTested: new Date(),
        componentsCount: 0,
        connection_type: 'client_account',
        workspace_id: activeWorkspace.id,
      });

      toast.success(`Cliente "${form.name || form.baseUrl}" adicionado com sucesso!`);
      handleClose();
      onSuccess?.(id);
    } catch {
      toast.error('Erro ao salvar o cliente. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('url');
    setForm({ url: '', baseUrl: '', name: '', username: '', applicationPassword: '' });
    setValidation(null);
    setIsLoading(false);
    onClose();
  };

  const stepIndex = step === 'url' ? 0 : step === 'credentials' ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Adicionar novo cliente</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Conecte o site WordPress do seu cliente em poucos passos.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-2">
          {(['url', 'credentials', 'confirm'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors',
                  stepIndex > i
                    ? 'bg-green-500 text-white'
                    : stepIndex === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {stepIndex > i ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 rounded-full transition-colors',
                    stepIndex > i ? 'bg-green-400' : 'bg-gray-200'
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 -mt-1 mb-3">
          <span>URL do site</span>
          <span>Credenciais</span>
          <span>Confirmar</span>
        </div>

        {/* Step: URL */}
        {step === 'url' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <Globe className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                Informe a URL do site WordPress do cliente para começar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-url">URL do site *</Label>
              <Input
                id="client-url"
                placeholder="https://meucliente.com.br"
                value={form.url}
                onChange={(e) => updateForm({ url: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlNext()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Cole a URL principal do site WordPress do cliente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-name">Nome do cliente (opcional)</Label>
              <Input
                id="client-name"
                placeholder="Ex: Loja do João"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Se deixar em branco, usaremos o domínio do site automaticamente.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleUrlNext}>
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Credentials */}
        {step === 'credentials' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <KeyRound className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Conectando a <strong>{form.baseUrl}</strong>. Informe as credenciais de acesso ao WordPress.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wp-username">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Usuário do WordPress *
                </span>
              </Label>
              <Input
                id="wp-username"
                placeholder="admin"
                value={form.username}
                onChange={(e) => updateForm({ username: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wp-password">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Senha de Aplicação *
                </span>
              </Label>
              <Input
                id="wp-password"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={form.applicationPassword}
                onChange={(e) => updateForm({ applicationPassword: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Crie em: <strong>WordPress Admin → Usuários → Seu Perfil → Senhas de Aplicação</strong>
              </p>
            </div>

            {validation && !validation.isValid && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{validation.error}</p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('url')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleTestAndSave} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Testar e continuar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700">
                Conexão verificada com sucesso! Confirme os dados antes de salvar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-name">Nome do cliente *</Label>
              <Input
                id="confirm-name"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="Nome do cliente"
                autoFocus
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Site</span>
                <span className="font-medium truncate max-w-[200px]">{form.baseUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usuário</span>
                <span className="font-medium">{form.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Workspace</span>
                <span className="font-medium">{activeWorkspace?.name ?? '—'}</span>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('credentials')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Adicionar cliente'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
