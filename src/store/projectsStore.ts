import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProjectTask } from '@/types/projects';

interface ProjectsUIState {
  // Optimistic task state for kanban drag & drop
  optimisticTasks: ProjectTask[] | null; // null = use server data from React Query
  previousTasks: ProjectTask[] | null;   // snapshot for revert on error

  // Tab active in ProjectDetail
  activeTab: 'kanban' | 'metrics';

  // Dialog state
  editingTaskId: string | null;
  editingProjectId: string | null;
  serviceCatalogOpen: boolean;
  createTaskStatus: string | null; // pre-fill kanban column when clicking "+ add" in a column

  // Overview: which projects are visible (null = all)
  activeProjectIds: string[] | null;
}

interface ProjectsActions {
  setOptimisticTasks: (tasks: ProjectTask[]) => void;
  revertTasks: () => void;
  clearOptimistic: () => void;
  setActiveTab: (tab: 'kanban' | 'metrics') => void;
  setEditingTaskId: (id: string | null) => void;
  setEditingProjectId: (id: string | null) => void;
  setServiceCatalogOpen: (open: boolean) => void;
  setCreateTaskStatus: (status: string | null) => void;
  setActiveProjectIds: (ids: string[] | null) => void;
}

export const useProjectsStore = create<ProjectsUIState & ProjectsActions>()(
  devtools(
    (set, get) => ({
      optimisticTasks: null,
      previousTasks: null,
      activeTab: 'kanban',
      editingTaskId: null,
      editingProjectId: null,
      serviceCatalogOpen: false,
      createTaskStatus: null,
      activeProjectIds: null,

      setOptimisticTasks: (tasks) =>
        set(
          { previousTasks: get().optimisticTasks, optimisticTasks: tasks },
          false,
          'setOptimisticTasks'
        ),

      revertTasks: () =>
        set(
          (state) => ({ optimisticTasks: state.previousTasks, previousTasks: null }),
          false,
          'revertTasks'
        ),

      clearOptimistic: () =>
        set({ optimisticTasks: null, previousTasks: null }, false, 'clearOptimistic'),

      setActiveTab: (tab) => set({ activeTab: tab }, false, 'setActiveTab'),
      setEditingTaskId: (id) => set({ editingTaskId: id }, false, 'setEditingTaskId'),
      setEditingProjectId: (id) => set({ editingProjectId: id }, false, 'setEditingProjectId'),
      setServiceCatalogOpen: (open) => set({ serviceCatalogOpen: open }, false, 'setServiceCatalogOpen'),
      setCreateTaskStatus: (status) => set({ createTaskStatus: status }, false, 'setCreateTaskStatus'),
      setActiveProjectIds: (ids) => set({ activeProjectIds: ids }, false, 'setActiveProjectIds'),
    }),
    { name: 'projects-store' }
  )
);
