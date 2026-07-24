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
      WHEN public.is_platform_admin(candidate_user_id) THEN 2
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
  SELECT CASE coalesce(max(level), 0) WHEN 2 THEN 'editor' WHEN 1 THEN 'viewer' ELSE 'none' END
  FROM applicable;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.save_cloud_issue_item_revision(
  target_workspace_id uuid,
  target_issue_id uuid,
  target_item_type text,
  target_item_id uuid,
  target_payload jsonb,
  expected_revision integer
)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_row public.cloud_issue_items;
DECLARE actor text := auth.user_id();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF target_item_type NOT IN ('communication', 'reference', 'milestone', 'summary', 'draft') THEN
    RAISE EXCEPTION 'Unsupported Issue item type';
  END IF;
  IF jsonb_typeof(target_payload) <> 'object'
    OR target_payload ->> 'id' <> target_item_id::text
    OR target_payload ->> 'issueId' <> target_issue_id::text THEN
    RAISE EXCEPTION 'Issue item payload does not match its identifiers';
  END IF;

  SELECT * INTO current_row FROM public.cloud_issue_items
  WHERE workspace_id = target_workspace_id AND item_type = target_item_type AND id = target_item_id
  FOR UPDATE;

  IF current_row.id IS NULL THEN
    IF NOT public.can_edit_issue(target_workspace_id, target_issue_id, actor) THEN
      RAISE EXCEPTION 'Issue editing access required';
    END IF;
    IF expected_revision <> 0 THEN RAISE EXCEPTION 'Issue item no longer exists'; END IF;
    INSERT INTO public.cloud_issue_items (
      workspace_id, issue_id, item_type, id, payload, created_by, updated_by,
      created_at, updated_at, deleted_at, revision
    ) VALUES (
      target_workspace_id, target_issue_id, target_item_type, target_item_id,
      target_payload, actor, actor,
      coalesce(nullif(target_payload ->> 'createdAt', '')::timestamptz, now()),
      now(), NULL, 1
    ) RETURNING cloud_issue_items.revision, cloud_issue_items.payload,
      cloud_issue_items.updated_at, cloud_issue_items.updated_by
      INTO revision, payload, updated_at, updated_by;
    saved := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_row.issue_id <> target_issue_id
    OR NOT public.can_edit_issue(target_workspace_id, current_row.issue_id, actor) THEN
    RAISE EXCEPTION 'Issue editing access required';
  END IF;
  IF current_row.revision <> expected_revision THEN
    saved := false;
    revision := current_row.revision;
    payload := current_row.payload;
    updated_at := current_row.updated_at;
    updated_by := current_row.updated_by;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.cloud_issue_items SET
    payload = target_payload,
    updated_by = actor,
    updated_at = now(),
    deleted_at = NULL,
    revision = current_row.revision + 1
  WHERE workspace_id = target_workspace_id AND item_type = target_item_type AND id = target_item_id
  RETURNING cloud_issue_items.revision, cloud_issue_items.payload,
    cloud_issue_items.updated_at, cloud_issue_items.updated_by
    INTO revision, payload, updated_at, updated_by;
  saved := true;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_notifications_mark_own_read_accessible" ON public.cloud_notifications;
--> statement-breakpoint
CREATE POLICY "cloud_notifications_mark_own_read_accessible" ON public.cloud_notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
    AND (issue_id IS NULL OR public.can_read_issue(workspace_id, issue_id))
  )
  WITH CHECK (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
    AND (issue_id IS NULL OR public.can_read_issue(workspace_id, issue_id))
  );
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.issue_access_level(uuid, uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.save_cloud_issue_item_revision(uuid, uuid, text, uuid, jsonb, integer) TO authenticated;
--> statement-breakpoint

SELECT pg_notify('pgrst', 'reload schema');
