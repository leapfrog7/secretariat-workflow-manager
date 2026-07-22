CREATE TABLE IF NOT EXISTS public.cloud_issue_items (
  workspace_id uuid NOT NULL,
  issue_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('communication', 'reference', 'milestone', 'summary', 'draft')),
  id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (
    jsonb_typeof(payload) = 'object'
    AND payload ->> 'id' = id::text
    AND payload ->> 'issueId' = issue_id::text
  ),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (workspace_id, item_type, id),
  FOREIGN KEY (workspace_id, issue_id)
    REFERENCES public.cloud_issues(workspace_id, id)
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cloud_issue_items_issue_idx
  ON public.cloud_issue_items (workspace_id, issue_id, item_type, updated_at DESC);
--> statement-breakpoint

ALTER TABLE public.cloud_issue_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_issue_items TO authenticated;
--> statement-breakpoint

CREATE POLICY "cloud_issue_items_read_members" ON public.cloud_issue_items
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id));
--> statement-breakpoint

CREATE POLICY "cloud_issue_items_insert_editors" ON public.cloud_issue_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_issue_items_update_editors" ON public.cloud_issue_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_issue_items_delete_admins" ON public.cloud_issue_items
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.cloud_workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE public.cloud_workspace_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_workspace_settings TO authenticated;
--> statement-breakpoint

CREATE POLICY "cloud_workspace_settings_read_members" ON public.cloud_workspace_settings
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id));
--> statement-breakpoint

CREATE POLICY "cloud_workspace_settings_insert_editors" ON public.cloud_workspace_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_workspace_settings_update_editors" ON public.cloud_workspace_settings
  FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_workspace_settings_delete_admins" ON public.cloud_workspace_settings
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.cloud_user_settings (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
--> statement-breakpoint

ALTER TABLE public.cloud_user_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE ON public.cloud_user_settings TO authenticated;
--> statement-breakpoint

CREATE POLICY "cloud_user_settings_read_own" ON public.cloud_user_settings
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  );
--> statement-breakpoint

CREATE POLICY "cloud_user_settings_insert_own" ON public.cloud_user_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  );
--> statement-breakpoint

CREATE POLICY "cloud_user_settings_update_own" ON public.cloud_user_settings
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.user_id())
    AND public.is_active_workspace_member(workspace_id)
  );
