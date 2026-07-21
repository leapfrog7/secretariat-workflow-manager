CREATE TABLE IF NOT EXISTS public.cloud_officers (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND payload ->> 'id' = id::text),
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cloud_officers_workspace_idx
  ON public.cloud_officers (workspace_id, is_active, updated_at DESC);
--> statement-breakpoint

ALTER TABLE public.cloud_officers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_officers TO authenticated;
--> statement-breakpoint

CREATE POLICY "cloud_officers_read_members" ON public.cloud_officers
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id));
--> statement-breakpoint

CREATE POLICY "cloud_officers_insert_editors" ON public.cloud_officers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND created_by = (SELECT auth.user_id())
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_officers_update_editors" ON public.cloud_officers
  FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND updated_by = (SELECT auth.user_id())
  );
--> statement-breakpoint

CREATE POLICY "cloud_officers_delete_admins" ON public.cloud_officers
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));
