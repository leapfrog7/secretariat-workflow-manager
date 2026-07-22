CREATE TABLE IF NOT EXISTS public.cloud_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  issue_id uuid,
  notification_type text NOT NULL CHECK (notification_type IN (
    'scheduled_returned',
    'deadline_upcoming',
    'deadline_due',
    'deadline_overdue',
    'weekly_digest',
    'monthly_digest'
  )),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  event_date date NOT NULL,
  due_date date,
  dedupe_key text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email_requested boolean NOT NULL DEFAULT false,
  email_status text NOT NULL DEFAULT 'not_requested' CHECK (email_status IN ('not_requested', 'pending', 'sent', 'not_configured', 'failed')),
  email_error text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, dedupe_key),
  FOREIGN KEY (workspace_id, issue_id)
    REFERENCES public.cloud_issues(workspace_id, id)
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cloud_notifications_inbox_idx
  ON public.cloud_notifications (workspace_id, user_id, in_app, read_at, created_at DESC);
--> statement-breakpoint

ALTER TABLE public.cloud_notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT ON public.cloud_notifications TO authenticated;
--> statement-breakpoint
GRANT UPDATE (read_at) ON public.cloud_notifications TO authenticated;
--> statement-breakpoint

CREATE POLICY "cloud_notifications_read_own" ON public.cloud_notifications
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  );
--> statement-breakpoint

CREATE POLICY "cloud_notifications_mark_own_read" ON public.cloud_notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  );
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.automation_runs (
  run_date date PRIMARY KEY,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  reactivated_count integer NOT NULL DEFAULT 0,
  notification_count integer NOT NULL DEFAULT 0,
  email_count integer NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NOT NULL DEFAULT ''
);
--> statement-breakpoint

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
