import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const sql = neon(process.env.DATABASE_URL);
const [tables, policies, functions, migrations, workspaces, memberships] = await Promise.all([
  sql`
    SELECT count(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('profiles', 'workspaces', 'workspace_members', 'audit_events', 'cloud_issues', 'cloud_officers', 'cloud_issue_items', 'cloud_workspace_settings', 'cloud_user_settings', 'cloud_notifications', 'automation_runs', 'cloud_ai_provider_settings', 'cloud_ai_user_permissions', 'cloud_ai_generation_logs')
  `,
  sql`SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public'`,
  sql`
    SELECT count(*)::int AS count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'is_platform_admin',
        'is_active_workspace_member',
        'is_workspace_admin',
        'can_edit_workspace',
        'admin_update_profile',
        'ensure_platform_workspace',
        'admin_set_workspace_member',
        'authorize_cloud_ai_request'
      )
  `,
  sql`
    SELECT count(*)::int AS count
    FROM public.swm_migrations
    WHERE name IN (
      '001_identity_and_access.sql',
      '002_workspaces_and_cloud_issues.sql',
      '003_require_active_profile_for_workspace.sql',
      '004_workspace_editor_permissions.sql',
      '005_cloud_officer_directory.sql',
      '006_complete_workspace_sync.sql',
      '007_background_reminders.sql',
      '008_cloud_ai.sql'
    )
  `,
  sql`SELECT count(*)::int AS count FROM public.workspaces WHERE is_active = true`,
  sql`SELECT count(*)::int AS count FROM public.workspace_members WHERE status = 'active'`,
]);

const result = {
  tables: tables[0].count,
  policies: policies[0].count,
  functions: functions[0].count,
  migrationRecords: migrations[0].count,
  activeWorkspaces: workspaces[0].count,
  activeMemberships: memberships[0].count,
};

const expected = { tables: 14, policies: 37, functions: 8, migrationRecords: 8 };
const valid = Object.entries(expected).every(([key, value]) => result[key] === value);

console.log(JSON.stringify(result, null, 2));
if (!valid) throw new Error('Database verification did not match the expected identity schema.');
