CREATE OR REPLACE FUNCTION public.require_issue_division_when_enforced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  division_access_is_enabled boolean;
BEGIN
  SELECT w.division_access_enabled
  INTO division_access_is_enabled
  FROM public.workspaces w
  WHERE w.id = NEW.workspace_id;

  IF division_access_is_enabled AND NEW.owning_division_id IS NULL THEN
    RAISE EXCEPTION 'Choose an owning division while division-based access is enforced';
  END IF;

  IF division_access_is_enabled
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_divisions d
      WHERE d.workspace_id = NEW.workspace_id
        AND d.id = NEW.owning_division_id
        AND d.is_active = true
    ) THEN
    RAISE EXCEPTION 'The owning division must be active while division-based access is enforced';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS require_issue_division_when_enforced_trigger
ON public.cloud_issues;
--> statement-breakpoint

CREATE TRIGGER require_issue_division_when_enforced_trigger
BEFORE INSERT OR UPDATE OF workspace_id, owning_division_id
ON public.cloud_issues
FOR EACH ROW
EXECUTE FUNCTION public.require_issue_division_when_enforced();
