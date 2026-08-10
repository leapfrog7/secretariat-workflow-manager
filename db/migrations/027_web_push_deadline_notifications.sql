CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) BETWEEN 20 AND 4096),
  p256dh text NOT NULL CHECK (char_length(p256dh) BETWEEN 20 AND 512),
  auth_secret text NOT NULL CHECK (char_length(auth_secret) BETWEEN 8 AND 256),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (workspace_id, user_id, updated_at DESC);
--> statement-breakpoint

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT ON public.push_subscriptions TO authenticated;
--> statement-breakpoint

CREATE POLICY "push_subscriptions_read_own" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  );
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  target_workspace_id uuid,
  target_endpoint text,
  target_p256dh text,
  target_auth_secret text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id text := (SELECT auth.user_id());
  subscription_id uuid;
  existing public.push_subscriptions%ROWTYPE;
BEGIN
  IF caller_id IS NULL OR NOT public.is_active_workspace_member(target_workspace_id) THEN
    RAISE EXCEPTION 'Active workspace membership is required.';
  END IF;
  IF char_length(target_endpoint) NOT BETWEEN 20 AND 4096
     OR char_length(target_p256dh) NOT BETWEEN 20 AND 512
     OR char_length(target_auth_secret) NOT BETWEEN 8 AND 256 THEN
    RAISE EXCEPTION 'Invalid push subscription.';
  END IF;

  SELECT * INTO existing FROM public.push_subscriptions WHERE endpoint = target_endpoint;
  IF FOUND AND (existing.p256dh <> target_p256dh OR existing.auth_secret <> target_auth_secret) THEN
    RAISE EXCEPTION 'Push subscription credentials do not match.';
  END IF;

  INSERT INTO public.push_subscriptions (workspace_id, user_id, endpoint, p256dh, auth_secret)
  VALUES (target_workspace_id, caller_id, target_endpoint, target_p256dh, target_auth_secret)
  ON CONFLICT (endpoint) DO UPDATE
    SET workspace_id = EXCLUDED.workspace_id,
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth_secret = EXCLUDED.auth_secret,
        updated_at = now()
  RETURNING id INTO subscription_id;
  RETURN subscription_id;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(
  target_workspace_id uuid,
  target_endpoint text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id text := (SELECT auth.user_id());
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM public.push_subscriptions
  WHERE workspace_id = target_workspace_id
    AND user_id = caller_id
    AND endpoint = target_endpoint;
  RETURN FOUND;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.register_push_subscription(uuid, text, text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.unregister_push_subscription(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.register_push_subscription(uuid, text, text, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(uuid, text) TO authenticated;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.push_notification_deliveries (
  notification_id uuid NOT NULL REFERENCES public.cloud_notifications(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'expired')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 10),
  error text NOT NULL DEFAULT '',
  attempted_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (notification_id, subscription_id)
);
--> statement-breakpoint

ALTER TABLE public.push_notification_deliveries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS push_count integer NOT NULL DEFAULT 0;
