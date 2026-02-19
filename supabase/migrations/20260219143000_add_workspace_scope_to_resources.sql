-- Scope resources by workspace.
-- This enforces tenant isolation for resources similar to connections/proposals.

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;

-- Backfill from creator membership when possible.
UPDATE public.resources r
SET workspace_id = (
  SELECT wm.workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = r.created_by
  ORDER BY wm.joined_at ASC
  LIMIT 1
)
WHERE r.workspace_id IS NULL;

-- Fallback: assign remaining rows to the oldest workspace.
DO $$
DECLARE
  v_default_workspace_id UUID;
BEGIN
  SELECT id
  INTO v_default_workspace_id
  FROM public.workspaces
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_default_workspace_id IS NOT NULL THEN
    UPDATE public.resources
    SET workspace_id = v_default_workspace_id
    WHERE workspace_id IS NULL;
  END IF;
END;
$$;

ALTER TABLE public.resources
  ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resources_workspace_id
  ON public.resources(workspace_id);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all resources" ON public.resources;
DROP POLICY IF EXISTS "PRO users can view active resources" ON public.resources;
DROP POLICY IF EXISTS "admin_all_resources" ON public.resources;
DROP POLICY IF EXISTS "workspace_member_select_resources" ON public.resources;
DROP POLICY IF EXISTS "workspace_owner_insert_resources" ON public.resources;
DROP POLICY IF EXISTS "workspace_owner_update_resources" ON public.resources;
DROP POLICY IF EXISTS "workspace_owner_delete_resources" ON public.resources;

CREATE POLICY "admin_all_resources"
  ON public.resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "workspace_member_select_resources"
  ON public.resources FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_owner_insert_resources"
  ON public.resources FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_owner_update_resources"
  ON public.resources FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_owner_delete_resources"
  ON public.resources FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));
