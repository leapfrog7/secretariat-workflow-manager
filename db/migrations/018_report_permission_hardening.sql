CREATE OR REPLACE FUNCTION public.can_refine_issue_report(
  target_workspace_id uuid,
  target_issue_ids uuid[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(cardinality(target_issue_ids), 0) BETWEEN 1 AND 200
    AND array_position(target_issue_ids, NULL::uuid) IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(target_issue_ids) AS requested(issue_id)
      WHERE NOT coalesce(
        public.can_read_issue(target_workspace_id, requested.issue_id),
        false
      )
    );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.authorize_cloud_ai_report_request(
  target_workspace_id uuid,
  selected_provider text,
  target_issue_ids uuid[],
  request_identifier uuid,
  prompt_size integer
)
RETURNS TABLE(provider text, model text, input_rate numeric, output_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.can_refine_issue_report(target_workspace_id, target_issue_ids) THEN
    RAISE EXCEPTION 'Issue report access required';
  END IF;

  RETURN QUERY
  SELECT authorized_request.provider, authorized_request.model,
    authorized_request.input_rate, authorized_request.output_rate
  FROM public.authorize_cloud_ai_request(
    target_workspace_id,
    selected_provider,
    'report',
    NULL::uuid,
    request_identifier,
    prompt_size
  ) AS authorized_request;
END;
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.authorize_cloud_ai_report_request(uuid, text, uuid[], uuid, integer) TO authenticated;
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
