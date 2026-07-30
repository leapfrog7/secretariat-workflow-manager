CREATE OR REPLACE FUNCTION public.enforce_draft_snapshot_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.item_type <> 'draft' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  WITH overflow AS (
    SELECT entry.id
    FROM public.cloud_issue_items entry
    WHERE entry.workspace_id = NEW.workspace_id
      AND entry.issue_id = NEW.issue_id
      AND entry.item_type = 'draft'
      AND entry.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN entry.payload->>'version' ~ '^[0-9]+$'
          THEN (entry.payload->>'version')::integer
        ELSE 0
      END DESC,
      entry.updated_at DESC,
      entry.id DESC
    OFFSET 5
  )
  UPDATE public.cloud_issue_items entry
  SET deleted_at = now(),
      revision = entry.revision + 1,
      updated_by = NEW.updated_by,
      updated_at = now()
  WHERE entry.workspace_id = NEW.workspace_id
    AND entry.issue_id = NEW.issue_id
    AND entry.item_type = 'draft'
    AND entry.deleted_at IS NULL
    AND entry.id IN (SELECT id FROM overflow);

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_draft_snapshot_retention_trigger
ON public.cloud_issue_items;
--> statement-breakpoint

CREATE TRIGGER enforce_draft_snapshot_retention_trigger
AFTER INSERT OR UPDATE ON public.cloud_issue_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_draft_snapshot_retention();
--> statement-breakpoint

WITH ranked AS (
  SELECT
    workspace_id,
    issue_id,
    id,
    row_number() OVER (
      PARTITION BY workspace_id, issue_id
      ORDER BY
        CASE
          WHEN payload->>'version' ~ '^[0-9]+$'
            THEN (payload->>'version')::integer
          ELSE 0
        END DESC,
        updated_at DESC,
        id DESC
    ) AS position
  FROM public.cloud_issue_items
  WHERE item_type = 'draft' AND deleted_at IS NULL
)
UPDATE public.cloud_issue_items entry
SET deleted_at = now(),
    revision = entry.revision + 1,
    updated_at = now()
FROM ranked
WHERE ranked.workspace_id = entry.workspace_id
  AND ranked.issue_id = entry.issue_id
  AND ranked.id = entry.id
  AND ranked.position > 5;
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
