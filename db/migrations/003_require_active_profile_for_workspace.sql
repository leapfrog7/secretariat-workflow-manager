CREATE OR REPLACE FUNCTION public.is_active_workspace_member(candidate_workspace_id uuid, candidate_user_id text DEFAULT auth.user_id())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_platform_admin(candidate_user_id) OR EXISTS (
    SELECT 1
    FROM public.workspace_members m
    JOIN public.profiles p ON p.user_id = m.user_id
    WHERE m.workspace_id = candidate_workspace_id
      AND m.user_id = candidate_user_id
      AND m.status = 'active'
      AND p.status = 'active'
  );
$$;
