ALTER TABLE public.cloud_ai_generation_logs
  DROP CONSTRAINT IF EXISTS cloud_ai_generation_logs_operation_check;
--> statement-breakpoint

ALTER TABLE public.cloud_ai_generation_logs
  ADD CONSTRAINT cloud_ai_generation_logs_operation_check
  CHECK (operation IN ('draft', 'paragraph', 'report'));
--> statement-breakpoint

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
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(target_issue_ids) AS requested(issue_id)
      WHERE NOT public.can_read_issue(target_workspace_id, requested.issue_id)
    );
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.can_refine_issue_report(uuid, uuid[]) TO authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.authorize_cloud_ai_request(
  target_workspace_id uuid,
  selected_provider text,
  selected_operation text,
  target_issue_id uuid,
  request_identifier uuid,
  prompt_size integer
)
RETURNS TABLE(provider text, model text, input_rate numeric, output_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id text := auth.user_id();
  member_role text;
  provider_row public.cloud_ai_provider_settings;
  permission_row public.cloud_ai_user_permissions;
  effective_daily_limit integer;
  used_today integer;
  used_this_month integer;
  spent_this_month numeric(12,6);
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF selected_provider NOT IN ('openai', 'gemini') THEN RAISE EXCEPTION 'Unsupported AI provider'; END IF;
  IF selected_operation NOT IN ('draft', 'paragraph', 'report') THEN RAISE EXCEPTION 'Unsupported AI operation'; END IF;
  IF prompt_size < 1 OR prompt_size > 80000 THEN RAISE EXCEPTION 'AI request is empty or too large'; END IF;

  SELECT m.role INTO member_role
  FROM public.workspace_members m
  JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.workspace_id = target_workspace_id
    AND m.user_id = actor_id
    AND m.status = 'active'
    AND p.status = 'active';
  IF member_role IS NULL THEN RAISE EXCEPTION 'Active workspace access required'; END IF;

  SELECT * INTO provider_row
  FROM public.cloud_ai_provider_settings s
  WHERE s.workspace_id = target_workspace_id AND s.provider = selected_provider
  FOR UPDATE;
  IF provider_row.workspace_id IS NULL OR provider_row.enabled = false THEN
    RAISE EXCEPTION 'This AI provider is disabled for the workspace';
  END IF;

  SELECT * INTO permission_row
  FROM public.cloud_ai_user_permissions p
  WHERE p.workspace_id = target_workspace_id AND p.user_id = actor_id AND p.provider = selected_provider;
  IF permission_row.workspace_id IS NOT NULL AND permission_row.allowed = false THEN
    RAISE EXCEPTION 'Your account is not permitted to use this AI provider';
  END IF;
  IF permission_row.workspace_id IS NULL AND NOT (member_role = ANY(provider_row.allowed_roles)) THEN
    RAISE EXCEPTION 'Your workspace role is not permitted to use this AI provider';
  END IF;

  effective_daily_limit := coalesce(permission_row.daily_request_limit, provider_row.daily_user_request_limit);
  SELECT count(*) INTO used_today
  FROM public.cloud_ai_generation_logs l
  WHERE l.workspace_id = target_workspace_id AND l.user_id = actor_id AND l.provider = selected_provider
    AND l.created_at >= date_trunc('day', now());
  IF used_today >= effective_daily_limit THEN RAISE EXCEPTION 'Your daily AI request limit has been reached'; END IF;

  SELECT count(*), coalesce(sum(l.estimated_cost_usd), 0) INTO used_this_month, spent_this_month
  FROM public.cloud_ai_generation_logs l
  WHERE l.workspace_id = target_workspace_id
    AND l.created_at >= date_trunc('month', now());
  IF used_this_month >= provider_row.monthly_workspace_request_limit THEN
    RAISE EXCEPTION 'The workspace monthly AI request limit has been reached';
  END IF;
  IF provider_row.monthly_budget_usd > 0 AND spent_this_month >= provider_row.monthly_budget_usd THEN
    RAISE EXCEPTION 'The workspace monthly AI budget has been reached';
  END IF;

  INSERT INTO public.cloud_ai_generation_logs (
    id, workspace_id, user_id, issue_id, provider, model, operation, status, prompt_characters
  ) VALUES (
    request_identifier, target_workspace_id, actor_id, target_issue_id, selected_provider,
    provider_row.model, selected_operation, 'pending', prompt_size
  );

  RETURN QUERY SELECT selected_provider, provider_row.model,
    provider_row.input_cost_per_million_usd, provider_row.output_cost_per_million_usd;
END;
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.authorize_cloud_ai_request(uuid, text, text, uuid, uuid, integer) TO authenticated;
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
