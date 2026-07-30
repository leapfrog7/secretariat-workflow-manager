ALTER TABLE public.cloud_issue_items
  DROP CONSTRAINT IF EXISTS cloud_issue_items_item_type_check;
--> statement-breakpoint
ALTER TABLE public.cloud_issue_items
  ADD CONSTRAINT cloud_issue_items_item_type_check
  CHECK (item_type IN ('communication', 'reference', 'milestone', 'summary', 'note', 'draft'));
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
  IF target_item_type NOT IN ('communication', 'reference', 'milestone', 'summary', 'note', 'draft') THEN
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

GRANT EXECUTE ON FUNCTION public.save_cloud_issue_item_revision(uuid, uuid, text, uuid, jsonb, integer) TO authenticated;
