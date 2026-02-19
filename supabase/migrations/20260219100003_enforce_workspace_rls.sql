-- Migration: Enforce NOT NULL workspace_id, add helper functions, and apply RLS policies.
-- IMPORTANT: Run AFTER deploying the frontend code that injects workspace_id on insert.

-- Enforce NOT NULL now that all existing rows are migrated
ALTER TABLE public.connections ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.proposals   ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================================
-- Helper functions (SECURITY DEFINER for RLS performance)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- RLS: workspaces
-- ============================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_all_workspaces"
  ON public.workspaces FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Members can view their own workspaces
CREATE POLICY "member_select_own_workspace"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));

-- ============================================================
-- RLS: workspace_members
-- ============================================================
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_all_workspace_members"
  ON public.workspace_members FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Members can see other members in their workspaces
CREATE POLICY "member_select_same_workspace_members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- RLS: connections
-- Drop existing policies before adding new ones.
-- Run: SELECT policyname FROM pg_policies WHERE tablename = 'connections';
-- ============================================================

-- Admin full access
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'connections' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.connections', r.policyname);
  END LOOP;
END;
$$;

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_connections"
  ON public.connections FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "workspace_member_select_connections"
  ON public.connections FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_owner_insert_connections"
  ON public.connections FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_owner_update_connections"
  ON public.connections FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_owner_delete_connections"
  ON public.connections FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- ============================================================
-- RLS: proposals
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'proposals' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.proposals', r.policyname);
  END LOOP;
END;
$$;

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_proposals"
  ON public.proposals FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "workspace_member_select_proposals"
  ON public.proposals FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_owner_insert_proposals"
  ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_owner_update_proposals"
  ON public.proposals FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_owner_delete_proposals"
  ON public.proposals FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- Allow public token-based proposal access (no auth required for /p/:token)
CREATE POLICY "public_select_proposal_by_token"
  ON public.proposals FOR SELECT
  USING (token IS NOT NULL);

-- ============================================================
-- RLS: client_pages (access derived via connection → workspace)
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'client_pages' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.client_pages', r.policyname);
  END LOOP;
END;
$$;

ALTER TABLE public.client_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_client_pages_select"
  ON public.client_pages FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_pages.connection_id
        AND public.is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY "workspace_client_pages_insert"
  ON public.client_pages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_pages.connection_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

CREATE POLICY "workspace_client_pages_update"
  ON public.client_pages FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_pages.connection_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

CREATE POLICY "workspace_client_pages_delete"
  ON public.client_pages FOR DELETE TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_pages.connection_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

-- ============================================================
-- RLS: client_page_performance (same derivation)
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'client_page_performance' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.client_page_performance', r.policyname);
  END LOOP;
END;
$$;

ALTER TABLE public.client_page_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_perf_select"
  ON public.client_page_performance FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_page_performance.connection_id
        AND public.is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY "workspace_perf_insert"
  ON public.client_page_performance FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_page_performance.connection_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

CREATE POLICY "workspace_perf_update"
  ON public.client_page_performance FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_page_performance.connection_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

CREATE POLICY "workspace_perf_delete"
  ON public.client_page_performance FOR DELETE TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = client_page_performance.connection_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

-- ============================================================
-- RLS: client_page_recommendations (same derivation via client_page → connection)
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'client_page_recommendations' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.client_page_recommendations', r.policyname);
  END LOOP;
END;
$$;

ALTER TABLE public.client_page_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_recs_select"
  ON public.client_page_recommendations FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_pages cp
      JOIN public.connections c ON c.id = cp.connection_id
      WHERE cp.id = client_page_recommendations.client_page_id
        AND public.is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY "workspace_recs_insert"
  ON public.client_page_recommendations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_pages cp
      JOIN public.connections c ON c.id = cp.connection_id
      WHERE cp.id = client_page_recommendations.client_page_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

CREATE POLICY "workspace_recs_update"
  ON public.client_page_recommendations FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_pages cp
      JOIN public.connections c ON c.id = cp.connection_id
      WHERE cp.id = client_page_recommendations.client_page_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );

CREATE POLICY "workspace_recs_delete"
  ON public.client_page_recommendations FOR DELETE TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_pages cp
      JOIN public.connections c ON c.id = cp.connection_id
      WHERE cp.id = client_page_recommendations.client_page_id
        AND public.is_workspace_owner(c.workspace_id)
    )
  );
