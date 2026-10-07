CREATE OR REPLACE FUNCTION public.save_issue_reference_link_revision(
  target_workspace_id uuid,
  target_issue_id uuid,
  target_id uuid,
  target_reference_id uuid,
  target_payload jsonb,
  expected_revision integer
)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor text := auth.user_id();
  current_row public.issue_reference_links;
  saved_row public.issue_reference_links;
BEGIN
  IF actor IS NULL OR NOT public.can_edit_issue(target_workspace_id, target_issue_id) THEN
    RAISE EXCEPTION 'Issue edit access required';
  END IF;

  IF target_payload IS NULL OR jsonb_typeof(target_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid Issue reference link payload';
  END IF;

  IF target_payload->>'id' IS DISTINCT FROM target_id::text
    OR target_payload->>'issueId' IS DISTINCT FROM target_issue_id::text
    OR target_payload->>'referenceId' IS DISTINCT FROM target_reference_id::text THEN
    RAISE EXCEPTION 'Issue reference link payload does not match its target';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_references
    WHERE workspace_id = target_workspace_id
      AND id = target_reference_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Reference not available';
  END IF;

  SELECT * INTO current_row
  FROM public.issue_reference_links
  WHERE workspace_id = target_workspace_id
    AND id = target_id
  FOR UPDATE;

  IF FOUND THEN
    -- SECURITY DEFINER bypasses row policies, so authorize the stored parent too.
    -- Do this before returning conflict metadata or updating any content.
    IF NOT public.can_edit_issue(target_workspace_id, current_row.issue_id)
      OR current_row.issue_id <> target_issue_id
      OR current_row.reference_id <> target_reference_id THEN
      RAISE EXCEPTION 'Issue reference link not available';
    END IF;

    IF current_row.revision <> expected_revision THEN
      RETURN QUERY
      SELECT false, current_row.revision, current_row.payload,
        current_row.updated_at, current_row.updated_by;
      RETURN;
    END IF;

    UPDATE public.issue_reference_links
    SET payload = target_payload,
      revision = issue_reference_links.revision + 1,
      updated_by = actor,
      updated_at = now(),
      deleted_at = NULL
    WHERE workspace_id = target_workspace_id
      AND issue_id = target_issue_id
      AND id = target_id
      AND reference_id = target_reference_id
    RETURNING * INTO saved_row;
  ELSE
    IF expected_revision <> 0 THEN
      RETURN QUERY
      SELECT false, 0, NULL::jsonb, NULL::timestamptz, NULL::text;
      RETURN;
    END IF;

    INSERT INTO public.issue_reference_links (
      workspace_id, issue_id, id, reference_id, payload, created_by, updated_by
    ) VALUES (
      target_workspace_id, target_issue_id, target_id, target_reference_id,
      target_payload, actor, actor
    )
    RETURNING * INTO saved_row;
  END IF;

  RETURN QUERY
  SELECT true, saved_row.revision, saved_row.payload,
    saved_row.updated_at, saved_row.updated_by;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.save_issue_reference_link_revision(uuid, uuid, uuid, uuid, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_issue_reference_link_revision(uuid, uuid, uuid, uuid, jsonb, integer) TO authenticated;
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
