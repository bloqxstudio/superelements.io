import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Calendar, DollarSign, User, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PROJECT_STATUS_CONFIG } from '@/types/projects';
import type { Project } from '@/types/projects';

interface Props {
  project: Project;
  taskCount?: number;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
}

const ProjectCard: React.FC<Props> = ({ project, taskCount, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const statusCfg = PROJECT_STATUS_CONFIG[project.status];

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover o projeto "${project.name}"? Esta ação não pode ser desfeita.`)) return;
    onDelete(project.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(project);
  };

  return (
    <div
      className="group cursor-pointer rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge variant="outline" className={cn('text-xs shrink-0', statusCfg.badgeClass)}>
            {statusCfg.label}
          </Badge>
          {project.client_account && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5 truncate max-w-[140px]">
              <User className="h-3 w-3 shrink-0" />
              {project.client_account.name}
            </span>
          )}
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-lg"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-3 font-semibold text-gray-900 leading-snug truncate">
        {project.name}
      </h3>

      {/* Description */}
      {project.description && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Meta */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {project.deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(project.deadline), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        )}
        {project.budget != null && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {formatCurrency(project.budget)}
          </span>
        )}
        {taskCount != null && (
          <span>{taskCount} {taskCount === 1 ? 'tarefa' : 'tarefas'}</span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
        <span className="text-xs text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
          Ver kanban
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
};

export default ProjectCard;
