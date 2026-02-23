-- Migration: Create CRM/Commercial Module (idempotent)

-- ============================================================
-- ENUMs
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new_lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_source AS ENUM (
    'indication', 'instagram', 'linkedin', 'website', 'cold_outreach', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: leads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  source          public.lead_source NOT NULL DEFAULT 'other',
  estimated_value NUMERIC(12, 2),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  kanban_status   public.lead_status NOT NULL DEFAULT 'new_lead',
  position        INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_status    ON public.leads(workspace_id, kanban_status);
CREATE INDEX IF NOT EXISTS idx_leads_position  ON public.leads(workspace_id, kanban_status, position);

-- ============================================================
-- TABLE: lead_interactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead      ON public.lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_workspace ON public.lead_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_chrono    ON public.lead_interactions(lead_id, created_at DESC);

-- ============================================================
-- TABLE: lead_projects (junction)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_projects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_projects_lead    ON public.lead_projects(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_projects_project ON public.lead_projects(project_id);

-- ============================================================
-- Trigger (reuse existing set_updated_at function)
-- ============================================================

DO $$ BEGIN
  CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- RLS: leads
-- ============================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_leads"
    ON public.leads FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_member_select_leads"
    ON public.leads FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_insert_leads"
    ON public.leads FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_update_leads"
    ON public.leads FOR UPDATE TO authenticated
    USING (public.is_workspace_owner(workspace_id))
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_delete_leads"
    ON public.leads FOR DELETE TO authenticated
    USING (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- RLS: lead_interactions
-- ============================================================

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_lead_interactions"
    ON public.lead_interactions FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_member_select_lead_interactions"
    ON public.lead_interactions FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_insert_lead_interactions"
    ON public.lead_interactions FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_delete_lead_interactions"
    ON public.lead_interactions FOR DELETE TO authenticated
    USING (public.is_workspace_owner(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- RLS: lead_projects
-- ============================================================

ALTER TABLE public.lead_projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_lead_projects"
    ON public.lead_projects FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_member_select_lead_projects"
    ON public.lead_projects FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
          AND public.is_workspace_member(l.workspace_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_insert_lead_projects"
    ON public.lead_projects FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
          AND public.is_workspace_owner(l.workspace_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "workspace_owner_delete_lead_projects"
    ON public.lead_projects FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
          AND public.is_workspace_owner(l.workspace_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
