CREATE OR REPLACE FUNCTION public.can_edit_workspace(candidate_workspace_id uuid, candidate_user_id text DEFAULT auth.user_id())
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
      AND m.role IN ('workspace_admin', 'officer')
      AND m.status = 'active'
      AND p.status = 'active'
  );
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.can_edit_workspace(uuid, text) TO authenticated;
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_issues_insert_members" ON public.cloud_issues;
--> statement-breakpoint
CREATE POLICY "cloud_issues_insert_editors" ON public.cloud_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_issues_update_members" ON public.cloud_issues;
--> statement-breakpoint
CREATE POLICY "cloud_issues_update_editors" ON public.cloud_issues
  FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
