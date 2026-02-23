import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useProjects } from '@/hooks/useProjects';
import { useProjectTaskMutations } from '@/hooks/useProjectTasks';
import { useActiveServiceCatalog } from '@/hooks/useServiceCatalog';
import { useProjectsStore } from '@/store/projectsStore';
import { supabase } from '@/integrations/supabase/client';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LayoutGrid, ArrowLeft, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { KANBAN_COLUMNS } from '@/types/projects';
import type { ProjectTask, TaskStatus, TaskFormValues } from '@/types/projects';
import UnifiedTaskCard from '@/components/projects/UnifiedTaskCard';
import TaskForm from '@/components/projects/TaskForm';

// ── Droppable column ──────────────────────────────────────────────────────────

interface ColumnProps {
  columnId: TaskStatus;
  label: string;
  colorClass: string;
  headerClass: string;
  tasks: Array<ProjectTask & { projectName: string }>;
  onEdit: (task: ProjectTask) => void;
}

const KanbanColumn: React.FC<ColumnProps> = ({ columnId, label, colorClass, headerClass, tasks, onEdit }) => {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div className={cn('flex flex-col rounded-lg border w-72 shrink-0', colorClass, isOver && 'ring-2 ring-primary/50')}>
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg', headerClass)}>
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs bg-white/60 rounded-full px-1.5 py-0.5 font-medium">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-320px)]"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <UnifiedTaskCard key={task.id} task={task} projectName={task.projectName} onEdit={onEdit} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="text-xs text-center text-muted-foreground/60 py-4">Nenhuma tarefa</p>
        )}
      </div>
    </div>
  );
};

// ── Board ─────────────────────────────────────────────────────────────────────

const COLUMN_IDS = new Set(KANBAN_COLUMNS.map((c) => c.id as string));

interface BoardProps {
  tasks: Array<ProjectTask & { projectName: string }>;
  projectIds: string[];
  onEditTask: (task: ProjectTask) => void;
}

const ProjectsOverviewBoard: React.FC<BoardProps> = ({ tasks, projectIds, onEditTask }) => {
  const [activeTask, setActiveTask] = useState<(ProjectTask & { projectName: string }) | null>(null);

  // Fixed pool of 20 mutation hooks (React rules compliant — hooks in fixed count)
  const mut0  = useProjectTaskMutations(projectIds[0]  ?? '');
  const mut1  = useProjectTaskMutations(projectIds[1]  ?? '');
  const mut2  = useProjectTaskMutations(projectIds[2]  ?? '');
  const mut3  = useProjectTaskMutations(projectIds[3]  ?? '');
  const mut4  = useProjectTaskMutations(projectIds[4]  ?? '');
  const mut5  = useProjectTaskMutations(projectIds[5]  ?? '');
  const mut6  = useProjectTaskMutations(projectIds[6]  ?? '');
  const mut7  = useProjectTaskMutations(projectIds[7]  ?? '');
  const mut8  = useProjectTaskMutations(projectIds[8]  ?? '');
  const mut9  = useProjectTaskMutations(projectIds[9]  ?? '');
  const mut10 = useProjectTaskMutations(projectIds[10] ?? '');
  const mut11 = useProjectTaskMutations(projectIds[11] ?? '');
  const mut12 = useProjectTaskMutations(projectIds[12] ?? '');
  const mut13 = useProjectTaskMutations(projectIds[13] ?? '');
  const mut14 = useProjectTaskMutations(projectIds[14] ?? '');
  const mut15 = useProjectTaskMutations(projectIds[15] ?? '');
  const mut16 = useProjectTaskMutations(projectIds[16] ?? '');
  const mut17 = useProjectTaskMutations(projectIds[17] ?? '');
  const mut18 = useProjectTaskMutations(projectIds[18] ?? '');
  const mut19 = useProjectTaskMutations(projectIds[19] ?? '');

  const mutationsArray = [
    mut0, mut1, mut2, mut3, mut4, mut5, mut6, mut7, mut8, mut9,
    mut10, mut11, mut12, mut13, mut14, mut15, mut16, mut17, mut18, mut19,
  ];

  const getMutation = useCallback((projectId: string) => {
    const idx = projectIds.indexOf(projectId);
    return idx >= 0 ? mutationsArray[idx] : null;
  }, [projectIds, mutationsArray]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tasksByColumn = useCallback(
    (columnId: TaskStatus) => tasks.filter((t) => t.kanban_status === columnId).sort((a, b) => a.position - b.position),
    [tasks]
  );

  const resolveColumn = useCallback((overId: string): TaskStatus | null => {
    if (COLUMN_IDS.has(overId)) return overId as TaskStatus;
    return tasks.find((t) => t.id === overId)?.kanban_status ?? null;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const destColumn = resolveColumn(String(over.id));
    if (!destColumn) return;

    const overTask = COLUMN_IDS.has(String(over.id)) ? undefined : tasks.find((t) => t.id === over.id);
    if (overTask && overTask.project_id !== draggedTask.project_id) return;

    const sourceCol = tasksByColumn(draggedTask.kanban_status).filter((t) => t.project_id === draggedTask.project_id && t.id !== draggedTask.id);
    const destCol   = tasksByColumn(destColumn).filter((t) => t.project_id === draggedTask.project_id && t.id !== draggedTask.id);

    let insertIndex = destCol.length;
    if (overTask && overTask.kanban_status === destColumn) {
      const idx = destCol.findIndex((t) => t.id === overTask.id);
      if (idx !== -1) insertIndex = idx;
    }
    destCol.splice(insertIndex, 0, { ...draggedTask, kanban_status: destColumn });

    const affectedTasks: Array<{ id: string; kanban_status: TaskStatus; position: number }> = [];
    sourceCol.forEach((t, i) => {
      if (t.position !== i || t.kanban_status !== draggedTask.kanban_status)
        affectedTasks.push({ id: t.id, kanban_status: draggedTask.kanban_status, position: i });
    });
    destCol.forEach((t, i) => affectedTasks.push({ id: t.id, kanban_status: destColumn, position: i }));

    if (affectedTasks.length > 0) getMutation(draggedTask.project_id)?.moveTask.mutate(affectedTasks);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            columnId={col.id}
            label={col.label}
            colorClass={col.colorClass}
            headerClass={col.headerClass}
            tasks={tasksByColumn(col.id) as Array<ProjectTask & { projectName: string }>}
            onEdit={onEditTask}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="rotate-1 opacity-90 pointer-events-none">
            <UnifiedTaskCard task={activeTask} projectName={activeTask.projectName} onEdit={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

// ── Animation variants ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// ── Main component ────────────────────────────────────────────────────────────

const ProjectsOverview: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const { data: projects = [], isLoading: projectsLoading } = useProjects(wsId);
  const { activeProjectIds, setActiveProjectIds } = useProjectsStore();

  // Person filter (local state — no need for store)
  const [activeAssigneeId, setActiveAssigneeId] = useState<string | null>(null);

  const visibleProjectIds = useMemo(() => {
    if (activeProjectIds === null) return projects.map((p) => p.id);
    return activeProjectIds;
  }, [activeProjectIds, projects]);

  const toggleProject = (projectId: string) => {
    const current = activeProjectIds === null ? projects.map((p) => p.id) : activeProjectIds;
    if (current.includes(projectId)) {
      const next = current.filter((id) => id !== projectId);
      setActiveProjectIds(next.length === projects.length ? null : next);
    } else {
      const next = [...current, projectId];
      setActiveProjectIds(next.length === projects.length ? null : next);
    }
  };

  // Fetch tasks for all visible projects in parallel
  const taskQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ['project-tasks-overview', project.id],
      enabled: visibleProjectIds.includes(project.id),
      staleTime: 15_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('project_tasks')
          .select('*, service_catalog:service_catalog(id, name, default_hourly_rate), assignee:assignee_id(id, email)')
          .eq('project_id', project.id)
          .order('kanban_status', { ascending: true })
          .order('position', { ascending: true });
        if (error) throw error;
        return (data ?? []).map((task) => ({ ...task, projectName: project.name })) as Array<ProjectTask & { projectName: string }>;
      },
    })),
  });

  // All tasks from visible projects (unfiltered by person)
  const allTasks = useMemo(() => {
    return taskQueries
      .filter((q, i) => visibleProjectIds.includes(projects[i]?.id ?? ''))
      .flatMap((q) => q.data ?? []);
  }, [taskQueries, visibleProjectIds, projects]);

  // Unique assignees across all loaded tasks
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((t) => {
      if (t.assignee) map.set(t.assignee.id, t.assignee.email);
    });
    return Array.from(map.entries()).map(([id, email]) => ({ id, email }));
  }, [allTasks]);

  // Tasks shown in the board (filtered by person if active)
  const visibleTasks = useMemo(() => {
    if (!activeAssigneeId) return allTasks;
    return allTasks.filter((t) => t.assignee_id === activeAssigneeId);
  }, [allTasks, activeAssigneeId]);

  const isLoadingTasks = taskQueries.some((q) => q.isLoading);

  // Edit task dialog
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const needsFormData = !!editingTask;

  const { data: services = [] } = useActiveServiceCatalog(needsFormData ? wsId : undefined);
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members-profiles', wsId],
    enabled: !!wsId && needsFormData,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('user_id, profiles:profiles(id, email)')
        .eq('workspace_id', wsId!);
      if (error) throw error;
      return (data ?? [])
        .map((m) => (m.profiles as unknown as { id: string; email: string } | null))
        .filter(Boolean) as { id: string; email: string }[];
    },
  });

  const editingProjectMutation = useProjectTaskMutations(editingTask?.project_id ?? '');

  const handleUpdateTask = async (values: TaskFormValues) => {
    if (!editingTask) return;
    await editingProjectMutation.updateTask.mutateAsync({ id: editingTask.id, values });
    setEditingTask(null);
  };

  const handleDeleteTask = () => {
    if (!editingTask) return;
    if (!confirm(`Remover a tarefa "${editingTask.title}"?`)) return;
    editingProjectMutation.deleteTask.mutate(editingTask.id);
    setEditingTask(null);
  };

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8]">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-5">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="w-72 h-64 rounded-2xl shrink-0" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <motion.div
        className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.section variants={itemVariants} className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <LayoutGrid className="h-6 w-6" />
                Kanban
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Visão unificada de todos os projetos</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-gray-200 hover:border-gray-300 hover:bg-white"
              onClick={() => navigate('/projects')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Projetos
            </Button>
          </div>
        </motion.section>

        {/* Filters card */}
        {projects.length > 0 && (
          <motion.div variants={itemVariants} className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-sm space-y-3">

            {/* Project filter row */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Projetos</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveProjectIds(null)}
                  className={cn(
                    'text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                    activeProjectIds === null
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  )}
                >
                  Todos
                </button>
                <button
                  onClick={() => setActiveProjectIds([])}
                  className={cn(
                    'text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                    Array.isArray(activeProjectIds) && activeProjectIds.length === 0
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  )}
                >
                  Nenhum
                </button>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                {projects.map((project) => {
                  const isActive = visibleProjectIds.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={cn(
                        'text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                        isActive
                          ? 'bg-violet-100 text-violet-800 border-violet-300'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                      )}
                    >
                      {isActive && <span className="mr-1">●</span>}
                      {project.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignee filter row — only shown when there are assignees */}
            {assignees.length > 0 && (
              <>
                <div className="border-t border-gray-100" />
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Responsável</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActiveAssigneeId(null)}
                      className={cn(
                        'text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                        activeAssigneeId === null
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      )}
                    >
                      Todos
                    </button>

                    {assignees.map(({ id, email }) => {
                      const isActive = activeAssigneeId === id;
                      const name = email.split('@')[0];
                      return (
                        <button
                          key={id}
                          onClick={() => setActiveAssigneeId(isActive ? null : id)}
                          className={cn(
                            'text-xs font-medium px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5',
                            isActive
                              ? 'bg-sky-100 text-sky-800 border-sky-300'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                          )}
                        >
                          <User className="h-3 w-3" />
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Kanban board */}
        <motion.div variants={itemVariants}>
          {projects.length === 0 ? (
            <div className="rounded-3xl border border-gray-200/70 bg-white p-12 shadow-sm flex flex-col items-center justify-center text-center">
              <LayoutGrid className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-gray-900">Nenhum projeto encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">Crie projetos primeiro para visualizá-los aqui.</p>
              <Button className="mt-4 rounded-xl" onClick={() => navigate('/projects')}>Ir para Projetos</Button>
            </div>
          ) : visibleProjectIds.length === 0 ? (
            <div className="rounded-3xl border border-gray-200/70 bg-white p-12 shadow-sm flex flex-col items-center justify-center text-center">
              <LayoutGrid className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-gray-900">Nenhum projeto selecionado</p>
              <p className="text-sm text-muted-foreground mt-1">Clique nos chips acima para ativar os projetos.</p>
            </div>
          ) : isLoadingTasks ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="w-72 h-48 rounded-2xl shrink-0" />)}
            </div>
          ) : (
            <ProjectsOverviewBoard
              tasks={visibleTasks}
              projectIds={projects.map((p) => p.id)}
              onEditTask={setEditingTask}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Edit task dialog */}
      <Dialog open={!!editingTask} onOpenChange={(o) => !o && setEditingTask(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              defaultValues={editingTask}
              services={services}
              members={members}
              onSubmit={handleUpdateTask}
              isLoading={editingProjectMutation.updateTask.isPending}
              onCancel={() => setEditingTask(null)}
              onDelete={handleDeleteTask}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsOverview;
