ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS division_access_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.workspace_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code),
  UNIQUE (workspace_id, id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.division_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  division_id uuid NOT NULL,
  user_id text NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('division_admin', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (division_id, user_id),
  FOREIGN KEY (workspace_id, division_id)
    REFERENCES public.workspace_divisions(workspace_id, id)
    ON DELETE CASCADE
);
--> statement-breakpoint

ALTER TABLE public.cloud_issues
  ADD COLUMN IF NOT EXISTS owning_division_id uuid,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'workspace'
    CHECK (visibility IN ('workspace', 'division', 'restricted'));
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cloud_issues_owning_division_fk'
  ) THEN
    ALTER TABLE public.cloud_issues
      ADD CONSTRAINT cloud_issues_owning_division_fk
      FOREIGN KEY (workspace_id, owning_division_id)
      REFERENCES public.workspace_divisions(workspace_id, id)
      ON DELETE SET NULL (owning_division_id);
  END IF;
END;
$$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.issue_access_grants (
  workspace_id uuid NOT NULL,
  issue_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  principal_type text NOT NULL CHECK (principal_type IN ('user', 'division')),
  principal_id text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('viewer', 'editor')),
  granted_by text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, issue_id, principal_type, principal_id),
  FOREIGN KEY (workspace_id, issue_id)
    REFERENCES public.cloud_issues(workspace_id, id)
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS workspace_divisions_workspace_idx
  ON public.workspace_divisions (workspace_id, is_active, name);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS division_members_user_idx
  ON public.division_members (workspace_id, user_id, status);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS issue_access_grants_issue_idx
  ON public.issue_access_grants (workspace_id, issue_id, access_level);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_active_division_member(
  candidate_division_id uuid,
  candidate_user_id text DEFAULT auth.user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_platform_admin(candidate_user_id) OR EXISTS (
    SELECT 1
    FROM public.division_members dm
    JOIN public.workspace_members wm
      ON wm.workspace_id = dm.workspace_id
     AND wm.user_id = dm.user_id
    JOIN public.profiles p ON p.user_id = dm.user_id
    WHERE dm.division_id = candidate_division_id
      AND dm.user_id = candidate_user_id
      AND dm.status = 'active'
      AND wm.status = 'active'
      AND p.status = 'active'
  );
$$;
--> statement-breakpoint

ALTER TABLE public.workspace_divisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.division_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.issue_access_grants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_divisions TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.division_members TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_access_grants TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_active_division_member(uuid, text) TO authenticated;
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_divisions_read_members" ON public.workspace_divisions;
--> statement-breakpoint
CREATE POLICY "workspace_divisions_read_members" ON public.workspace_divisions
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_divisions_manage_admins" ON public.workspace_divisions;
--> statement-breakpoint
CREATE POLICY "workspace_divisions_manage_admins" ON public.workspace_divisions
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "division_members_read_related" ON public.division_members;
--> statement-breakpoint
CREATE POLICY "division_members_read_related" ON public.division_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    OR public.is_workspace_admin(workspace_id)
    OR public.is_active_division_member(division_id)
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "division_members_manage_admins" ON public.division_members;
--> statement-breakpoint
CREATE POLICY "division_members_manage_admins" ON public.division_members
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "issue_access_grants_read_related" ON public.issue_access_grants;
--> statement-breakpoint
CREATE POLICY "issue_access_grants_read_related" ON public.issue_access_grants
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_admin(workspace_id)
    OR (principal_type = 'user' AND principal_id = (SELECT auth.user_id()))
    OR CASE
      WHEN principal_type = 'division'
        THEN public.is_active_division_member(principal_id::uuid)
      ELSE false
    END
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "issue_access_grants_manage_admins" ON public.issue_access_grants;
--> statement-breakpoint
CREATE POLICY "issue_access_grants_manage_admins" ON public.issue_access_grants
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));
--> statement-breakpoint

COMMENT ON COLUMN public.workspaces.division_access_enabled IS
  'Feature flag. Keep false until Issue and child-record RLS plus local-cache revocation are deployed.';
