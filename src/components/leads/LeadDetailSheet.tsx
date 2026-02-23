import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Phone,
  DollarSign,
  Building2,
  Pencil,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLeadDetail, useLeadInteractionMutations } from '@/hooks/useLeads';
import { useProjects } from '@/hooks/useProjects';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_CONFIG } from '@/types/leads';
import type { LeadInteractionFormValues } from '@/types/leads';

interface Props {
  leadId: string | null;
  onClose: () => void;
  onEditLead: (leadId: string) => void;
}

const LeadDetailSheet: React.FC<Props> = ({ leadId, onClose, onEditLead }) => {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const [showProjectSelect, setShowProjectSelect] = useState(false);

  const { data, isLoading } = useLeadDetail(leadId ?? undefined);
  const { data: allProjects = [] } = useProjects(
    showProjectSelect ? activeWorkspace?.id : undefined
  );

  const { createInteraction, deleteInteraction, linkProject, unlinkProject } =
    useLeadInteractionMutations(leadId ?? '');

  const { register, handleSubmit, reset, formState: { isSubmitting } } =
    useForm<LeadInteractionFormValues>({ defaultValues: { content: '' } });

  const onAddInteraction = async (values: LeadInteractionFormValues) => {
    if (!values.content.trim()) return;
    await createInteraction.mutateAsync(values);
    reset();
  };

  const linkedProjectIds = new Set(data?.linkedProjects.map((lp) => lp.project_id) ?? []);
  const availableProjects = allProjects.filter((p) => !linkedProjectIds.has(p.id));

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Sheet open={!!leadId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:!max-w-lg overflow-y-auto">
        {isLoading || !data ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="pr-8">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg leading-tight break-words">
                    {data.lead.name}
                  </SheetTitle>
                  {data.lead.company && (
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {data.lead.company}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onEditLead(data.lead.id)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Status + source badges */}
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${LEAD_STATUS_CONFIG[data.lead.kanban_status].badgeClass}`}
                >
                  {LEAD_STATUS_CONFIG[data.lead.kanban_status].label}
                </Badge>
                <Badge variant="outline" className="text-xs text-sky-600 border-sky-300 bg-sky-50">
                  {LEAD_SOURCE_LABELS[data.lead.source]}
                </Badge>
              </div>
            </SheetHeader>

            {/* ── Lead info ─────────────────────────────────────────────── */}
            <div className="mt-4 space-y-2">
              {data.lead.email && (
                <a
                  href={`mailto:${data.lead.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="group-hover:underline">{data.lead.email}</span>
                </a>
              )}
              {data.lead.phone && (
                <a
                  href={`tel:${data.lead.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="group-hover:underline">{data.lead.phone}</span>
                </a>
              )}
              {data.lead.estimated_value != null && data.lead.estimated_value > 0 && (
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  {formatCurrency(data.lead.estimated_value)}
                </p>
              )}
              {data.lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.lead.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {data.lead.notes && (
                <p className="text-sm text-muted-foreground bg-gray-50 rounded-md px-3 py-2 mt-2">
                  {data.lead.notes}
                </p>
              )}
            </div>

            {/* ── Linked projects ───────────────────────────────────────── */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Projetos vinculados</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1"
                  onClick={() => setShowProjectSelect((v) => !v)}
                >
                  <Plus className="h-3 w-3" />
                  Vincular
                </Button>
              </div>

              {showProjectSelect && (
                <div className="mb-2">
                  <Select
                    onValueChange={(projectId) => {
                      linkProject.mutate(projectId, {
                        onSuccess: () => setShowProjectSelect(false),
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar projeto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhum projeto disponível
                        </div>
                      ) : (
                        availableProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {data.linkedProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 py-2">Nenhum projeto vinculado</p>
              ) : (
                <div className="space-y-1.5">
                  {data.linkedProjects.map((lp) => (
                    <div
                      key={lp.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-gray-50 px-3 py-2"
                    >
                      <button
                        className="flex-1 text-left text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 min-w-0"
                        onClick={() => {
                          onClose();
                          navigate(`/projects/${lp.project_id}`);
                        }}
                      >
                        <span className="truncate">{lp.project?.name ?? 'Projeto'}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                      </button>
                      {lp.project?.status && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {lp.project.status}
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground/50 hover:text-red-500 shrink-0"
                        onClick={() => unlinkProject.mutate(lp.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Interaction history ───────────────────────────────────── */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Histórico de interações
              </h3>

              {/* Add interaction */}
              <form onSubmit={handleSubmit(onAddInteraction)} className="space-y-2 mb-4">
                <Textarea
                  placeholder="Adicionar nota... Ex: Liguei para o cliente, ficou de retornar na segunda."
                  rows={2}
                  className="text-sm resize-none"
                  {...register('content', { required: true })}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || createInteraction.isPending}
                    className="h-7 text-xs"
                  >
                    Salvar nota
                  </Button>
                </div>
              </form>

              {/* Interactions list */}
              {data.interactions.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 py-2 text-center">
                  Nenhuma interação registrada
                </p>
              ) : (
                <div className="space-y-3">
                  {data.interactions.map((interaction) => (
                    <div key={interaction.id} className="group rounded-md border bg-gray-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <span className="font-medium">
                              {interaction.author?.email?.split('@')[0] ?? 'Usuário'}
                            </span>
                            <span>·</span>
                            <span
                              title={format(
                                new Date(interaction.created_at),
                                "dd/MM/yyyy 'às' HH:mm",
                                { locale: ptBR }
                              )}
                            >
                              {formatDistanceToNow(new Date(interaction.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </p>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {interaction.content}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-red-500 shrink-0"
                          onClick={() => deleteInteraction.mutate(interaction.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default LeadDetailSheet;
