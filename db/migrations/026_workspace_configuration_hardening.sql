ALTER TABLE public.cloud_workspace_settings
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_workspace_settings_insert_editors" ON public.cloud_workspace_settings;
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_workspace_settings_update_editors" ON public.cloud_workspace_settings;
--> statement-breakpoint
CREATE POLICY "cloud_workspace_settings_insert_admins" ON public.cloud_workspace_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint
CREATE POLICY "cloud_workspace_settings_update_admins" ON public.cloud_workspace_settings
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "cloud_officers_insert_editors" ON public.cloud_officers;
--> statement-breakpoint
DROP POLICY IF EXISTS "cloud_officers_update_editors" ON public.cloud_officers;
--> statement-breakpoint
CREATE POLICY "cloud_officers_insert_admins" ON public.cloud_officers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint
CREATE POLICY "cloud_officers_update_admins" ON public.cloud_officers
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.save_cloud_workspace_settings_revision(
  target_workspace_id uuid,
  target_payload jsonb,
  expected_revision integer
)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_row public.cloud_workspace_settings;
DECLARE actor text := auth.user_id();
BEGIN
  IF actor IS NULL OR NOT public.is_workspace_admin(target_workspace_id, actor) THEN
    RAISE EXCEPTION 'Workspace administrator access required';
  END IF;
  IF target_payload IS NULL OR jsonb_typeof(target_payload) <> 'object' THEN
    RAISE EXCEPTION 'Workspace settings must be a JSON object';
  END IF;

  SELECT * INTO current_row
  FROM public.cloud_workspace_settings s
  WHERE s.workspace_id = target_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF coalesce(expected_revision, 0) <> 0 THEN
      RETURN QUERY SELECT false, 0, NULL::jsonb, NULL::timestamptz, NULL::text;
      RETURN;
    END IF;
    INSERT INTO public.cloud_workspace_settings (
      workspace_id, payload, created_by, updated_by, revision
    ) VALUES (
      target_workspace_id, target_payload, actor, actor, 1
    ) RETURNING cloud_workspace_settings.revision, cloud_workspace_settings.payload,
      cloud_workspace_settings.updated_at, cloud_workspace_settings.updated_by
      INTO revision, payload, updated_at, updated_by;
    saved := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_row.revision <> coalesce(expected_revision, 0) THEN
    RETURN QUERY SELECT false, current_row.revision, current_row.payload,
      current_row.updated_at, current_row.updated_by;
    RETURN;
  END IF;

  UPDATE public.cloud_workspace_settings SET
    payload = target_payload,
    updated_by = actor,
    updated_at = now(),
    revision = current_row.revision + 1
  WHERE workspace_id = target_workspace_id
  RETURNING cloud_workspace_settings.revision, cloud_workspace_settings.payload,
    cloud_workspace_settings.updated_at, cloud_workspace_settings.updated_by
    INTO revision, payload, updated_at, updated_by;
  saved := true;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.save_cloud_workspace_settings_revision(uuid, jsonb, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.save_cloud_workspace_settings_revision(uuid, jsonb, integer) TO authenticated;
--> statement-breakpoint

SELECT pg_notify('pgrst', 'reload schema');
