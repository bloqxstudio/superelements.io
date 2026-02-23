-- Migration SAFE: Create Projects Module (idempotent version)
-- Use this if 20260223000001 failed partway through (ENUMs already created)

-- ============================================================
-- ENUMs (skip if already exist)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM (
    'planning', 'active', 'on_hold', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM (
    'backlog', 'todo', 'in_progress', 'in_review', 'done', 'billed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: service_catalog
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_catalog (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  default_hourly_rate  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_workspace ON public.service_catalog(workspace_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_active    ON public.service_catalog(workspace_id, is_active);

-- ============================================================
-- TABLE: projects
-- ============================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_account_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  status            public.project_status NOT NULL DEFAULT 'active',
  budget            NUMERIC(12, 2),
  deadline          DATE,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace      ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_account ON public.projects(client_account_id);
CREATE INDEX IF NOT EXISTS idx_projects_status         ON public.projects(workspace_id, status);

-- ============================================================
-- TABLE: project_tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id       UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  kanban_status      public.task_status NOT NULL DEFAULT 'backlog',
  position           INTEGER NOT NULL DEFAULT 0,
  service_catalog_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  hourly_rate        NUMERIC(10, 2),
  estimated_hours    NUMERIC(8, 2),
  actual_hours       NUMERIC(8, 2) NOT NULL DEFAULT 0,
  task_cost          NUMERIC(12, 2) GENERATED ALWAYS AS (
    CASE
      WHEN actual_hours IS NOT NULL AND hourly_rate IS NOT NULL
      THEN actual_hours * hourly_rate
      ELSE NULL
    END
  ) STORED,
  assignee_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  billing_status     TEXT NOT NULL DEFAULT 'unbilled'
    CHECK (billing_status IN ('unbilled', 'billed')),
  billed_at          TIMESTAMPTZ,
  due_date           DATE,
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project   ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_workspace ON public.project_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee  ON public.project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status    ON public.project_tasks(project_id, kanban_status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_billing   ON public.project_tasks(workspace_id, billing_status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_position  ON public.project_tasks(project_id, kanban_status, position);

-- ============================================================
-- Trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_service_catalog_updated_at
    BEFORE UPDATE ON public.service_catalog
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_project_tasks_updated_at
    BEFORE UPDATE ON public.project_tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- VIEW: project_cost_summary
-- ============================================================

CREATE OR REPLACE VIEW public.project_cost_summary AS
SELECT
  p.id                                                                                   AS project_id,
  p.workspace_id,
  p.client_account_id,
  p.name                                                                                 AS project_name,
  p.status                                                                               AS project_status,
  p.budget,
  p.deadline,
  COUNT(t.id)                                                                            AS total_tasks,
  COALESCE(SUM(t.actual_hours), 0)                                                       AS total_actual_hours,
  COALESCE(SUM(t.estimated_hours), 0)                                                    AS total_estimated_hours,
  COALESCE(SUM(t.task_cost), 0)                                                          AS total_cost,
  COALESCE(SUM(CASE WHEN t.billing_status = 'unbilled' THEN t.task_cost ELSE 0 END), 0) AS unbilled_cost,
  COALESCE(SUM(CASE WHEN t.billing_status = 'billed'   THEN t.task_cost ELSE 0 END), 0) AS billed_cost,
  COUNT(CASE WHEN t.kanban_status IN ('done', 'billed') THEN 1 END)                     AS completed_tasks
FROM public.projects p
LEFT JOIN public.project_tasks t ON t.project_id = p.id
GROUP BY p.id, p.workspace_id, p.client_account_id, p.name, p.status, p.budget, p.deadline;

-- ============================================================
-- RLS: service_catalog
-- ============================================================

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_service_catalog"
    ON public.service_catalog FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_member_select_service_catalog"
    ON public.service_catalog FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_insert_service_catalog"
    ON public.service_catalog FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_update_service_catalog"
    ON public.service_catalog FOR UPDATE TO authenticated
    USING (public.is_workspace_owner(workspace_id))
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_delete_service_catalog"
    ON public.service_catalog FOR DELETE TO authenticated
    USING (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- RLS: projects
-- ============================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_projects"
    ON public.projects FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_member_select_projects"
    ON public.projects FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_insert_projects"
    ON public.projects FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_update_projects"
    ON public.projects FOR UPDATE TO authenticated
    USING (public.is_workspace_owner(workspace_id))
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_delete_projects"
    ON public.projects FOR DELETE TO authenticated
    USING (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- RLS: project_tasks
-- ============================================================

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_project_tasks"
    ON public.project_tasks FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_member_select_project_tasks"
    ON public.project_tasks FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_insert_project_tasks"
    ON public.project_tasks FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_update_project_tasks"
    ON public.project_tasks FOR UPDATE TO authenticated
    USING (public.is_workspace_owner(workspace_id))
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_delete_project_tasks"
    ON public.project_tasks FOR DELETE TO authenticated
    USING (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
