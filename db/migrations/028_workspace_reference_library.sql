CREATE TABLE public.workspace_references (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (workspace_id, id)
);
--> statement-breakpoint
CREATE TABLE public.issue_reference_links (
  workspace_id uuid NOT NULL,
  issue_id uuid NOT NULL,
  id uuid NOT NULL,
  reference_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, issue_id, reference_id),
  FOREIGN KEY (workspace_id, issue_id) REFERENCES public.cloud_issues(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, reference_id) REFERENCES public.workspace_references(workspace_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX workspace_references_search_idx ON public.workspace_references (workspace_id, status, updated_at DESC);
CREATE INDEX issue_reference_links_issue_idx ON public.issue_reference_links (workspace_id, issue_id, updated_at DESC);
--> statement-breakpoint
ALTER TABLE public.workspace_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_reference_links ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "workspace_references_read" ON public.workspace_references FOR SELECT TO authenticated
USING (public.is_active_workspace_member(workspace_id));
CREATE POLICY "workspace_references_write" ON public.workspace_references FOR ALL TO authenticated
USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "issue_reference_links_read" ON public.issue_reference_links FOR SELECT TO authenticated
USING (public.can_read_issue(workspace_id, issue_id));
CREATE POLICY "issue_reference_links_write" ON public.issue_reference_links FOR ALL TO authenticated
USING (public.can_edit_issue(workspace_id, issue_id)) WITH CHECK (public.can_edit_issue(workspace_id, issue_id));
--> statement-breakpoint
INSERT INTO public.workspace_references (workspace_id, id, payload, status, revision, created_by, updated_by, created_at, updated_at)
SELECT item.workspace_id, item.id,
  jsonb_build_object(
    'id', item.id, 'title', coalesce(nullif(item.payload->>'citation', ''), 'Untitled reference'),
    'citation', coalesce(item.payload->>'citation', ''), 'referenceDate', coalesce(item.payload->>'referenceDate', ''),
    'authority', '', 'referenceType', 'Other', 'tags', '[]'::jsonb, 'retainedText', '', 'extracts', '[]'::jsonb,
    'scope', 'workspace', 'status', 'active', 'createdAt', item.created_at, 'updatedAt', item.updated_at
  ), 'active', greatest(item.revision, 1), item.created_by, item.updated_by, item.created_at, item.updated_at
FROM public.cloud_issue_items item WHERE item.item_type = 'reference' AND item.deleted_at IS NULL
ON CONFLICT (workspace_id, id) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.issue_reference_links (workspace_id, issue_id, id, reference_id, payload, revision, created_by, updated_by, created_at, updated_at)
SELECT item.workspace_id, item.issue_id, gen_random_uuid(), item.id,
  jsonb_build_object('issueId', item.issue_id, 'referenceId', item.id, 'relevanceNote', coalesce(item.payload->>'notes', ''), 'extractIds', '[]'::jsonb, 'includeFullText', false),
  1, item.created_by, item.updated_by, item.created_at, item.updated_at
FROM public.cloud_issue_items item WHERE item.item_type = 'reference' AND item.deleted_at IS NULL
ON CONFLICT (workspace_id, issue_id, reference_id) DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.save_workspace_reference_revision(target_workspace_id uuid, target_id uuid, target_payload jsonb, expected_revision integer)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text := auth.user_id(); current_row public.workspace_references; saved_row public.workspace_references;
BEGIN
  IF actor IS NULL OR NOT public.can_edit_workspace(target_workspace_id) THEN RAISE EXCEPTION 'Workspace edit access required'; END IF;
  SELECT * INTO current_row FROM public.workspace_references WHERE workspace_id=target_workspace_id AND id=target_id FOR UPDATE;
  IF FOUND AND current_row.revision <> expected_revision THEN RETURN QUERY SELECT false,current_row.revision,current_row.payload,current_row.updated_at,current_row.updated_by; RETURN; END IF;
  IF FOUND THEN UPDATE public.workspace_references SET payload=target_payload,status=coalesce(nullif(target_payload->>'status',''),'active'),revision=revision+1,updated_by=actor,updated_at=now(),deleted_at=NULL WHERE workspace_id=target_workspace_id AND id=target_id RETURNING * INTO saved_row;
  ELSE
    IF expected_revision <> 0 THEN RETURN QUERY SELECT false,0,NULL::jsonb,NULL::timestamptz,NULL::text; RETURN; END IF;
    INSERT INTO public.workspace_references(workspace_id,id,payload,status,created_by,updated_by) VALUES(target_workspace_id,target_id,target_payload,coalesce(nullif(target_payload->>'status',''),'active'),actor,actor) RETURNING * INTO saved_row;
  END IF;
  RETURN QUERY SELECT true,saved_row.revision,saved_row.payload,saved_row.updated_at,saved_row.updated_by;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.save_issue_reference_link_revision(target_workspace_id uuid, target_issue_id uuid, target_id uuid, target_reference_id uuid, target_payload jsonb, expected_revision integer)
RETURNS TABLE(saved boolean, revision integer, payload jsonb, updated_at timestamptz, updated_by text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text := auth.user_id(); current_row public.issue_reference_links; saved_row public.issue_reference_links;
BEGIN
  IF actor IS NULL OR NOT public.can_edit_issue(target_workspace_id,target_issue_id) THEN RAISE EXCEPTION 'Issue edit access required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.workspace_references WHERE workspace_id=target_workspace_id AND id=target_reference_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Reference not available'; END IF;
  SELECT * INTO current_row FROM public.issue_reference_links WHERE workspace_id=target_workspace_id AND id=target_id FOR UPDATE;
  IF FOUND AND current_row.revision <> expected_revision THEN RETURN QUERY SELECT false,current_row.revision,current_row.payload,current_row.updated_at,current_row.updated_by; RETURN; END IF;
  IF FOUND THEN UPDATE public.issue_reference_links SET payload=target_payload,revision=revision+1,updated_by=actor,updated_at=now(),deleted_at=NULL WHERE workspace_id=target_workspace_id AND id=target_id RETURNING * INTO saved_row;
  ELSE INSERT INTO public.issue_reference_links(workspace_id,issue_id,id,reference_id,payload,created_by,updated_by) VALUES(target_workspace_id,target_issue_id,target_id,target_reference_id,target_payload,actor,actor) RETURNING * INTO saved_row; END IF;
  RETURN QUERY SELECT true,saved_row.revision,saved_row.payload,saved_row.updated_at,saved_row.updated_by;
END $$;
--> statement-breakpoint
GRANT SELECT ON public.workspace_references, public.issue_reference_links TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_workspace_reference_revision(uuid,uuid,jsonb,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_issue_reference_link_revision(uuid,uuid,uuid,uuid,jsonb,integer) TO authenticated;
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
