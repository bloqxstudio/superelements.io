-- Migration: Create "Legacy Workspace" and assign all existing connections/proposals to it.
-- This workspace is owned by the first admin user (by profile creation date).

DO $$
DECLARE
  v_admin_user_id UUID;
  v_workspace_id  UUID;
BEGIN
  -- Find the oldest admin user
  SELECT ur.user_id INTO v_admin_user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    RAISE NOTICE 'No admin user found — skipping legacy workspace creation.';
    RETURN;
  END IF;

  -- Create legacy workspace
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES ('Legacy Workspace', 'legacy', v_admin_user_id)
  RETURNING id INTO v_workspace_id;

  -- Add admin as owner member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_admin_user_id, 'owner');

  -- Assign all existing connections without a workspace
  UPDATE public.connections
  SET workspace_id = v_workspace_id
  WHERE workspace_id IS NULL;

  -- Assign all existing proposals without a workspace
  UPDATE public.proposals
  SET workspace_id = v_workspace_id
  WHERE workspace_id IS NULL;

  RAISE NOTICE 'Legacy Workspace created with id: %', v_workspace_id;
END;
$$;
