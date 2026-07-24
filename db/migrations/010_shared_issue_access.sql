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
  SELECT public.is_platform_admin(candidate_user_id) OR EXISTS (
    SELECT 1
    FROM public.division_members dm
    JOIN public.workspace_members wm ON wm.workspace_id = dm.workspace_id AND wm.user_id = dm.user_id
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

CREATE OR REPLACE FUNCTION public.shares_active_workspace(
  candidate_user_id text,
  other_user_id text DEFAULT auth.user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members mine
    JOIN public.workspace_members theirs ON theirs.workspace_id = mine.workspace_id
    JOIN public.profiles mine_profile ON mine_profile.user_id = mine.user_id AND mine_profile.status = 'active'
    JOIN public.profiles their_profile ON their_profile.user_id = theirs.user_id AND their_profile.status = 'active'
    WHERE mine.user_id = other_user_id AND mine.status = 'active'
      AND theirs.user_id = candidate_user_id AND theirs.status = 'active'
  );
$$;
--> statement-breakpoint

DROP POLICY IF EXISTS "profiles_read_self_or_admin" ON public.profiles;
--> statement-breakpoint
CREATE POLICY "profiles_read_workspace_colleagues" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.user_id()) OR public.is_platform_admin() OR public.shares_active_workspace(user_id));
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.shares_active_workspace(text, text) TO authenticated;
--> statement-breakpoint

DROP POLICY IF EXISTS "memberships_read_related" ON public.workspace_members;
--> statement-breakpoint
CREATE POLICY "memberships_read_workspace_colleagues" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id));
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
      WHEN public.is_platform_admin(candidate_user_id)
        OR (public.is_workspace_admin(candidate_workspace_id, candidate_user_id) AND public.can_edit_workspace(candidate_workspace_id, candidate_user_id)) THEN 2
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
  SELECT CASE coalesce(max(level), 0) WHEN 2 THEN 'editor' WHEN 1 THEN 'viewer' ELSE 'none' END
  FROM applicable;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.can_read_issue(
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
  SELECT public.issue_access_level(candidate_workspace_id, candidate_issue_id, candidate_user_id) IN ('viewer', 'editor');
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.can_edit_issue(
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
  SELECT public.issue_access_level(candidate_workspace_id, candidate_issue_id, candidate_user_id) = 'editor';
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.list_my_issue_access(target_workspace_id uuid)
RETURNS TABLE(issue_id uuid, access_level text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.id, public.issue_access_level(i.workspace_id, i.id)
  FROM public.cloud_issues i
  WHERE i.workspace_id = target_workspace_id
    AND i.deleted_at IS NULL
    AND public.can_read_issue(i.workspace_id, i.id);
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.issue_access_readiness(target_workspace_id uuid)
RETURNS TABLE(active_divisions bigint, unassigned_issues bigint, active_members_without_division bigint, ready boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM public.workspace_divisions d WHERE d.workspace_id = target_workspace_id AND d.is_active),
    (SELECT count(*) FROM public.cloud_issues i WHERE i.workspace_id = target_workspace_id AND i.deleted_at IS NULL AND i.owning_division_id IS NULL),
    (SELECT count(*) FROM public.workspace_members wm
      WHERE wm.workspace_id = target_workspace_id AND wm.status = 'active' AND wm.role <> 'workspace_admin'
        AND NOT EXISTS (
          SELECT 1 FROM public.division_members dm
          WHERE dm.workspace_id = target_workspace_id AND dm.user_id = wm.user_id AND dm.status = 'active'
        )),
    (SELECT count(*) FROM public.workspace_divisions d WHERE d.workspace_id = target_workspace_id AND d.is_active) > 0
      AND (SELECT count(*) FROM public.cloud_issues i WHERE i.workspace_id = target_workspace_id AND i.deleted_at IS NULL AND i.owning_division_id IS NULL) = 0
      AND (SELECT count(*) FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id AND wm.status = 'active' AND wm.role <> 'workspace_admin'
          AND NOT EXISTS (
            SELECT 1 FROM public.division_members dm
            WHERE dm.workspace_id = target_workspace_id AND dm.user_id = wm.user_id AND dm.status = 'active'
          )) = 0
  WHERE public.is_workspace_admin(target_workspace_id);
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.set_division_access_enabled(target_workspace_id uuid, next_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE readiness record;
BEGIN
  IF NOT public.is_workspace_admin(target_workspace_id) THEN RAISE EXCEPTION 'Workspace administrator access required'; END IF;
  IF next_enabled THEN
    SELECT * INTO readiness FROM public.issue_access_readiness(target_workspace_id);
    IF readiness.ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assign every active Issue and workspace member to a division before enabling access'; END IF;
  END IF;
  UPDATE public.workspaces SET division_access_enabled = next_enabled, updated_at = now() WHERE id = target_workspace_id;
  INSERT INTO public.audit_events (actor_user_id, event_type, target_type, target_id, metadata)
  VALUES (auth.user_id(), 'workspace.division_access_changed', 'workspace', target_workspace_id::text, jsonb_build_object('enabled', next_enabled));
  RETURN next_enabled;
END;
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.is_division_admin(uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.issue_access_level(uuid, uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.can_read_issue(uuid, uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.can_edit_issue(uuid, uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.list_my_issue_access(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.issue_access_readiness(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.set_division_access_enabled(uuid, boolean) TO authenticated;
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_issues_read_members" ON public.cloud_issues;
--> statement-breakpoint
CREATE POLICY "cloud_issues_read_effective" ON public.cloud_issues
  FOR SELECT TO authenticated USING (public.can_read_issue(workspace_id, id));
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_issues_insert_members" ON public.cloud_issues;
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_issues_insert_editors" ON public.cloud_issues;
--> statement-breakpoint
CREATE POLICY "cloud_issues_insert_editors" ON public.cloud_issues
  FOR INSERT TO authenticated WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_issues_update_members" ON public.cloud_issues;
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_issues_update_editors" ON public.cloud_issues;
--> statement-breakpoint
CREATE POLICY "cloud_issues_update_effective" ON public.cloud_issues
  FOR UPDATE TO authenticated
  USING (public.can_edit_issue(workspace_id, id))
  WITH CHECK (public.can_edit_issue(workspace_id, id) AND updated_by = (SELECT auth.user_id()));
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_issue_items_read_members" ON public.cloud_issue_items;
--> statement-breakpoint
CREATE POLICY "cloud_issue_items_read_effective" ON public.cloud_issue_items
  FOR SELECT TO authenticated USING (public.can_read_issue(workspace_id, issue_id));
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_issue_items_insert_editors" ON public.cloud_issue_items;
--> statement-breakpoint
CREATE POLICY "cloud_issue_items_insert_effective" ON public.cloud_issue_items
  FOR INSERT TO authenticated WITH CHECK (
    public.can_edit_issue(workspace_id, issue_id)
    AND created_by = (SELECT auth.user_id()) AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_issue_items_update_editors" ON public.cloud_issue_items;
--> statement-breakpoint
CREATE POLICY "cloud_issue_items_update_effective" ON public.cloud_issue_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_issue(workspace_id, issue_id))
  WITH CHECK (public.can_edit_issue(workspace_id, issue_id) AND updated_by = (SELECT auth.user_id()));
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_notifications_read_own" ON public.cloud_notifications;
--> statement-breakpoint
CREATE POLICY "cloud_notifications_read_own_accessible" ON public.cloud_notifications
  FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
    AND (issue_id IS NULL OR public.can_read_issue(workspace_id, issue_id))
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_notifications_mark_own_read" ON public.cloud_notifications;
--> statement-breakpoint
CREATE POLICY "cloud_notifications_mark_own_read_accessible" ON public.cloud_notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.user_id()) AND (issue_id IS NULL OR public.can_read_issue(workspace_id, issue_id)))
  WITH CHECK (user_id = (SELECT auth.user_id()) AND (issue_id IS NULL OR public.can_read_issue(workspace_id, issue_id)));
--> statement-breakpoint

DROP POLICY IF EXISTS "issue_access_grants_manage_admins" ON public.issue_access_grants;
--> statement-breakpoint
CREATE POLICY "issue_access_grants_manage_editors" ON public.issue_access_grants
  FOR ALL TO authenticated
  USING (public.can_edit_issue(workspace_id, issue_id))
  WITH CHECK (public.can_edit_issue(workspace_id, issue_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "issue_access_grants_read_related" ON public.issue_access_grants;
--> statement-breakpoint
CREATE POLICY "issue_access_grants_read_effective" ON public.issue_access_grants
  FOR SELECT TO authenticated USING (public.can_read_issue(workspace_id, issue_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "division_members_manage_admins" ON public.division_members;
--> statement-breakpoint
CREATE POLICY "division_members_manage_authorized" ON public.division_members
  FOR ALL TO authenticated
  USING ((public.is_workspace_admin(workspace_id) AND public.can_edit_workspace(workspace_id)) OR public.is_division_admin(division_id))
  WITH CHECK ((public.is_workspace_admin(workspace_id) AND public.can_edit_workspace(workspace_id)) OR public.is_division_admin(division_id));
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_ai_issue_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.issue_id IS NOT NULL AND NOT public.can_read_issue(NEW.workspace_id, NEW.issue_id, NEW.user_id) THEN
    RAISE EXCEPTION 'Issue access is no longer available';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS cloud_ai_issue_access_guard ON public.cloud_ai_generation_logs;
--> statement-breakpoint
CREATE TRIGGER cloud_ai_issue_access_guard
  BEFORE INSERT ON public.cloud_ai_generation_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_issue_access();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.audit_issue_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor text := coalesce(auth.user_id(), 'system');
BEGIN
  IF TG_TABLE_NAME = 'issue_access_grants' THEN
    INSERT INTO public.audit_events (actor_user_id, event_type, target_type, target_id, metadata)
    VALUES (
      actor,
      'issue.access_grant_' || lower(TG_OP),
      'issue',
      coalesce(NEW.issue_id, OLD.issue_id)::text,
      jsonb_build_object(
        'principal_type', coalesce(NEW.principal_type, OLD.principal_type),
        'principal_id', coalesce(NEW.principal_id, OLD.principal_id),
        'access_level', coalesce(NEW.access_level, OLD.access_level)
      )
    );
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF OLD.owning_division_id IS DISTINCT FROM NEW.owning_division_id OR OLD.visibility IS DISTINCT FROM NEW.visibility THEN
    INSERT INTO public.audit_events (actor_user_id, event_type, target_type, target_id, metadata)
    VALUES (
      actor, 'issue.access_policy_updated', 'issue', NEW.id::text,
      jsonb_build_object('owning_division_id', NEW.owning_division_id, 'visibility', NEW.visibility)
    );
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS issue_access_grant_audit ON public.issue_access_grants;
--> statement-breakpoint
CREATE TRIGGER issue_access_grant_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.issue_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.audit_issue_access_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS issue_access_policy_audit ON public.cloud_issues;
--> statement-breakpoint
CREATE TRIGGER issue_access_policy_audit
  AFTER UPDATE OF owning_division_id, visibility ON public.cloud_issues
  FOR EACH ROW EXECUTE FUNCTION public.audit_issue_access_change();
