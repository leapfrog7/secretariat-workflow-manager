ALTER TABLE public.cloud_issues
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
--> statement-breakpoint

ALTER TABLE public.cloud_issue_items
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.save_cloud_issue_revision(
  target_workspace_id uuid,
  target_issue_id uuid,
  target_payload jsonb,
  expected_revision integer,
  target_status text,
  target_assigned_officer_id text,
  target_next_deadline date,
  target_is_archived boolean,
  target_is_scheduled boolean,
  target_owning_division_id uuid,
  target_visibility text
)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_row public.cloud_issues;
DECLARE actor text := auth.user_id();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO current_row FROM public.cloud_issues
  WHERE workspace_id = target_workspace_id AND id = target_issue_id
  FOR UPDATE;

  IF current_row.id IS NULL THEN
    IF expected_revision <> 0 OR NOT public.can_edit_workspace(target_workspace_id, actor) THEN
      RAISE EXCEPTION 'Issue cannot be created';
    END IF;
    INSERT INTO public.cloud_issues (
      workspace_id, id, payload, status, assigned_officer_id, next_deadline,
      is_archived, is_scheduled, owning_division_id, visibility,
      created_by, updated_by, created_at, updated_at, deleted_at, revision
    ) VALUES (
      target_workspace_id, target_issue_id, target_payload, target_status,
      coalesce(target_assigned_officer_id, ''), target_next_deadline,
      target_is_archived, target_is_scheduled, target_owning_division_id,
      target_visibility, actor, actor,
      coalesce(nullif(target_payload ->> 'createdAt', '')::timestamptz, now()),
      now(), NULL, 1
    ) RETURNING cloud_issues.revision, cloud_issues.payload, cloud_issues.updated_at, cloud_issues.updated_by
      INTO revision, payload, updated_at, updated_by;
    saved := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT public.can_edit_issue(target_workspace_id, target_issue_id, actor) THEN
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

  UPDATE public.cloud_issues SET
    payload = target_payload,
    status = target_status,
    assigned_officer_id = coalesce(target_assigned_officer_id, ''),
    next_deadline = target_next_deadline,
    is_archived = target_is_archived,
    is_scheduled = target_is_scheduled,
    owning_division_id = target_owning_division_id,
    visibility = target_visibility,
    updated_by = actor,
    updated_at = now(),
    deleted_at = NULL,
    revision = current_row.revision + 1
  WHERE workspace_id = target_workspace_id AND id = target_issue_id
  RETURNING cloud_issues.revision, cloud_issues.payload, cloud_issues.updated_at, cloud_issues.updated_by
    INTO revision, payload, updated_at, updated_by;
  saved := true;
  RETURN NEXT;
END;
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
  IF NOT public.can_edit_issue(target_workspace_id, target_issue_id, actor) THEN
    RAISE EXCEPTION 'Issue editing access required';
  END IF;

  SELECT * INTO current_row FROM public.cloud_issue_items
  WHERE workspace_id = target_workspace_id AND item_type = target_item_type AND id = target_item_id
  FOR UPDATE;

  IF current_row.id IS NULL THEN
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
    issue_id = target_issue_id,
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

CREATE OR REPLACE FUNCTION public.delete_cloud_issue_revision(
  target_workspace_id uuid,
  target_issue_id uuid,
  expected_revision integer
)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_row public.cloud_issues;
DECLARE actor text := auth.user_id();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO current_row FROM public.cloud_issues
  WHERE workspace_id = target_workspace_id AND id = target_issue_id
  FOR UPDATE;

  IF current_row.id IS NULL THEN
    saved := true;
    revision := expected_revision;
    RETURN NEXT;
    RETURN;
  END IF;
  IF NOT public.can_edit_issue(target_workspace_id, target_issue_id, actor) THEN
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

  UPDATE public.cloud_issues SET
    deleted_at = now(),
    updated_at = now(),
    updated_by = actor,
    revision = current_row.revision + 1
  WHERE workspace_id = target_workspace_id AND id = target_issue_id
  RETURNING cloud_issues.revision, cloud_issues.payload,
    cloud_issues.updated_at, cloud_issues.updated_by
    INTO revision, payload, updated_at, updated_by;
  saved := true;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.delete_cloud_issue_item_revision(
  target_workspace_id uuid,
  target_item_type text,
  target_item_id uuid,
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
  SELECT * INTO current_row FROM public.cloud_issue_items
  WHERE workspace_id = target_workspace_id AND item_type = target_item_type AND id = target_item_id
  FOR UPDATE;

  IF current_row.id IS NULL THEN
    saved := true;
    revision := expected_revision;
    RETURN NEXT;
    RETURN;
  END IF;
  IF NOT public.can_edit_issue(target_workspace_id, current_row.issue_id, actor) THEN
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
    deleted_at = now(),
    updated_at = now(),
    updated_by = actor,
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

GRANT EXECUTE ON FUNCTION public.save_cloud_issue_revision(uuid, uuid, jsonb, integer, text, text, date, boolean, boolean, uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.save_cloud_issue_item_revision(uuid, uuid, text, uuid, jsonb, integer) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.delete_cloud_issue_revision(uuid, uuid, integer) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.delete_cloud_issue_item_revision(uuid, text, uuid, integer) TO authenticated;
--> statement-breakpoint

SELECT pg_notify('pgrst', 'reload schema');
