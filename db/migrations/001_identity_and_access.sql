CREATE TABLE IF NOT EXISTS public.profiles (
  user_id text PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'platform_admin')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles (lower(email));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'officer' CHECK (role IN ('workspace_admin', 'officer', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id text NOT NULL,
  event_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_platform_admin(candidate_user_id text DEFAULT auth.user_id())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = candidate_user_id
      AND role = 'platform_admin'
      AND status = 'active'
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_active_workspace_member(candidate_workspace_id uuid, candidate_user_id text DEFAULT auth.user_id())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_platform_admin(candidate_user_id) OR EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = candidate_workspace_id
      AND user_id = candidate_user_id
      AND status = 'active'
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.admin_update_profile(target_user_id text, next_status text, next_role text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_profile public.profiles;
BEGIN
  IF NOT public.is_platform_admin(auth.user_id()) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF next_status NOT IN ('pending', 'active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid profile status';
  END IF;
  IF next_role NOT IN ('user', 'platform_admin') THEN
    RAISE EXCEPTION 'Invalid profile role';
  END IF;
  IF target_user_id = auth.user_id() AND (next_status <> 'active' OR next_role <> 'platform_admin') THEN
    RAISE EXCEPTION 'An administrator cannot remove their own active administrator access';
  END IF;

  UPDATE public.profiles
  SET status = next_status,
      role = next_role,
      reviewed_by = auth.user_id(),
      reviewed_at = now(),
      updated_at = now()
  WHERE user_id = target_user_id
  RETURNING * INTO updated_profile;

  IF updated_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO public.audit_events (actor_user_id, event_type, target_type, target_id, metadata)
  VALUES (
    auth.user_id(),
    'profile.access_updated',
    'profile',
    target_user_id,
    jsonb_build_object('status', next_status, 'role', next_role)
  );

  RETURN updated_profile;
END;
$$;
--> statement-breakpoint

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT, INSERT ON public.profiles TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
--> statement-breakpoint
GRANT SELECT ON public.audit_events TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_platform_admin(text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_active_workspace_member(uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_update_profile(text, text, text) TO authenticated;
--> statement-breakpoint

CREATE POLICY "profiles_read_self_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.user_id()) OR public.is_platform_admin());
--> statement-breakpoint

CREATE POLICY "profiles_register_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.user_id())
    AND status = 'pending'
    AND role = 'user'
  );
--> statement-breakpoint

CREATE POLICY "workspaces_read_members" ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(id));
--> statement-breakpoint

CREATE POLICY "workspaces_admin_insert" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin() AND created_by = (SELECT auth.user_id()));
--> statement-breakpoint

CREATE POLICY "workspaces_admin_update" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
--> statement-breakpoint

CREATE POLICY "memberships_read_related" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.user_id()) OR public.is_platform_admin());
--> statement-breakpoint

CREATE POLICY "memberships_admin_manage" ON public.workspace_members
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
--> statement-breakpoint

CREATE POLICY "audit_admin_read" ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());
