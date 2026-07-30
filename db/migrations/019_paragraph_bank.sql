CREATE TABLE public.paragraph_bank_entries (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('personal', 'workspace')),
  owner_user_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (workspace_id, id)
);
--> statement-breakpoint

CREATE INDEX paragraph_bank_entries_visible_idx
  ON public.paragraph_bank_entries (workspace_id, scope, owner_user_id, updated_at DESC);
--> statement-breakpoint

ALTER TABLE public.paragraph_bank_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "paragraph_bank_read_visible" ON public.paragraph_bank_entries
FOR SELECT TO authenticated
USING (
  public.is_active_workspace_member(workspace_id)
  AND (scope = 'workspace' OR owner_user_id = auth.user_id())
);
--> statement-breakpoint

CREATE POLICY "paragraph_bank_insert_managed" ON public.paragraph_bank_entries
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_workspace_member(workspace_id)
  AND (
    (scope = 'personal' AND owner_user_id = auth.user_id())
    OR (scope = 'workspace' AND public.is_workspace_admin(workspace_id))
  )
);
--> statement-breakpoint

CREATE POLICY "paragraph_bank_update_managed" ON public.paragraph_bank_entries
FOR UPDATE TO authenticated
USING (
  public.is_active_workspace_member(workspace_id)
  AND (
    (scope = 'personal' AND owner_user_id = auth.user_id())
    OR (scope = 'workspace' AND public.is_workspace_admin(workspace_id))
  )
)
WITH CHECK (
  public.is_active_workspace_member(workspace_id)
  AND (
    (scope = 'personal' AND owner_user_id = auth.user_id())
    OR (scope = 'workspace' AND public.is_workspace_admin(workspace_id))
  )
);
--> statement-breakpoint

CREATE POLICY "paragraph_bank_delete_managed" ON public.paragraph_bank_entries
FOR DELETE TO authenticated
USING (
  public.is_active_workspace_member(workspace_id)
  AND (
    (scope = 'personal' AND owner_user_id = auth.user_id())
    OR (scope = 'workspace' AND public.is_workspace_admin(workspace_id))
  )
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.save_paragraph_bank_entry_revision(
  target_workspace_id uuid,
  target_entry_id uuid,
  target_payload jsonb,
  expected_revision integer
)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id text := auth.user_id();
  requested_scope text := coalesce(target_payload->>'scope', 'personal');
  requested_owner text := coalesce(nullif(target_payload->>'ownerUserId', ''), actor_id);
  existing public.paragraph_bank_entries;
  saved_row public.paragraph_bank_entries;
BEGIN
  IF actor_id IS NULL OR NOT public.is_active_workspace_member(target_workspace_id) THEN
    RAISE EXCEPTION 'Active workspace access required';
  END IF;
  IF requested_scope NOT IN ('personal', 'workspace') THEN
    RAISE EXCEPTION 'Invalid paragraph scope';
  END IF;
  IF requested_scope = 'personal' AND requested_owner <> actor_id THEN
    RAISE EXCEPTION 'Personal paragraphs can only belong to the current user';
  END IF;
  IF requested_scope = 'workspace' AND NOT public.is_workspace_admin(target_workspace_id) THEN
    RAISE EXCEPTION 'Workspace administrator access required';
  END IF;

  SELECT * INTO existing
  FROM public.paragraph_bank_entries entry
  WHERE entry.workspace_id = target_workspace_id AND entry.id = target_entry_id
  FOR UPDATE;

  IF existing.id IS NOT NULL THEN
    IF existing.scope = 'personal' AND existing.owner_user_id <> actor_id THEN
      RAISE EXCEPTION 'Paragraph management permission required';
    END IF;
    IF existing.scope = 'workspace' AND NOT public.is_workspace_admin(target_workspace_id) THEN
      RAISE EXCEPTION 'Workspace administrator access required';
    END IF;
    IF existing.revision <> expected_revision THEN
      RETURN QUERY SELECT false, existing.revision, existing.payload,
        existing.updated_at, existing.updated_by;
      RETURN;
    END IF;

    UPDATE public.paragraph_bank_entries entry
    SET scope = requested_scope,
        owner_user_id = requested_owner,
        payload = target_payload,
        status = coalesce(nullif(target_payload->>'status', ''), 'active'),
        revision = entry.revision + 1,
        updated_by = actor_id,
        updated_at = now(),
        deleted_at = NULL
    WHERE entry.workspace_id = target_workspace_id AND entry.id = target_entry_id
    RETURNING * INTO saved_row;
  ELSE
    IF expected_revision <> 0 THEN
      RETURN QUERY SELECT false, 0, NULL::jsonb, NULL::timestamptz, NULL::text;
      RETURN;
    END IF;
    INSERT INTO public.paragraph_bank_entries (
      workspace_id, id, scope, owner_user_id, payload, status,
      revision, created_by, updated_by
    ) VALUES (
      target_workspace_id, target_entry_id, requested_scope, requested_owner,
      target_payload, coalesce(nullif(target_payload->>'status', ''), 'active'),
      1, actor_id, actor_id
    )
    RETURNING * INTO saved_row;
  END IF;

  RETURN QUERY SELECT true, saved_row.revision, saved_row.payload,
    saved_row.updated_at, saved_row.updated_by;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.delete_paragraph_bank_entry_revision(
  target_workspace_id uuid,
  target_entry_id uuid,
  expected_revision integer
)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id text := auth.user_id();
  existing public.paragraph_bank_entries;
  saved_row public.paragraph_bank_entries;
BEGIN
  IF actor_id IS NULL OR NOT public.is_active_workspace_member(target_workspace_id) THEN
    RAISE EXCEPTION 'Active workspace access required';
  END IF;
  SELECT * INTO existing
  FROM public.paragraph_bank_entries entry
  WHERE entry.workspace_id = target_workspace_id AND entry.id = target_entry_id
  FOR UPDATE;
  IF existing.id IS NULL THEN
    RETURN QUERY SELECT true, 0, NULL::jsonb, NULL::timestamptz, actor_id;
    RETURN;
  END IF;
  IF existing.scope = 'personal' AND existing.owner_user_id <> actor_id THEN
    RAISE EXCEPTION 'Paragraph management permission required';
  END IF;
  IF existing.scope = 'workspace' AND NOT public.is_workspace_admin(target_workspace_id) THEN
    RAISE EXCEPTION 'Workspace administrator access required';
  END IF;
  IF existing.revision <> expected_revision THEN
    RETURN QUERY SELECT false, existing.revision, existing.payload,
      existing.updated_at, existing.updated_by;
    RETURN;
  END IF;

  UPDATE public.paragraph_bank_entries entry
  SET revision = entry.revision + 1, updated_by = actor_id,
      updated_at = now(), deleted_at = now()
  WHERE entry.workspace_id = target_workspace_id AND entry.id = target_entry_id
  RETURNING * INTO saved_row;
  RETURN QUERY SELECT true, saved_row.revision, saved_row.payload,
    saved_row.updated_at, saved_row.updated_by;
END;
$$;
--> statement-breakpoint

GRANT SELECT ON public.paragraph_bank_entries TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.save_paragraph_bank_entry_revision(uuid, uuid, jsonb, integer) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.delete_paragraph_bank_entry_revision(uuid, uuid, integer) TO authenticated;
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
