import React, { useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Plus, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEAD_KANBAN_COLUMNS } from '@/types/leads';
import type { Lead, LeadStatus } from '@/types/leads';
import LeadCard from './LeadCard';

// ── Droppable column ──────────────────────────────────────────────────────────

interface ColumnProps {
  columnId: LeadStatus;
  label: string;
  colorClass: string;
  headerClass: string;
  terminal?: boolean;
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onClick: (lead: Lead) => void;
  onAddLead: (status: LeadStatus) => void;
}

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const KanbanColumn: React.FC<ColumnProps> = ({
  columnId,
  label,
  colorClass,
  headerClass,
  terminal,
  leads,
  onEdit,
  onClick,
  onAddLead,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);

  return (
    <div className={cn('flex flex-col rounded-lg border w-72 shrink-0', colorClass, isOver && 'ring-2 ring-primary/50')}>
      {/* Column header */}
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-lg', headerClass)}>
        <div className="flex items-center gap-2">
          {terminal && columnId === 'won' && <Trophy className="h-3 w-3" />}
          {terminal && columnId === 'lost' && <X className="h-3 w-3" />}
          <span className="text-xs font-semibold">{label}</span>
          <span className="text-xs bg-white/60 rounded-full px-1.5 py-0.5 font-medium">
            {leads.length}
          </span>
          {totalValue > 0 && (
            <span className="text-xs bg-white/60 rounded-full px-1.5 py-0.5 font-medium">
              {formatCurrency(totalValue)}
            </span>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 hover:bg-white/40"
          onClick={() => onAddLead(columnId)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Lead list */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]"
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onEdit={onEdit} onClick={onClick} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <p className="text-xs text-center text-muted-foreground/60 py-4">
            Nenhum lead
          </p>
        )}
      </div>
    </div>
  );
};

// ── Main Kanban board ─────────────────────────────────────────────────────────

interface Props {
  leads: Lead[];
  onLeadsChange: (
    affected: Array<{ id: string; kanban_status: LeadStatus; position: number }>
  ) => void;
  onEditLead: (lead: Lead) => void;
  onLeadClick: (lead: Lead) => void;
  onAddLead: (status: LeadStatus) => void;
}

const COLUMN_IDS = new Set(LEAD_KANBAN_COLUMNS.map((c) => c.id as string));

const LeadKanban: React.FC<Props> = ({
  leads,
  onLeadsChange,
  onEditLead,
  onLeadClick,
  onAddLead,
}) => {
  const [activeLead, setActiveLead] = React.useState<Lead | null>(null);
  const [overColumn, setOverColumn] = React.useState<LeadStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const leadsByColumn = useCallback(
    (columnId: LeadStatus) =>
      leads
        .filter((l) => l.kanban_status === columnId)
        .sort((a, b) => a.position - b.position),
    [leads]
  );

  const resolveColumn = useCallback(
    (overId: string): LeadStatus | null => {
      if (COLUMN_IDS.has(overId)) return overId as LeadStatus;
      const overLead = leads.find((l) => l.id === overId);
      return overLead?.kanban_status ?? null;
    },
    [leads]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverColumn(null); return; }
    setOverColumn(resolveColumn(String(over.id)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    setOverColumn(null);

    const { active, over } = event;
    if (!over) return;

    const draggedLead = leads.find((l) => l.id === active.id);
    if (!draggedLead) return;

    const destColumn = resolveColumn(String(over.id));
    if (!destColumn) return;

    const overLead = COLUMN_IDS.has(String(over.id))
      ? undefined
      : leads.find((l) => l.id === over.id);

    const sourceCol = leadsByColumn(draggedLead.kanban_status).filter((l) => l.id !== draggedLead.id);
    const destCol   = leadsByColumn(destColumn).filter((l) => l.id !== draggedLead.id);

    let insertIndex = destCol.length;
    if (overLead && overLead.kanban_status === destColumn) {
      const idx = destCol.findIndex((l) => l.id === overLead.id);
      if (idx !== -1) insertIndex = idx;
    }

    destCol.splice(insertIndex, 0, { ...draggedLead, kanban_status: destColumn });

    const affected: Array<{ id: string; kanban_status: LeadStatus; position: number }> = [];

    sourceCol.forEach((l, i) => {
      if (l.position !== i || l.kanban_status !== draggedLead.kanban_status) {
        affected.push({ id: l.id, kanban_status: draggedLead.kanban_status, position: i });
      }
    });

    destCol.forEach((l, i) => {
      affected.push({ id: l.id, kanban_status: destColumn, position: i });
    });

    if (affected.length > 0) {
      onLeadsChange(affected);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {LEAD_KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            columnId={col.id}
            label={col.label}
            colorClass={col.colorClass}
            headerClass={col.headerClass}
            terminal={col.terminal}
            leads={leadsByColumn(col.id)}
            onEdit={onEditLead}
            onClick={onLeadClick}
            onAddLead={onAddLead}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead && (
          <div className="rotate-1 opacity-90 pointer-events-none">
            <LeadCard lead={activeLead} onEdit={() => {}} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default LeadKanban;
