CREATE OR REPLACE FUNCTION public.admin_approve_and_assign_user(
  target_user_id text,
  target_workspace_id uuid,
  next_workspace_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_row public.profiles;
  workspace_row public.workspaces;
  membership_row public.workspace_members;
BEGIN
  IF NOT public.is_platform_admin(auth.user_id()) THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  IF next_workspace_role NOT IN ('workspace_admin', 'officer', 'viewer') THEN
    RAISE EXCEPTION 'Invalid workspace role';
  END IF;

  SELECT p.* INTO profile_row
  FROM public.profiles p
  WHERE p.user_id = target_user_id
  FOR UPDATE;

  IF profile_row.user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF profile_row.status = 'suspended' THEN
    RAISE EXCEPTION 'Restore the suspended account before assigning a workspace';
  END IF;

  SELECT w.* INTO workspace_row
  FROM public.workspaces w
  WHERE w.id = target_workspace_id
    AND w.is_active = true
  FOR UPDATE;

  IF workspace_row.id IS NULL THEN
    RAISE EXCEPTION 'Active workspace not found';
  END IF;

  UPDATE public.profiles
  SET status = 'active',
      reviewed_by = auth.user_id(),
      reviewed_at = now(),
      updated_at = now()
  WHERE user_id = target_user_id
  RETURNING * INTO profile_row;

  UPDATE public.workspace_members
  SET status = 'suspended',
      updated_at = now()
  WHERE user_id = target_user_id
    AND workspace_id <> target_workspace_id
    AND status = 'active';

  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    status
  )
  VALUES (
    target_workspace_id,
    target_user_id,
    next_workspace_role,
    'active'
  )
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role = excluded.role,
      status = 'active',
      updated_at = now()
  RETURNING * INTO membership_row;

  INSERT INTO public.audit_events (
    actor_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    auth.user_id(),
    'profile.approved_and_assigned',
    'profile',
    target_user_id,
    jsonb_build_object(
      'workspace_id', target_workspace_id,
      'workspace_role', next_workspace_role
    )
  );

  RETURN jsonb_build_object(
    'profile', to_jsonb(profile_row),
    'membership', to_jsonb(membership_row),
    'workspace', to_jsonb(workspace_row)
  );
END;
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.admin_approve_and_assign_user(text, uuid, text)
TO authenticated;
--> statement-breakpoint
