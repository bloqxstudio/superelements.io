-- Migration: Create workspaces and workspace_members tables

CREATE TYPE workspace_role AS ENUM ('owner', 'member');

CREATE TABLE public.workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         workspace_role NOT NULL DEFAULT 'member',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspaces_owner_id          ON public.workspaces(owner_id);
CREATE INDEX idx_workspaces_slug              ON public.workspaces(slug);
CREATE INDEX idx_workspace_members_user_id    ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace  ON public.workspace_members(workspace_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_workspace_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER workspaces_set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_updated_at();
