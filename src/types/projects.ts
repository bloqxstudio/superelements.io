// ── Enums ────────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'billed';

export type BillingStatus = 'unbilled' | 'billed';

// ── Kanban column metadata ────────────────────────────────────────────────────

export interface KanbanColumn {
  id: TaskStatus;
  label: string;
  colorClass: string;
  headerClass: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'backlog',     label: 'Backlog',       colorClass: 'bg-gray-50 border-gray-200',    headerClass: 'bg-gray-100 text-gray-600' },
  { id: 'todo',        label: 'A Fazer',        colorClass: 'bg-blue-50 border-blue-200',    headerClass: 'bg-blue-100 text-blue-700' },
  { id: 'in_progress', label: 'Em Andamento',   colorClass: 'bg-amber-50 border-amber-200',  headerClass: 'bg-amber-100 text-amber-700' },
  { id: 'in_review',   label: 'Em Revisão',     colorClass: 'bg-purple-50 border-purple-200',headerClass: 'bg-purple-100 text-purple-700' },
  { id: 'done',        label: 'Concluído',      colorClass: 'bg-emerald-50 border-emerald-200',headerClass: 'bg-emerald-100 text-emerald-700' },
  { id: 'billed',      label: 'Faturado',       colorClass: 'bg-teal-50 border-teal-200',    headerClass: 'bg-teal-100 text-teal-700' },
];

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; badgeClass: string }> = {
  planning:  { label: 'Planejamento', badgeClass: 'bg-gray-100 text-gray-700 border-gray-300' },
  active:    { label: 'Ativo',        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  on_hold:   { label: 'Em Pausa',    badgeClass: 'bg-amber-100 text-amber-700 border-amber-300' },
  completed: { label: 'Concluído',   badgeClass: 'bg-blue-100 text-blue-700 border-blue-300' },
  cancelled: { label: 'Cancelado',   badgeClass: 'bg-red-100 text-red-700 border-red-300' },
};

// ── Domain entities ───────────────────────────────────────────────────────────

export interface ServiceCatalogItem {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  default_hourly_rate: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  client_account_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  budget: number | null;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined via select
  client_account?: { id: string; name: string } | null;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  kanban_status: TaskStatus;
  position: number;
  service_catalog_id: string | null;
  hourly_rate: number | null;
  estimated_hours: number | null;
  actual_hours: number;
  task_cost: number | null; // generated column — read-only, never in INSERT/UPDATE
  assignee_id: string | null;
  billing_status: BillingStatus;
  billed_at: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined via select
  service_catalog?: Pick<ServiceCatalogItem, 'id' | 'name' | 'default_hourly_rate'> | null;
  assignee?: { id: string; email: string } | null;
}

// ── Aggregation (from project_cost_summary view) ──────────────────────────────

export interface ProjectCostSummary {
  project_id: string | null;
  workspace_id: string | null;
  client_account_id: string | null;
  project_name: string | null;
  project_status: ProjectStatus | null;
  budget: number | null;
  deadline: string | null;
  total_tasks: number | null;
  total_actual_hours: number | null;
  total_estimated_hours: number | null;
  total_cost: number | null;
  unbilled_cost: number | null;
  billed_cost: number | null;
  completed_tasks: number | null;
}

// ── Form input types ──────────────────────────────────────────────────────────

export interface ProjectFormValues {
  name: string;
  description: string;
  client_account_id: string;
  status: ProjectStatus;
  budget: string;
  deadline: string;
}

export interface TaskFormValues {
  title: string;
  description: string;
  kanban_status: TaskStatus;
  service_catalog_id: string;
  hourly_rate: string;
  estimated_hours: string;
  actual_hours: string;
  assignee_id: string;
  due_date: string;
  billing_status: BillingStatus;
}

export interface ServiceCatalogFormValues {
  name: string;
  description: string;
  default_hourly_rate: string;
  is_active: boolean;
}
