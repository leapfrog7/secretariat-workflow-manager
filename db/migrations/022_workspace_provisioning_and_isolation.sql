CREATE OR REPLACE FUNCTION public.is_active_workspace_member(
  candidate_workspace_id uuid,
  candidate_user_id text DEFAULT auth.user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    JOIN public.profiles p ON p.user_id = m.user_id
    WHERE m.workspace_id = candidate_workspace_id
      AND m.user_id = candidate_user_id
      AND m.status = 'active'
      AND p.status = 'active'
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_workspace_admin(
  candidate_workspace_id uuid,
  candidate_user_id text DEFAULT auth.user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    JOIN public.profiles p ON p.user_id = m.user_id
    WHERE m.workspace_id = candidate_workspace_id
      AND m.user_id = candidate_user_id
      AND m.role = 'workspace_admin'
      AND m.status = 'active'
      AND p.status = 'active'
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.can_edit_workspace(
  candidate_workspace_id uuid,
  candidate_user_id text DEFAULT auth.user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    JOIN public.profiles p ON p.user_id = m.user_id
    WHERE m.workspace_id = candidate_workspace_id
      AND m.user_id = candidate_user_id
      AND m.role IN ('workspace_admin', 'officer')
      AND m.status = 'active'
      AND p.status = 'active'
  );
$$;
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
  SELECT EXISTS (
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

CREATE OR REPLACE FUNCTION public.is_division_admin(
  candidate_division_id uuid,
  candidate_user_id text DEFAULT auth.user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.division_members dm
    JOIN public.workspace_members wm
      ON wm.workspace_id = dm.workspace_id
     AND wm.user_id = dm.user_id
    JOIN public.profiles p ON p.user_id = dm.user_id
    WHERE dm.division_id = candidate_division_id
      AND dm.user_id = candidate_user_id
      AND dm.role = 'division_admin'
      AND dm.status = 'active'
      AND wm.status = 'active'
      AND p.status = 'active'
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.issue_access_level(
  candidate_workspace_id uuid,
  candidate_issue_id uuid,
  candidate_user_id text DEFAULT auth.user_id()
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH issue AS (
    SELECT i.*, w.division_access_enabled
    FROM public.cloud_issues i
    JOIN public.workspaces w ON w.id = i.workspace_id
    WHERE i.workspace_id = candidate_workspace_id AND i.id = candidate_issue_id
  ),
  member AS (
    SELECT wm.role
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.user_id = wm.user_id
    WHERE wm.workspace_id = candidate_workspace_id
      AND wm.user_id = candidate_user_id
      AND wm.status = 'active'
      AND p.status = 'active'
  ),
  applicable AS (
    SELECT CASE
      WHEN m.role IS NULL THEN 0
      WHEN public.is_workspace_admin(candidate_workspace_id, candidate_user_id)
        AND public.can_edit_workspace(candidate_workspace_id, candidate_user_id) THEN 2
      WHEN NOT i.division_access_enabled AND m.role = 'officer' THEN 2
      WHEN NOT i.division_access_enabled AND m.role = 'viewer' THEN 1
      WHEN i.created_by = candidate_user_id THEN 2
      WHEN i.visibility = 'workspace' AND m.role = 'officer' THEN 2
      WHEN i.visibility = 'workspace' AND m.role = 'viewer' THEN 1
      WHEN i.visibility = 'division' AND dm.role IN ('division_admin', 'editor') THEN 2
      WHEN i.visibility = 'division' AND dm.role = 'viewer' THEN 1
      ELSE 0
    END AS level
    FROM issue i
    LEFT JOIN member m ON true
    LEFT JOIN public.division_members dm
      ON dm.division_id = i.owning_division_id
     AND dm.user_id = candidate_user_id
     AND dm.status = 'active'
    UNION ALL
    SELECT CASE g.access_level WHEN 'editor' THEN 2 ELSE 1 END
    FROM issue i
    JOIN member m ON true
    JOIN public.issue_access_grants g
      ON g.workspace_id = i.workspace_id
     AND g.issue_id = i.id
     AND (g.expires_at IS NULL OR g.expires_at > now())
    LEFT JOIN public.division_members dm
      ON g.principal_type = 'division'
     AND dm.division_id::text = g.principal_id
     AND dm.user_id = candidate_user_id
     AND dm.status = 'active'
    WHERE (g.principal_type = 'user' AND g.principal_id = candidate_user_id)
       OR (g.principal_type = 'division' AND dm.user_id IS NOT NULL)
  )
  SELECT CASE coalesce(max(level), 0)
    WHEN 2 THEN 'editor'
    WHEN 1 THEN 'viewer'
    ELSE 'none'
  END
  FROM applicable;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.can_manage_issue_access(
  candidate_workspace_id uuid,
  candidate_issue_id uuid,
  candidate_user_id text DEFAULT auth.user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cloud_issues i
    WHERE i.workspace_id = candidate_workspace_id
      AND i.id = candidate_issue_id
      AND (
        (
          public.is_workspace_admin(candidate_workspace_id, candidate_user_id)
          AND public.can_edit_workspace(candidate_workspace_id, candidate_user_id)
        )
        OR (
          i.owning_division_id IS NOT NULL
          AND public.is_division_admin(i.owning_division_id, candidate_user_id)
        )
      )
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.admin_create_workspace_for_user(
  target_user_id text,
  workspace_name text,
  workspace_code text,
  source_workspace_id uuid DEFAULT NULL
)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  workspace_row public.workspaces;
  normalized_code text := lower(trim(workspace_code));
  normalized_name text := trim(workspace_name);
BEGIN
  IF NOT public.is_platform_admin(auth.user_id()) THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = target_user_id
      AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only an active account can manage a workspace';
  END IF;
  IF length(normalized_name) < 2 OR length(normalized_name) > 120 THEN
    RAISE EXCEPTION 'Workspace name must contain 2 to 120 characters';
  END IF;
  IF normalized_code !~ '^[a-z0-9][a-z0-9-]{1,47}$' THEN
    RAISE EXCEPTION 'Workspace code must contain 2 to 48 lowercase letters, numbers or hyphens';
  END IF;

  INSERT INTO public.workspaces (name, code, created_by)
  VALUES (normalized_name, normalized_code, auth.user_id())
  RETURNING * INTO workspace_row;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (workspace_row.id, target_user_id, 'workspace_admin', 'active');

  IF source_workspace_id IS NOT NULL
    AND source_workspace_id <> workspace_row.id THEN
    UPDATE public.workspace_members
    SET status = 'suspended',
        updated_at = now()
    WHERE workspace_id = source_workspace_id
      AND user_id = target_user_id;
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    auth.user_id(),
    'workspace.provisioned',
    'workspace',
    workspace_row.id::text,
    jsonb_build_object(
      'name', workspace_row.name,
      'code', workspace_row.code,
      'manager_user_id', target_user_id,
      'removed_from_workspace_id', source_workspace_id
    )
  );

  RETURN workspace_row;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'That workspace code is already in use';
END;
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.admin_create_workspace_for_user(text, text, text, uuid)
TO authenticated;
--> statement-breakpoint

SELECT pg_notify('pgrst', 'reload schema');
