DROP POLICY IF EXISTS "workspaces_read_members" ON public.workspaces;
--> statement-breakpoint
CREATE POLICY "workspaces_read_members_or_platform_admins" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_active_workspace_member(id)
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "memberships_read_related" ON public.workspace_members;
--> statement-breakpoint
DROP POLICY IF EXISTS "memberships_read_workspace_colleagues" ON public.workspace_members;
--> statement-breakpoint
CREATE POLICY "memberships_read_workspace_colleagues_or_platform_admins"
  ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_active_workspace_member(workspace_id)
  );
--> statement-breakpoint
