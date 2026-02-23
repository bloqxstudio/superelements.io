import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GripVertical, Pencil, Clock, DollarSign, Calendar, User, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProjectTask } from '@/types/projects';

interface Props {
  task: ProjectTask;
  projectName: string;
  onEdit: (task: ProjectTask) => void;
}

const UnifiedTaskCard: React.FC<Props> = ({ task, projectName, onEdit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white rounded-md border shadow-sm p-3 group select-none',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Arrastar tarefa"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Project badge */}
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              <FolderOpen className="h-2.5 w-2.5" />
              {projectName}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-snug break-words">{task.title}</p>

          {/* Service */}
          {task.service_catalog && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {task.service_catalog.name}
            </p>
          )}

          {/* Meta row: hours + cost */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.actual_hours > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.actual_hours}h
              </span>
            )}
            {task.task_cost != null && task.task_cost > 0 && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(task.task_cost)}
              </span>
            )}
          </div>

          {/* Due date + assignee */}
          <div className="mt-1.5 flex flex-col gap-1">
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                Prazo: {format(new Date(task.due_date), "dd 'de' MMM", { locale: ptBR })}
              </span>
            )}
            {task.assignee && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                {task.assignee.email.split('@')[0]}
              </span>
            )}
          </div>

          {/* Bottom row: billing badge + edit */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {task.billing_status === 'billed' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-teal-600 border-teal-300 bg-teal-50">
                  Faturado
                </Badge>
              )}
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedTaskCard;
