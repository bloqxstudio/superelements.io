import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useProjectWithTasks, useProjectMutations } from '@/hooks/useProjects';
import { useProjectTaskMutations } from '@/hooks/useProjectTasks';
import { useActiveServiceCatalog } from '@/hooks/useServiceCatalog';
import { useProjectsStore } from '@/store/projectsStore';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Pencil,
  Settings2,
  Kanban,
  BarChart3,
  Calendar,
  DollarSign,
  User,
  FolderOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PROJECT_STATUS_CONFIG } from '@/types/projects';
import type { ProjectTask, TaskStatus, ProjectFormValues, TaskFormValues } from '@/types/projects';
import ProjectKanban from '@/components/projects/ProjectKanban';
import ProjectMetrics from '@/components/projects/ProjectMetrics';
import ProjectForm from '@/components/projects/ProjectForm';
import TaskForm from '@/components/projects/TaskForm';
import ServiceCatalogManager from '@/components/projects/ServiceCatalogManager';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  // ── Data — critical path ──────────────────────────────────────────────────
  const { data: projectData, isLoading: mainLoading, error: mainError } = useProjectWithTasks(projectId);
  const project = projectData?.project;
  const serverTasks = projectData?.tasks ?? [];
  const { updateProject } = useProjectMutations();
  const { createTask, updateTask, moveTask, deleteTask } = useProjectTaskMutations(projectId ?? '');

  // ── UI State ──────────────────────────────────────────────────────────────
  const {
    optimisticTasks,
    setOptimisticTasks,
    revertTasks,
    clearOptimistic,
    activeTab,
    setActiveTab,
    serviceCatalogOpen,
    setServiceCatalogOpen,
    createTaskStatus,
    setCreateTaskStatus,
  } = useProjectsStore();

  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // ── Data — lazy ───────────────────────────────────────────────────────────
  const needsFormData = editProjectOpen || createTaskOpen || !!editingTask;

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

  const { data: clientAccounts = [] } = useQuery({
    queryKey: ['client-accounts', wsId],
    enabled: !!wsId && editProjectOpen,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connections')
        .select('id, name')
        .eq('workspace_id', wsId!)
        .eq('connection_type', 'client_account')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const tasks = optimisticTasks ?? serverTasks;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTasksChange = useCallback(
    (affectedTasks: Array<{ id: string; kanban_status: TaskStatus; position: number }>) => {
      const updatedMap = new Map(affectedTasks.map((t) => [t.id, t]));
      const optimistic = serverTasks.map((t) => {
        const update = updatedMap.get(t.id);
        if (!update) return t;
        return { ...t, kanban_status: update.kanban_status, position: update.position };
      });
      setOptimisticTasks(optimistic);
      moveTask.mutate(affectedTasks, {
        onSuccess: () => clearOptimistic(),
        onError: () => revertTasks(),
      });
    },
    [serverTasks, setOptimisticTasks, clearOptimistic, revertTasks, moveTask]
  );

  const handleEditTask = (task: ProjectTask) => setEditingTask(task);
  const handleAddTask = (status: TaskStatus) => {
    setCreateTaskStatus(status);
    setCreateTaskOpen(true);
  };

  const handleCreateTask = async (values: TaskFormValues) => {
    await createTask.mutateAsync(values);
    setCreateTaskOpen(false);
    setCreateTaskStatus(null);
  };

  const handleUpdateTask = async (values: TaskFormValues) => {
    if (!editingTask) return;
    await updateTask.mutateAsync({ id: editingTask.id, values });
    setEditingTask(null);
  };

  const handleDeleteTask = () => {
    if (!editingTask) return;
    if (!confirm(`Remover a tarefa "${editingTask.title}"?`)) return;
    deleteTask.mutate(editingTask.id);
    setEditingTask(null);
  };

  const handleUpdateProject = async (values: ProjectFormValues) => {
    if (!project) return;
    await updateProject.mutateAsync({ id: project.id, values });
    setEditProjectOpen(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (mainLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-5">
        <Skeleton className="h-5 w-32 rounded-full" />
        <div className="rounded-3xl border border-gray-200/70 bg-white p-5 sm:p-6 shadow-sm space-y-3">
          <Skeleton className="h-7 w-64 rounded-lg" />
          <Skeleton className="h-4 w-48 rounded-lg" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-4 w-32 rounded-lg" />
            <Skeleton className="h-4 w-28 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="w-72 h-64 rounded-2xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (mainError || !project) {
    const errMsg = mainError
      ? (mainError as { message?: string; details?: string })?.message
        ?? (mainError as { details?: string })?.details
        ?? JSON.stringify(mainError)
      : null;
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center p-6">
        <div className="rounded-3xl border border-gray-200/70 bg-white p-8 shadow-sm text-center space-y-3 max-w-md w-full">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-muted-foreground/50" />
            </div>
          </div>
          <p className="font-semibold text-gray-900">
            {errMsg ? `Erro: ${errMsg}` : 'Projeto não encontrado'}
          </p>
          <p className="text-sm text-muted-foreground">
            Verifique se a migration SQL foi executada no Supabase.
          </p>
          <Button variant="outline" onClick={() => navigate('/projects')} className="mt-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para projetos
          </Button>
        </div>
      </div>
    );
  }

  const statusCfg = PROJECT_STATUS_CONFIG[project.status];

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <motion.div
        className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-5"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Breadcrumb */}
        <motion.div variants={itemVariants}>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Projetos
          </button>
        </motion.div>

        {/* Project header card */}
        <motion.div
          variants={itemVariants}
          className="rounded-3xl border border-gray-200/70 bg-white p-5 sm:p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              {/* Status + client */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="outline" className={cn('text-xs', statusCfg.badgeClass)}>
                  {statusCfg.label}
                </Badge>
                {project.client_account && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 bg-gray-100 rounded-full px-2.5 py-0.5">
                    <User className="h-3 w-3" />
                    {project.client_account.name}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{project.name}</h1>

              {/* Description */}
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{project.description}</p>
              )}

              {/* Meta */}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {project.deadline && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Prazo: {format(new Date(project.deadline), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
                {project.budget != null && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Orçamento: {project.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                onClick={() => setServiceCatalogOpen(true)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Serviços
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                onClick={() => setEditProjectOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Tabs + content */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'kanban' | 'metrics')}>
            <TabsList className="bg-white border border-gray-200/70 rounded-2xl p-1 h-auto shadow-sm w-fit">
              <TabsTrigger
                value="kanban"
                className="rounded-xl data-[state=active]:bg-gray-100 data-[state=active]:shadow-none flex items-center gap-1.5 text-sm px-4 py-1.5"
              >
                <Kanban className="h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger
                value="metrics"
                className="rounded-xl data-[state=active]:bg-gray-100 data-[state=active]:shadow-none flex items-center gap-1.5 text-sm px-4 py-1.5"
              >
                <BarChart3 className="h-4 w-4" />
                Métricas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kanban" className="mt-4">
              <ProjectKanban
                tasks={tasks}
                onTasksChange={handleTasksChange}
                onEditTask={handleEditTask}
                onAddTask={handleAddTask}
              />
            </TabsContent>

            <TabsContent value="metrics" className="mt-4">
              <div className="rounded-3xl border border-gray-200/70 bg-white p-5 sm:p-6 shadow-sm">
                <ProjectMetrics project={project} tasks={tasks} />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      {/* Edit project dialog */}
      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar projeto</DialogTitle>
          </DialogHeader>
          <ProjectForm
            defaultValues={project}
            clientAccounts={clientAccounts}
            onSubmit={handleUpdateProject}
            isLoading={updateProject.isPending}
            onCancel={() => setEditProjectOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Create task dialog */}
      <Dialog
        open={createTaskOpen}
        onOpenChange={(o) => { setCreateTaskOpen(o); if (!o) setCreateTaskStatus(null); }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
          </DialogHeader>
          <TaskForm
            defaultStatus={(createTaskStatus as TaskStatus) ?? 'backlog'}
            services={services}
            members={members}
            onSubmit={handleCreateTask}
            isLoading={createTask.isPending}
            onCancel={() => { setCreateTaskOpen(false); setCreateTaskStatus(null); }}
          />
        </DialogContent>
      </Dialog>

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
              isLoading={updateTask.isPending}
              onCancel={() => setEditingTask(null)}
              onDelete={handleDeleteTask}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Service catalog manager */}
      <ServiceCatalogManager
        open={serviceCatalogOpen}
        onOpenChange={setServiceCatalogOpen}
      />
    </div>
  );
};

export default ProjectDetail;
