CREATE TABLE IF NOT EXISTS public.cloud_ai_provider_settings (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'gemini')),
  enabled boolean NOT NULL DEFAULT false,
  model text NOT NULL,
  allowed_roles text[] NOT NULL DEFAULT ARRAY['workspace_admin', 'officer']::text[],
  daily_user_request_limit integer NOT NULL DEFAULT 20 CHECK (daily_user_request_limit BETWEEN 1 AND 500),
  monthly_workspace_request_limit integer NOT NULL DEFAULT 500 CHECK (monthly_workspace_request_limit BETWEEN 1 AND 100000),
  monthly_budget_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (monthly_budget_usd >= 0),
  input_cost_per_million_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (input_cost_per_million_usd >= 0),
  output_cost_per_million_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (output_cost_per_million_usd >= 0),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, provider)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.cloud_ai_user_permissions (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai', 'gemini')),
  allowed boolean NOT NULL,
  daily_request_limit integer CHECK (daily_request_limit BETWEEN 1 AND 500),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, provider)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.cloud_ai_generation_logs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  issue_id uuid,
  provider text NOT NULL CHECK (provider IN ('openai', 'gemini')),
  model text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('draft', 'paragraph')),
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  prompt_characters integer NOT NULL DEFAULT 0 CHECK (prompt_characters >= 0),
  response_characters integer NOT NULL DEFAULT 0 CHECK (response_characters >= 0),
  request_fingerprint text NOT NULL DEFAULT '',
  error_code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cloud_ai_logs_workspace_month_idx
  ON public.cloud_ai_generation_logs (workspace_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cloud_ai_logs_user_day_idx
  ON public.cloud_ai_generation_logs (workspace_id, user_id, provider, created_at DESC);
--> statement-breakpoint

ALTER TABLE public.cloud_ai_provider_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.cloud_ai_user_permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.cloud_ai_generation_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE ON public.cloud_ai_provider_settings TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_ai_user_permissions TO authenticated;
--> statement-breakpoint
GRANT SELECT ON public.cloud_ai_generation_logs TO authenticated;
--> statement-breakpoint

CREATE POLICY "ai_provider_settings_read_members" ON public.cloud_ai_provider_settings
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id));
--> statement-breakpoint
CREATE POLICY "ai_provider_settings_insert_admins" ON public.cloud_ai_provider_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint
CREATE POLICY "ai_provider_settings_update_admins" ON public.cloud_ai_provider_settings
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "ai_user_permissions_read_related" ON public.cloud_ai_user_permissions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.user_id()) OR public.is_workspace_admin(workspace_id));
--> statement-breakpoint
CREATE POLICY "ai_user_permissions_insert_admins" ON public.cloud_ai_user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id) AND updated_by = (SELECT auth.user_id()));
--> statement-breakpoint
CREATE POLICY "ai_user_permissions_update_admins" ON public.cloud_ai_user_permissions
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id) AND updated_by = (SELECT auth.user_id()));
--> statement-breakpoint
CREATE POLICY "ai_user_permissions_delete_admins" ON public.cloud_ai_user_permissions
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));
--> statement-breakpoint

CREATE POLICY "ai_generation_logs_read_related" ON public.cloud_ai_generation_logs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.user_id()) OR public.is_workspace_admin(workspace_id));
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
  IF selected_operation NOT IN ('draft', 'paragraph') THEN RAISE EXCEPTION 'Unsupported AI operation'; END IF;
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
