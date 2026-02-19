-- Ensure every workspace owner is also present in workspace_members.
-- This fixes cases where workspaces were inserted without the corresponding
-- owner membership row, causing the workspace to not appear in selection.

-- 1) Backfill existing rows
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'::workspace_role
FROM public.workspaces w
LEFT JOIN public.workspace_members wm
  ON wm.workspace_id = w.id
 AND wm.user_id = w.owner_id
WHERE wm.user_id IS NULL;

-- 2) Keep consistency for future inserts/owner changes
CREATE OR REPLACE FUNCTION public.ensure_workspace_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner'::workspace_role)
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = 'owner'::workspace_role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_workspace_owner_membership ON public.workspaces;
CREATE TRIGGER trg_ensure_workspace_owner_membership
AFTER INSERT OR UPDATE OF owner_id
ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.ensure_workspace_owner_membership();

