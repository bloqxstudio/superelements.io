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
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KANBAN_COLUMNS } from '@/types/projects';
import type { ProjectTask, TaskStatus } from '@/types/projects';
import TaskCard from './TaskCard';

// ── Droppable column ──────────────────────────────────────────────────────────

interface ColumnProps {
  columnId: TaskStatus;
  label: string;
  colorClass: string;
  headerClass: string;
  tasks: ProjectTask[];
  onEdit: (task: ProjectTask) => void;
  onAddTask: (status: TaskStatus) => void;
}

const KanbanColumn: React.FC<ColumnProps> = ({
  columnId,
  label,
  colorClass,
  headerClass,
  tasks,
  onEdit,
  onAddTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div className={cn('flex flex-col rounded-lg border w-72 shrink-0', colorClass, isOver && 'ring-2 ring-primary/50')}>
      {/* Column header */}
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-lg', headerClass)}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{label}</span>
          <span className="text-xs bg-white/60 rounded-full px-1.5 py-0.5 font-medium">
            {tasks.length}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 hover:bg-white/40"
          onClick={() => onAddTask(columnId)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <p className="text-xs text-center text-muted-foreground/60 py-4">
            Nenhuma tarefa
          </p>
        )}
      </div>
    </div>
  );
};

// ── Main Kanban board ─────────────────────────────────────────────────────────

interface Props {
  tasks: ProjectTask[];
  onTasksChange: (
    affectedTasks: Array<{ id: string; kanban_status: TaskStatus; position: number }>
  ) => void;
  onEditTask: (task: ProjectTask) => void;
  onAddTask: (status: TaskStatus) => void;
}

const COLUMN_IDS = new Set(KANBAN_COLUMNS.map((c) => c.id as string));

const ProjectKanban: React.FC<Props> = ({ tasks, onTasksChange, onEditTask, onAddTask }) => {
  const [activeTask, setActiveTask] = React.useState<ProjectTask | null>(null);
  // Track which column the drag is currently over (for live feedback)
  const [overColumn, setOverColumn] = React.useState<TaskStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByColumn = useCallback(
    (columnId: TaskStatus) =>
      tasks
        .filter((t) => t.kanban_status === columnId)
        .sort((a, b) => a.position - b.position),
    [tasks]
  );

  // Resolve which column an over-id belongs to
  const resolveColumn = useCallback(
    (overId: string): TaskStatus | null => {
      if (COLUMN_IDS.has(overId)) return overId as TaskStatus;
      const overTask = tasks.find((t) => t.id === overId);
      return overTask?.kanban_status ?? null;
    },
    [tasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverColumn(null); return; }
    setOverColumn(resolveColumn(String(over.id)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    setOverColumn(null);

    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const destColumn = resolveColumn(String(over.id));
    if (!destColumn) return;

    // overTask: only when dropping onto another task (not a column droppable)
    const overTask = COLUMN_IDS.has(String(over.id))
      ? undefined
      : tasks.find((t) => t.id === over.id);

    const sourceCol = tasksByColumn(draggedTask.kanban_status).filter((t) => t.id !== draggedTask.id);
    const destCol   = tasksByColumn(destColumn).filter((t) => t.id !== draggedTask.id);

    // Determine insertion index
    let insertIndex = destCol.length;
    if (overTask && overTask.kanban_status === destColumn) {
      const idx = destCol.findIndex((t) => t.id === overTask.id);
      if (idx !== -1) insertIndex = idx;
    }

    destCol.splice(insertIndex, 0, { ...draggedTask, kanban_status: destColumn });

    // Collect all tasks whose status or position changed
    const affectedTasks: Array<{ id: string; kanban_status: TaskStatus; position: number }> = [];

    sourceCol.forEach((t, i) => {
      if (t.position !== i || t.kanban_status !== draggedTask.kanban_status) {
        affectedTasks.push({ id: t.id, kanban_status: draggedTask.kanban_status, position: i });
      }
    });

    destCol.forEach((t, i) => {
      affectedTasks.push({ id: t.id, kanban_status: destColumn, position: i });
    });

    if (affectedTasks.length > 0) {
      onTasksChange(affectedTasks);
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
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            columnId={col.id}
            label={col.label}
            colorClass={col.colorClass}
            headerClass={col.headerClass}
            tasks={tasksByColumn(col.id)}
            onEdit={onEditTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      {/* Drag overlay: plain div, not sortable — avoids phantom node interference */}
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="rotate-1 opacity-90 pointer-events-none">
            <TaskCard task={activeTask} onEdit={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default ProjectKanban;
