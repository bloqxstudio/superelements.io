import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GripVertical, Pencil, DollarSign, Trophy, X, Building2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types/leads';
import { LEAD_SOURCE_LABELS } from '@/types/leads';

interface Props {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onClick: (lead: Lead) => void;
}

const LeadCard: React.FC<Props> = ({ lead, onEdit, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const isWon = lead.kanban_status === 'won';
  const isLost = lead.kanban_status === 'lost';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white rounded-md border shadow-sm p-3 group select-none cursor-pointer',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30'
      )}
      onClick={(e) => {
        // Don't open detail if clicking the edit button or drag handle
        if ((e.target as HTMLElement).closest('[data-no-detail]')) return;
        onClick(lead);
      }}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          data-no-detail
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Arrastar lead"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Name + terminal icon */}
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-medium leading-snug break-words flex-1">{lead.name}</p>
            {isWon && <Trophy className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
            {isLost && <X className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />}
          </div>

          {/* Company */}
          {lead.company && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
              <Building2 className="h-3 w-3 shrink-0" />
              {lead.company}
            </p>
          )}

          {/* Estimated value */}
          {lead.estimated_value != null && lead.estimated_value > 0 && (
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(lead.estimated_value)}
            </p>
          )}

          {/* Source badge + tags */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-sky-600 border-sky-300 bg-sky-50"
            >
              {LEAD_SOURCE_LABELS[lead.source]}
            </Badge>
            {lead.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-gray-500 border-gray-200"
              >
                {tag}
              </Badge>
            ))}
            {lead.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{lead.tags.length - 3}</span>
            )}
          </div>

          {/* Quick note preview */}
          {lead.notes && (
            <p className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1 line-clamp-2">
              <FileText className="h-3 w-3 shrink-0 mt-0.5" />
              {lead.notes}
            </p>
          )}

          {/* Edit button */}
          <div className="mt-2 flex justify-end">
            <Button
              data-no-detail
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(lead);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadCard;
