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
        public.is_platform_admin(candidate_user_id)
        OR (
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

GRANT EXECUTE ON FUNCTION public.can_manage_issue_access(uuid, uuid, text) TO authenticated;
--> statement-breakpoint

DROP POLICY IF EXISTS "issue_access_grants_manage_editors" ON public.issue_access_grants;
--> statement-breakpoint
DROP POLICY IF EXISTS "issue_access_grants_manage_authorized" ON public.issue_access_grants;
--> statement-breakpoint
CREATE POLICY "issue_access_grants_manage_authorized" ON public.issue_access_grants
  FOR ALL TO authenticated
  USING (public.can_manage_issue_access(workspace_id, issue_id))
  WITH CHECK (public.can_manage_issue_access(workspace_id, issue_id));
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_issue_access_management()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    NEW.owning_division_id IS DISTINCT FROM OLD.owning_division_id
    OR NEW.visibility IS DISTINCT FROM OLD.visibility
  ) AND NOT public.can_manage_issue_access(OLD.workspace_id, OLD.id) THEN
    RAISE EXCEPTION 'Issue access management permission required';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_issue_access_management_trigger
ON public.cloud_issues;
--> statement-breakpoint
CREATE TRIGGER enforce_issue_access_management_trigger
BEFORE UPDATE OF owning_division_id, visibility
ON public.cloud_issues
FOR EACH ROW
EXECUTE FUNCTION public.enforce_issue_access_management();
--> statement-breakpoint

SELECT pg_notify('pgrst', 'reload schema');
