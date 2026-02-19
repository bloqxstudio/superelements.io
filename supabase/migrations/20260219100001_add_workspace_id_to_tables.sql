-- Migration: Add nullable workspace_id to connections and proposals
-- (nullable first; NOT NULL enforced after data migration in migration 20260219100003)

ALTER TABLE public.connections
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;

ALTER TABLE public.proposals
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;

CREATE INDEX idx_connections_workspace_id ON public.connections(workspace_id);
CREATE INDEX idx_proposals_workspace_id   ON public.proposals(workspace_id);
