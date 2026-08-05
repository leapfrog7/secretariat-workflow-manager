CREATE OR REPLACE FUNCTION public.search_casework_issues(
  target_workspace_id uuid,
  search_text text DEFAULT '',
  page_limit integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS TABLE(issue_id uuid, short_title text, status text, updated_at timestamptz, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH matching AS (
    SELECT
      i.id,
      coalesce(nullif(trim(i.payload ->> 'shortTitle'), ''), 'Untitled Issue') AS title,
      i.status,
      i.updated_at
    FROM public.cloud_issues i
    WHERE i.workspace_id = target_workspace_id
      AND i.deleted_at IS NULL
      AND NOT i.is_archived
      AND NOT i.is_scheduled
      AND public.can_read_issue(i.workspace_id, i.id)
      AND (
        trim(coalesce(search_text, '')) = ''
        OR position(
          lower(trim(search_text)) IN lower(concat_ws(' ',
            i.payload ->> 'shortTitle',
            i.payload ->> 'eFileNumber',
            i.payload ->> 'subjectType',
            i.payload ->> 'currentPosition',
            i.status
          ))
        ) > 0
      )
  )
  SELECT id, title, matching.status, matching.updated_at, count(*) OVER ()
  FROM matching
  ORDER BY matching.updated_at DESC, id
  LIMIT least(greatest(page_limit, 1), 50)
  OFFSET greatest(page_offset, 0);
$$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.casework_operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  issue_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('casework.load_failed', 'casework.search_failed', 'casework.ai_handoff_failed')),
  operation text NOT NULL DEFAULT '' CHECK (length(operation) <= 48),
  provider text NOT NULL DEFAULT '' CHECK (length(provider) <= 32),
  error_code text NOT NULL DEFAULT 'unknown' CHECK (length(error_code) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS casework_operational_events_workspace_created_idx
  ON public.casework_operational_events (workspace_id, created_at DESC);
--> statement-breakpoint

ALTER TABLE public.casework_operational_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "casework_operational_events_admin_read" ON public.casework_operational_events;
--> statement-breakpoint
CREATE POLICY "casework_operational_events_admin_read" ON public.casework_operational_events
  FOR SELECT TO authenticated
  USING (public.is_workspace_admin(workspace_id) AND public.is_active_workspace_member(workspace_id));
--> statement-breakpoint

GRANT SELECT ON public.casework_operational_events TO authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.record_casework_operational_event(
  target_workspace_id uuid,
  target_issue_id uuid,
  target_event_type text,
  target_operation text DEFAULT '',
  target_provider text DEFAULT '',
  target_error_code text DEFAULT 'unknown'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE event_id uuid;
DECLARE actor text := auth.user_id();
BEGIN
  IF actor IS NULL OR NOT public.is_active_workspace_member(target_workspace_id, actor) THEN
    RAISE EXCEPTION 'Active workspace membership required';
  END IF;
  IF target_issue_id IS NOT NULL AND NOT public.can_read_issue(target_workspace_id, target_issue_id, actor) THEN
    RAISE EXCEPTION 'Issue access required';
  END IF;
  IF target_event_type NOT IN ('casework.load_failed', 'casework.search_failed', 'casework.ai_handoff_failed') THEN
    RAISE EXCEPTION 'Unsupported operational event';
  END IF;

  INSERT INTO public.casework_operational_events (
    workspace_id, user_id, issue_id, event_type, operation, provider, error_code
  ) VALUES (
    target_workspace_id,
    actor,
    target_issue_id,
    target_event_type,
    left(coalesce(target_operation, ''), 48),
    left(coalesce(target_provider, ''), 32),
    left(coalesce(nullif(target_error_code, ''), 'unknown'), 80)
  ) RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.search_casework_issues(uuid, text, integer, integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.record_casework_operational_event(uuid, uuid, text, text, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.search_casework_issues(uuid, text, integer, integer) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.record_casework_operational_event(uuid, uuid, text, text, text, text) TO authenticated;
--> statement-breakpoint

SELECT pg_notify('pgrst', 'reload schema');
