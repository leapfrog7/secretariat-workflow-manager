CREATE OR REPLACE FUNCTION public.is_workspace_admin(candidate_workspace_id uuid, candidate_user_id text DEFAULT auth.user_id())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_platform_admin(candidate_user_id) OR EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = candidate_workspace_id
      AND user_id = candidate_user_id
      AND role = 'workspace_admin'
      AND status = 'active'
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ensure_platform_workspace(default_name text, default_code text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  workspace_row public.workspaces;
BEGIN
  IF NOT public.is_platform_admin(auth.user_id()) THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  IF length(trim(default_name)) < 2 OR length(trim(default_code)) < 2 THEN
    RAISE EXCEPTION 'Workspace name and code are required';
  END IF;

  SELECT w.* INTO workspace_row
  FROM public.workspaces w
  JOIN public.workspace_members m ON m.workspace_id = w.id
  WHERE m.user_id = auth.user_id()
    AND m.status = 'active'
    AND w.is_active = true
  ORDER BY w.created_at
  LIMIT 1;

  IF workspace_row.id IS NULL THEN
    SELECT * INTO workspace_row
    FROM public.workspaces
    WHERE code = lower(trim(default_code));

    IF workspace_row.id IS NULL THEN
      INSERT INTO public.workspaces (name, code, created_by)
      VALUES (trim(default_name), lower(trim(default_code)), auth.user_id())
      RETURNING * INTO workspace_row;
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES (workspace_row.id, auth.user_id(), 'workspace_admin', 'active')
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = 'workspace_admin', status = 'active', updated_at = now();

    INSERT INTO public.audit_events (actor_user_id, event_type, target_type, target_id, metadata)
    VALUES (
      auth.user_id(),
      'workspace.ready',
      'workspace',
      workspace_row.id::text,
      jsonb_build_object('name', workspace_row.name, 'code', workspace_row.code)
    );
  END IF;

  RETURN workspace_row;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.admin_set_workspace_member(target_workspace_id uuid, target_user_id text, next_role text, next_status text)
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  member_row public.workspace_members;
BEGIN
  IF NOT public.is_workspace_admin(target_workspace_id, auth.user_id()) THEN
    RAISE EXCEPTION 'Workspace administrator access required';
  END IF;
  IF next_role NOT IN ('workspace_admin', 'officer', 'viewer') THEN
    RAISE EXCEPTION 'Invalid workspace role';
  END IF;
  IF next_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid workspace status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = target_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active application users can join a workspace';
  END IF;
  IF target_user_id = auth.user_id() AND (next_role <> 'workspace_admin' OR next_status <> 'active') THEN
    RAISE EXCEPTION 'A workspace administrator cannot remove their own administrator access';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (target_workspace_id, target_user_id, next_role, next_status)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role = excluded.role,
      status = excluded.status,
      updated_at = now()
  RETURNING * INTO member_row;

  INSERT INTO public.audit_events (actor_user_id, event_type, target_type, target_id, metadata)
  VALUES (
    auth.user_id(),
    'workspace.member_updated',
    'workspace_member',
    target_workspace_id::text || ':' || target_user_id,
    jsonb_build_object('role', next_role, 'status', next_status)
  );

  RETURN member_row;
END;
$$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.cloud_issues (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND payload ->> 'id' = id::text),
  status text NOT NULL DEFAULT 'Pending',
  assigned_officer_id text NOT NULL DEFAULT '',
  next_deadline date,
  is_archived boolean NOT NULL DEFAULT false,
  is_scheduled boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (workspace_id, id)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cloud_issues_register_idx
  ON public.cloud_issues (workspace_id, is_archived, is_scheduled, status, updated_at DESC);
--> statement-breakpoint

ALTER TABLE public.cloud_issues ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_issues TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ensure_platform_workspace(text, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_set_workspace_member(uuid, text, text, text) TO authenticated;
--> statement-breakpoint

DROP POLICY IF EXISTS "memberships_read_related" ON public.workspace_members;
--> statement-breakpoint
CREATE POLICY "memberships_read_related" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    OR public.is_platform_admin()
    OR public.is_workspace_admin(workspace_id)
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "memberships_admin_manage" ON public.workspace_members;
--> statement-breakpoint
CREATE POLICY "memberships_admin_manage" ON public.workspace_members
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));
--> statement-breakpoint

CREATE POLICY "cloud_issues_read_members" ON public.cloud_issues
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id));
--> statement-breakpoint

CREATE POLICY "cloud_issues_insert_members" ON public.cloud_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_workspace_member(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_issues_update_members" ON public.cloud_issues
  FOR UPDATE TO authenticated
  USING (public.is_active_workspace_member(workspace_id))
  WITH CHECK (
    public.is_active_workspace_member(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_issues_delete_admins" ON public.cloud_issues
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));
