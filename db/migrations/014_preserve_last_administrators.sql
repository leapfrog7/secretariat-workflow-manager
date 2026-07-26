CREATE OR REPLACE FUNCTION public.preserve_last_profile_administrator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_workspace uuid;
BEGIN
  IF OLD.role = 'platform_admin'
    AND OLD.status = 'active'
    AND (
      TG_OP = 'DELETE'
      OR NEW.role <> 'platform_admin'
      OR NEW.status <> 'active'
    ) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('swm:platform-admin', 0));

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id <> OLD.user_id
        AND p.role = 'platform_admin'
        AND p.status = 'active'
    ) THEN
      RAISE EXCEPTION 'At least one active Platform Admin is required';
    END IF;
  END IF;

  IF OLD.status = 'active'
    AND (TG_OP = 'DELETE' OR NEW.status <> 'active') THEN
    FOR affected_workspace IN
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = OLD.user_id
        AND wm.role = 'workspace_admin'
        AND wm.status = 'active'
      ORDER BY wm.workspace_id
    LOOP
      PERFORM pg_advisory_xact_lock(
        hashtextextended('swm:workspace-admin:' || affected_workspace::text, 0)
      );

      IF NOT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        JOIN public.profiles p ON p.user_id = wm.user_id
        WHERE wm.workspace_id = affected_workspace
          AND wm.user_id <> OLD.user_id
          AND wm.role = 'workspace_admin'
          AND wm.status = 'active'
          AND p.status = 'active'
      ) THEN
        RAISE EXCEPTION 'At least one active Workspace Admin is required for each workspace';
      END IF;
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.preserve_last_workspace_administrator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'workspace_admin'
    AND OLD.status = 'active'
    AND (
      TG_OP = 'DELETE'
      OR NEW.workspace_id <> OLD.workspace_id
      OR NEW.role <> 'workspace_admin'
      OR NEW.status <> 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.workspaces w WHERE w.id = OLD.workspace_id
    ) THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('swm:workspace-admin:' || OLD.workspace_id::text, 0)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.profiles p ON p.user_id = wm.user_id
      WHERE wm.workspace_id = OLD.workspace_id
        AND wm.user_id <> OLD.user_id
        AND wm.role = 'workspace_admin'
        AND wm.status = 'active'
        AND p.status = 'active'
    ) THEN
      RAISE EXCEPTION 'At least one active Workspace Admin is required for each workspace';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS preserve_last_profile_administrator_trigger
ON public.profiles;
--> statement-breakpoint

CREATE TRIGGER preserve_last_profile_administrator_trigger
BEFORE UPDATE OF role, status OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.preserve_last_profile_administrator();
--> statement-breakpoint

DROP TRIGGER IF EXISTS preserve_last_workspace_administrator_trigger
ON public.workspace_members;
--> statement-breakpoint

CREATE TRIGGER preserve_last_workspace_administrator_trigger
BEFORE UPDATE OF workspace_id, role, status OR DELETE ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.preserve_last_workspace_administrator();
