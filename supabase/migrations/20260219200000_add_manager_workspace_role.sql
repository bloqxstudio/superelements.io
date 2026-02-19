-- Add 'manager' role to workspace_role enum
-- Managers can only access /inicio and /client-accounts within a workspace
ALTER TYPE workspace_role ADD VALUE IF NOT EXISTS 'manager';
